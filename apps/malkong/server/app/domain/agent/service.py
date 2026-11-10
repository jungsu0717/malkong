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
    MAX_CALLS,
    MAX_HIGHLIGHT,
    MODEL_SCHEMA,
    SYSTEM_PROMPT,
    TOOLS,
    TOOLS_PROMPT,
    TOOLS_SCHEMA,
    user_message,
)
from app.domain.agent.schema import (
    AgentAction,
    AgentRequest,
    AgentResponse,
    ContextRecord,
    ModelAnswer,
    ToolCall,
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
        if self._model is None or not self._settings.agent_enabled:
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
        # 기능 목록을 실행할 수 있는 앱에만 「앱 기능」 절과 tools 답을 연다(decisions/043)
        system, schema = (
            (TOOLS_PROMPT, TOOLS_SCHEMA) if req.tools else (SYSTEM_PROMPT, MODEL_SCHEMA)
        )
        try:
            text = await self._model.generate_json(system, message, schema)
        except ModelError as exc:
            # exc 에는 예외 종류와 상태 코드만 있다
            logger.warning("agent: 모델에 닿지 못함 (%s)", exc)
            raise _unavailable() from None
        res = read_answer(text, req)
        # 모델을 부른 횟수를 답의 종류로만 센다 — 문장, 기록, 모델 답은 적지 않는다(decisions/044).
        # Cloud Run 로그에서 「agent: 답」으로 찾아 하루 몇 번 모델로 갔는지 본다
        tools = ",".join(c.tool for c in res.calls)
        logger.info(
            "agent: 답 %s%s 기록 %d개", res.type, f" ({tools})" if tools else "", len(req.records)
        )
        return res

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

    if answer.type == "tools":
        if not req.tools:
            return _unknown()
        calls: list[ToolCall] = []
        # 기간을 쓰는 줄이 하나뿐인가 — 그때만 문장의 기간 낱말로 바로잡는다
        uses_range = [
            i
            for i in answer.calls
            if isinstance(i, dict) and "range" in _TOOL_ARGS.get(i.get("tool"), [])
        ]
        single = len(uses_range) <= 1
        for c in (_call(item, req.text, single) for item in answer.calls):
            # 같은 줄이 두 번 오면 하나만 — 기간마다 줄을 나눠 쓴 답을 채우면 같은 줄이 된다
            if c and c not in calls:
                calls.append(c)
        if not calls:
            return _unknown()
        return AgentResponse(type="tools", calls=calls[:MAX_CALLS], highlight=highlight)

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


# 기능마다 쓰는 값 — tools.json 의 args 이름(camelCase)을 파이썬 칸 이름으로
_TOOL_ARGS = {t["name"]: t["args"] for t in TOOLS["tools"]}
_FIELD = {"rangeB": "range_b"}
# 견줄 기간을 말하지 않았을 때 — 오늘은 어제와, 이번 주는 지난주와
_RANGE_B = {
    "today": "yesterday",
    "thisWeek": "lastWeek",
    "recent7": "lastWeek",
    "tonight": "lastNight",
}
# 무엇을 셀지 말하지 않았을 때 — 찾기 규칙(find-parse.ts readMeasure)과 같다
_MEASURE = {
    "sleep": "duration",
    "nap": "duration",
    "night": "duration",
    "breast": "duration",
    "formula": "amount",
}


# 문장의 기간 낱말 — 앞에 있는 것부터 본다. 「어제 밤」의 「어제」처럼 겹치면 앞줄이 이긴다
_RANGE_WORDS = [
    ("lastNight", re.compile(r"어젯밤|어제\s*밤|지난\s*밤")),
    ("tonight", re.compile(r"오늘\s*밤")),
    ("thisWeek", re.compile(r"이번\s*주")),
    ("lastWeek", re.compile(r"지난\s*주|저번\s*주")),
    ("recent7", re.compile(r"최근\s*(일주일|7일)|요즘\s*일주일")),
    ("recent30", re.compile(r"한\s*달|30일")),
    ("yesterday", re.compile(r"어제")),
    ("today", re.compile(r"오늘")),
]


def ranges_in(text: str) -> list[str]:
    """문장에 나온 기간을 나온 차례대로 — 「이번 주 낮잠이 지난주보다」는 thisWeek, lastWeek."""
    taken: list[tuple[int, int]] = []
    found: list[tuple[int, str]] = []
    for key, pattern in _RANGE_WORDS:
        for m in pattern.finditer(text):
            if any(m.start() < b and a < m.end() for a, b in taken):
                continue
            taken.append((m.start(), m.end()))
            found.append((m.start(), key))
    keys: list[str] = []
    for _, key in sorted(found):
        if key not in keys:
            keys.append(key)
    return keys


def _fill(call: ToolCall, text: str = "", single: bool = True) -> ToolCall:
    """모델이 빠뜨린 값을 채운다.

    실제 호출에서 total · compare_ranges 의 기간을 range 대신 when 에 쓰고
    measure 와 rangeB 를 비운 일이 있다(2026-11-10). 다른 칸에 쓴 날(오늘 · 어제)을 옮기고,
    셀 것과 견줄 기간은 정해 둔 값으로 둔다.
    """
    days = ("today", "yesterday")
    spoken = next((v for v in (call.range, call.when, call.day) if v in days), None)
    names = _TOOL_ARGS.get(call.tool, [])
    update: dict[str, Any] = {}
    # 기간은 문장의 낱말이 정본이다 — 두 번째 실제 호출에서 「어젯밤」, 「이번 주 … 지난주」를
    # 오늘로 잡았다(2026-11-10). 기간을 쓰는 줄이 하나일 때만 바로잡는다
    # (여럿이면 어느 줄의 기간인지 모른다)
    said = ranges_in(text)
    if "range" in names and single and said and call.range not in said:
        update["range"] = said[0]
    if "rangeB" in names and single and len(said) > 1 and call.range_b not in said[1:]:
        update["range_b"] = said[1]
    if "range" in names and call.range is None and "range" not in update:
        update["range"] = spoken or (said[0] if said else "today")
    if "when" in names and call.when is None:
        update["when"] = spoken or "viewing"
    if "day" in names and call.day is None:
        update["day"] = spoken or "viewing"
    if "sleep" in names and call.sleep is None:
        update["sleep"] = "any"
    if "measure" in names and call.measure is None and call.what:
        update["measure"] = _MEASURE.get(call.what, "count")
    if "rangeB" in names and call.range_b is None and "range_b" not in update:
        rng = update.get("range", call.range)
        if rng in _RANGE_B:
            update["range_b"] = _RANGE_B[rng]
    return call.model_copy(update=update) if update else call


def _call(item: Any, text: str = "", single: bool = True) -> ToolCall | None:
    """기능 한 줄 다듬기.

    목록에 없는 기능, 빠지거나 목록에 없는 값이 있으면 None(그 줄을 버린다).
    """
    try:
        call = ToolCall.model_validate(item)
    except ValidationError:
        return None
    names = _TOOL_ARGS.get(call.tool)
    if names is None:
        return None
    call = _fill(call, text, single)
    values: dict[str, Any] = {}
    for name in names:
        arg = TOOLS["args"][name]
        value = getattr(call, _FIELD.get(name, name))
        if arg.get("type") == "string":
            # 찾을 이름은 낱말 하나 — 혼잣말 흔적이나 문장이면 버린다
            value = plain_text(value, arg["maxLength"])
        elif value not in arg["values"]:
            value = None
        if value is None:
            return None
        values[_FIELD.get(name, name)] = value
    return ToolCall(tool=call.tool, **values)
