"""가족 공유 — 만들기 · 코드로 들어가기 · 가득 · 나가기 · 맞추기 (task my/007).

저장소는 메모리 판이다. 기기 키는 /v1/devices 로 받는다.
"""

import pytest
from fastapi.testclient import TestClient

from app.common.core.setting import Settings, get_settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.domain.family.router import get_family_service
from app.domain.family.service import (
    CODE_ALPHABET,
    CODE_LENGTH,
    MAX_JOIN_ATTEMPTS_PER_DAY,
    MAX_MEMBERS,
    FamilyService,
    new_code,
)
from app.infra.db.family_store import MemoryFamilyStore
from app.infra.db.usage_store import MemoryUsageStore
from app.main import create_app

CONSENT = {"consentedAt": "2026-10-12T09:00:00.000Z"}


@pytest.fixture
def app():
    settings = Settings(_env_file=None)
    app = create_app()
    usage = EntitlementsService(MemoryUsageStore(), settings)
    service = FamilyService(MemoryFamilyStore())
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_family_service] = lambda: service
    return app


def phone(app) -> TestClient:
    key = TestClient(app).post("/v1/devices").json()["deviceKey"]
    return TestClient(app, headers={"X-Device-Key": key})


def baby(updated: str = "2026-10-12T09:00:00.000Z", name: str = "하율") -> dict:
    return {
        "id": "baby-1",
        "name": name,
        "birthDate": "2026-05-10",
        "createdAt": "2026-10-01T00:00:00.000Z",
        "updatedAt": updated,
    }


def record(rid: str, label: str, updated: str, deleted: bool = False) -> dict:
    return {
        "id": rid,
        "kind": "기록",
        "label": label,
        "covers": [],
        "whenLabel": "10월 8일 대화에서",
        "sourceMessageId": None,
        "stale": False,
        "createdAt": "2026-10-08T00:00:00.000Z",
        "updatedAt": updated,
        "deleted": deleted,
    }


def test_code_is_six_unambiguous_chars() -> None:
    code = new_code()
    assert len(code) == CODE_LENGTH
    assert set(code) <= set(CODE_ALPHABET)
    assert not set("IO01L") & set(CODE_ALPHABET)


def test_needs_device_key(app) -> None:
    assert TestClient(app).get("/v1/family").status_code == 401


def test_no_family_yet(app) -> None:
    res = phone(app).get("/v1/family")
    assert res.status_code == 404
    assert res.json()["code"] == "NOT_IN_FAMILY"


def test_create_then_info_and_no_second_family(app) -> None:
    a = phone(app)
    res = a.post("/v1/family", json=CONSENT)
    assert res.status_code == 201
    info = res.json()
    assert len(info["inviteCode"]) == CODE_LENGTH and info["members"] == 1
    assert a.get("/v1/family").json() == info
    again = a.post("/v1/family", json=CONSENT)
    assert again.status_code == 409 and again.json()["code"] == "ALREADY_IN_FAMILY"


def test_join_by_code(app) -> None:
    a, b, c = phone(app), phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    # 소문자로 적어도 들어간다
    res = b.post("/v1/family/join", json={"code": code.lower(), **CONSENT})
    assert res.status_code == 200 and res.json()["members"] == 2
    assert b.get("/v1/family").json()["familyId"] == a.get("/v1/family").json()["familyId"]
    # 같은 코드를 다시 넣어도 그대로
    assert b.post("/v1/family/join", json={"code": code, **CONSENT}).status_code == 200
    wrong = b.post("/v1/family/join", json={"code": "ZZZZZZ", **CONSENT})
    assert wrong.status_code == 404 and wrong.json()["code"] == "INVITE_NOT_FOUND"
    # 다른 가족에 있는 기기는 못 들어온다
    c.post("/v1/family", json=CONSENT)
    other = c.post("/v1/family/join", json={"code": code, **CONSENT})
    assert other.status_code == 409 and other.json()["code"] == "ALREADY_IN_FAMILY"


def test_family_is_capped(app) -> None:
    a = phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    for _ in range(MAX_MEMBERS - 1):
        assert phone(app).post("/v1/family/join", json={"code": code, **CONSENT}).status_code == 200
    full = phone(app).post("/v1/family/join", json={"code": code, **CONSENT})
    assert full.status_code == 409 and full.json()["code"] == "FAMILY_FULL"


def test_join_attempts_are_limited_per_day(app) -> None:
    b = phone(app)
    for _ in range(MAX_JOIN_ATTEMPTS_PER_DAY):
        assert b.post("/v1/family/join", json={"code": "ZZZZZZ", **CONSENT}).status_code == 404
    res = b.post("/v1/family/join", json={"code": "ZZZZZZ", **CONSENT})
    assert res.status_code == 429 and res.json()["code"] == "TOO_MANY_ATTEMPTS"


