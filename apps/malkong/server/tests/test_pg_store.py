"""Postgres 저장소를 실제 Postgres 에 붙여 본다 — `MALKONG_TEST_PG_URL` 이 있을 때만 돈다.

Neon 과 같은 SQL 이 도는지 보는 시험이다. 로컬 Postgres 를 띄우는 법은 server/AGENTS.md 「명령」.
시험 줄은 키 해시가 'pgtest-' 로 시작하고, 끝나면 지운다. 운영 DB 주소를 넣지 않는다.
"""

import os

import pytest

from app.infra.db.usage_store import PostgresUsageStore

URL = os.environ.get("MALKONG_TEST_PG_URL")
pytestmark = pytest.mark.skipif(not URL, reason="MALKONG_TEST_PG_URL 이 없다")

KEY = "pgtest-key"


@pytest.fixture
def store():
    store = PostgresUsageStore(URL)
    yield store
    with store._conn() as conn:
        conn.execute("DELETE FROM device WHERE key_hash LIKE 'pgtest-%'")
    store._pool.close()


def test_devices(store: PostgresUsageStore) -> None:
    store.add_device(KEY)
    store.add_device(KEY)
    assert store.has_device(KEY)
    assert not store.has_device("pgtest-unknown")


# --- 가족 공유 저장소 (task my/007) ---


@pytest.fixture
def family_store():
    from app.infra.db.family_store import PostgresFamilyStore

    store = PostgresFamilyStore(URL)
    yield store
    with store._conn() as conn:
        conn.execute("DELETE FROM family WHERE id LIKE 'pgtest-%'")
    store._pool.close()


def test_family_create_join_sync_and_leave(family_store) -> None:
    from app.infra.db.family_store import RecordRow

    fam = family_store.create("pgtest-fam", "PGTEST", "pgtest-dev-a", "2026-10-12T09:00:00Z")
    assert fam.invite_code == "PGTEST"
    assert family_store.find_by_code("PGTEST").id == "pgtest-fam"
    family_store.add_member("pgtest-fam", "pgtest-dev-b", "2026-10-12T09:01:00Z")
    assert family_store.member_count("pgtest-fam") == 2
    assert family_store.family_of("pgtest-dev-b").id == "pgtest-fam"

    family_store.put_baby("pgtest-fam", {"name": "하율"}, "2026-10-12T10:00:00Z")
    family_store.put_baby(
        "pgtest-fam", {"name": "옛날"}, "2026-10-12T09:00:00Z"
    )  # 더 이르면 지지 않는다
    assert family_store.baby("pgtest-fam")[0]["name"] == "하율"

    family_store.upsert_records(
        "pgtest-fam",
        [
            RecordRow("r1", {"label": "a"}, "2026-10-12T10:00:00Z", False, 0),
            RecordRow("r2", {"label": "b"}, "2026-10-12T10:00:00Z", False, 0),
        ],
    )
    first = family_store.records_since("pgtest-fam", 0)
    assert [r.id for r in first] == ["r1", "r2"] and first[0].seq < first[1].seq
    last = first[-1].seq
    # 더 이른 고침은 지지 않고 번호도 안 움직인다, 더 늦은 고침은 새 번호
    family_store.upsert_records(
        "pgtest-fam", [RecordRow("r1", {"label": "old"}, "2026-10-12T09:00:00Z", False, 0)]
    )
    assert family_store.records_since("pgtest-fam", last) == []
    family_store.upsert_records(
        "pgtest-fam", [RecordRow("r1", {"label": "new"}, "2026-10-12T11:00:00Z", True, 0)]
    )
    newer = family_store.records_since("pgtest-fam", last)
    assert (
        len(newer) == 1
        and newer[0].id == "r1"
        and newer[0].deleted
        and newer[0].data["label"] == "new"
    )

    assert family_store.remove_member("pgtest-fam", "pgtest-dev-a") == 1
    assert family_store.remove_member("pgtest-fam", "pgtest-dev-b") == 0
    assert family_store.find_by_code("PGTEST") is None
    assert family_store.records_since("pgtest-fam", 0) == []
