"""POST /v1/ask — 요청을 받아 AskService 에 넘기기만 한다. /v1 은 main.py 가 붙인다."""

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.common.core.exception import ErrorBody
from app.common.core.setting import Settings, get_settings
from app.domain.ask.cache import ResponseCache
from app.domain.ask.schema import AskRequest, AskResponse
from app.domain.ask.service import AskService
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.schema import LimitExceededBody
from app.domain.entitlements.service import EntitlementsService
from app.domain.knowledge.repository import L1Repository
from app.infra.llm.anthropic import AnthropicClient
from app.infra.llm.base import LlmClient
from app.infra.llm.gemini import GeminiClient

router = APIRouter(tags=["ask"])
logger = logging.getLogger("uvicorn.error")


@lru_cache
def get_l1_repository() -> L1Repository:
    return L1Repository(get_settings().l1_dir)


@lru_cache
def get_llm_client() -> LlmClient | None:
    """설정에 적힌 회사와 모델로 어댑터를 만든다.

    설정이 비어 있으면 None — 모델 길은 503 이 된다.
    """
    s = get_settings()
    if not s.llm_model:
        return None
    try:
        if s.llm_provider == "gemini" and s.gemini_api_key:
            return GeminiClient(
                s.gemini_api_key.get_secret_value(), s.llm_model, timeout_s=s.llm_timeout_s
            )
        if s.llm_provider == "anthropic":
            return AnthropicClient(
                s.llm_model,
                vertex_project=s.vertex_project,
                vertex_region=s.vertex_region,
                api_key=s.anthropic_api_key.get_secret_value() if s.anthropic_api_key else None,
                timeout_s=s.llm_timeout_s,
            )
    except Exception as exc:
        # 모델 설정이 틀려도 위험 신호 응답은 막히면 안 된다 — 모델 길만 503 이 된다
        logger.error("ask: 모델 어댑터를 만들지 못함 (%s)", type(exc).__name__)
    return None


@lru_cache
def get_response_cache() -> ResponseCache:
    return ResponseCache()


def get_ask_service(
    l1: Annotated[L1Repository, Depends(get_l1_repository)],
    llm: Annotated[LlmClient | None, Depends(get_llm_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    usage: Annotated[EntitlementsService, Depends(get_entitlements_service)],
    cache: Annotated[ResponseCache, Depends(get_response_cache)],
) -> AskService:
    return AskService(l1, llm, settings, usage, cache)


@router.post(
    "/ask",
    summary="질문",
    response_model=AskResponse,
    responses={
        401: {"model": ErrorBody},
        422: {"model": ErrorBody},
        429: {"model": LimitExceededBody},
        503: {"model": ErrorBody},
    },
)
def ask(
    req: AskRequest,
    service: Annotated[AskService, Depends(get_ask_service)],
    # POST /v1/devices 로 받은 키. 위험 신호 응답은 키 없이도 나간다
    x_device_key: Annotated[str | None, Header()] = None,
) -> AskResponse:
    return service.ask(req, x_device_key)
