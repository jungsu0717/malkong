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


# --- 빠른 기록 맞추기 (SPEC-LOG-07, task log/001) ---


def event(eid: str, kind: str, updated: str, **over) -> dict:
    out = {
        "id": eid,
        "kind": kind,
        "startAt": "2026-10-12T09:00:00.000Z",
        "endAt": None,
        "amount": None,
        "side": None,
        "diaper": None,
        "note": None,
        "createdAt": "2026-10-12T09:00:00.000Z",
        "updatedAt": updated,
        "deleted": False,
    }
    return out | over


def test_sync_events_alongside_records(app) -> None:
    a, b = phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    b.post("/v1/family/join", json={"code": code, **CONSENT})
    # a 가 분유 · 재는 중인 잠과 기록 하나를 함께 올린다
    a.post(
        "/v1/family/sync",
        json={
            "since": 0,
            "records": [record("r1", "몸무게 6.4kg", "2026-10-12T10:00:00.000Z")],
            "events": [
                event("ev-1", "formula", "2026-10-12T10:00:00.000Z", amount=120, by="할머니"),
                event("ev-3", "diaper", "2026-10-12T10:10:00.000Z", diaper="poo", color="green"),
                event(
                    "ev-2", "sleep", "2026-10-12T10:05:00.000Z", startAt="2026-10-12T10:05:00.000Z"
                ),
            ],
        },
    )
    got = b.post("/v1/family/sync", json={"since": 0}).json()
    # 기록과 빠른 기록은 갈라서 온다 — 표시는 밖으로 새지 않는다
    assert [r["id"] for r in got["records"]] == ["r1"]
    assert {(e["id"], e["kind"], e["amount"], e["endAt"]) for e in got["events"]} == {
        ("ev-1", "formula", 120, None),
        ("ev-2", "sleep", None, None),
        ("ev-3", "diaper", None, None),
    }
    # 변 색도 그대로 온다(task log/002)
    assert [e["color"] for e in got["events"] if e["id"] == "ev-3"] == ["green"]
    # 누가 남겼는지도 온다(task log/003) — 보내지 않은 줄은 비어 있다
    assert {e["id"]: e["by"] for e in got["events"]} == {
        "ev-1": "할머니",
        "ev-2": None,
        "ev-3": None,
    }
    assert all("_event" not in e for e in got["events"])

    # b 가 잠을 끝내면(더 늦게 고침) a 에게 끝난 잠이 간다
    seq = got["seq"]
    b.post(
        "/v1/family/sync",
        json={
            "since": seq,
            "events": [
                event(
                    "ev-2",
                    "sleep",
                    "2026-10-12T11:00:00.000Z",
                    startAt="2026-10-12T10:05:00.000Z",
                    endAt="2026-10-12T11:00:00.000Z",
                )
            ],
        },
    )
    mine = a.post("/v1/family/sync", json={"since": seq}).json()
    assert [(e["id"], e["endAt"]) for e in mine["events"]] == [("ev-2", "2026-10-12T11:00:00.000Z")]
    assert mine["records"] == []

    # 지운 빠른 기록도 「지웠다」로 간다
    a.post(
        "/v1/family/sync",
        json={
            "since": mine["seq"],
            "events": [event("ev-1", "formula", "2026-10-12T12:00:00.000Z", deleted=True)],
        },
    )
    after = b.post("/v1/family/sync", json={"since": mine["seq"]}).json()
    assert [(e["id"], e["deleted"]) for e in after["events"]] == [("ev-1", True)]


def test_sync_rejects_unknown_event_kind(app) -> None:
    a = phone(app)
    a.post("/v1/family", json=CONSENT)
    res = a.post(
        "/v1/family/sync",
        json={"since": 0, "events": [event("ev-x", "photo", "2026-10-12T10:00:00.000Z")]},
    )
    assert res.status_code == 422


def item(item_kind: str, id_: str, updated: str, **data) -> dict:
    return {
        "kind": item_kind,
        "id": id_,
        "updatedAt": updated,
        "deleted": False,
        "data": {"id": id_, **data},
    }


