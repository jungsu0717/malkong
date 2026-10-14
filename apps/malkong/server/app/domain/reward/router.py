"""GET /v1/reward/ssv — AdMob 이 부르는 보상 확인 콜백. /v1 은 main.py 가 붙인다.

AdMob 은 GET 으로 부른다(api-contract 표기는 경로 이름). 앱은 이 경로를 부르지 않는다.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.core.exception import ErrorBody
from app.common.core.setting import get_settings
from app.domain.entitlements.router import get_entitlements_service, get_usage_store
from app.domain.reward.service import RewardService

router = APIRouter(tags=["reward"])


@lru_cache
def get_reward_service() -> RewardService:
    return RewardService(get_usage_store(), get_entitlements_service(), get_settings())


@router.get(
    "/reward/ssv",
    summary="보상형 광고 적립 (AdMob 서버가 호출)",
    status_code=200,
    responses={403: {"model": ErrorBody}, 503: {"model": ErrorBody}},
)
def reward_ssv(
    request: Request, service: Annotated[RewardService, Depends(get_reward_service)]
) -> Response:
    # 이미 적립했거나 상한이어도 200 — 그래야 AdMob 이 같은 콜백을 되풀이하지 않는다
    service.credit(request.url.query)
    return Response(status_code=200)
