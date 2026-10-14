"""POST /v1/feedback — 답변 피드백. /v1 은 main.py 가 붙인다."""

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response

from app.common.core.exception import ErrorBody
from app.common.core.setting import get_settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.domain.feedback.schema import FeedbackRequest
from app.domain.feedback.service import FeedbackService
from app.infra.db.feedback_store import MemoryFeedbackStore, PostgresFeedbackStore

router = APIRouter(tags=["feedback"])
logger = logging.getLogger("uvicorn.error")


@lru_cache
def get_feedback_service() -> FeedbackService:
    url = get_settings().database_url
    if url:
        try:
            return FeedbackService(PostgresFeedbackStore(url.get_secret_value()))
        except Exception as exc:
            logger.error("feedback: 저장소에 닿지 못해 메모리로 돈다 (%s)", type(exc).__name__)
    return FeedbackService(MemoryFeedbackStore())


@router.post(
    "/feedback",
    summary="답변 피드백",
    status_code=204,
    responses={401: {"model": ErrorBody}, 422: {"model": ErrorBody}, 429: {"model": ErrorBody}},
)
def feedback(
    req: FeedbackRequest,
    service: Annotated[FeedbackService, Depends(get_feedback_service)],
    usage: Annotated[EntitlementsService, Depends(get_entitlements_service)],
    x_device_key: Annotated[str | None, Header()] = None,
) -> Response:
    # 키는 남용을 막는 데만 쓰고 피드백과 함께 저장하지 않는다
    device = usage.device(x_device_key)
    service.save(device, req, usage.today())
    return Response(status_code=204)
