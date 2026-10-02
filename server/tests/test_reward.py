"""GET /v1/reward/ssv — AdMob 서명을 확인하고 적립한다 (task common/006).

진짜 Google 키 대신 시험용 키로 서명한다. 서명 대상은 signature 앞까지의 쿼리 문자열이다.
"""

import base64
import hashlib

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.common.core.setting import Settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.domain.reward.router import get_reward_service
from app.domain.reward.service import RewardService
from app.infra.db.usage_store import MemoryUsageStore
from app.main import create_app

KEY_ID = 1234
PRIVATE = ec.generate_private_key(ec.SECP256R1())
PEM = (
    PRIVATE.public_key()
    .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    .decode()
)


def signed(query: str, key_id: int = KEY_ID) -> str:
    sig = PRIVATE.sign(query.encode(), ec.ECDSA(hashes.SHA256()))
    return f"{query}&signature={base64.urlsafe_b64encode(sig).decode().rstrip('=')}&key_id={key_id}"


@pytest.fixture
def setup():
    store = MemoryUsageStore()
    settings = Settings(_env_file=None, daily_limit=1)
    usage = EntitlementsService(store, settings)
    reward = RewardService(store, usage, settings, fetch_keys=lambda: {KEY_ID: PEM})
    app = create_app()
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_reward_service] = lambda: reward
    key = usage.issue_device("t")
    return TestClient(app), usage, key


def callback(key: str, tx: str) -> str:
    user = hashlib.sha256(key.encode()).hexdigest()
    return (
        "ad_network=5450213213286189855&ad_unit=1234567890&reward_amount=1&reward_item=answer"
        f"&timestamp=1759450000000&transaction_id={tx}&user_id={user}"
    )


def test_verified_reward_adds_one_answer(setup) -> None:
    client, usage, key = setup
    device = usage.device(key)
    assert usage.remaining(device) == 1
    res = client.get(f"/v1/reward/ssv?{signed(callback(key, 'tx-1'))}")
    assert res.status_code == 200
    assert usage.remaining(device) == 2


def test_same_transaction_counts_once(setup) -> None:
    client, usage, key = setup
    query = signed(callback(key, "tx-1"))
    client.get(f"/v1/reward/ssv?{query}")
    assert client.get(f"/v1/reward/ssv?{query}").status_code == 200
    assert usage.remaining(usage.device(key)) == 2


def test_rewards_are_capped_per_day(setup) -> None:
    client, usage, key = setup
    for i in range(5):
        client.get(f"/v1/reward/ssv?{signed(callback(key, f'tx-{i}'))}")
    # 하루 3편까지(설정 reward_max_per_day)
    assert usage.remaining(usage.device(key)) == 1 + 3


@pytest.mark.parametrize(
    "query",
    [
        "user_id=x&transaction_id=t",
        "user_id=x&transaction_id=t&signature=AAAA&key_id=1234",
    ],
    ids=["unsigned", "bad-signature"],
)
def test_unverified_callbacks_are_refused(setup, query: str) -> None:
    client, usage, key = setup
    res = client.get(f"/v1/reward/ssv?{query}")
    assert res.status_code == 403
    assert res.json()["code"] == "INVALID_SIGNATURE"


def test_tampered_query_is_refused(setup) -> None:
    client, usage, key = setup
    query = signed(callback(key, "tx-1")).replace("reward_amount=1", "reward_amount=9")
    assert client.get(f"/v1/reward/ssv?{query}").status_code == 403
    assert usage.remaining(usage.device(key)) == 1


def test_unknown_key_id_is_refused(setup) -> None:
    client, _, key = setup
    assert client.get(f"/v1/reward/ssv?{signed(callback(key, 'tx'), key_id=9)}").status_code == 403


def test_unknown_device_gets_nothing_but_ok(setup) -> None:
    client, _, _ = setup
    assert client.get(f"/v1/reward/ssv?{signed(callback('dk_nobody', 'tx'))}").status_code == 200
