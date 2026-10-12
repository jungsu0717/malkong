"""가족 공유 저장소 — 가족 · 구성원(기기 키 해시) · 아기 · 기록 (SPEC-MY-05, task my/007).

서버가 아기 데이터를 갖는 유일한 자리다. 가족 공유를 켜고(동의) 들어온 기기의 것만
들어온다(backend 「DB — 두 단계」). 아기와 기록은 폰의 모양 그대로 JSON 으로 둔다 —
서버는 내용을 읽지 않고 맞추기만 한다.

맞추는 규칙: 마지막으로 고친 쪽이 이긴다(`updated_at` 비교, 폰이 적은 ISO 시각).
기록마다 늘어나는 번호(`seq`)를 매겨 폰이 「그 뒤에 바뀐 것만」 받는다.
지운 기록은 `deleted` 표시로 남겨 다른 폰에서도 지워지게 한다.

두 가지 구현이 같은 계약을 따른다 — PostgresFamilyStore(Neon) · MemoryFamilyStore(시험 · 주소 없음).
"""

import json
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from app.infra.db.usage_store import StoreError

SCHEMA = """
CREATE TABLE IF NOT EXISTS family (
  id           TEXT PRIMARY KEY,
  invite_code  TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_member (
  device_hash   TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  consented_at  TEXT NOT NULL,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_family_member_family ON family_member(family_id);
CREATE TABLE IF NOT EXISTS family_baby (
  family_id   TEXT PRIMARY KEY REFERENCES family(id) ON DELETE CASCADE,
  baby_json   TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS family_record (
  family_id    TEXT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  id           TEXT NOT NULL,
  record_json  TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  seq          BIGSERIAL,
  PRIMARY KEY (family_id, id)
);
CREATE INDEX IF NOT EXISTS ix_family_record_seq ON family_record(family_id, seq);
"""


@dataclass(frozen=True)
class FamilyRow:
    id: str
    invite_code: str
    created_at: datetime


@dataclass(frozen=True)
class RecordRow:
    """기록 한 줄 — 내용은 JSON 그대로, 맞추기에 필요한 것만 따로."""

    id: str
    data: dict[str, Any]
    updated_at: str
    deleted: bool
    seq: int


class FamilyStore(Protocol):
    def family_of(self, device_hash: str) -> FamilyRow | None: ...

    def find_by_code(self, code: str) -> FamilyRow | None: ...

    def create(self, family_id: str, code: str, device_hash: str, consented_at: str) -> FamilyRow:
        """가족을 만들고 그 기기를 첫 구성원으로 넣는다."""
        ...

    def add_member(self, family_id: str, device_hash: str, consented_at: str) -> None: ...

    def member_count(self, family_id: str) -> int: ...

    def remove_member(self, family_id: str, device_hash: str) -> int:
        """구성원에서 뺀다. 남은 수를 돌려주고, 0이면 가족과 데이터를 지운다."""
        ...

    def baby(self, family_id: str) -> tuple[dict[str, Any], str] | None:
        """(아기 JSON, updated_at) — 없으면 None."""
        ...

    def put_baby(self, family_id: str, data: dict[str, Any], updated_at: str) -> None:
        """더 늦게 고친 것일 때만 덮는다."""
        ...

    def upsert_records(self, family_id: str, rows: list[RecordRow]) -> None:
        """기록마다 더 늦게 고친 것일 때만 덮고 새 번호를 매긴다. seq 는 무시한다."""
        ...

    def records_since(self, family_id: str, since: int) -> list[RecordRow]:
        """번호가 since 보다 큰 기록 — 번호 순."""
        ...


class MemoryFamilyStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._families: dict[str, FamilyRow] = {}
        self._members: dict[str, tuple[str, str]] = {}  # device_hash → (family_id, consented_at)
        self._babies: dict[str, tuple[dict[str, Any], str]] = {}
        self._records: dict[str, dict[str, RecordRow]] = {}
        self._seq = 0

    def family_of(self, device_hash: str) -> FamilyRow | None:
        member = self._members.get(device_hash)
        return self._families.get(member[0]) if member else None

    def find_by_code(self, code: str) -> FamilyRow | None:
        return next((f for f in self._families.values() if f.invite_code == code), None)

    def create(self, family_id: str, code: str, device_hash: str, consented_at: str) -> FamilyRow:
        with self._lock:
            row = FamilyRow(family_id, code, datetime.now(UTC))
            self._families[family_id] = row
            self._members[device_hash] = (family_id, consented_at)
            self._records[family_id] = {}
            return row

    def add_member(self, family_id: str, device_hash: str, consented_at: str) -> None:
        with self._lock:
            self._members[device_hash] = (family_id, consented_at)

    def member_count(self, family_id: str) -> int:
        return sum(1 for fid, _ in self._members.values() if fid == family_id)

    def remove_member(self, family_id: str, device_hash: str) -> int:
        with self._lock:
            self._members.pop(device_hash, None)
            left = self.member_count(family_id)
            if left == 0:
                self._families.pop(family_id, None)
                self._babies.pop(family_id, None)
                self._records.pop(family_id, None)
            return left

    def baby(self, family_id: str) -> tuple[dict[str, Any], str] | None:
        return self._babies.get(family_id)

    def put_baby(self, family_id: str, data: dict[str, Any], updated_at: str) -> None:
        with self._lock:
            current = self._babies.get(family_id)
            if current is None or current[1] < updated_at:
                self._babies[family_id] = (dict(data), updated_at)

    def upsert_records(self, family_id: str, rows: list[RecordRow]) -> None:
        with self._lock:
            table = self._records.setdefault(family_id, {})
            for row in rows:
                current = table.get(row.id)
                if current is not None and current.updated_at >= row.updated_at:
                    continue
                self._seq += 1
                table[row.id] = RecordRow(
                    row.id, dict(row.data), row.updated_at, row.deleted, self._seq
                )

    def records_since(self, family_id: str, since: int) -> list[RecordRow]:
        rows = [r for r in self._records.get(family_id, {}).values() if r.seq > since]
        return sorted(rows, key=lambda r: r.seq)


