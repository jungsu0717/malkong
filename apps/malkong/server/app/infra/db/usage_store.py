"""기기 저장소 — 디바이스 키 해시(backend 「기기 키」).

두 가지 구현이 같은 계약을 따른다:
- PostgresUsageStore — Neon. `MALKONG_DATABASE_URL` 이 있을 때
- MemoryUsageStore — 접속 주소가 없을 때와 시험. 인스턴스가 바뀌면 잊는다

키 원문은 여기 오지 않는다. 서비스가 해시로 바꿔서 넘긴다.
질문 답변 기능을 뺀 뒤(2026-10-22, task common/022)로는 하루 사용 수 · 비용 표를
만들지도 쓰지도 않는다.
"""

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Protocol

# 서버가 뜰 때 없으면 만든다 — 표가 하나라 마이그레이션 도구 없이 간다
SCHEMA = """
CREATE TABLE IF NOT EXISTS device (
  key_hash    TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


class StoreError(Exception):
    """저장소에 닿지 못했다 — 서비스가 503 으로 바꾼다. 메시지에는 접속 주소를 넣지 않는다."""


class UsageStore(Protocol):
    def add_device(self, key_hash: str) -> None: ...

    def has_device(self, key_hash: str) -> bool: ...


class MemoryUsageStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._devices: set[str] = set()

    def add_device(self, key_hash: str) -> None:
        with self._lock:
            self._devices.add(key_hash)

    def has_device(self, key_hash: str) -> bool:
        return key_hash in self._devices


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
