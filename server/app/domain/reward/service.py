"""보상형 광고 적립 — AdMob 서버 측 검증(SSV) 콜백.

계약: api-contract `/v1/reward/ssv`, backend 「일일 한도」 보상.

광고를 끝까지 봤다는 판정은 AdMob → 서버 경로만 믿는다. 앱의 자체 신고로는 적립하지 않는다.
AdMob 이 보낸 쿼리 문자열의 서명을 Google 공개 키로 확인한 뒤,
`user_id`(앱이 넣은 기기 키 해시)에 +1 한다.
검증 방법: https://developers.google.com/admob/android/ssv
"""

import base64
import hashlib
import logging
import threading
import time
from collections.abc import Callable
from http import HTTPStatus
from urllib.parse import parse_qs

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_public_key

from app.common.core.exception import ApiException
from app.common.core.setting import Settings
from app.domain.entitlements.service import EntitlementsService
from app.infra.db.usage_store import StoreError, UsageStore

logger = logging.getLogger("uvicorn.error")

VERIFIER_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json"
# Google 은 키를 가끔 바꾼다 — 하루 동안 기억하고, 모르는 key_id 가 오면 다시 받는다
KEYS_TTL_S = 24 * 3600


def fetch_google_keys() -> dict[int, str]:
    res = httpx.get(VERIFIER_KEYS_URL, timeout=10)
    res.raise_for_status()
    return {int(k["keyId"]): k["pem"] for k in res.json()["keys"]}


class RewardService:
    def __init__(
        self,
        store: UsageStore,
        usage: EntitlementsService,
        settings: Settings,
        fetch_keys: Callable[[], dict[int, str]] = fetch_google_keys,
    ) -> None:
        self._store = store
        self._usage = usage
        self._settings = settings
        self._fetch_keys = fetch_keys
        self._lock = threading.Lock()
        self._keys: dict[int, str] = {}
        self._keys_at = 0.0

    def _key(self, key_id: int) -> str | None:
        with self._lock:
            stale = time.monotonic() - self._keys_at > KEYS_TTL_S
            if stale or key_id not in self._keys:
                try:
                    self._keys = self._fetch_keys()
                    self._keys_at = time.monotonic()
                except Exception as exc:
                    logger.warning("reward: Google 검증 키를 받지 못함 (%s)", type(exc).__name__)
            return self._keys.get(key_id)

    def verify(self, raw_query: str) -> dict[str, str]:
        """서명을 확인하고 쿼리 값을 돌려준다. 서명이 틀리면 403."""
        # 서명 대상은 signature 앞까지의 쿼리 문자열 그대로다(순서·인코딩을 건드리지 않는다)
        cut = raw_query.find("&signature=")
        params = {k: v[0] for k, v in parse_qs(raw_query, keep_blank_values=True).items()}
        if cut < 0 or "signature" not in params or "key_id" not in params:
            raise _forbidden()
        message = raw_query[:cut].encode()
        try:
            key_id = int(params["key_id"])
            signature = base64.urlsafe_b64decode(
                params["signature"] + "=" * (-len(params["signature"]) % 4)
            )
        except ValueError:
            raise _forbidden() from None
        pem = self._key(key_id)
        if pem is None:
            raise _forbidden()
        try:
            public_key = load_pem_public_key(pem.encode())
            assert isinstance(public_key, ec.EllipticCurvePublicKey)
            public_key.verify(signature, message, ec.ECDSA(hashes.SHA256()))
        except (InvalidSignature, ValueError, AssertionError):
            raise _forbidden() from None
        return params

    def credit(self, raw_query: str) -> bool:
        """검증된 콜백이면 그 기기에 1편을 적립한다.

        이미 적립한 거래·하루 상한·모르는 기기면 False.
        """
        params = self.verify(raw_query)
        key_hash = params.get("user_id", "")
        transaction = params.get("transaction_id", "")
        if not key_hash or not transaction:
            return False
        try:
            if not self._store.has_device(key_hash):
                return False
            return self._store.add_reward(
                key_hash,
                self._usage.today(),
                hashlib.sha256(transaction.encode()).hexdigest(),
                self._settings.reward_max_per_day,
            )
        except StoreError:
            # AdMob 은 200 이 아니면 다시 보낸다 — 저장소가 돌아오면 그때 적립된다
            raise ApiException(
                HTTPStatus.SERVICE_UNAVAILABLE, "STORE_UNAVAILABLE", "잠시 뒤에 다시 시도해 주세요"
            ) from None


def _forbidden() -> ApiException:
    return ApiException(HTTPStatus.FORBIDDEN, "INVALID_SIGNATURE", "검증할 수 없는 요청이에요")
