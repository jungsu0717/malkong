"""L1 검색 — 질문에 맞는 승인된 L1 항목을 골라 모델에 건넨다.

항목이 수십~수백 건이라 색인 없이 규칙과 글자 겹침으로 고른다
(knowledge-layers 「가져오지 않은 것」 —
벡터 검색은 필요해질 때 다시 본다). 순서:

1. 백신 이름이 나오면 그 백신의 모든 차수(차수가 나오면 그 차수만)
2. 아니면 질문에 나온 월령("6개월", "돌", "다음 접종")이나 아기 월령에 해당하는 항목 가운데,
   질문의 분류 낱말(접종·수유·수면…)에 맞는 것
3. 접종·검진을 물었으면 그 달의 것을 모두, 그 밖에는 질문과 글자가 많이 겹치는 순서로.
   겹침은 L1 전체에서 드문 두 글자 조합만 센다 — "아기", "어요"처럼 어디에나 있는 조합으로는
   고르지 않는다. 발달을 물었으면 그 달 이정표, 다음 이정표, 조기 상담 안내를 늘 함께 건넨다
   ("아직 못 해요" 같은 걱정에 답할 근거)
4. 분류 낱말이 하나도 없으면 고르지 않는다 — 억지로 붙인 근거는 근거가 아니다

모델은 건네받은 id 만 인용할 수 있다(SPEC-ASK-01). 그래서 여기서 빠진 항목은 답의 근거가 될 수 없다.
"""

import re

from app.domain.ask.redflag import is_head_event
from app.domain.knowledge.repository import L1Item

MAX_SNIPPETS = 8
# 이보다 많은 항목에 들어 있는 두 글자 조합은 흔한 말로 보고 점수에서 뺀다
COMMON_BIGRAM_SHARE = 0.1
# 두 글자 조합 두 개는 우연히도 겹친다("머리"+"한쪽") — 셋부터 근거로 본다
MIN_SCORE = 3
ACT_EARLY_ID = "k-dev-0202"
HEAD_ID = "k-warn-0007"

# 질문 속 이름 → 항목 제목에 들어 있는 이름
VACCINE_ALIASES: dict[str, str] = {
    "bcg": "BCG",
    "결핵": "BCG",
    "b형간염": "B형간염",
    "비형간염": "B형간염",
    "dtap": "DTaP",
    "디티에이피": "DTaP",
    "디프테리아": "DTaP",
    "파상풍": "DTaP",
    "백일해": "DTaP",
    "폴리오": "폴리오",
    "소아마비": "폴리오",
    "hib": "Hib",
    "히브": "Hib",
    "뇌수막": "Hib",
    "폐렴구균": "폐렴구균",
    "로타": "로타바이러스",
    "mmr": "MMR",
    "홍역": "MMR",
    "볼거리": "MMR",
    "풍진": "MMR",
    "수두": "수두",
    "a형간염": "A형간염",
    "에이형간염": "A형간염",
    "일본뇌염": "일본뇌염",
    "독감": "인플루엔자",
    "인플루엔자": "인플루엔자",
}

KIND_WORDS: dict[str, str] = {
    # "이유식 양이 맞는지", "질식 예방" 같은 말이 접종으로 잡히지 않게 흔한 동사는 넣지 않는다
    "접종": r"접종|주사|백신|맞혀|맞춰|맞히",
    "검진": r"검진|건강검진",
    "발달": (r"발달|이정표|뒤집|옹알|목가누|앉|기어|걸음|걷|잡고서|웃|낯가림|까꿍|빠이|말하|단어"),
    "수유": (
        r"수유|분유|모유|젖|먹|이유식|우유|꿀|주스|물을|비타민|알레르기|땅콩|달걀|계란|트림|질식"
    ),
    "수면": (
        r"잠|잘때|자요|자는|재우|재워|재울|눕혀|이불|덮|수면|낮잠|밤잠|깨요|깨는|엎드려자|쪽쪽이|공갈"
    ),
    "생활": r"터미타임|엎드려놀|책|노래|말걸|화면|티비|tv|영상|동영상|유튜브",
    "안전": (
        r"카시트|안전|목욕|욕조|흔들|삼켰|삼키|담배|흡연|뜨거|화상|떨어|굴러|낙상|추락|넘어|질식"
    ),
    # 부모 돌봄(task common/013) — "재우기 힘들어요" 같은 흔한 말은 넣지 않는다
    "부모": r"산후|우울|울적|번아웃|지쳤|지쳐|화가나|화나|해치|못달래|안달래",
    "대응": r"열|체온|토|설사|숨|경련|머리|탈수|소변|오줌|기저귀|눈물|처져",
}

