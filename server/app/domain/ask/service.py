"""ask 서비스 — 질문에 어떤 답을 낼지 정한다 (backend 「LLM 파이프라인 — 질문 라우팅」).

① 위험 신호 규칙 → (② 캐시는 뒤 task) → ③ 모델. 모델 길은 L1 검색 → 프롬프트 → 모델 → 검사다.
검사에 걸리면 한 번 다시 생성하고, 그래도 걸리면 안전한 쪽으로 끝낸다
(판단 답의 안심 표현은 진료 권유 고정 문장, 그 밖에는 503).
질문 원문과 기록, 모델 출력은 로그에 남기지 않는다(server/AGENTS.md 「금지」).
"""

import logging
import re
from http import HTTPStatus

import anthropic
import httpx
from google.genai import errors as genai_errors
from pydantic import ValidationError

from app.common.core.exception import ApiException
from app.common.core.setting import Settings
from app.domain.ask import redflag
from app.domain.ask.cache import ResponseCache
from app.domain.ask.prompt import (
    MODEL_OUTPUT_SCHEMA,
    RED_FLAG_IDS,
    SYSTEM_PROMPT,
    BabyRecordLine,
    L1Snippet,
    ModelOutput,
    build_user_message,
)
from app.domain.ask.retrieval import retrieve
from app.domain.ask.schema import (
    AnswerResponse,
    AskRequest,
    AskResponse,
    Followup,
    FollowupResponse,
    RecordSuggestion,
    RedflagResponse,
    Source,
    Usage,
)
from app.domain.entitlements.service import EntitlementsService
from app.domain.knowledge.repository import L1Item, L1Repository
from app.infra.llm.base import LlmClient, LlmError, LlmRequest, LlmUnavailable

logger = logging.getLogger("uvicorn.error")

# 처음 한 번 + 검사에 걸렸을 때 다시 한 번
MAX_ATTEMPTS = 2

# 모델이 답하지 못한 것으로 보는 예외 — 거절·잘린 출력·형식 오류(LlmError), 각 SDK 의 API 오류,
# 네트워크·시간 초과. 그 밖의 예외(우리 코드의 버그)는 잡지 않고 500 으로 흘려 traceback 을 남긴다
MODEL_FAILURES = (
    LlmError,
    ValidationError,
    genai_errors.APIError,
    anthropic.APIError,
    httpx.HTTPError,
    TimeoutError,
)

# 판단 수위 답에 남아서는 안 되는 안심 표현 — decisions/008 「남은 약점」
REASSURANCE = re.compile(
    r"걱정\s*(하지|마|안\s*하셔도|않으셔도)|괜찮을\s*(거|것)|괜찮아요|괜찮습니다|"
    # "아기마다 차이가 있어요"는 판정이 아니라 사실이라 잡지 않는다(task ask/004)
    r"정상(이에요|입니다|이니|일\s*거)|문제\s*(없|가\s*없)"
)

RETRY_NOTES = {
    "fact": "\n\n(다시 답하기: 직전 답은 사실 수위인데 주어진 표준 지식의 id 를 인용하지 않았다. "
    "주어진 id 만 citedIds 에 넣거나, 근거가 없으면 일반 수위로 답한다.)",
    "judgment": "\n\n(다시 답하기: 직전 답은 판단 수위인데 안심시키는 표현이 들어 있었다. "
    "괜찮다·정상이다·걱정 말라는 말 없이, "
    "이 월령에 흔한 모습과 살펴볼 점, 진료가 필요한 기준을 말한다.)",
    "followup": "\n\n(다시 답하기: 되묻기에는 followup.question, 선택지 2~4개, recordLabel 이 "
    "모두 있어야 한다.)",
    "no_followup": "\n\n(다시 답하기: 이번에는 되묻지 않는다. type 을 answer 로 하고 월령 기준 "
    "일반 정보로 답한다.)",
    "empty": "\n\n(다시 답하기: answer 가 비어 있었다. 질문에 답하는 문장을 쓴다.)",
    "broken": "",
}

# 무료 티어·절약 모드에서는 기록을 보내지 않으므로, 되묻기 표대로 물으면 칩으로 답해도 같은 질문을
# 다시 묻게 된다(SPEC-ASK-03 재질문 금지). 그래서 되묻지 말고 일반 기준으로 답하라고 처음부터 알린다
ECO_NOTE = (
    "\n\n(이 답은 우리 아기 기록 없이 일반 기준으로 한다. 기록이 없어도 되묻지 말고 "
    "type 을 answer 로 해서 월령 기준으로 답한다.)"
)

