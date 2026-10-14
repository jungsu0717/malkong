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
from app.infra.db.usage_store import DayUsage, MemoryUsageStore, StoreError
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
    assert body == {
        "ads": True,
        "dailyLimit": 2,
        "rewardPerAd": 5,
        "rewardMaxPerDay": 2,
        "remaining": 2,
        "operator": False,
    }


def test_entitlements_need_a_key(app) -> None:
    res = TestClient(app).get("/v1/entitlements")
    assert res.status_code == 401
    assert res.json()["code"] == "DEVICE_KEY_INVALID"


def test_operator_device_has_no_ads_and_no_limit(app) -> None:
    client = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY})
    body = client.get("/v1/entitlements").json()
    assert body == {
        "ads": False,
        "dailyLimit": None,
        "rewardPerAd": 0,
        "rewardMaxPerDay": 0,
        "remaining": None,
        "operator": True,
    }
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
    assert store.usage("k", today - timedelta(days=31)) == DayUsage()
    assert store.usage("k", today) == DayUsage(used=1)


# --- 일반 기준 답 한도 · 서버 전체 하루 비용 천장 (decisions/019) ---


def swap_settings(app, clock: Clock, **over) -> EntitlementsService:
    """설정을 바꿔 끼운 새 자격 서비스 — 한도와 천장 숫자를 작게 해서 시험한다."""
    base = {"_env_file": None, "daily_limit": 2, "operator_device_keys": SecretStr(OPERATOR_KEY)}
    settings = Settings(**(base | over))
    usage = EntitlementsService(MemoryUsageStore(), settings, clock=clock)
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_settings] = lambda: settings
    return usage


def ask(client: TestClient, msg_id: str, eco: bool = False):
    body = {**QUESTION, "clientMessageId": msg_id} | ({"mode": "eco"} if eco else {})
    return client.post("/v1/ask", json=body)


def test_eco_answers_are_counted_and_capped(app, clock: Clock) -> None:
    swap_settings(app, clock, eco_daily_limit=2)
    client = keyed(app)
    with_llm(app, *[model_out()] * 4)
    for i in range(2):
        assert ask(client, f"q-{i}").status_code == 200
    for i in range(2):
        assert ask(client, f"e-{i}", eco=True).status_code == 200
    # 일반 기준 답까지 다 썼다 — 오늘은 여기까지
    res = ask(client, "e-2", eco=True)
    assert res.status_code == 429
    assert res.json()["ecoAvailable"] is False
    assert res.json()["rewardAvailable"] is True
    # 정밀 답 요청도 이제 일반 기준 선택지를 내주지 않는다
    assert ask(client, "q-9").json()["ecoAvailable"] is False


def test_eco_retry_counts_once(app, clock: Clock) -> None:
    usage = swap_settings(app, clock, eco_daily_limit=1)
    client = keyed(app)
    with_llm(app, model_out())
    first = ask(client, "e-1", eco=True)
    assert ask(client, "e-1", eco=True).json() == first.json()
    device = usage.device(client.headers["X-Device-Key"])
    assert usage._store.usage(device.key_hash, usage.today()).eco == 1


def test_daily_budget_stops_model_answers_but_not_redflags(app, clock: Clock) -> None:
    # 천장 1원(1달러 = 1000원으로) = 백만분의1달러로 1000.
    # 한 번 부르는 값: 입력 1000 × 0.30 + 출력 400 × 2.50 = 1300 이라 첫 답 뒤에 닿는다
    usage = swap_settings(app, clock, daily_budget_krw=1, usd_to_krw=1000)
    client = keyed(app)
    app.dependency_overrides[get_llm_client] = lambda: FakeLlm(
        model_out(), model_out(), tokens=(1000, 0, 400, 0)
    )
    assert ask(client, "q-1").status_code == 200
    assert usage._store.cost(usage.today()) == 1300

    res = ask(client, "q-2")
    assert res.status_code == 503
    assert res.json()["code"] == "DAILY_BUDGET_REACHED"
    assert res.json()["resetAt"] == "2026-10-04T00:00:00+09:00"
    # 위험 신호 안내는 모델을 부르지 않으므로 그대로 나간다
    assert client.post("/v1/ask", json=REDFLAG).json()["type"] == "redflag"
    # 운영자(가족) 기기는 천장에 걸리지 않는다
    family = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY})
    assert ask(family, "op-1").status_code == 200
    # 다음 날 0시에 풀린다
    clock.now = datetime(2026, 10, 4, 0, 0, tzinfo=KST)
    assert ask(client, "q-3").status_code != 503


