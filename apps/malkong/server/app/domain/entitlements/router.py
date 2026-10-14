"""GET /v1/entitlements · 저장소와 자격 서비스 팩토리. /v1 은 main.py 가 붙인다."""

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.common.core.exception import ErrorBody
from app.common.core.setting import get_settings
from app.domain.entitlements.schema import EntitlementsResponse
from app.domain.entitlements.service import EntitlementsService
from app.infra.db.usage_store import MemoryUsageStore, PostgresUsageStore, UsageStore

router = APIRouter(tags=["entitlements"])
logger = logging.getLogger("uvicorn.error")


@lru_cache
def get_usage_store() -> UsageStore:
    """Neon 주소가 있으면 Postgres, 없거나 닿지 않으면 메모리(backend 「사용량을 세는 법」)."""
    url = get_settings().database_url
    if url:
        try:
            return PostgresUsageStore(url.get_secret_value())
        except Exception as exc:
            # 접속 주소가 로그에 남지 않게 예외 종류만 적는다
            logger.error("usage: 저장소에 닿지 못해 메모리로 돈다 (%s)", type(exc).__name__)
    else:
        logger.warning("usage: MALKONG_DATABASE_URL 이 없어 메모리 저장소로 돈다")
    return MemoryUsageStore()


@lru_cache
def get_entitlements_service() -> EntitlementsService:
    # 하나만 둔다 — 키 발급 수를 메모리에서 세기 때문이다
    return EntitlementsService(get_usage_store(), get_settings())


@router.get(
    "/entitlements",
    summary="기기 자격",
    response_model=EntitlementsResponse,
    responses={401: {"model": ErrorBody}, 503: {"model": ErrorBody}},
)
def entitlements(
    service: Annotated[EntitlementsService, Depends(get_entitlements_service)],
    x_device_key: Annotated[str | None, Header()] = None,
    # 가족 기기의 일반 사용자로 보기 — "1" 이면 일반 기기처럼 답한다
    x_as_user: Annotated[str | None, Header()] = None,
) -> EntitlementsResponse:
    return service.entitlements(service.device(x_device_key, x_as_user))
