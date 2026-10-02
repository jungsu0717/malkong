"""위험 신호 규칙 필터 — 모델에 닿기 전에 질문 글만 보고 병원·119 안내로 돌린다 (SPEC-ASK-02).

위험 신호 판별은 모델에 맡기지 않는다(backend 라우팅 ①). 범주와 기준 수치의 정본은
L1 의 red_flag 항목(`대응` 분류, k-warn-*)이고, 범주 ↔ 항목 표는 docs/menu-spec/ask.md
「위험 신호 사전」에 있다. 여기는 "어떤 말이 어느 범주인가"(문장 매칭 규칙)만 정한다.
잡아야 할 말과 잡으면 안 되는 말의 표는 tests/test_redflag.py — 규칙을 고치면 표부터 고친다.

규칙의 태도:
- 놓치는 쪽보다 더 잡는 쪽으로 기운다. 잘못 잡으면 진료 권유로 끝나지만, 놓치면 위험하다
- 기준 수치는 L1 항목 그대로다(3개월 미만 38°C · 40°C · 38.9°C(102°F) · 2일). 40°C 는
  "넘는"을 넘어 40°C 그 자체부터 잡는다 — 경계에서는 잡는 쪽이다
- 증상이 없다는 말("경련은 없었어요")에는 걸리지 않는다. 그러나 증상이 멈추지 않는다는 말
  ("경련이 멈추지 않아요")은 부정이 아니라 증상이 계속된다는 뜻이다 — 둘을 가른다
- 부정은 그 낱말이 든 구절 안에서만 본다.
  "경련을 했는데 열은 없어요"의 "없어요"는 경련을 지우지 않는다
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class RedflagHit:
    l1_id: str
    # 어느 규칙이 걸렸는지 — 시험과 검토용. 질문 원문은 남기지 않는다
    rule: str


# --- 글 다듬기 -------------------------------------------------------------


def _compact(text: str) -> str:
    """띄어쓰기는 사람마다 달라서("숨 쉬기"/"숨쉬기") 지우고 본다. "38,5" 는 "38.5" 로."""
    text = re.sub(r"(\d),(\d)", r"\1.\2", text.lower())
    return re.sub(r"\s+", "", text)


# --- 부정 판단 -------------------------------------------------------------

# 구절이 끝나는 자리 — 부정은 이 앞까지만 본다
_CLAUSE_END = re.compile(
    r"는데|은데|인데|지만|면서|니까|어서|아서|해서|더니|다가|고서|나서|했고|하고|이고|[,.?!]"
)
# 증상이 없다는 말
_NEGATION = re.compile(r"없|않|안나(?!아)|안났|아니|안해|안했|안하|안보|전혀|하나도")
# 증상이 멈추지·나아지지 않는다는 말 — 부정이 아니라 증상이 계속된다는 뜻
_PERSISTS = re.compile(
    r"(안|못)(멈|끝|떨어|내려|내리|나아|일어|깨|그치|그쳐|가라앉|잡히|돌아)"
    r"|(멈추|끝나|떨어지|내리|내려가|나아지|일어나|깨|그치|가라앉|잡히|좋아지)지(는|도|가)?(않|못|안)"
)


def _negated(after: str) -> bool:
    """걸린 낱말 바로 뒤가 '없다'는 뜻인가."""
    if _PERSISTS.search(after[:12]):
        return False
    window = after[:8]
    end = _CLAUSE_END.search(window)
    if end:
        window = window[: end.start()]
    return bool(_NEGATION.search(window))


def _found(pattern: str, text: str) -> bool:
    """패턴이 '없다'는 뜻 없이 한 번이라도 나오는가."""
    return any(not _negated(text[m.end() :]) for m in re.finditer(pattern, text))


# --- 숫자 읽기 -------------------------------------------------------------

_NUMBER = re.compile(r"(?<![\d.])(\d{2,3}(?:\.\d{1,2})?)")
# 체온이 아닌 숫자 — 키·양·주수·날짜·시간·횟수
_NOT_TEMPERATURE = re.compile(
    r"^(cm|mm|ml|kg|g|cc|oz|주|일|개월|달|시간|분|번|회|%|살|세|미리|키로|그램|센치|센티|온스|개|명|등)"
)
_TEMPERATURE_UNIT = re.compile(r"^(도|℃|°c|°f|°|c(?![a-z]))")
_ABOVE = re.compile(r"^(도|℃|°c|°f|°)?(넘|이상|초과)")
# 체온이 아닌 온도의 문맥 — 분유 물, 목욕물, 방 온도
_ENVIRONMENT = re.compile(r"물|온도|습도|실내|목욕|분유|기온|날씨|에어컨|보일러|방")
_BODY_HEAT = re.compile(r"체온|열")


def _temperatures(text: str) -> list[float]:
    """글에 적힌 체온(°C). 화씨로 적었으면 바꾼다. "N도 넘어요"는 N 보다 조금 높게 본다."""
    temps = []
    for m in _NUMBER.finditer(text):
        raw = m.group(1)
        after = text[m.end() : m.end() + 4]
        before = text[max(0, m.start() - 8) : m.start()]
        if _NOT_TEMPERATURE.match(after):
            continue
        has_unit = bool(_TEMPERATURE_UNIT.match(after))
        near_fever = bool(re.search(r"(체온|열)(이|은|가|도|는)?$", before))
        # 단위 없는 정수("38번", "39개월")는 체온·열 바로 뒤에 올 때만 체온으로 본다
        if not (has_unit or "." in raw or near_fever):
            continue
        if _ENVIRONMENT.search(before) and not _BODY_HEAT.search(before):
            continue
        value = float(raw)
        if 95.0 <= value <= 110.0:  # 화씨
            value = (value - 32.0) * 5.0 / 9.0
        if not 34.0 <= value <= 43.0:
            continue
        if _ABOVE.match(after):
            value += 0.01
        temps.append(round(value, 2))
    return temps


_KOREAN_DAYS = {
    "이틀": 2,
    "사흘": 3,
    "나흘": 4,
    "닷새": 5,
    "엿새": 6,
    "일주일": 7,
    "한주": 7,
    "며칠": 3,
}
_SPAN = r"(째|동안|넘|이상|간|연속|내내|지나)"


def _days(text: str) -> float:
    """이어진 기간의 날 수. "이틀 전에" 처럼 이어지지 않은 때는 세지 않는다."""
    days = [float(n) for n, _ in re.findall(rf"(\d+)일{_SPAN}", text)]
    words = "|".join(_KOREAN_DAYS)
    days += [_KOREAN_DAYS[w] for w, _ in re.findall(rf"({words}){_SPAN}", text)]
    days += [int(h) / 24 for h, _ in re.findall(rf"(\d+)시간{_SPAN}", text)]
    if re.search(r"그저께부터|그제부터", text):
        days.append(2.0)
    return max(days, default=0.0)


# --- 범주별 문장 -----------------------------------------------------------

FEVER = (
    r"열(이|나|났|있|올|감|높|날)|발열|고열|미열|불덩이"
    r"|(이마|몸|머리|배|등|목)(이|가)?.{0,3}(뜨거|뜨끈|화끈)"
)
ANTIPYRETIC = r"해열제|타이레놀|챔프|부루펜|맥시부펜|세토펜|이부프로펜|아세트아미노펜|덱시부프로펜"
ANTIPYRETIC_FAIL = (
    rf"({ANTIPYRETIC}).{{0,14}}"
    r"(안떨어|안내려|그대로|소용없|효과(가|는)?없|안들|안듣|떨어지지(는|도)?않|내리지(는|도)?않"
    r"|계속(나|올|높|있|열))"
)
COMES_BACK = r"(나아지|나아졌|좋아지|좋아졌|내렸|떨어졌).{0,8}(다시|또|더)(심해|올라|나|오|열|높)"
BREATHING = (
    r"숨(을|이)?.{0,2}(빨리|빠르|빨라|가쁘|가빠|힘들|헐떡|못쉬|막히|차)"
    r"|숨(이|을)?.{0,2}(멈|안쉬|쉬지(는|도)?않)|무호흡"
    r"|호흡(이)?.{0,4}(곤란|힘들|가쁘|가빠|빠르|빨라|거칠)"
    r"|헉헉|할딱|몰아쉬|헐떡"
    r"|(갈비뼈|가슴|명치|쇄골).{0,6}(들어가|움푹|쑥|쏙)"
    r"|청색"
    r"|(입술|얼굴|입주변|입주위|입가|손톱).{0,3}(파래|퍼래|퍼레|파랗|퍼렇|보라|새파|시퍼)"
)
SEIZURE = (
    r"경련|발작|열경기|경기(를|해|했|하|가|일으|같)"
    r"|눈(이|을)?.{0,3}(돌아|뒤집|까뒤집)"
    r"|몸(이)?.{0,3}(굳|뻣뻣)"
    r"|(부들|바들|덜덜).{0,3}떨|팔다리.{0,4}떨|사지.{0,3}떨"
    r"|입에거품|거품(을)?물"
)
UNRESPONSIVE = (
    r"반응(이|을)?.{0,3}(없|안|않|둔|느리|느려|떨어)"
    r"|깨워도.{0,6}(안|못|않|반응없)"
    r"|불러도.{0,6}(대답|반응|쳐다).{0,3}(없|안|않)"
    r"|의식(이|을)?.{0,3}(없|흐|잃|떨어)|정신(을|이)?.{0,3}(잃|못차|없|나갔)|기절|실신"
    r"|축.{0,2}(처|쳐|늘어)"
    r"|(?<!간격이)(?<!간격)(?<!텀이)(?<!시간이)(?<!양이)늘어(져|졌|지)"
    r"|(?<!기분이)(?<!눈이)(?<!가슴이)(처져|쳐져|처졌|쳐졌)"
    r"|멍하(니|게)"
)
DEHYDRATION = (
    r"(소변|오줌|쉬야|쉬)(을|를|이|가)?.{0,8}(안|못)(봐|봤|누|눴|싸|쌌|나와|나|해|했)"
    r"|(소변|오줌)(을|를)?(보|누|싸)지(는|도)?않"
    r"|(소변|오줌)(이|가)?.{0,2}없"
    r"|기저귀(가)?.{0,8}(말라|말랐|안젖|젖지(는|도)?않|뽀송|그대로|깨끗)"
    r"|눈물(이)?.{0,3}(안나|없|안흘|나지(는|도)?않)"
    r"|입(?!술)(안|속)?(이)?.{0,3}(바짝|바싹)?(말라|말랐|마른|마르)"
    r"|탈수"
)
HEAD_EVENT = (
    r"(머리|이마|뒤통수|얼굴)(를|가|을)?.{0,4}(박|부딪|찧|쿵|다쳤|찍)"
    r"|(침대|소파|쇼파|의자|계단|아기띠|유모차|식탁|책상|높은곳|높은데|기저귀갈이대|보행기|카시트"
    r"|미끄럼틀|범보|바운서|품)(에서|서)?.{0,6}(떨어|굴러|넘어)"
    r"|떨어뜨|낙상|추락"
)
HEAD_DANGER = (
    r"(?<!마)토(했|해|를|하|가|나)|구토|게워|토.{0,3}번"
    r"|계속.{0,2}울|안달래|달래지지|달래도.{0,4}(안|못|계속)|그치지(를)?않"
    r"|(젖|분유|밥|우유|이유식|맘마)(을|를)?.{0,3}(안|못)(먹|빨)|먹지(를|도)?않"
    r"|처져|쳐져|처지|늘어|보채|칭얼|졸려|자려고만"
    r"|깨워도.{0,6}(안|못|않)|기절|정신(을|이)?.{0,3}(잃|못차|없)|의식(을|이)?.{0,3}(잃|없|흐)"
    r"|경련|발작"
    r"|한쪽.{0,6}(눈동자|동공)|(눈동자|동공).{0,8}(달라|다르|짝짝|차이)|안절부절"
)
GI = r"설사|구토|장염|물똥|물설사|묽은변|게워|올려|(?<!마)토(를|해|했|하|가|나)"
BLOODY = (
    r"혈변|혈뇨|피똥|핏줄"
    r"|(변|똥|대변|소변|오줌|설사|기저귀)(에|이|가|에서|에도)?.{0,4}(피(?!곤|부)|빨개|빨갛|붉어|붉은)"
    r"|피(가)?.{0,3}(섞인|섞여|묻은|묻어|나와).{0,4}(변|똥|대변|소변|오줌)"
)
# 용혈성요독증후군(HUS) 징후 — L1 k-warn-0008 이 대장균 감염의 설사와 함께 든 것
HUS = (
    r"창백|하얘|핏기|분홍빛|멍(이|들)|(붉은|빨간)점|발진"
    r"|소변.{0,3}(진해|진하)|진한소변|(심한|엄청)갈증|물을.{0,3}(계속|자꾸)찾"
)


def detect(question: str, months: int) -> list[RedflagHit]:
    """걸린 범주의 L1 항목. 비어 있으면 위험 신호가 아니다(모델로 넘긴다)."""
    text = _compact(question)
    temps = _temperatures(text)
    max_temp = max(temps) if temps else 0.0
    hits: dict[str, str] = {}

    def hit(l1_id: str, rule: str) -> None:
        hits.setdefault(l1_id, rule)

    # k-warn-0001 — 3개월 미만의 열. 38°C 이상이 적혀 있거나 "열"이라는 말만 있어도 잡는다
    if months < 3 and (max_temp >= 38.0 or _found(FEVER, text)):
        hit("k-warn-0001", "3개월 미만 열")

    # k-warn-0002 — 40°C 넘는 열 · 해열제가 듣지 않는 열 · 나아지다 다시 오는 열·기침
    if max_temp >= 40.0:
        hit("k-warn-0002", "40도 이상")
    if _found(ANTIPYRETIC_FAIL, text):
        hit("k-warn-0002", "해열제가 듣지 않음")
    if _found(COMES_BACK, text) and re.search(r"열|기침|감기", text):
        hit("k-warn-0002", "나아지다 다시 옴")

    if _found(BREATHING, text):
        hit("k-warn-0003", "호흡곤란·청색증")
    if _found(SEIZURE, text):
        hit("k-warn-0004", "경련")
    if _found(UNRESPONSIVE, text):
        hit("k-warn-0005", "반응 없음")
    if _found(DEHYDRATION, text):
        hit("k-warn-0006", "탈수")

    # k-warn-0007 — 머리를 부딪히거나 떨어진 뒤의 위험 징후.
    # 부딪힌 것만으로는 걸지 않고, 징후가 없으면 L1 검색이 이 항목을 건네 모델이 징후를 안내한다
    if _found(HEAD_EVENT, text) and _found(HEAD_DANGER, text):
        hit("k-warn-0007", "머리 부딪힘 뒤 위험 징후")

    # k-warn-0008 — 피 섞인 변·소변 · 구토·설사 2일 넘게 · 구토·설사와 38.9°C · HUS 징후
    if _found(BLOODY, text):
        hit("k-warn-0008", "피 섞인 변·소변")
    if _found(GI, text):
        if _days(text) >= 2:
            hit("k-warn-0008", "구토·설사 2일 넘게")
        if max_temp >= 38.9:
            hit("k-warn-0008", "구토·설사와 38.9도 넘는 열")
        if _found(HUS, text):
            hit("k-warn-0008", "구토·설사와 HUS 징후")

    return [RedflagHit(l1_id, rule) for l1_id, rule in sorted(hits.items())]


def is_head_event(question: str) -> bool:
    """머리를 부딪히거나 떨어졌다는 말.

    위험 징후가 없어도 L1 검색이 k-warn-0007 을 함께 건네게 한다.
    """
    return _found(HEAD_EVENT, _compact(question))