def test_leave_and_last_member_deletes_family(app) -> None:
    a, b = phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    b.post("/v1/family/join", json={"code": code, **CONSENT})
    a.post(
        "/v1/family/sync",
        json={"since": 0, "baby": baby(), "records": [record("r1", "몸무게 6.4kg", "t1")]},
    )
    assert a.delete("/v1/family/me").status_code == 204
    assert a.get("/v1/family").status_code == 404
    assert b.get("/v1/family").json()["members"] == 1
    # 남은 사람은 데이터를 그대로 본다
    assert [r["id"] for r in b.post("/v1/family/sync", json={"since": 0}).json()["records"]] == [
        "r1"
    ]
    assert b.delete("/v1/family/me").status_code == 204
    # 마지막 사람이 나가면 가족과 데이터가 사라진다 — 코드도 더는 안 맞는다
    gone = phone(app).post("/v1/family/join", json={"code": code, **CONSENT})
    assert gone.status_code == 404
    assert a.post("/v1/family/sync", json={"since": 0}).status_code == 404


def test_sync_records_last_writer_wins_and_tombstones(app) -> None:
    a, b = phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    first = a.post(
        "/v1/family/sync",
        json={
            "since": 0,
            "baby": baby(),
            "records": [record("r1", "몸무게 6.4kg", "2026-10-12T10:00:00.000Z")],
        },
    ).json()
    assert first["seq"] == 1 and first["baby"]["name"] == "하율" and first["members"] == 1
    assert [r["label"] for r in first["records"]] == ["몸무게 6.4kg"]

    b.post("/v1/family/join", json={"code": code, **CONSENT})
    # 들어온 폰은 처음부터 다 받는다
    got = b.post("/v1/family/sync", json={"since": 0}).json()
    assert (
        got["seq"] == 1
        and got["baby"]["name"] == "하율"
        and [r["id"] for r in got["records"]] == ["r1"]
    )
    assert got["members"] == 2

    # b 가 r1 을 더 늦게 고치고 r2 를 더한다
    pushed = b.post(
        "/v1/family/sync",
        json={
            "since": 1,
            "records": [
                record("r1", "몸무게 6.6kg", "2026-10-12T11:00:00.000Z"),
                record("r2", "밤중 수유 2회", "2026-10-12T11:00:00.000Z"),
            ],
        },
    ).json()
    assert pushed["seq"] == 3
    # a 는 1번 뒤의 것만 받는다 — r1 의 새 판과 r2
    mine = a.post("/v1/family/sync", json={"since": 1}).json()
    assert {(r["id"], r["label"]) for r in mine["records"]} == {
        ("r1", "몸무게 6.6kg"),
        ("r2", "밤중 수유 2회"),
    }
    assert mine["seq"] == 3

    # a 가 더 이른 시각으로 r1 을 고쳐 보내면 지지 않는다 — 번호도 안 움직인다
    stale = a.post(
        "/v1/family/sync",
        json={"since": 3, "records": [record("r1", "몸무게 6.5kg", "2026-10-12T10:30:00.000Z")]},
    ).json()
    assert stale["records"] == [] and stale["seq"] == 3
    assert [
        r["label"]
        for r in b.post("/v1/family/sync", json={"since": 0}).json()["records"]
        if r["id"] == "r1"
    ] == ["몸무게 6.6kg"]

    # b 가 r2 를 지우면 a 에게 「지웠다」가 간다
    b.post(
        "/v1/family/sync",
        json={"since": 3, "records": [record("r2", "", "2026-10-12T12:00:00.000Z", deleted=True)]},
    )
    after = a.post("/v1/family/sync", json={"since": 3}).json()
    assert [(r["id"], r["deleted"]) for r in after["records"]] == [("r2", True)]
    assert after["seq"] == 4


def test_sync_baby_last_writer_wins(app) -> None:
    a, b = phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    b.post("/v1/family/join", json={"code": code, **CONSENT})
    a.post("/v1/family/sync", json={"since": 0, "baby": baby("2026-10-12T10:00:00.000Z", "하율")})
    older = b.post(
        "/v1/family/sync", json={"since": 0, "baby": baby("2026-10-12T09:00:00.000Z", "바뀜")}
    ).json()
    assert older["baby"]["name"] == "하율"
    newer = b.post(
        "/v1/family/sync", json={"since": 0, "baby": baby("2026-10-12T11:00:00.000Z", "바뀜")}
    ).json()
    assert newer["baby"]["name"] == "바뀜"
    assert a.post("/v1/family/sync", json={"since": 0}).json()["baby"]["name"] == "바뀜"


def test_sync_without_family(app) -> None:
    res = phone(app).post("/v1/family/sync", json={"since": 0})
    assert res.status_code == 404 and res.json()["code"] == "NOT_IN_FAMILY"
