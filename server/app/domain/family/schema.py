"""가족 공유 요청 · 응답 — docs/architecture/api-contract.md 「/v1/family」(task my/007).

아기와 기록은 폰의 모양(backend 「기기 DB 스키마」의 baby · record)을 그대로 실어 나른다.
"""

from typing import Literal

from pydantic import Field

from app.common.core.schema import ApiModel, NonEmptyStr


class ConsentIn(ApiModel):
    """가족을 만들거나 들어갈 때 — 아기 · 건강 기록의 서버 저장 · 가족 공유에 동의한 때(ISO)."""

    consented_at: NonEmptyStr = Field(max_length=40)


class JoinRequest(ConsentIn):
    code: NonEmptyStr = Field(max_length=12)


class FamilyInfo(ApiModel):
    family_id: str
    invite_code: str
    members: int


class BabyIn(ApiModel):
    id: NonEmptyStr = Field(max_length=100)
    name: str | None = Field(default=None, max_length=100)
    birth_date: NonEmptyStr = Field(max_length=10)
    created_at: NonEmptyStr = Field(max_length=40)
    updated_at: NonEmptyStr = Field(max_length=40)


class RecordIn(ApiModel):
    id: NonEmptyStr = Field(max_length=100)
    kind: Literal["기록", "요약"]
    label: str = Field(max_length=2000)
    covers: list[str] = Field(default=[], max_length=100)
    when_label: str | None = Field(default=None, max_length=200)
    source_message_id: str | None = Field(default=None, max_length=100)
    stale: bool = False
    created_at: NonEmptyStr = Field(max_length=40)
    updated_at: NonEmptyStr = Field(max_length=40)
    # 지운 기록 — 다른 폰에서도 지워진다. 내용은 비워 보내도 된다
    deleted: bool = False


class EventIn(ApiModel):
    """빠른 기록 한 줄(SPEC-LOG-07) — 폰의 care_event 모양 그대로."""

    id: NonEmptyStr = Field(max_length=100)
    kind: Literal["breast", "formula", "diaper", "sleep", "temp", "weight", "height"]
    start_at: NonEmptyStr = Field(max_length=40)
    # 비어 있으면 재는 중
    end_at: str | None = Field(default=None, max_length=40)
    amount: float | None = None
    side: Literal["left", "right"] | None = None
    diaper: Literal["pee", "poo", "both"] | None = None
    note: str | None = Field(default=None, max_length=500)
    created_at: NonEmptyStr = Field(max_length=40)
    updated_at: NonEmptyStr = Field(max_length=40)
    deleted: bool = False


class SyncRequest(ApiModel):
    # 마지막으로 받은 번호 — 그 뒤에 바뀐 것만 받는다. 처음이면 0
    since: int = Field(default=0, ge=0)
    baby: BabyIn | None = None
    records: list[RecordIn] = Field(default=[], max_length=500)
    # 빠른 기록 — 하루 수십 줄이라 기록보다 넉넉히(SPEC-LOG-07)
    events: list[EventIn] = Field(default=[], max_length=2000)


class SyncResponse(ApiModel):
    seq: int
    baby: BabyIn | None
    records: list[RecordIn]
    events: list[EventIn] = []
    members: int
