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


# 기능 목록 — 서버는 지시문과 답 모양을, 앱은 실행 코드를 이 파일 하나에서 만든다(decisions/043)
TOOLS: dict[str, Any] = json.loads(
    (Path(__file__).parent / "tools.json").read_text(encoding="utf-8")
)
TOOL_NAMES = [t["name"] for t in TOOLS["tools"]]
MAX_CALLS: int = TOOLS["maxCalls"]
# 기능 목록을 쓰지 않는 앱(빌드 15 까지)에는 tools 를 고를 수 없게 한다
BASE_TYPES = [t for t in get_args(AgentType) if t != "tools"]

# Gemini 가 받는 JSON 스키마(일부 문법만 된다). 비어도 되는 칸은 required 에서 뺀다
MODEL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": BASE_TYPES},
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


def _tool_arg_schema(name: str) -> dict[str, Any]:
    arg = TOOLS["args"][name]
    # 칸마다 쓰는 기능을 적는다 — 실제 호출에서 total 의 기간을
    # range 대신 when 에 쓴 일이 있다(2026-11-10)
    does = f"{arg['does']} — {arg['usedBy']} 만 쓴다"
    if arg.get("type") == "string":
        return {"type": "string", "description": does}
    return {"type": "string", "enum": arg["values"], "description": does}


# 기능 목록을 쓰는 앱의 답 모양 — calls 를 더한다
TOOLS_SCHEMA: dict[str, Any] = {
    **MODEL_SCHEMA,
    "properties": {
        **MODEL_SCHEMA["properties"],
        "type": {"type": "string", "enum": list(get_args(AgentType))},
        "calls": {
            "type": "array",
            "maxItems": MAX_CALLS,
            "description": "type 이 tools 일 때 앱이 실행할 기능",
            "items": {
                "type": "object",
                "properties": {
                    "tool": {"type": "string", "enum": TOOL_NAMES},
                    **{name: _tool_arg_schema(name) for name in TOOLS["args"]},
                },
                "required": ["tool"],
            },
        },
    },
}


def _cut(text: str, start: str, end: str, new: str) -> str:
    """지시문의 한 토막(start 부터 end 앞까지)을 바꾼다.

    지시문을 고쳐 토막이 없어지면 시험이 바로 알게 멈춘다.
    """
    a = text.index(start)
    b = text.index(end, a)
    return text[:a] + new + text[b:]


def _tools_section() -> str:
    lines = [
        "# 앱 기능(tools)",
        "앱은 아래 기능을 기기 안의 모든 기록(보는 날 밖의 날도)으로 직접 실행한다. "
        "너는 기능과 값만 고르고, 숫자와 답 문장은 앱이 쓴다.",
        f"- 한 문장에 기능을 1~{MAX_CALLS}개 고른다. 말한 순서대로 넣는다.",
        "- 기능 이름 뒤 괄호에 적힌 값은 빠짐없이 모두 채우고, 괄호에 없는 칸은 쓰지 않는다. "
        "기간은 range(견줄 기간은 rangeB)에 쓴다. when 은 find_name, day 는 day_summary 에만 쓴다.",
        "- 두 기간을 견주는 말은 compare_ranges 한 줄로 쓴다. 기간마다 줄을 나누지 않는다.",
        "- 기능의 값은 아래 「값」의 낱말만 쓴다. 문장에 없는 값은 지어내지 않고, "
        "물음에 맞는 값이 없으면 그 기능을 고르지 않는다.",
        "- 손톱, 목욕, 비타민D 처럼 기록 종류(what)에 없는 일은 find_name 으로 찾는다. "
        "그 일을 수유나 기저귀 같은 다른 종류로 바꾸지 않는다.",
        "",
        "기능:",
    ]
    for tool in TOOLS["tools"]:
        args = ", ".join(tool["args"])
        lines.append(f"- {tool['name']}({args}): {tool['does']}")
    lines += ["", "값:"]
    for name, arg in TOOLS["args"].items():
        lines.append(f"- {name}({arg['usedBy']}): {arg['words']}")
    return "\n".join(lines) + "\n"


def _tools_examples() -> str:
    out = []
    for tool in TOOLS["tools"]:
        for ex in tool["examples"]:
            body = json.dumps(
                {"type": "tools", "calls": [ex["call"]]}, ensure_ascii=False, separators=(",", ":")
            )
            out.append(f"문장: {ex['text']}\n{body}")
    return "\n".join(out) + "\n"


def tools_prompt(base: str = SYSTEM_PROMPT) -> str:
    """기능 목록을 쓰는 앱의 지시문.

    answer 를 가리키는 기록으로 좁히고, question 을 tools 로 바꾸고, 「앱 기능」 절과 보기를 더한다.
    """
    text = _cut(
        base,
        "- answer:",
        "- changes:",
        "- answer: 보는 날의 기록 가운데 선택한 기록이나 가리키는 기록"
        "(「이거」, 「아까 낮잠」, 「1시 50분 분유」)으로 답하는 물음.\n"
        "  답이 되는 기록의 ref 를 highlight 에 넣는다. "
        "답 문장은 앱이 그 기록으로 쓰니 너는 문장을 쓰지 않는다.\n",
    )
    text = _cut(
        text,
        "- question:",
        "- health:",
        "- tools: 기록을 묻고, 견주고, 요약하고, 하루 초안이나 메모 창이나 일주일 보기를 "
        "부탁하는 말. 아래 「앱 기능」에서 고른다.\n"
        "  보는 날 밖의 기간, 며칠에 걸친 합계와 평균, "
        "기록을 보내지 않았을 때 기록을 묻는 말도 여기다. calls 를 채운다.\n",
    )
    text = text.replace(
        "보낸 기록으로 답할 수 없고 찾을 조건으로도 바꿀 수 없는 말",
        "보낸 기록으로 답할 수 없고 앱 기능으로도 할 수 없는 말",
        1,
    )
    text = _cut(text, "# question", "# 보기", _tools_section() + "\n")
    text = _cut(
        text,
        "문장: 이번 주 밤잠 평균은?",
        "문장: 열이 38도인데",
        _tools_examples(),
    )
    return text


TOOLS_PROMPT = tools_prompt()

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
