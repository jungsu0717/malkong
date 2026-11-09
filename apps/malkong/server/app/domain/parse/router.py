"""POST /v1/parse — 물어보기 창의 문장 읽기(decisions/039, task common/031).

/v1 은 main.py 가 붙인다. 기기 키가 있어야 한다.
모델을 기다리는 동안 다른 요청을 막지 않게 라우트는 async 로 둔다. 저장소를 읽는 기기 키 확인은
def 의존성으로 빼서 FastAPI 가 스레드풀에서 부르게 한다.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.common.core.exception import ErrorBody
from app.common.core.setting import Settings, get_settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import Device, EntitlementsService
from app.domain.parse.schema import ParseRequest, ParseResponse
from app.domain.parse.service import ParseService
from app.infra.llm.base import JsonModel
from app.infra.llm.gemini import GeminiModel

router = APIRouter(tags=["parse"])


def model_from(settings: Settings) -> JsonModel | None:
    """키가 없으면 None — /v1/parse 가 503 을 주고 앱은 규칙으로 읽는다."""
    if not settings.gemini_api_key:
        return None
    return GeminiModel(
        settings.gemini_api_key.get_secret_value(),
        settings.gemini_model,
        timeout_s=settings.model_timeout_s,
    )


@lru_cache
def get_parse_service() -> ParseService:
    # 하나만 둔다 — 기기마다 하루 읽은 수를 메모리에서 세기 때문이다
    settings = get_settings()
    return ParseService(model_from(settings), settings)


Usage = Annotated[EntitlementsService, Depends(get_entitlements_service)]


def current_device(usage: Usage, x_device_key: Annotated[str | None, Header()] = None) -> Device:
    return usage.device(x_device_key)


@router.post(
    "/parse",
    summary="문장 읽기",
    response_model=ParseResponse,
    responses={
        401: {"model": ErrorBody},
        422: {"model": ErrorBody},
        429: {"model": ErrorBody},
        503: {"model": ErrorBody},
    },
)
async def parse(
    req: ParseRequest,
    service: Annotated[ParseService, Depends(get_parse_service)],
    usage: Usage,
    device: Annotated[Device, Depends(current_device)],
) -> ParseResponse:
    return await service.parse(device, req, usage.today())
