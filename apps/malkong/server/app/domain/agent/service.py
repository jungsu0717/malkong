"""물어보기 서비스 — 문장과 보고 있는 날의 기록을 모델에 한 번 보내 가리키는 기록이나
바꿀 것 목록을 받는다.

근거는 decisions/040 과 task common/032. 모델 답은 칸마다 검사해서 맞지 않는 줄은 버린다.
모델이 쓴 문장은 내보내지 않는다 — 답 문장은 앱이 가리키는 기록으로 쓴다(헌장 13). 실제 호출에서
모델이 정해진 JSON 칸 안에 혼잣말을 쓰거나 같은 말을 되풀이한 일이 있었다(2026-11-09).
저장과 반영은 앱이 사람 확인을 받아서 한다. 서버는 보낸 기록을 가리키는 줄만 남긴다.
문장, 기록, 대화, 모델 답은 저장하지도 로그에 남기지도 않는다(server/AGENTS.md 「금지」).
"""

import json
import logging
import re
import threading
from collections import defaultdict
from datetime import date, datetime
from http import HTTPStatus
from typing import Any

from pydantic import ValidationError

from app.common.core.exception import ApiException
from app.common.core.setting import Settings
from app.domain.agent.prompt import (
    MAX_ACTIONS,
    MAX_HIGHLIGHT,
    MODEL_SCHEMA,
    SYSTEM_PROMPT,
    user_message,
)
from app.domain.agent.schema import (
    AgentAction,
    AgentRequest,
    AgentResponse,
    ContextRecord,
    ModelAnswer,
)
from app.domain.entitlements.service import Device
from app.domain.parse.schema import FindQuestion, ParsedRecord
from app.domain.parse.service import FIELDS, OPTIONAL, clean_record, to_local
from app.infra.llm.base import JsonModel, ModelError

logger = logging.getLogger("uvicorn.error")

# 메모(note)를 붙일 수 있는 기록 — 루틴과 메모는 title 이 글이라 note 가 없다
NOTE_KINDS = {"breast", "formula", "diaper", "sleep", "temp", "weight", "height"}
# 일정 이름의 길이 상한 — 「2개월 접종」, 「병원 예약」처럼 짧은 이름만 받는다
MAX_PLAN_TITLE = 20
# 모델이 글 칸에 혼잣말을 쓴 흔적 — 한글과 라틴 글자, 흔한 기호 밖의 글자(다른 나라 글자)나
# 스키마 칸 이름, 기록 번호(r12), 화살표. 실제 호출에서 「2개월 접종Parse error: … No, wait」,
# 「2개월 접종 বয়স 확인 필요함 …」을 본 뒤에 둔다
LEAK = re.compile(
    r"[^\u0020-\u007e\u00b7\u2103\u3000-\u303f\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3\uff01-\uff5e\n]"
    r"|error|wait|highlight|start_?at|end_?at|has_?time|json|->|→|\br\d{1,3}\b",
    re.IGNORECASE,
)


def plain_text(value: str | None, limit: int) -> str | None:
    """사람이 쓴 것 같은 짧은 글만 — 비었거나, 길거나, 혼잣말 흔적이 있으면 None."""
    if value is None:
        return None
    text = value.strip()
    if not text or len(text) > limit or LEAK.search(text):
        return None
    return text


def _unknown() -> AgentResponse:
    return AgentResponse(type="unknown")


class AgentService:
    def __init__(self, model: JsonModel | None, settings: Settings) -> None:
        self._model = model
        self._settings = settings
        self._lock = threading.Lock()
        # (기기 키 해시, 날짜) → 오늘 물어본 수. 메모리에서만 센다
        self._calls: dict[tuple[str, date], int] = defaultdict(int)

    async def ask(self, device: Device, req: AgentRequest, today: date) -> AgentResponse:
        if self._model is None:
            raise _unavailable()
        self._count(device, today)
        message = user_message(
            req.text,
            req.now,
            day=req.day,
            records=req.records,
            selected=req.selected,
            history=req.history,
        )
        try:
            text = await self._model.generate_json(SYSTEM_PROMPT, message, MODEL_SCHEMA)
        except ModelError as exc:
            # exc 에는 예외 종류와 상태 코드만 있다
            logger.warning("agent: 모델에 닿지 못함 (%s)", exc)
            raise _unavailable() from None
        return read_answer(text, req)

    def _count(self, device: Device, today: date) -> None:
        with self._lock:
            # 지난날의 수는 버린다
            for stale in [k for k in self._calls if k[1] != today]:
                del self._calls[stale]
            slot = (device.key_hash, today)
            if self._calls[slot] >= self._settings.agent_per_device_per_day:
                raise ApiException(
                    HTTPStatus.TOO_MANY_REQUESTS, "LIMIT_EXCEEDED", "오늘은 더 물어볼 수 없어요"
                )
            self._calls[slot] += 1


def _unavailable() -> ApiException:
    return ApiException(
        HTTPStatus.SERVICE_UNAVAILABLE, "MODEL_UNAVAILABLE", "지금은 물어볼 수 없어요"
    )


