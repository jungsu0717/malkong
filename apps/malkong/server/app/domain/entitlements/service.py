"""기기 자격 서비스 — 키 발급·확인, 하루 한도 세기, 서버 전체 하루 비용 천장
(backend 「일일 한도」 · 「사용량을 세는 법」, decisions/019).

키 원문은 저장하지 않는다. 저장소에는 해시만 간다.
질문도 오지 않는다 — clientMessageId 의 해시만 받는다.
"""

import hashlib
import logging
import secrets
import threading
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from http import HTTPStatus
from zoneinfo import ZoneInfo

from app.common.core.exception import ApiException
from app.common.core.setting import Settings
from app.domain.entitlements.schema import EntitlementsResponse
from app.infra.db.usage_store import DayUsage, StoreError, UsageStore

# 하루는 한국 시간 0시에 바뀐다
KST = ZoneInfo("Asia/Seoul")

logger = logging.getLogger("uvicorn.error")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass(frozen=True)
class Device:
    key_hash: str
    # 운영자(가족) 기기로 다룬다 — 한도 없음·광고 없음. 일반 사용자로 보기 중이면 False
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
        self._purged_on: date | None = None
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
            self._purge_once_a_day(day)
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

    def _precise_left(self, day: DayUsage) -> int:
        cfg = self._settings
        return max(0, cfg.daily_limit + day.rewards * cfg.reward_per_ad - day.used)

    def remaining(self, device: Device) -> int | None:
        """오늘 남은 정밀 답변 수. 운영자 기기는 None(무제한)."""
        if device.operator:
            return None
        with _store_errors():
            day = self._store.usage(device.key_hash, self.today())
        return self._precise_left(day)

    def ensure_can_answer(self, device: Device, eco: bool = False) -> None:
        """정밀(eco 면 일반 기준) 답을 더 낼 수 있는지 — 다 썼으면 429 와 선택지 정보."""
        if device.operator:
            return
        with _store_errors():
            day = self._store.usage(device.key_hash, self.today())
        eco_left = day.eco < self._settings.eco_daily_limit
        if eco_left if eco else self._precise_left(day) > 0:
            return
        raise ApiException(
            HTTPStatus.TOO_MANY_REQUESTS,
            "LIMIT_EXCEEDED",
            "오늘은 답을 다 썼어요" if eco else "오늘 정밀 답변을 다 썼어요",
            extra={
                "resetAt": self._tomorrow(),
                "rewardAvailable": day.rewards < self._settings.reward_max_per_day,
                "ecoAvailable": eco_left,
            },
        )

    def record_answer(
        self, device: Device, client_message_id: str, eco: bool = False
    ) -> int | None:
        """답 하나를 센다 — 같은 clientMessageId 는 한 번만. 남은 정밀 답변 수를 돌려준다."""
        if device.operator:
            return None
        with _store_errors():
            day = self._store.count_once(
                device.key_hash, self.today(), _hash(client_message_id), eco=eco
            )
        return self._precise_left(day)

    def _budget_micro_usd(self) -> int:
        cfg = self._settings
        return round(cfg.daily_budget_krw / cfg.usd_to_krw * 1_000_000)

    def ensure_budget(self, device: Device) -> None:
        """서버 전체의 오늘 모델 비용이 천장을 넘었으면 503. 운영자 기기는 막지 않는다."""
        if device.operator:
            return
        with _store_errors():
            spent = self._store.cost(self.today())
        if spent < self._budget_micro_usd():
            return
        raise ApiException(
            HTTPStatus.SERVICE_UNAVAILABLE,
            "DAILY_BUDGET_REACHED",
            "오늘은 버디가 답할 수 있는 양을 다 썼어요",
            extra={"resetAt": self._tomorrow()},
        )

    def add_cost(self, micro_usd: int) -> None:
        """모델을 한 번 부른 비용을 오늘 합계에 더한다.

        천장을 넘는 순간 ERROR 를 한 줄 남긴다 — 메일 알림의 근거가 된다.
        """
        if micro_usd <= 0:
            return
        try:
            total = self._store.add_cost(self.today(), micro_usd)
        except StoreError as exc:
            # 기록일 뿐이다 — 이미 값을 치른 모델 답을 저장소 장애로 버리지 않는다.
            # 그 몫은 천장 계산에서 빠진다
            logger.warning("usage: 모델 비용을 적지 못함 (%s)", exc)
            return
        budget = self._budget_micro_usd()
        if total - micro_usd < budget <= total:
            logger.error(
                "usage: 오늘 모델 비용이 하루 천장에 닿음 (약 %d원) — 오늘은 모델 답을 멈춘다",
                self._settings.daily_budget_krw,
            )

    def _tomorrow(self) -> str:
        return datetime.combine(self.today() + timedelta(days=1), time(0), tzinfo=KST).isoformat()

    def entitlements(self, device: Device) -> EntitlementsResponse:
        if device.operator:
            return EntitlementsResponse(
                ads=False,
                daily_limit=None,
                reward_per_ad=0,
                reward_max_per_day=0,
                remaining=None,
                operator=True,
            )
        return EntitlementsResponse(
            operator=device.operator_key,
            ads=True,
            daily_limit=self._settings.daily_limit,
            reward_per_ad=self._settings.reward_per_ad,
            reward_max_per_day=self._settings.reward_max_per_day,
            remaining=self.remaining(device),
        )

    def _purge_once_a_day(self, day: date) -> None:
        # 보관 기간이 지난 사용량을 지운다 — 키를 발급할 때 하루 한 번
        if self._purged_on == day:
            return
        self._purged_on = day
        self._store.purge(day)


class _store_errors:
    """저장소에 닿지 못하면 503 — 위험 신호 응답은 저장소를 거치지 않으므로 막히지 않는다."""

    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is not None and issubclass(exc_type, StoreError):
            raise ApiException(
                HTTPStatus.SERVICE_UNAVAILABLE, "STORE_UNAVAILABLE", "잠시 뒤에 다시 시도해 주세요"
            ) from None
        return False
