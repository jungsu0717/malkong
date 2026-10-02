"""답변 피드백 저장소 (SPEC-ASK-06, api-contract `/v1/feedback`).

기기 키는 여기 오지 않는다 — 피드백은 기기와 떼어 저장한다. 질문·답 원문은 사용자가 그 피드백에서
함께 보내기를 골랐을 때만 온다. 1년이 지나면 지운다(개인정보 처리방침).
"""

import json
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from app.infra.db.usage_store import StoreError

KEEP_DAYS = 365

SCHEMA = """
CREATE TABLE IF NOT EXISTS feedback (
  answer_id_hash   TEXT PRIMARY KEY,
  rating           TEXT NOT NULL CHECK (rating IN ('up','down')),
  comment          TEXT,
  level            TEXT,
  source_ids       TEXT,
  eco              BOOLEAN NOT NULL DEFAULT FALSE,
  shared_question  TEXT,
  shared_answer    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


@dataclass(frozen=True)
class FeedbackRow:
    answer_id_hash: str
    rating: str
    comment: str | None
    level: str | None
    source_ids: list[str]
    eco: bool
    shared_question: str | None
    shared_answer: str | None


class FeedbackStore(Protocol):
    def save(self, row: FeedbackRow) -> None:
        """같은 답변의 피드백은 마지막 것만 남긴다."""
        ...

    def purge(self, now: datetime) -> None: ...


class MemoryFeedbackStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.rows: dict[str, tuple[datetime, FeedbackRow]] = {}

    def save(self, row: FeedbackRow) -> None:
        with self._lock:
            self.rows[row.answer_id_hash] = (datetime.now(UTC), row)

    def purge(self, now: datetime) -> None:
        before = now - timedelta(days=KEEP_DAYS)
        with self._lock:
            for key in [k for k, (at, _) in self.rows.items() if at < before]:
                del self.rows[key]


class PostgresFeedbackStore:
    def __init__(self, url: str) -> None:
        import psycopg
        from psycopg_pool import ConnectionPool

        self._errors = psycopg.Error
        self._pool = ConnectionPool(
            url,
            min_size=0,
            max_size=2,
            kwargs={"autocommit": True, "prepare_threshold": None},
            open=True,
        )
        self._run(SCHEMA)

    def _run(self, sql: str, params: tuple = ()) -> None:
        try:
            with self._pool.connection() as conn:
                conn.execute(sql, params)
        except self._errors as exc:
            raise StoreError(type(exc).__name__) from None

    def save(self, row: FeedbackRow) -> None:
        self._run(
            "INSERT INTO feedback (answer_id_hash, rating, comment, level, source_ids, eco, "
            "shared_question, shared_answer) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (answer_id_hash) DO UPDATE SET rating = excluded.rating, "
            "comment = excluded.comment, level = excluded.level, source_ids = excluded.source_ids, "
            "eco = excluded.eco, shared_question = excluded.shared_question, "
            "shared_answer = excluded.shared_answer, created_at = now()",
            (
                row.answer_id_hash,
                row.rating,
                row.comment,
                row.level,
                json.dumps(row.source_ids),
                row.eco,
                row.shared_question,
                row.shared_answer,
            ),
        )

    def purge(self, now: datetime) -> None:
        self._run("DELETE FROM feedback WHERE created_at < %s", (now - timedelta(days=KEEP_DAYS),))
