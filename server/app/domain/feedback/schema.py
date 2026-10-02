"""답변 피드백 요청 — docs/architecture/api-contract.md 「POST /v1/feedback」."""

from typing import Literal

from pydantic import Field

from app.common.core.schema import ApiModel, NonEmptyStr
from app.domain.ask.schema import Level


class AnswerInfo(ApiModel):
    """서버는 답을 저장하지 않으므로, 품질을 고치는 데 쓸 정보를 앱이 함께 보낸다."""

    level: Level | None = None
    source_ids: list[str] = Field(default=[], max_length=20)
    eco: bool = False


class SharedText(ApiModel):
    """사용자가 「질문과 답도 함께 보내기」를 골랐을 때만 온다."""

    question: str | None = Field(default=None, max_length=2000)
    answer: str | None = Field(default=None, max_length=4000)


class FeedbackRequest(ApiModel):
    answer_id: NonEmptyStr = Field(max_length=100)
    rating: Literal["up", "down"]
    comment: str | None = Field(default=None, max_length=500)
    answer: AnswerInfo = AnswerInfo()
    shared: SharedText | None = None
