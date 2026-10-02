"""사용량 저장소 — 디바이스 키 해시 · 하루 사용 수 · 이미 센 질문 (backend 「사용량을 세는 법」).

두 가지 구현이 같은 계약을 따른다:
- PostgresUsageStore — Neon. `MALKONG_DATABASE_URL` 이 있을 때
- MemoryUsageStore — 접속 주소가 없을 때와 시험. 인스턴스가 바뀌면 잊는다

키 원문과 질문은 여기 오지 않는다. 서비스가 해시로 바꿔서 넘긴다.
"""

import threading
from collections import defaultdict
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, timedelta
from typing import Any, Protocol

# 서버가 뜰 때 없으면 만든다 — 표가 셋뿐이라 마이그레이션 도구 없이 간다
SCHEMA = """
CREATE TABLE IF NOT EXISTS device (
  key_hash    TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daily_usage (
  key_hash  TEXT NOT NULL,
  day       DATE NOT NULL,
  used      INTEGER NOT NULL DEFAULT 0,
  rewards   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, day)
);
CREATE TABLE IF NOT EXISTS counted_message (
  key_hash      TEXT NOT NULL,
  message_hash  TEXT NOT NULL,
  day           DATE NOT NULL,
  PRIMARY KEY (key_hash, message_hash)
);
"""

# 지우는 기준 — 하루 사용 수는 30일(개인정보 처리방침),
# 이미 센 질문 표시는 재시도만 막으면 되므로 2일
USAGE_KEEP_DAYS = 30
COUNTED_KEEP_DAYS = 2


class StoreError(Exception):
    """저장소에 닿지 못했다 — 서비스가 503 으로 바꾼다. 메시지에는 접속 주소를 넣지 않는다."""


class UsageStore(Protocol):
    def add_device(self, key_hash: str) -> None: ...

    def has_device(self, key_hash: str) -> bool: ...

    def usage(self, key_hash: str, day: date) -> tuple[int, int]:
        """(쓴 수, 광고 적립 수)"""
        ...

    def count_once(self, key_hash: str, day: date, message_hash: str) -> int:
        """처음 보는 질문이면 1 을 더한다. 더한 뒤(또는 이미 센 경우 그대로)의 쓴 수를 돌려준다."""
        ...

    def purge(self, today: date) -> None: ...


class MemoryUsageStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._devices: set[str] = set()
        self._used: dict[tuple[str, date], int] = defaultdict(int)
        self._rewards: dict[tuple[str, date], int] = defaultdict(int)
        self._counted: dict[tuple[str, str], date] = {}

    def add_device(self, key_hash: str) -> None:
        with self._lock:
            self._devices.add(key_hash)

    def has_device(self, key_hash: str) -> bool:
        return key_hash in self._devices

    def usage(self, key_hash: str, day: date) -> tuple[int, int]:
        return self._used.get((key_hash, day), 0), self._rewards.get((key_hash, day), 0)

    def count_once(self, key_hash: str, day: date, message_hash: str) -> int:
        with self._lock:
            if (key_hash, message_hash) not in self._counted:
                self._counted[(key_hash, message_hash)] = day
                self._used[(key_hash, day)] += 1
            return self._used[(key_hash, day)]

    def purge(self, today: date) -> None:
        usage_before = today - timedelta(days=USAGE_KEEP_DAYS)
        counted_before = today - timedelta(days=COUNTED_KEEP_DAYS)
        with self._lock:
            for key in [k for k in self._used if k[1] < usage_before]:
                del self._used[key]
            for key in [k for k in self._rewards if k[1] < usage_before]:
                del self._rewards[key]
            for key in [k for k, d in self._counted.items() if d < counted_before]:
                del self._counted[key]


class PostgresUsageStore:
    """Neon. 요청마다 풀에서 연결을 빌린다.

    라우트가 동기 def 라서 막히는 호출이어도 된다(server/AGENTS.md).
    """

    def __init__(self, url: str) -> None:
        # 지연 import — 접속 주소가 없는 환경(시험·로컬)에서는 psycopg 를 읽지 않는다
        from psycopg_pool import ConnectionPool

        # Neon 의 연결 풀러(PgBouncer)는 준비된 문(prepared statement)을 나눠 쓰지 못한다 — 끈다
        self._pool = ConnectionPool(
            url,
            min_size=0,
            max_size=4,
            kwargs={"autocommit": True, "prepare_threshold": None},
            open=True,
        )
        with self._conn() as conn:
            conn.execute(SCHEMA)

    @contextmanager
    def _conn(self) -> Iterator[Any]:
        import psycopg

        try:
            with self._pool.connection() as conn:
                yield conn
        except psycopg.Error as exc:
            raise StoreError(type(exc).__name__) from None

    def add_device(self, key_hash: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO device (key_hash) VALUES (%s) ON CONFLICT DO NOTHING", (key_hash,)
            )

    def has_device(self, key_hash: str) -> bool:
        with self._conn() as conn:
            row = conn.execute("SELECT 1 FROM device WHERE key_hash = %s", (key_hash,)).fetchone()
        return row is not None

    def usage(self, key_hash: str, day: date) -> tuple[int, int]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT used, rewards FROM daily_usage WHERE key_hash = %s AND day = %s",
                (key_hash, day),
            ).fetchone()
        return (row[0], row[1]) if row else (0, 0)

    def count_once(self, key_hash: str, day: date, message_hash: str) -> int:
        with self._conn() as conn, conn.transaction():
            fresh = conn.execute(
                "INSERT INTO counted_message (key_hash, message_hash, day) VALUES (%s, %s, %s) "
                "ON CONFLICT DO NOTHING RETURNING 1",
                (key_hash, message_hash, day),
            ).fetchone()
            if fresh:
                row = conn.execute(
                    "INSERT INTO daily_usage (key_hash, day, used) VALUES (%s, %s, 1) "
                    "ON CONFLICT (key_hash, day) DO UPDATE SET used = daily_usage.used + 1 "
                    "RETURNING used",
                    (key_hash, day),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT used FROM daily_usage WHERE key_hash = %s AND day = %s",
                    (key_hash, day),
                ).fetchone()
        return row[0] if row else 0

    def purge(self, today: date) -> None:
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM daily_usage WHERE day < %s",
                (today - timedelta(days=USAGE_KEEP_DAYS),),
            )
            conn.execute(
                "DELETE FROM counted_message WHERE day < %s",
                (today - timedelta(days=COUNTED_KEEP_DAYS),),
            )