def read_answer(text: str, req: AgentRequest) -> AgentResponse:
    """모델 답(JSON 글)을 검사해 응답으로 바꾼다. 겉모양이 틀리면 unknown."""
    try:
        answer = ModelAnswer.model_validate(json.loads(text))
    except (ValueError, ValidationError):
        # 모델 답은 남기지 않는다 — 문장이나 기록을 되풀이했을 수 있다
        logger.warning("agent: 모델 답의 형식이 맞지 않음 (길이 %d)", len(text))
        return _unknown()

    # 건강 질문과 그 밖의 말에는 앱이 정해 둔 글을 보인다 — 모델이 쓴 글은 싣지 않는다
    if answer.type in ("health", "unknown"):
        return AgentResponse(type=answer.type)

    records = {r.ref: r for r in req.records}
    highlight = _highlight(answer.highlight, records)

    if answer.type == "question":
        try:
            question = FindQuestion.model_validate(answer.question)
        except ValidationError:
            return _unknown()
        return AgentResponse(type="question", question=question, highlight=highlight)

    if answer.type == "changes":
        actions = [a for a in (_action(item, records, req.now) for item in answer.actions) if a]
        if not actions:
            return _unknown()
        return AgentResponse(type="changes", actions=actions[:MAX_ACTIONS], highlight=highlight)

    # answer — 가리키는 기록만 보낸다. 비어 있으면 앱이 「그날 기록에서 찾지 못했어요」를 보인다
    return AgentResponse(type="answer", highlight=highlight)


def _highlight(values: list[Any], records: dict[str, ContextRecord]) -> list[str]:
    # 보낸 기록의 ref 만, 겹치지 않게, 앞에서부터
    refs: list[str] = []
    for value in values:
        if isinstance(value, str) and value in records and value not in refs:
            refs.append(value)
    return refs[:MAX_HIGHLIGHT]


def _action(item: Any, records: dict[str, ContextRecord], now: datetime) -> AgentAction | None:
    """바꿀 것 한 줄 다듬기. op 마다 쓰는 칸만 남기고, 맞지 않으면 None(그 줄을 버린다)."""
    try:
        action = AgentAction.model_validate(item)
    except ValidationError:
        return None
    if action.op == "add":
        return _add(action, now)
    if action.op == "plan":
        return _plan(action, now)
    record = records.get(action.ref or "")
    if record is None:
        return None
    if action.op == "delete":
        return AgentAction(op="delete", ref=record.ref, kind=record.kind)
    return _update(action, record, now)


def _add(action: AgentAction, now: datetime) -> AgentAction | None:
    # 새 기록은 문장 읽기의 기록 한 줄과 같은 규칙으로 다듬는다
    if action.kind is None:
        return None
    values = {name: getattr(action, name) for name in OPTIONAL}
    if values["title"] is not None:
        values["title"] = plain_text(values["title"], 300)
    record = clean_record(ParsedRecord(kind=action.kind, **values), now)
    if record is None:
        return None
    return AgentAction(op="add", **record.model_dump(by_alias=False))


def _plan(action: AgentAction, now: datetime) -> AgentAction | None:
    title = plain_text(action.title, MAX_PLAN_TITLE)
    if not title or action.start_at is None:
        return None
    return AgentAction(
        op="plan",
        title=title,
        start_at=to_local(action.start_at, now),
        # 시각을 말했는지 모델이 적지 않았으면 시각이 있는 일정으로 본다
        has_time=True if action.has_time is None else action.has_time,
    )


def _update(action: AgentAction, record: ContextRecord, now: datetime) -> AgentAction | None:
    """그 기록의 종류에 있는 칸 가운데 지금 값과 다른 칸만 남긴다. 바뀌는 칸이 없으면 버린다."""
    allowed = FIELDS[record.kind] | ({"note"} if record.kind in NOTE_KINDS else set())
    # 실제 호출에서 「이 기록에 메모: …」를 note 대신 title 에 쓴 일이 있다(2026-11-09).
    # title 이 없는 기록 종류에 title 만 왔으면 기록에 붙이는 메모로 읽는다
    if record.kind in NOTE_KINDS and action.note is None and action.title:
        action = action.model_copy(update={"note": action.title, "title": None})
    # 글 칸(메모, 루틴 · 메모 이름)에 혼잣말 흔적이 있으면 그 칸은 바뀌지 않은 것으로 본다
    action = action.model_copy(
        update={"note": plain_text(action.note, 300), "title": plain_text(action.title, 300)}
    )
    changes: dict[str, Any] = {}
    for name in sorted(allowed):
        value = getattr(action, name)
        if value is None or value == "":
            continue
        if name in ("start_at", "end_at"):
            value = to_local(value, now)
        # 보낸 기록에는 걸린 시간(minutes) 칸이 없어서, 모델이 적었으면 바뀌는 것으로 본다
        if value == getattr(record, name, None):
            continue
        changes[name] = value
    # 소변 기저귀에는 변 색이 없다
    if changes.get("diaper", record.diaper) == "pee":
        changes.pop("color", None)
    if not changes:
        return None
    return AgentAction(op="update", ref=record.ref, kind=record.kind, **changes)
