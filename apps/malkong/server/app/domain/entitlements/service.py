"""기기 자격 서비스 — 키 발급 · 확인과 광고 여부(backend 「기기 키」 · 「운영자 기기」).

키 원문은 저장하지 않는다. 저장소에는 해시만 간다.
"""

import hashlib
import secrets
import threading
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from http import HTTPStatus
from zoneinfo import ZoneInfo

from app.common.core.exception import ApiException
from app.common.core.setting import Settings
from app.domain.entitlements.schema import EntitlementsResponse
from app.infra.db.usage_store import StoreError, UsageStore

# 하루는 한국 시간 0시에 바뀐다 — 키 발급 수를 셀 때 쓴다
KST = ZoneInfo("Asia/Seoul")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass(frozen=True)
class Device:
    key_hash: str
    # 운영자(가족) 기기로 다룬다 — 광고 없음. 일반 사용자로 보기 중이면 False
    operator: bool
    # 키가 가족 명단에 있는지 — 일반 사용자로 보기 중에도 True(앱이 스위치를 보인다)
    operator_key: bool = False


class EntitlementsService:
    def __init__(
        self,
        store: UsageStore,
        settings: Settings,
        clock: Callable[[], datetime] = lambda: datetime.now(KST),
    ) -> None:
        self._store = store
        self._settings = settings
        self._clock = clock
        self._lock = threading.Lock()
        # (연결 출처, 날짜) → 오늘 발급한 키 수. 메모리에서만 센다
        self._issued: dict[tuple[str, date], int] = defaultdict(int)
        raw = (
            settings.operator_device_keys.get_secret_value()
            if settings.operator_device_keys
            else ""
        )
        self._operators = {_hash(k.strip()) for k in raw.split(",") if k.strip()}

    def today(self) -> date:
        return self._clock().astimezone(KST).date()

    def issue_device(self, origin: str | None) -> str:
        day = self.today()
        with self._lock:
            # 지난날의 발급 수는 버린다
            for stale in [k for k in self._issued if k[1] != day]:
                del self._issued[stale]
            slot = (origin or "-", day)
            if self._issued[slot] >= self._settings.devices_per_ip_per_day:
                raise ApiException(
                    HTTPStatus.TOO_MANY_REQUESTS,
                    "TOO_MANY_DEVICES",
                    "오늘은 기기 키를 더 받을 수 없어요",
                )
            self._issued[slot] += 1
        key = "dk_" + secrets.token_urlsafe(32)
        with _store_errors():
            self._store.add_device(_hash(key))
        return key

    def device(self, key: str | None, as_user: str | None = None) -> Device:
        """요청의 X-Device-Key 를 확인한다. 없거나 모르는 키면 401 — 앱은 키를 새로 받는다.

        가족 키에 X-As-User: 1 이 오면 일반 기기처럼 다룬다(일반 사용자로 보기).
        권한을 낮추기만 하므로 일반 키에서는 이 머리를 보지 않는다.
        """
        if key:
            key_hash = _hash(key)
            if key_hash in self._operators:
                return Device(key_hash, operator=as_user != "1", operator_key=True)
            with _store_errors():
                known = self._store.has_device(key_hash)
            if known:
                return Device(key_hash, operator=False)
        raise ApiException(
            HTTPStatus.UNAUTHORIZED, "DEVICE_KEY_INVALID", "기기 키가 없거나 알 수 없어요"
        )

    def entitlements(self, device: Device) -> EntitlementsResponse:
        return EntitlementsResponse(ads=not device.operator, operator=device.operator_key)


class _store_errors:
    """저장소에 닿지 못하면 503."""

    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is not None and issubclass(exc_type, StoreError):
            raise ApiException(
                HTTPStatus.SERVICE_UNAVAILABLE, "STORE_UNAVAILABLE", "잠시 뒤에 다시 시도해 주세요"
            ) from None
        return False
