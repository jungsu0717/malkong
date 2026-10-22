"""기기 키 · 기기 자격 (task common/005 · 022).

api-contract `/v1/devices` · `/v1/entitlements`. 저장소는 메모리 판을 쓴다.
"""

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.common.core.setting import Settings, get_settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.infra.db.usage_store import MemoryUsageStore
from app.main import create_app

OPERATOR_KEY = "dk_family"


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, operator_device_keys=SecretStr(f" {OPERATOR_KEY} , dk_x"))


@pytest.fixture
def usage(settings: Settings) -> EntitlementsService:
    return EntitlementsService(MemoryUsageStore(), settings)


@pytest.fixture
def app(usage: EntitlementsService, settings: Settings):
    app = create_app()
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_settings] = lambda: settings
    return app


def keyed(app) -> TestClient:
    key = TestClient(app).post("/v1/devices").json()["deviceKey"]
    return TestClient(app, headers={"X-Device-Key": key})


# --- 키 발급 ---


def test_device_key_is_issued(app) -> None:
    res = TestClient(app).post("/v1/devices")
    assert res.status_code == 201
    assert res.json()["deviceKey"].startswith("dk_")


def test_device_keys_per_origin_are_capped(app) -> None:
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
    assert keyed(app).get("/v1/entitlements").json() == {"ads": True, "operator": False}


def test_entitlements_need_a_key(app) -> None:
    res = TestClient(app).get("/v1/entitlements")
    assert res.status_code == 401
    assert res.json()["code"] == "DEVICE_KEY_INVALID"


def test_operator_device_has_no_ads(app) -> None:
    client = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY})
    assert client.get("/v1/entitlements").json() == {"ads": False, "operator": True}


def test_operator_can_view_as_a_user(app) -> None:
    user_view = TestClient(app, headers={"X-Device-Key": OPERATOR_KEY, "X-As-User": "1"})
    # 광고는 일반 기기와 같고, 스위치를 보이도록 operator 는 그대로 true
    assert user_view.get("/v1/entitlements").json() == {"ads": True, "operator": True}


def test_as_user_header_changes_nothing_for_a_normal_device(app) -> None:
    client = keyed(app)
    plain = client.get("/v1/entitlements").json()
    client.headers["X-As-User"] = "1"
    assert client.get("/v1/entitlements").json() == plain
    assert plain["operator"] is False
