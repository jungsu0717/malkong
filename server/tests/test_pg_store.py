"""Postgres 저장소를 실제 Postgres 에 붙여 본다 — `MALKONG_TEST_PG_URL` 이 있을 때만 돈다.

Neon 과 같은 SQL 이 도는지 보는 시험이다. 로컬 Postgres 를 띄우는 법은 server/AGENTS.md 「명령」.
시험 줄은 키 해시가 'pgtest-' 로 시작하고, 끝나면 지운다. 운영 DB 주소를 넣지 않는다.
"""

import os
from datetime import date, timedelta

import pytest

from app.infra.db.feedback_store import FeedbackRow, PostgresFeedbackStore
from app.infra.db.usage_store import DayUsage, PostgresUsageStore

URL = os.environ.get("MALKONG_TEST_PG_URL")
pytestmark = pytest.mark.skipif(not URL, reason="MALKONG_TEST_PG_URL 이 없다")

KEY = "pgtest-key"
# 실제 날짜와 섞이지 않는 먼 과거 — 비용 표는 기기 구분 없이 날짜 하나에 한 줄이다
OLD_DAY = date(2000, 1, 1)


@pytest.fixture
def store():
    store = PostgresUsageStore(URL)
    yield store
    with store._conn() as conn:
        for table in ("counted_message", "reward_tx", "daily_usage", "device"):
            conn.execute(f"DELETE FROM {table} WHERE key_hash LIKE 'pgtest-%'")
        conn.execute("DELETE FROM daily_cost WHERE day <= %s", (OLD_DAY,))
    store._pool.close()


def test_devices(store: PostgresUsageStore) -> None:
    store.add_device(KEY)
    store.add_device(KEY)
    assert store.has_device(KEY)
    assert not store.has_device("pgtest-unknown")


def test_precise_and_eco_are_counted_once_each(store: PostgresUsageStore) -> None:
    today = date.today()
    assert store.count_once(KEY, today, "pgtest-p1") == DayUsage(used=1)
    assert store.count_once(KEY, today, "pgtest-p1") == DayUsage(used=1)
    assert store.count_once(KEY, today, "pgtest-e1", eco=True) == DayUsage(used=1, eco=1)
    assert store.count_once(KEY, today, "pgtest-e1", eco=True) == DayUsage(used=1, eco=1)
    assert store.usage(KEY, today) == DayUsage(used=1, eco=1)


def test_rewards_once_per_transaction_and_capped(store: PostgresUsageStore) -> None:
    today = date.today()
    assert store.add_reward(KEY, today, "pgtest-tx1", 2)
    assert not store.add_reward(KEY, today, "pgtest-tx1", 2)
    assert store.add_reward(KEY, today, "pgtest-tx2", 2)
    assert not store.add_reward(KEY, today, "pgtest-tx3", 2)
    assert store.usage(KEY, today).rewards == 2


def test_daily_cost_adds_up_and_is_purged(store: PostgresUsageStore) -> None:
    assert store.add_cost(OLD_DAY, 600) == 600
    assert store.add_cost(OLD_DAY, 700) == 1300
    assert store.cost(OLD_DAY) == 1300
    assert store.cost(OLD_DAY - timedelta(days=1)) == 0
    store.purge(date.today())
    assert store.cost(OLD_DAY) == 0


def test_feedback_is_saved() -> None:
    fb = PostgresFeedbackStore(URL)
    try:
        fb.save(FeedbackRow("pgtest-answer", "up", None, "일반", [], False, None, None))
        fb.save(FeedbackRow("pgtest-answer", "down", "별로", "일반", [], False, None, None))
        with fb._pool.connection() as conn:
            row = conn.execute(
                "SELECT rating FROM feedback WHERE answer_id_hash = 'pgtest-answer'"
            ).fetchone()
            conn.execute("DELETE FROM feedback WHERE answer_id_hash = 'pgtest-answer'")
        # 같은 답변의 피드백은 마지막 것만 남는다
        assert row == ("down",)
    finally:
        fb._pool.close()