class PostgresFamilyStore:
    """Neon. 사용량 저장소와 같은 풀 설정(server/AGENTS.md)."""

    def __init__(self, url: str) -> None:
        from psycopg_pool import ConnectionPool

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

    def family_of(self, device_hash: str) -> FamilyRow | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT f.id, f.invite_code, f.created_at FROM family_member m "
                "JOIN family f ON f.id = m.family_id WHERE m.device_hash = %s",
                (device_hash,),
            ).fetchone()
        return FamilyRow(*row) if row else None

    def find_by_code(self, code: str) -> FamilyRow | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT id, invite_code, created_at FROM family WHERE invite_code = %s", (code,)
            ).fetchone()
        return FamilyRow(*row) if row else None

    def create(self, family_id: str, code: str, device_hash: str, consented_at: str) -> FamilyRow:
        with self._conn() as conn, conn.transaction():
            row = conn.execute(
                "INSERT INTO family (id, invite_code) VALUES (%s, %s) "
                "RETURNING id, invite_code, created_at",
                (family_id, code),
            ).fetchone()
            conn.execute(
                "INSERT INTO family_member (device_hash, family_id, consented_at) "
                "VALUES (%s, %s, %s)",
                (device_hash, family_id, consented_at),
            )
        return FamilyRow(*row)

    def add_member(self, family_id: str, device_hash: str, consented_at: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO family_member (device_hash, family_id, consented_at) "
                "VALUES (%s, %s, %s) ON CONFLICT (device_hash) DO UPDATE "
                "SET family_id = EXCLUDED.family_id, consented_at = EXCLUDED.consented_at",
                (device_hash, family_id, consented_at),
            )

    def member_count(self, family_id: str) -> int:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT count(*) FROM family_member WHERE family_id = %s", (family_id,)
            ).fetchone()
        return int(row[0]) if row else 0

    def remove_member(self, family_id: str, device_hash: str) -> int:
        with self._conn() as conn, conn.transaction():
            conn.execute("DELETE FROM family_member WHERE device_hash = %s", (device_hash,))
            left = int(
                conn.execute(
                    "SELECT count(*) FROM family_member WHERE family_id = %s", (family_id,)
                ).fetchone()[0]
            )
            if left == 0:
                # 아기 · 기록은 ON DELETE CASCADE 로 함께 지워진다
                conn.execute("DELETE FROM family WHERE id = %s", (family_id,))
        return left

    def baby(self, family_id: str) -> tuple[dict[str, Any], str] | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT baby_json, updated_at FROM family_baby WHERE family_id = %s", (family_id,)
            ).fetchone()
        return (json.loads(row[0]), row[1]) if row else None

    def put_baby(self, family_id: str, data: dict[str, Any], updated_at: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO family_baby (family_id, baby_json, updated_at) VALUES (%s, %s, %s) "
                "ON CONFLICT (family_id) DO UPDATE SET baby_json = EXCLUDED.baby_json, "
                "updated_at = EXCLUDED.updated_at "
                "WHERE family_baby.updated_at < EXCLUDED.updated_at",
                (family_id, json.dumps(data, ensure_ascii=False), updated_at),
            )

    def upsert_records(self, family_id: str, rows: list[RecordRow]) -> None:
        if not rows:
            return
        with self._conn() as conn, conn.transaction():
            for row in rows:
                conn.execute(
                    "INSERT INTO family_record (family_id, id, record_json, updated_at, deleted) "
                    "VALUES (%s, %s, %s, %s, %s) "
                    "ON CONFLICT (family_id, id) DO UPDATE SET record_json = EXCLUDED.record_json, "
                    "updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, "
                    "seq = nextval('family_record_seq_seq') "
                    "WHERE family_record.updated_at < EXCLUDED.updated_at",
                    (
                        family_id,
                        row.id,
                        json.dumps(row.data, ensure_ascii=False),
                        row.updated_at,
                        row.deleted,
                    ),
                )

    def records_since(self, family_id: str, since: int) -> list[RecordRow]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, record_json, updated_at, deleted, seq FROM family_record "
                "WHERE family_id = %s AND seq > %s ORDER BY seq",
                (family_id, since),
            ).fetchall()
        return [RecordRow(r[0], json.loads(r[1]), r[2], bool(r[3]), int(r[4])) for r in rows]