# 뜻이 분명한 주제어 — 질문과 항목에 함께 나오면 글자 겹침 점수와 상관없이 근거로 고른다.
# "꿀"처럼 한 글자라 두 글자 조합으로는 잡히지 않는 낱말을 위해 둔다.
# 왼쪽은 질문에 나오는 말, 오른쪽은 항목에 쓰인 말
TOPIC_TERMS: dict[str, str] = {
    "꿀": "꿀",
    "우유": "우유",
    "주스": "주스",
    "이불": "이불",
    "베개": "베개",
    "범퍼": "범퍼",
    "쪽쪽이": "쪽쪽이",
    "공갈": "쪽쪽이",
    "카시트": "카시트",
    "비타민": "비타민",
    "땅콩": "땅콩",
    "달걀": "달걀",
    "계란": "달걀",
    "알레르기": "알레르기",
    "아토피": "아토피",
    "이유식": "이유식",
    "소시지": "소시지",
    "포도": "포도",
    "흔들": "흔들",
    # 안전한 잠자리(k-sleep-0004) — "덥게 입히면", "머리를 덮어 주면"은 두 글자 겹침으로는 안 잡힌다
    "덥게": "덥게",
    "덥지": "덥게",
    "더운": "더운",
    "머리를덮": "머리를 덮",
    "머리덮": "머리를 덮",
    "질식": "질식",
    "담배": "담배",
    "흡연": "담배",
    "목욕": "욕조",
    "욕조": "욕조",
    "터미타임": "터미타임",
    "화면": "화면",
    "영상": "화면",
    "티비": "화면",
    "tv": "화면",
    "유튜브": "화면",
}

_MONTH = re.compile(r"(\d{1,2})개월")
_DOSE = re.compile(r"(\d)차")


def _compact(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())


def _bigrams(text: str) -> set[str]:
    t = re.sub(r"[^0-9a-z가-힣]", "", _compact(text))
    return {t[i : i + 2] for i in range(len(t) - 1)}


def _vaccine_names(q: str) -> set[str]:
    # "a형간염" 안의 "간염" 이 B형으로 잘못 잡히지 않게 별칭에 짧은 "간염" 은 두지 않았다
    return {name for alias, name in VACCINE_ALIASES.items() if alias in q}


def _target_months(q: str, baby_months: int) -> set[int]:
    months = {int(m) for m in _MONTH.findall(q)}
    if "돌" in q and re.search(r"돌(지나|무렵|쯤|때|부터|이후|되|이|에)", q):
        months.add(12)
    if "백일" in q:
        months.add(3)
    if "신생아" in q:
        months.add(0)
    return months or {baby_months}


def _kinds(q: str) -> set[str]:
    return {kind for kind, pattern in KIND_WORDS.items() if re.search(pattern, q)}


def _common_bigrams(items: list[L1Item]) -> set[str]:
    counts: dict[str, int] = {}
    for item in items:
        for bg in _bigrams(item.title + item.body):
            counts[bg] = counts.get(bg, 0) + 1
    limit = max(3, int(len(items) * COMMON_BIGRAM_SHARE))
    return {bg for bg, n in counts.items() if n > limit}


