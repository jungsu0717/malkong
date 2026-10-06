"""기기 자격과 한도.

계약: docs/architecture/api-contract.md 「GET /v1/entitlements」 · 「POST /v1/devices」.
"""

from app.common.core.schema import ApiModel


class EntitlementsResponse(ApiModel):
    # 광고를 보여줄지 — 운영자(가족) 기기는 false
    ads: bool
    # 하루 정밀 답변 수. null 이면 무제한(운영자 기기)
    daily_limit: int | None
    # 보상형 광고 1편이 채우는 정밀 답변 수와 하루 편수
    reward_per_ad: int
    reward_max_per_day: int
    # 오늘 남은 정밀 답변 수. null 이면 무제한
    remaining: int | None
    # 이 키가 가족 명단에 있는지 — 일반 사용자로 보기(X-As-User) 중에도 true.
    # 앱은 이 값을 보고 숨은 스위치를 보인다
    operator: bool = False


class DeviceKeyResponse(ApiModel):
    device_key: str


class LimitExceededBody(ApiModel):
    """429 LIMIT_EXCEEDED — 앱은 광고 충전(정밀)과 절약 모드(일반 기준) 선택지를 낸다."""

    code: str
    message: str
    # 한도가 다시 차는 시각(한국 시간 다음 0시)
    reset_at: str
    reward_available: bool
    # 일반 기준 답을 오늘 더 받을 수 있는지 — 그것까지 다 썼으면 false
    eco_available: bool


class BudgetReachedBody(ApiModel):
    """503 DAILY_BUDGET_REACHED — 서버 전체의 오늘 모델 비용이 천장에 닿았다.

    위험 신호 안내는 모델을 부르지 않으므로 계속 나간다.
    """

    code: str
    message: str
    # 다시 답하기 시작하는 시각(한국 시간 다음 0시)
    reset_at: str
