"""ask 요청과 응답 모형 — docs/architecture/api-contract.md 「POST /v1/ask」를 그대로 옮긴다."""

from typing import Annotated, Literal

from pydantic import Field, model_validator

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
    # 오늘 남은 정밀 답변 수. 운영자(가족) 기기는 null(무제한)
    remaining: int | None


Level = Literal["사실", "일반", "판단"]


class AnswerResponse(ApiModel):
    type: Literal["answer"] = "answer"
    answer: str
    # 답변 수위(SPEC-ASK-08). 앱은 sources 가 비면 "공공 지식 근거 없음 · 일반 정보"를 표시한다
    level: Level
    sources: list[Source] = []
    records: list[RecordSuggestion] = []
    usage: Usage
    eco: bool = False

    @model_validator(mode="after")
    def _fact_needs_sources(self) -> "AnswerResponse":
        # 근거 없는 답을 근거 있는 척 내보내지 않는다(constitution 1) — 사실 답은 반드시 출처가 있다
        if self.level == "사실" and not self.sources:
            raise ValueError("사실 수위 답에는 sources 가 있어야 한다")
        return self


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
