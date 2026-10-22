"""가족 공유 요청 · 응답 — docs/architecture/api-contract.md 「/v1/family」(task my/007).

아기와 기록은 폰의 모양(backend 「기기 DB 스키마」의 baby · record)을 그대로 실어 나른다.
"""

import json
from typing import Any, Literal

from pydantic import Field, field_validator

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
    # 변 색 — 대변이 있을 때(task log/002)
    color: Literal["yellow", "brown", "green", "black", "red", "white"] | None = None
    note: str | None = Field(default=None, max_length=500)
    created_at: NonEmptyStr = Field(max_length=40)
    updated_at: NonEmptyStr = Field(max_length=40)
    deleted: bool = False


ItemKind = Literal["topic", "todo", "routine", "routineLog", "memo"]
# 이 서버가 받는 줄 종류 — 응답에 실어 보낸다.
# 앱이 옛 서버에 모르는 종류(메모)를 보내 요청 전체가 거절되는 일을 피한다
ITEM_KINDS: list[str] = ["topic", "todo", "routine", "routineLog", "memo"]

# 한 줄의 내용(data)이 이보다 길면 받지 않는다 — 할 일 · 루틴 한 줄은 수백 자면 충분하다
MAX_ITEM_DATA_CHARS = 4000


class ItemIn(ApiModel):
    """할 일 · 주제 · 루틴 · 루틴 기록 · 우리 아기 메모 한 줄(task my/009 · common/024).

    폰의 줄을 data 에 그대로 싣는다. 서버는 내용을 읽지 않는다.
    """

    kind: ItemKind
    id: NonEmptyStr = Field(max_length=100)
    updated_at: NonEmptyStr = Field(max_length=40)
    deleted: bool = False
    data: dict[str, Any] = {}

    @field_validator("data")
    @classmethod
    def _small(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(json.dumps(value, ensure_ascii=False)) > MAX_ITEM_DATA_CHARS:
            raise ValueError("data is too large")
        return value


class SyncRequest(ApiModel):
    # 마지막으로 받은 번호 — 그 뒤에 바뀐 것만 받는다. 처음이면 0
    since: int = Field(default=0, ge=0)
    baby: BabyIn | None = None
    records: list[RecordIn] = Field(default=[], max_length=500)
    # 빠른 기록 — 하루 수십 줄이라 기록보다 넉넉히(SPEC-LOG-07)
    events: list[EventIn] = Field(default=[], max_length=2000)
    # 할 일 · 주제 · 루틴 · 루틴 기록(task my/009) — 옛 앱은 보내지 않는다
    items: list[ItemIn] = Field(default=[], max_length=2000)


class SyncResponse(ApiModel):
    seq: int
    baby: BabyIn | None
    records: list[RecordIn]
    events: list[EventIn] = []
    # 이 칸이 오면 서버가 items 를 받아 준 것이다 — 앱은 그때만 올린 때를 넘긴다
    items: list[ItemIn] = []
    # 이 서버가 받는 줄 종류 — 앱은 여기에 있는 종류만 올린다(메모는 2026-10-22 부터)
    item_kinds: list[str] = Field(default_factory=lambda: list(ITEM_KINDS))
    members: int