DONT_KNOW = "잘 모르겠어요"
JUDGMENT_FALLBACK = (
    "아기 상태를 버디가 판단해 드릴 수는 없어요. 걱정되는 모습이 이어지면 "
    "소아청소년과에서 진료를 받아 보세요."
)
GENERAL_PREFIX = "일반적으로는, "

# 답을 만드는 동안의 자리 값 — ask() 가 사용량을 센 뒤 실제 남은 수로 바꾼다
PENDING_USAGE = Usage(remaining=None)

REDFLAG_HEAD = "말씀하신 내용에 바로 진료가 필요할 수 있는 신호가 있어요."
REDFLAG_TAIL = (
    "증상이 심하거나 아기가 반응이 없으면 바로 119 에 전화하세요. "
    "그렇지 않더라도 지금 소아청소년과나 응급실에서 진료를 받으세요."
)


class AskService:
    def __init__(
        self,
        l1: L1Repository,
        llm: LlmClient | None,
        settings: Settings,
        usage: EntitlementsService,
        cache: ResponseCache,
    ) -> None:
        self._l1 = l1
        self._llm = llm
        self._settings = settings
        self._usage = usage
        self._cache = cache

    def ask(self, req: AskRequest, device_key: str | None) -> AskResponse:
        # ① 위험 신호 — 모델을 부르지 않는다(SPEC-ASK-02). 키·한도와 상관없이 언제나 나간다
        hits = redflag.detect(req.question, req.baby.months)
        if hits:
            return self._redflag([h.l1_id for h in hits])

        device = self._usage.device(device_key)
        # 같은 clientMessageId 의 재요청 — 새로 만들지 않고 같은 응답(api-contract 재시도 안전)
        cached = self._cache.get(device.key_hash, req.client_message_id)
        if cached is not None:
            return cached
        # 절약 모드 요청은 한도와 상관없다. 정밀 답변 요청만 다 썼는지 본다
        precise = req.mode != "eco"
        if precise:
            self._usage.ensure_can_answer(device)

        response = self._model_answer(req)
        if isinstance(response, AnswerResponse):
            remaining = (
                self._usage.record_answer(device, req.client_message_id)
                if precise
                else self._usage.remaining(device)
            )
            response = response.model_copy(update={"usage": Usage(remaining=remaining)})
        self._cache.put(device.key_hash, req.client_message_id, response)
        return response

    def _model_answer(self, req: AskRequest) -> AskResponse:
        # ③ 모델
        if self._llm is None:
            raise ApiException(
                HTTPStatus.SERVICE_UNAVAILABLE, "MODEL_UNAVAILABLE", "답변 모델이 연결되지 않았어요"
            )
        # 무료 티어나 절약 모드에서는 아기 기록을 보내지 않는다
        eco = req.mode == "eco" or not self._settings.llm_paid_tier
        records = [] if eco else [BabyRecordLine(r.kind, r.label) for r in req.baby.records]
        items = retrieve(req.question, req.baby.months, self._l1.approved())
        snippets = [L1Snippet(i.id, i.title, i.body, i.source_name) for i in items]
        user = build_user_message(req.question, req.baby.months, records, snippets)
        if eco:
            user += ECO_NOTE
        return self._answer(user, {i.id: i for i in items}, eco, req.baby.months)

    def _redflag(self, ids: list[str]) -> RedflagResponse:
        items = [item for i in ids if (item := self._l1.get(i)) is not None]
        parts = [REDFLAG_HEAD, *(f"{i.title}\n{i.body}" for i in items), REDFLAG_TAIL]
        return RedflagResponse(answer="\n\n".join(parts), sources=[_source(i) for i in items])

    def _answer(self, user: str, given: dict[str, L1Item], eco: bool, months: int) -> AskResponse:
        note = ""
        last_problem = ""
        for _ in range(MAX_ATTEMPTS):
            out = self._generate(user + note)
            problem, response = self._check(out, given, eco, months)
            if response is not None:
                return response
            last_problem = problem
            note = RETRY_NOTES[problem]

        if last_problem == "judgment":
            # 마지막까지 안심 표현을 지우지 못했으면 판단하지 않는 고정 문장으로 끝낸다
            return AnswerResponse(
                answer=JUDGMENT_FALLBACK, level="판단", usage=PENDING_USAGE, eco=eco
            )
        raise ApiException(
            HTTPStatus.SERVICE_UNAVAILABLE, "MODEL_UNAVAILABLE", "답변을 만들지 못했어요"
        )

    def _check(
        self, out: ModelOutput | None, given: dict[str, L1Item], eco: bool, months: int
    ) -> tuple[str, AskResponse | None]:
        """모델 출력을 검사한다. 통과하면 (\"\", 응답), 걸리면 (문제 이름, None)."""
        if out is None:
            return "broken", None

        # 두 번째 겹 — 규칙이 놓친 위험 신호를 모델이 표시했으면
        # 그 답은 버리고 고정 응급 안내를 낸다
        # (decisions/010). 3개월 미만의 열(k-warn-0001)은 월령이 맞을 때만 받는다
        flag = out.red_flag
        if flag in RED_FLAG_IDS and not (flag == "k-warn-0001" and months >= 3):
            return "", self._redflag([flag])

        if out.type == "followup":
            if eco:
                return "no_followup", None
            followup = _clean_followup(out)
            if followup is None:
                return "followup", None
            return "", FollowupResponse(followup=followup)

        if not out.answer.strip():
            return "empty", None
        # 건네지 않은 id 는 지어낸 것이다 — 버린다(api-contract)
        cited = [given[i] for i in dict.fromkeys(out.cited_ids) if i in given]
        if out.level == "사실" and not cited:
            return "fact", None
        if out.level == "판단" and REASSURANCE.search(out.answer):
            return "judgment", None
        return "", self._to_answer(out, cited, eco)

    def _generate(self, user: str) -> ModelOutput | None:
        assert self._llm is not None
        request = LlmRequest(system=SYSTEM_PROMPT, user=user, schema=MODEL_OUTPUT_SCHEMA)
        try:
            return ModelOutput.model_validate(self._llm.generate(request).data)
        except LlmUnavailable as exc:
            # 요금·호출 한도나 키 문제 — 다시 불러도 같다. 기다리게 하지 않고 바로 알린다
            logger.warning("ask: 모델 회사가 요청을 받지 않음 (%s)", exc)
            raise ApiException(
                HTTPStatus.SERVICE_UNAVAILABLE,
                "MODEL_UNAVAILABLE",
                "지금은 답변을 만들 수 없어요. 잠시 뒤 다시 물어봐 주세요",
            ) from exc
        except MODEL_FAILURES as exc:
            # 예외 종류만 남긴다 — 메시지에 모델 출력이나 질문이 섞일 수 있다
            logger.warning("ask: 모델이 답하지 못함 (%s)", type(exc).__name__)
            return None

    def _to_answer(self, out: ModelOutput, cited: list[L1Item], eco: bool) -> AnswerResponse:
        answer = out.answer.strip()
        # 근거 없는 일반 답은 그렇다고 밝힌다(SPEC-ASK-08) — 모델이 빠뜨렸으면 서버가 붙인다
        if out.level == "일반" and not cited and "일반적" not in answer:
            answer = GENERAL_PREFIX + answer
        return AnswerResponse(
            answer=answer,
            level=out.level,
            sources=[_source(i) for i in cited],
            records=[
                RecordSuggestion(kind=r.kind, label=r.label.strip())
                for r in out.records
                if r.label.strip()
            ],
            usage=PENDING_USAGE,
            eco=eco,
        )


def _clean_followup(out: ModelOutput) -> Followup | None:
    """되묻기를 다듬는다. 질문·기록 이름이 비었거나 선택지가 모자라면 None (SPEC-ASK-03·04)."""
    question = out.followup.question.strip()
    label = out.followup.record_label.strip()
    chips = [c.strip() for c in out.followup.chips if c.strip()]
    # "잘 모르겠어요"는 언제나 고를 수 있어야 한다 — 없으면 끝에 붙인다
    if DONT_KNOW not in chips:
        chips = [*chips[:3], DONT_KNOW]
    if not question or not label or not 2 <= len(chips) <= 4:
        return None
    return Followup(question=question, chips=chips, record_label=label)


def _source(item: L1Item) -> Source:
    return Source(id=item.id, name=item.source_name, url=item.source_url)
