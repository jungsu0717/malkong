"""기기 키 · 하루 한도 · 재시도 안전 (task common/005).

api-contract `/v1/devices` · `/v1/entitlements` · `/v1/ask`.

저장소는 메모리 판을 쓴다. 모델은 가짜다.
"""

from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.common.core.setting import Settings, get_settings
from app.domain.ask.cache import ResponseCache
from app.domain.ask.router import get_llm_client, get_response_cache
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import KST, EntitlementsService
from app.infra.db.usage_store import MemoryUsageStore
from app.main import create_app
from tests.test_ask import FakeLlm, model_out

QUESTION = {"question": "분유를 잘 안 먹어요", "baby": {"months": 3}, "clientMessageId": "q-1"}
REDFLAG = {"question": "아기가 경련을 해요", "baby": {"months": 9}, "clientMessageId": "r-1"}
OPERATOR_KEY = "dk_family"


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 3, 9, 0, tzinfo=KST)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None, daily_limit=2, operator_device_keys=SecretStr(f" {OPERATOR_KEY} , dk_x")
    )


@pytest.fixture
def usage(settings: Settings, clock: Clock) -> EntitlementsService:
    return EntitlementsService(MemoryUsageStore(), settings, clock=clock)


@pytest.fixture
def app(usage: EntitlementsService, settings: Settings):
    app = create_app()
    cache = ResponseCache()
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_response_cache] = lambda: cache
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_llm_client] = lambda: None
    return app


def with_llm(app, *outputs) -> FakeLlm:
    llm = FakeLlm(*outputs)
    app.dependency_overrides[get_llm_client] = lambda: llm
    return llm


def keyed(app) -> TestClient:
    key = TestClient(app).post("/v1/devices").json()["deviceKey"]
    return TestClient(app, headers={"X-Device-Key": key})


# --- 키 발급 ---


def test_device_key_is_issued(app) -> None:
    res = TestClient(app).post("/v1/devices")
    assert res.status_code == 201
    assert res.json()["deviceKey"].startswith("dk_")


def test_device_keys_per_origin_are_capped(app, usage: EntitlementsService) -> None:
    client = TestClient(app)
    headers = {"X-Forwarded-For": "203.0.113.7, 10.0.0.1"}
    for _ in range(20):
        assert client.post("/v1/devices", headers=headers).status_code == 201
    res = client.post("/v1/devices", headers=headers)
    assert res.status_code == 429
    assert res.json()["code"] == "TOO_MANY_DEVICES"
    # 다른 출처는 막히지 않는다
    assert (
        client.post("/v1/devices", headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 201
    )


def test_store_keeps_only_key_hashes() -> None:
    store = MemoryUsageStore()
    service = EntitlementsService(store, Settings(_env_file=None))
    key = service.issue_device("o")
    assert key not in store._devices
    assert len(next(iter(store._devices))) == 64


# --- 자격 ---


def test_entitlements_for_a_device(app) -> None:
    body = keyed(app).get("/v1/entitlements").json()
    assert body == {"ads": True, "dailyLimit": 2, "rewardMaxPerDay": 3, "remaining": 2}


def test_entitlements_need_a_key(app) -> None:
    res = TestClient(app).get("/v1/entitlements")
    assert res.status_code == 401
    assert res.json()["code"] == "DEVICE_KEY_INVALID"


def test_operator_device_has_no_ads_and_no_limit(app) -> None:
    client = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY})
    body = client.get("/v1/entitlements").json()
    assert body == {"ads": False, "dailyLimit": None, "rewardMaxPerDay": 0, "remaining": None}
    with_llm(app, *[model_out()] * 3)
    for i in range(3):
        res = client.post("/v1/ask", json={**QUESTION, "clientMessageId": f"op-{i}"})
        assert res.status_code == 200
        assert res.json()["usage"]["remaining"] is None


# --- 한도 ---


