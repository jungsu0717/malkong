"""POST /v1/agent — 물어보기(decisions/040, task common/032).

/v1 은 main.py 가 붙인다. 기기 키가 있어야 한다.
모델을 기다리는 동안 다른 요청을 막지 않게 라우트는 async 로 둔다. 저장소를 읽는 기기 키 확인은
def 의존성으로 빼서 FastAPI 가 스레드풀에서 부르게 한다.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.common.core.exception import ErrorBody
from app.common.core.setting import Settings, get_settings
from app.domain.agent.schema import AgentRequest, AgentResponse
from app.domain.agent.service import AgentService
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import Device, EntitlementsService
from app.infra.llm.base import JsonModel
from app.infra.llm.gemini import GeminiModel

router = APIRouter(tags=["agent"])


def model_from(settings: Settings) -> JsonModel | None:
    """키가 없으면 None — /v1/agent 가 503 을 준다. 모델과 키는 문장 읽기와 같다.

    가리키는 기록을 찾고 하루 안에서 비교해야 해서 문장 읽기보다 한 단계 더 생각하게(low) 한다.
    생각에 쓰는 토큰도 답 토큰에 들어간다. 실제 호출에서 생각과 답을 합쳐 700 토큰 안팎이었고,
    한 번은 같은 말을 되풀이하다 3,600 토큰을 넘겨 9초가 걸렸다(2026-11-09).
    그래서 상한을 1,500 으로 두어 빨리 끊는다.
    """
    if not settings.gemini_api_key:
        return None
    return GeminiModel(
        settings.gemini_api_key.get_secret_value(),
        settings.gemini_model,
        timeout_s=settings.agent_timeout_s,
        thinking_level="low",
        max_output_tokens=1500,
    )


@lru_cache
def get_agent_service() -> AgentService:
    # 하나만 둔다 — 기기마다 하루 물어본 수를 메모리에서 세기 때문이다
    settings = get_settings()
    return AgentService(model_from(settings), settings)


Usage = Annotated[EntitlementsService, Depends(get_entitlements_service)]


def current_device(usage: Usage, x_device_key: Annotated[str | None, Header()] = None) -> Device:
    return usage.device(x_device_key)


@router.post(
    "/agent",
    summary="물어보기",
    response_model=AgentResponse,
    responses={
        401: {"model": ErrorBody},
        422: {"model": ErrorBody},
        429: {"model": ErrorBody},
        503: {"model": ErrorBody},
    },
)
async def agent(
    req: AgentRequest,
    service: Annotated[AgentService, Depends(get_agent_service)],
    usage: Usage,
    device: Annotated[Device, Depends(current_device)],
) -> AgentResponse:
    return await service.ask(device, req, usage.today())