def retrieve(question: str, baby_months: int, items: list[L1Item]) -> list[L1Item]:
    q = _compact(question)

    # 1. 백신 이름 — 그 백신의 모든 차수, 차수가 나오면 그 차수만
    names = _vaccine_names(q)
    if names:
        picked = [i for i in items if i.kind == "접종" and any(n in i.title for n in names)]
        doses = set(_DOSE.findall(q))
        if doses:
            narrowed = [i for i in picked if any(f"{d}차" in i.title for d in doses)]
            picked = narrowed or picked
        return sorted(picked, key=lambda i: (i.start, i.id))[:MAX_SNIPPETS]

    # 머리를 부딪혔다는 말이 있으면 위험 징후 항목을 꼭 건넨다 — 모델이 살펴볼 징후를 안내하게
    head = [i for i in items if i.id == HEAD_ID] if is_head_event(question) else []

    kinds = _kinds(q)
    if not kinds:
        return head
    months = _target_months(q, baby_months)
    mentioned = {int(m) for m in _MONTH.findall(q)}

    # 2. "다음 접종·검진" — 지금(또는 말한 달) 다음에 시작하는 가장 가까운 달
    if "다음" in q and kinds & {"접종", "검진"}:
        now = max(mentioned) if mentioned else baby_months
        starts = sorted(
            {i.start for i in items if i.kind in kinds & {"접종", "검진"} and i.start > now}
        )
        if starts:
            months = {starts[0]}

    candidates = [i for i in items if set(i.months) & months and i.kind in kinds]

    # 3. 접종·검진을 물었으면 그 달의 일정을 빠짐없이 — 그달에 시작하는 것을 먼저.
    #    다른 분류도 함께 물었으면 아래 점수 결과와 합친다
    schedule = sorted(
        (i for i in candidates if i.kind in {"접종", "검진"}),
        key=lambda i: (i.start not in months, i.start, i.id),
    )
    if schedule and kinds <= {"접종", "검진"}:
        return schedule[:MAX_SNIPPETS]
    candidates = [i for i in candidates if i not in schedule]

    # 발달 걱정 — 그 달 이정표 + 다음 이정표 + 조기 상담 안내
    development: list[L1Item] = []
    if "발달" in kinds:
        milestones = sorted(
            (i for i in items if i.kind == "발달" and i.id != ACT_EARLY_ID), key=lambda i: i.start
        )
        now = max(months)
        current = [i for i in milestones if now in i.months]
        upcoming = [i for i in milestones if i.start > now][:1]
        act_early = [i for i in items if i.id == ACT_EARLY_ID and set(i.months) & months]
        development = current + upcoming + act_early

    # 그 밖에는 드문 글자 조합이 많이 겹치는 순서로, 겹침이 모자라면 버린다
    rare = _bigrams(question) - _common_bigrams(items)
    topics = {term for word, term in TOPIC_TERMS.items() if word in q}
    # 주제어가 맞는 항목은 월령이 달라도 고른다 —
    # "곧 이유식 하는데 땅콩은요?" 처럼 다가올 달을 묻기도 한다
    if topics:
        candidates += [
            i
            for i in items
            if i.kind in kinds
            and i not in candidates
            and any(t in i.title + i.body for t in topics)
        ]

    def score(item: L1Item) -> int:
        text = item.title + item.body
        if any(term in text for term in topics):
            return MIN_SCORE + len(rare & _bigrams(text))
        return len(rare & _bigrams(text))

    scored = [(score(i), i) for i in candidates]
    ranked = [
        i for score, i in sorted(scored, key=lambda s: (-s[0], s[1].id)) if score >= MIN_SCORE
    ]

    picked: list[L1Item] = []
    for item in [*head, *schedule, *development, *ranked]:
        if item not in picked:
            picked.append(item)
    return picked[:MAX_SNIPPETS]
