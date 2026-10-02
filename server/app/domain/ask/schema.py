"""ask 요청과 응답 모형 — docs/architecture/api-contract.md 「POST /v1/ask」를 그대로 옮긴다."""

from typing import Annotated, Literal

from pydantic import Field

from app.common.core.schema import ApiModel, NonEmptyStr

# --- 요청 ---


class BabyRecordIn(ApiModel):
    kind: Literal["기록", "요약"]
    label: NonEmptyStr


class BabyContext(ApiModel):
    months: int = Field(ge=0)
    records: list[BabyRecordIn] = []


class AskRequest(ApiModel):
    question: NonEmptyStr
    baby: BabyContext
    client_message_id: NonEmptyStr
    # "eco" 면 L2 기록 없이 일반 기준으로 답한다(backend 일일 한도 절)
    mode: Literal["eco"] | None = None


# --- 응답 — type 으로 갈린다 ---


class Source(ApiModel):
    # 근거가 된 L1 항목 id
    id: str
    name: str
    url: str


class RecordSuggestion(ApiModel):
    """답변에 붙는 저장 제안. 저장은 기기가 한다 — 서버는 아기 데이터를 갖지 않는다."""

    kind: Literal["기록", "요약"]
    label: str
    # 이 기록이 완료 처리하는 L1 항목 id
    covers: list[str] | None = None


class Usage(ApiModel):
    remaining: int


class AnswerResponse(ApiModel):
    type: Literal["answer"] = "answer"
    answer: str
    # 근거 없는 답변은 내보내지 않는다 — 비어 있으면 모형을 만드는 단계에서 막힌다
    sources: list[Source] = Field(min_length=1)
    records: list[RecordSuggestion] = []
    usage: Usage
    eco: bool = False


class Followup(ApiModel):
    question: str
    chips: list[str]
    record_label: str


class FollowupResponse(ApiModel):
    type: Literal["followup"] = "followup"
    followup: Followup


class RedflagResponse(ApiModel):
    """위험 신호 고정 응답 — LLM 을 부르지 않는다(SPEC-ASK-02)."""

    type: Literal["redflag"] = "redflag"
    answer: str
    sources: list[Source]


AskResponse = Annotated[
    AnswerResponse | FollowupResponse | RedflagResponse, Field(discriminator="type")
]
