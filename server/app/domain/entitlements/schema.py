"""기기 자격과 한도.

계약: docs/architecture/api-contract.md 「GET /v1/entitlements」 · 「POST /v1/devices」.
"""

from app.common.core.schema import ApiModel


class EntitlementsResponse(ApiModel):
    # 광고를 보여줄지 — 운영자(가족) 기기는 false
    ads: bool
    # 하루 정밀 답변 수. null 이면 무제한(운영자 기기)
    daily_limit: int | None
    reward_max_per_day: int
    # 오늘 남은 정밀 답변 수. null 이면 무제한
    remaining: int | None


class DeviceKeyResponse(ApiModel):
    device_key: str


class LimitExceededBody(ApiModel):
    """429 LIMIT_EXCEEDED — 앱은 광고 충전(정밀)과 절약 모드(일반 기준) 선택지를 낸다."""

    code: str
    message: str
    # 한도가 다시 차는 시각(한국 시간 다음 0시)
    reset_at: str
    reward_available: bool
    eco_available: bool
