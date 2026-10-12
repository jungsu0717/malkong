"""가족 공유 서비스 (SPEC-MY-05, task my/007) — 만들기 · 코드로 들어가기 · 나가기 · 맞추기."""

import secrets
import threading
import uuid
from collections import defaultdict
from datetime import date
from http import HTTPStatus

from app.common.core.exception import ApiException
from app.domain.entitlements.service import Device
from app.domain.family.schema import (
    BabyIn,
    FamilyInfo,
    RecordIn,
    SyncRequest,
    SyncResponse,
)
from app.infra.db.family_store import FamilyRow, FamilyStore, RecordRow
from app.infra.db.usage_store import StoreError

# 헷갈리는 글자(I · O · 0 · 1 · L)를 뺀 초대 코드 글자
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
MAX_MEMBERS = 6
# 코드 맞히기 시도 — 기기마다 하루. 메모리에서만 센다
MAX_JOIN_ATTEMPTS_PER_DAY = 20


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def _unavailable() -> ApiException:
    return ApiException(
        HTTPStatus.SERVICE_UNAVAILABLE, "STORE_UNAVAILABLE", "지금은 가족 저장소에 닿지 못했어요"
    )


class FamilyService:
    def __init__(self, store: FamilyStore) -> None:
        self._store = store
        self._lock = threading.Lock()
        self._attempts: dict[tuple[str, date], int] = defaultdict(int)

    def _info(self, family: FamilyRow) -> FamilyInfo:
        return FamilyInfo(
            family_id=family.id,
            invite_code=family.invite_code,
            members=self._store.member_count(family.id),
        )

    def _family(self, device: Device) -> FamilyRow:
        family = self._store.family_of(device.key_hash)
        if family is None:
            raise ApiException(HTTPStatus.NOT_FOUND, "NOT_IN_FAMILY", "아직 가족이 없어요")
        return family

    def info(self, device: Device) -> FamilyInfo:
        try:
            return self._info(self._family(device))
        except StoreError:
            raise _unavailable() from None

    def create(self, device: Device, consented_at: str) -> FamilyInfo:
        try:
            if self._store.family_of(device.key_hash) is not None:
                raise ApiException(HTTPStatus.CONFLICT, "ALREADY_IN_FAMILY", "이미 가족이 있어요")
            # 코드가 겹치면 다시 뽑는다 — 31^6 가운데 겹칠 일은 거의 없다
            code = new_code()
            while self._store.find_by_code(code) is not None:
                code = new_code()
            family = self._store.create(uuid.uuid4().hex, code, device.key_hash, consented_at)
            return self._info(family)
        except StoreError:
            raise _unavailable() from None

    def join(self, device: Device, code: str, consented_at: str, today: date) -> FamilyInfo:
        code = code.strip().upper()
        with self._lock:
            for stale in [k for k in self._attempts if k[1] != today]:
                del self._attempts[stale]
            slot = (device.key_hash, today)
            if self._attempts[slot] >= MAX_JOIN_ATTEMPTS_PER_DAY:
                raise ApiException(
                    HTTPStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", "오늘은 더 시도할 수 없어요"
                )
            self._attempts[slot] += 1
        try:
            family = self._store.find_by_code(code)
            if family is None:
                raise ApiException(
                    HTTPStatus.NOT_FOUND, "INVITE_NOT_FOUND", "맞는 초대 코드가 없어요"
                )
            mine = self._store.family_of(device.key_hash)
            if mine is not None:
                if mine.id == family.id:
                    return self._info(family)
                raise ApiException(
                    HTTPStatus.CONFLICT, "ALREADY_IN_FAMILY", "이미 다른 가족에 있어요"
                )
            if self._store.member_count(family.id) >= MAX_MEMBERS:
                raise ApiException(HTTPStatus.CONFLICT, "FAMILY_FULL", "가족이 가득 찼어요")
            self._store.add_member(family.id, device.key_hash, consented_at)
            return self._info(family)
        except StoreError:
            raise _unavailable() from None

    def leave(self, device: Device) -> None:
        try:
            family = self._family(device)
            self._store.remove_member(family.id, device.key_hash)
        except StoreError:
            raise _unavailable() from None

    def sync(self, device: Device, req: SyncRequest) -> SyncResponse:
        try:
            family = self._family(device)
            if req.baby is not None:
                self._store.put_baby(
                    family.id, req.baby.model_dump(by_alias=True), req.baby.updated_at
                )
            if req.records:
                self._store.upsert_records(
                    family.id,
                    [
                        RecordRow(r.id, r.model_dump(by_alias=True), r.updated_at, r.deleted, 0)
                        for r in req.records
                    ],
                )
            rows = self._store.records_since(family.id, req.since)
            baby = self._store.baby(family.id)
            return SyncResponse(
                seq=rows[-1].seq if rows else req.since,
                baby=BabyIn.model_validate(baby[0]) if baby else None,
                records=[RecordIn.model_validate({**r.data, "deleted": r.deleted}) for r in rows],
                members=self._store.member_count(family.id),
            )
        except StoreError:
            raise _unavailable() from None
