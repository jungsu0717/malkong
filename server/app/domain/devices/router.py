"""POST /v1/devices — 디바이스 키 발급. /v1 은 main.py 가 붙인다."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.common.core.exception import ErrorBody
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.schema import DeviceKeyResponse
from app.domain.entitlements.service import EntitlementsService

router = APIRouter(tags=["devices"])


def _origin(request: Request) -> str | None:
    # Cloud Run 은 원래 연결 출처를 X-Forwarded-For 첫 칸에 넣어 준다.
    # 이 값은 메모리에서 발급 수를 셀 때만 쓴다
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else None)


@router.post(
    "/devices",
    summary="디바이스 키 발급",
    status_code=201,
    response_model=DeviceKeyResponse,
    responses={429: {"model": ErrorBody}, 503: {"model": ErrorBody}},
)
def issue_device(
    request: Request,
    service: Annotated[EntitlementsService, Depends(get_entitlements_service)],
) -> DeviceKeyResponse:
    return DeviceKeyResponse(device_key=service.issue_device(_origin(request)))
