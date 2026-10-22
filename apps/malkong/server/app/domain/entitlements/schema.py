"""기기 자격.

계약: docs/architecture/api-contract.md 「GET /v1/entitlements」 · 「POST /v1/devices」.
"""

from app.common.core.schema import ApiModel


class EntitlementsResponse(ApiModel):
    # 광고를 보여줄지 — 운영자(가족) 기기는 false
    ads: bool
    # 이 키가 가족 명단에 있는지 — 일반 사용자로 보기(X-As-User) 중에도 true.
    # 앱은 이 값을 보고 숨은 스위치를 보인다
    operator: bool = False


class DeviceKeyResponse(ApiModel):
    device_key: str