def test_sync_items_todos_and_routines(app) -> None:
    """할 일 · 루틴 · 루틴 기록(task my/009).

    내용은 그대로 가고, 늦게 고친 쪽이 이기고, 지운 표시가 간다.
    """
    a, b = phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    b.post("/v1/family/join", json={"code": code, **CONSENT})
    a.post(
        "/v1/family/sync",
        json={
            "since": 0,
            "records": [record("r1", "몸무게 6.4kg", "2026-10-16T09:00:00.000Z")],
            "items": [
                item(
                    "todo",
                    "td-1",
                    "2026-10-16T09:00:00.000Z",
                    title="기저귀 4단계",
                    topicKind="shopping",
                    store="다이소",
                ),
                item(
                    "routine",
                    "rt-1",
                    "2026-10-16T09:00:00.000Z",
                    title="목욕",
                    kind="check",
                    everyDays=1,
                ),
                item(
                    "routineLog",
                    "rl-1",
                    "2026-10-16T08:10:00.000Z",
                    routineId="rt-1",
                    at="2026-10-16T08:10:00.000Z",
                    by="아빠",
                ),
            ],
        },
    )
    got = b.post("/v1/family/sync", json={"since": 0}).json()
    # 기록 · 빠른 기록과 갈라서 오고, 표시는 밖으로 새지 않는다
    assert [r["id"] for r in got["records"]] == ["r1"]
    assert got["events"] == []
    assert {(i["kind"], i["id"]) for i in got["items"]} == {
        ("todo", "td-1"),
        ("routine", "rt-1"),
        ("routineLog", "rl-1"),
    }
    todo = next(i for i in got["items"] if i["id"] == "td-1")
    assert todo["data"]["store"] == "다이소"
    assert todo["data"]["topicKind"] == "shopping"
    assert all("_item" not in i["data"] for i in got["items"])

    # b 가 완료(더 늦게 고침) → a 에게 간다. 더 먼저 고친 것은 지지 않는다
    seq = got["seq"]
    b.post(
        "/v1/family/sync",
        json={
            "since": seq,
            "items": [
                item(
                    "todo", "td-1", "2026-10-16T10:00:00.000Z", title="기저귀 4단계", doneBy="엄마"
                )
            ],
        },
    )
    a.post(
        "/v1/family/sync",
        json={
            "since": seq,
            "items": [item("todo", "td-1", "2026-10-16T09:30:00.000Z", title="옛 값")],
        },
    )
    mine = a.post("/v1/family/sync", json={"since": seq}).json()
    assert [(i["id"], i["data"].get("doneBy")) for i in mine["items"]] == [("td-1", "엄마")]

    # 지운 루틴 기록은 「지웠다」로 간다
    a.post(
        "/v1/family/sync",
        json={
            "since": mine["seq"],
            "items": [
                {
                    "kind": "routineLog",
                    "id": "rl-1",
                    "updatedAt": "2026-10-16T11:00:00.000Z",
                    "deleted": True,
                }
            ],
        },
    )
    after = b.post("/v1/family/sync", json={"since": mine["seq"]}).json()
    assert [(i["id"], i["deleted"]) for i in after["items"]] == [("rl-1", True)]


def test_sync_rejects_unknown_item_kind_and_big_data(app) -> None:
    a = phone(app)
    a.post("/v1/family", json=CONSENT)
    bad_kind = a.post(
        "/v1/family/sync",
        json={"since": 0, "items": [item("photo", "x-1", "2026-10-16T09:00:00.000Z")]},
    )
    assert bad_kind.status_code == 422
    big = a.post(
        "/v1/family/sync",
        json={
            "since": 0,
            "items": [item("todo", "td-big", "2026-10-16T09:00:00.000Z", note="가" * 5000)],
        },
    )
    assert big.status_code == 422


def test_sync_memos_and_item_kinds(app) -> None:
    """우리 아기 메모도 할 일처럼 가고(task common/024), 응답에 받는 종류가 실린다."""
    a, b = phone(app), phone(app)
    code = a.post("/v1/family", json=CONSENT).json()["inviteCode"]
    b.post("/v1/family/join", json={"code": code, **CONSENT})
    first = a.post("/v1/family/sync", json={"since": 0}).json()
    assert "memo" in first["itemKinds"]
    a.post(
        "/v1/family/sync",
        json={
            "since": 0,
            "items": [
                item(
                    "memo",
                    "mm-1",
                    "2026-10-22T09:00:00.000Z",
                    at="2026-10-22T09:00:00.000Z",
                    text="처음으로 눈 맞추고 웃었어요",
                    ref=None,
                )
            ],
        },
    )
    got = b.post("/v1/family/sync", json={"since": 0}).json()
    assert [(i["kind"], i["id"], i["data"]["text"]) for i in got["items"]] == [
        ("memo", "mm-1", "처음으로 눈 맞추고 웃었어요")
    ]