def test_reaching_the_budget_logs_one_error(app, clock: Clock, caplog) -> None:
    usage = swap_settings(app, clock, daily_budget_krw=1, usd_to_krw=1000)
    with caplog.at_level("ERROR", logger="uvicorn.error"):
        usage.add_cost(600)
        usage.add_cost(600)
        usage.add_cost(600)
    assert sum("하루 천장" in r.getMessage() for r in caplog.records) == 1


def test_cost_history_is_kept_longer_than_usage() -> None:
    store = MemoryUsageStore()
    today = date(2026, 10, 3)
    store.add_cost(today - timedelta(days=31), 5)
    store.add_cost(today - timedelta(days=401), 7)
    store.purge(today)
    assert store.cost(today - timedelta(days=31)) == 5
    assert store.cost(today - timedelta(days=401)) == 0


def test_answer_survives_a_failure_to_record_its_cost(app, clock: Clock) -> None:
    # 비용 적기는 기록일 뿐 — 저장소가 잠깐 실패해도 이미 만든 답을 버리지 않는다(리뷰 지적)
    usage = swap_settings(app, clock)

    def broken(day, micro_usd):
        raise StoreError("OperationalError")

    usage._store.add_cost = broken
    client = keyed(app)
    app.dependency_overrides[get_llm_client] = lambda: FakeLlm(model_out(), tokens=(10, 0, 10, 0))
    res = ask(client, "q-1")
    assert res.status_code == 200
    assert res.json()["type"] == "answer"


# --- 가족 기기의 일반 사용자로 보기 (task common/015) ---


def test_operator_can_view_as_a_user(app, clock: Clock) -> None:
    swap_settings(app, clock, daily_limit=1, eco_daily_limit=1)
    user_view = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY, "X-As-User": "1"})
    body = user_view.get("/v1/entitlements").json()
    # 한도 · 광고는 일반 기기와 같고, 스위치를 보이도록 operator 는 그대로 true
    assert body == {
        "ads": True,
        "dailyLimit": 1,
        "rewardPerAd": 5,
        "rewardMaxPerDay": 2,
        "remaining": 1,
        "operator": True,
    }
    with_llm(app, *[model_out()] * 3)
    assert ask(user_view, "u-1").json()["usage"]["remaining"] == 0
    res = ask(user_view, "u-2")
    assert res.status_code == 429
    assert res.json()["ecoAvailable"] is True
    assert ask(user_view, "u-3", eco=True).status_code == 200
    # 스위치를 끄면 다시 가족 기기 — 한도가 없다
    family = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY})
    assert family.get("/v1/entitlements").json()["remaining"] is None
    assert ask(family, "op-1").status_code == 200


def test_user_view_meets_the_daily_budget(app, clock: Clock) -> None:
    swap_settings(app, clock, daily_budget_krw=1, usd_to_krw=1000)
    app.dependency_overrides[get_llm_client] = lambda: FakeLlm(
        model_out(), model_out(), tokens=(1000, 0, 400, 0)
    )
    family = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY})
    assert ask(family, "op-1").status_code == 200
    user_view = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY, "X-As-User": "1"})
    assert ask(user_view, "u-1").json()["code"] == "DAILY_BUDGET_REACHED"


def test_as_user_header_changes_nothing_for_a_normal_device(app) -> None:
    client = keyed(app)
    plain = client.get("/v1/entitlements").json()
    client.headers["X-As-User"] = "1"
    assert client.get("/v1/entitlements").json() == plain
    assert plain["operator"] is False
