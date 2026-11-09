"""물어보기에 쓰는 모델 지시문, 답 모양(JSON 스키마), 모델에 보내는 글.

모델에는 지시문과 함께 지금 시각, 보고 있는 날의 기록(사용자가 동의했을 때만), 선택한 기록,
앞 대화, 문장을 보낸다(decisions/040). 기록 칸과 찾을 조건의 모양은 문장 읽기(parse)의 것을
그대로 가져와 어긋나지 않게 한다.
"""

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, get_args

from app.domain.agent.schema import ActionOp, AgentType, ContextRecord, HistoryTurn
from app.domain.parse.prompt import QUESTION_SCHEMA, RECORD_PROPERTIES, WEEKDAYS, enum_schema
from app.domain.parse.service import to_local

# 한 번에 돌려주는 바꿀 것과 가리키는 기록 수의 상한
MAX_ACTIONS = 10
MAX_HIGHLIGHT = 10

# 칸마다 뜻 — 실제 호출에서 plan 의 title 에 문장을 쓰고 startAt 을 빠뜨린 일이 있어
# (2026-11-09) 적어 둔다
DESCRIBE = {
    "ref": "update, delete 가 가리키는 기록(r12)",
    "highlight": "답이 되는 기록의 ref. 비교를 물으면 선택한 기록을 먼저",
    "startAt": "그 일이 일어난 때, plan 이면 일정의 때(지금과 같은 시간대의 ISO 8601)",
    "title": "루틴 이름, 메모 글, 일정 이름(「2개월 접종」처럼 짧은 이름, 문장 아님)",
    "note": "update 로 기록에 붙이는 메모",
    "hasTime": "plan 에서 시각을 말했으면 true",
}


def _described(name: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {**schema, "description": DESCRIBE[name]}


# Gemini 가 받는 JSON 스키마(일부 문법만 된다). 비어도 되는 칸은 required 에서 뺀다
MODEL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": list(get_args(AgentType))},
        "question": QUESTION_SCHEMA,
        "actions": {
            "type": "array",
            "maxItems": MAX_ACTIONS,
            "items": {
                "type": "object",
                "properties": {
                    "op": enum_schema(ActionOp),
                    "ref": _described("ref", {"type": "string"}),
                    **RECORD_PROPERTIES,
                    "startAt": _described("startAt", RECORD_PROPERTIES["startAt"]),
                    "title": _described("title", RECORD_PROPERTIES["title"]),
                    "note": _described("note", {"type": "string"}),
                    "hasTime": _described("hasTime", {"type": "boolean"}),
                },
                "required": ["op"],
            },
        },
        "highlight": _described(
            "highlight", {"type": "array", "maxItems": MAX_HIGHLIGHT, "items": {"type": "string"}}
        ),
    },
    "required": ["type"],
}

# 지시문은 글이 길어 따로 둔다. 서버 이미지에도 함께 들어간다(app/ 통째로 복사)
SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.txt").read_text(encoding="utf-8")

ROLES = {"user": "사용자", "app": "앱"}


def user_message(
    text: str,
    now: datetime,
    *,
    day: date | None = None,
    records: list[ContextRecord] | None = None,
    selected: str | None = None,
    history: list[HistoryTurn] | None = None,
) -> str:
    """모델에 보내는 글. 기록은 JSON 한 줄에 하나씩 — 기록 안의 줄바꿈이 줄을 나누지 못하게 한다."""
    lines = [f"지금: {now.isoformat(timespec='seconds')} {WEEKDAYS[now.weekday()]}"]
    if records:
        if day is not None:
            lines.append(f"보는 날: {day.isoformat()} {WEEKDAYS[day.weekday()]}")
        lines.append("기록:")
        lines.extend(record_line(r, now) for r in records)
        if selected:
            lines.append(f"선택한 기록: {selected}")
    else:
        lines.append("기록: 보내지 않음")
    if history:
        lines.append("앞 대화:")
        # 앞 대화의 줄바꿈은 빈칸으로 바꾼다 — 「문장:」 같은 줄을 흉내 내지 못하게
        lines.extend(f"{ROLES[turn.role]}: {' '.join(turn.text.split())}" for turn in history)
    lines.append(f"문장: {text}")
    return "\n".join(lines)


def record_line(record: ContextRecord, now: datetime) -> str:
    """빈 칸은 빼고, 때는 기기의 시간대로 맞추고, 120.0 같은 수는 120 으로 적는다."""
    data = record.model_dump(mode="json", by_alias=True, exclude_none=True)
    data["startAt"] = to_local(record.start_at, now).isoformat(timespec="seconds")
    if record.end_at is not None:
        data["endAt"] = to_local(record.end_at, now).isoformat(timespec="seconds")
    if record.amount is not None and float(record.amount).is_integer():
        data["amount"] = int(record.amount)
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))
