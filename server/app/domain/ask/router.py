"""POST /v1/ask — 요청을 받아 AskService 에 넘기기만 한다. /v1 은 main.py 가 붙인다."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.common.core.exception import ErrorBody
from app.domain.ask.schema import AskRequest, AskResponse
from app.domain.ask.service import AskService

router = APIRouter(tags=["ask"])


def get_ask_service() -> AskService:
    return AskService()


@router.post(
    "/ask",
    summary="질문",
    response_model=AskResponse,
    responses={422: {"model": ErrorBody}},
)
def ask(
    req: AskRequest,
    service: Annotated[AskService, Depends(get_ask_service)],
    # 받기만 하고 검사하지 않는다. 발급과 검사는 한도 task(common/004)에서 한다
    x_device_key: Annotated[str | None, Header()] = None,
) -> AskResponse:
    return service.ask(req)
