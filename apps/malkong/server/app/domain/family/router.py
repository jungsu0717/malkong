"""/v1/family — 가족 공유 (SPEC-MY-05, task my/007). /v1 은 main.py 가 붙인다.

기기 키가 있어야 한다 — 구성원의 정체가 기기 키 해시다. 키 원문은 저장하지 않는다.
"""

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response

from app.common.core.exception import ErrorBody
from app.common.core.setting import get_settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.domain.family.schema import ConsentIn, FamilyInfo, JoinRequest, SyncRequest, SyncResponse
from app.domain.family.service import FamilyService
from app.infra.db.family_store import MemoryFamilyStore, PostgresFamilyStore

router = APIRouter(tags=["family"])
logger = logging.getLogger("uvicorn.error")

ERRORS = {
    401: {"model": ErrorBody},
    404: {"model": ErrorBody},
    409: {"model": ErrorBody},
    503: {"model": ErrorBody},
}


@lru_cache
def get_family_service() -> FamilyService:
    url = get_settings().database_url
    if url:
        try:
            return FamilyService(PostgresFamilyStore(url.get_secret_value()))
        except Exception as exc:
            logger.error("family: 저장소에 닿지 못해 메모리로 돈다 (%s)", type(exc).__name__)
    else:
        logger.warning("family: MALKONG_DATABASE_URL 이 없어 메모리 저장소로 돈다")
    return FamilyService(MemoryFamilyStore())


Service = Annotated[FamilyService, Depends(get_family_service)]
Usage = Annotated[EntitlementsService, Depends(get_entitlements_service)]
DeviceKey = Annotated[str | None, Header()]


@router.get("/family", summary="내 가족", response_model=FamilyInfo, responses=ERRORS)
def family(service: Service, usage: Usage, x_device_key: DeviceKey = None) -> FamilyInfo:
    return service.info(usage.device(x_device_key))


@router.post(
    "/family", summary="가족 만들기", response_model=FamilyInfo, status_code=201, responses=ERRORS
)
def create(
    req: ConsentIn, service: Service, usage: Usage, x_device_key: DeviceKey = None
) -> FamilyInfo:
    return service.create(usage.device(x_device_key), req.consented_at)


@router.post(
    "/family/join",
    summary="초대 코드로 들어가기",
    response_model=FamilyInfo,
    responses={**ERRORS, 429: {"model": ErrorBody}},
)
def join(
    req: JoinRequest, service: Service, usage: Usage, x_device_key: DeviceKey = None
) -> FamilyInfo:
    return service.join(usage.device(x_device_key), req.code, req.consented_at, usage.today())


@router.delete("/family/me", summary="가족에서 나가기", status_code=204, responses=ERRORS)
def leave(service: Service, usage: Usage, x_device_key: DeviceKey = None) -> Response:
    service.leave(usage.device(x_device_key))
    return Response(status_code=204)


@router.post(
    "/family/sync", summary="아기 · 기록 맞추기", response_model=SyncResponse, responses=ERRORS
)
def sync(
    req: SyncRequest, service: Service, usage: Usage, x_device_key: DeviceKey = None
) -> SyncResponse:
    return service.sync(usage.device(x_device_key), req)