def test_answers_count_down_and_then_stop(app) -> None:
    client = keyed(app)
    with_llm(app, model_out(), model_out())
    assert client.post("/v1/ask", json=QUESTION).json()["usage"]["remaining"] == 1
    second = {**QUESTION, "clientMessageId": "q-2"}
    assert client.post("/v1/ask", json=second).json()["usage"]["remaining"] == 0

    res = client.post("/v1/ask", json={**QUESTION, "clientMessageId": "q-3"})
    assert res.status_code == 429
    body = res.json()
    assert body["code"] == "LIMIT_EXCEEDED"
    assert body["resetAt"] == "2026-10-04T00:00:00+09:00"
    assert body["rewardAvailable"] is True
    assert body["ecoAvailable"] is True


def test_same_client_message_id_is_answered_once(app) -> None:
    client = keyed(app)
    llm = with_llm(app, model_out(answer="일반적으로는 첫 답"), model_out(answer="두 번째"))
    first = client.post("/v1/ask", json=QUESTION).json()
    again = client.post("/v1/ask", json=QUESTION).json()
    assert again == first
    assert len(llm.requests) == 1
    assert client.get("/v1/entitlements").json()["remaining"] == 1


def test_count_once_even_when_the_answer_is_made_again(usage: EntitlementsService) -> None:
    # 다른 인스턴스로 간 재시도는 다시 생성될 수 있다 — 그래도 한도는 한 번만 깎인다
    device = usage.device(usage.issue_device("o"))
    assert usage.record_answer(device, "same") == 1
    assert usage.record_answer(device, "same") == 1


def test_eco_mode_answers_after_the_limit_without_counting(app) -> None:
    client = keyed(app)
    with_llm(app, *[model_out()] * 3)
    for i in range(2):
        client.post("/v1/ask", json={**QUESTION, "clientMessageId": f"q-{i}"})
    res = client.post("/v1/ask", json={**QUESTION, "clientMessageId": "eco-1", "mode": "eco"})
    assert res.status_code == 200
    assert res.json()["eco"] is True
    assert res.json()["usage"]["remaining"] == 0


def test_followup_does_not_count(app) -> None:
    client = keyed(app)
    followup = {"question": "수유 방식은요?", "chips": ["모유", "분유"], "recordLabel": "수유 방식"}
    with_llm(app, model_out(type="followup", answer="", followup=followup))
    paid = Settings(_env_file=None, daily_limit=2, llm_paid_tier=True)
    app.dependency_overrides[get_settings] = lambda: paid
    assert client.post("/v1/ask", json=QUESTION).json()["type"] == "followup"
    assert client.get("/v1/entitlements").json()["remaining"] == 2


def test_redflag_needs_no_key_and_ignores_the_limit(app) -> None:
    res = TestClient(app).post("/v1/ask", json=REDFLAG)
    assert res.status_code == 200
    assert res.json()["type"] == "redflag"

    client = keyed(app)
    with_llm(app, model_out(), model_out())
    for i in range(2):
        client.post("/v1/ask", json={**QUESTION, "clientMessageId": f"q-{i}"})
    assert client.post("/v1/ask", json=REDFLAG).json()["type"] == "redflag"


def test_limit_resets_at_midnight_kst(app, clock: Clock) -> None:
    client = keyed(app)
    with_llm(app, model_out(), model_out(), model_out())
    for i in range(2):
        client.post("/v1/ask", json={**QUESTION, "clientMessageId": f"q-{i}"})
    clock.now = datetime(2026, 10, 3, 23, 59, tzinfo=KST)
    assert client.post("/v1/ask", json={**QUESTION, "clientMessageId": "late"}).status_code == 429
    clock.now = datetime(2026, 10, 4, 0, 0, tzinfo=KST)
    assert client.get("/v1/entitlements").json()["remaining"] == 2


def test_old_usage_is_purged() -> None:
    store = MemoryUsageStore()
    today = date(2026, 10, 3)
    store.count_once("k", today - timedelta(days=31), "old")
    store.count_once("k", today, "new")
    store.purge(today)
    assert store.usage("k", today - timedelta(days=31)) == (0, 0)
    assert store.usage("k", today) == (1, 0)
