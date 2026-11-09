"""문장 읽기에 쓰는 모델 지시문과 답 모양(JSON 스키마).

모델에는 이 지시문과 사용자가 쓴 문장 하나, 기기의 지금 시각만 보낸다.
아기 기록은 보내지 않는다(헌장 13).
답 모양의 값 목록은 schema.py 의 Literal 에서 가져와 두 곳이 어긋나지 않게 한다.
"""

from datetime import datetime
from pathlib import Path
from typing import Any, get_args

from app.domain.parse.schema import (
    Diaper,
    FindMeasure,
    FindRangeKey,
    FindWhat,
    PooColor,
    RecordKind,
    Side,
)

# 한 문장에서 읽는 기록 수의 상한
MAX_RECORDS = 10


def _enum(literal: Any) -> dict[str, Any]:
    return {"type": "string", "enum": list(get_args(literal))}


# Gemini 가 받는 JSON 스키마(일부 문법만 된다).
# 비어도 되는 칸은 required 에서 빼서 모델이 아예 쓰지 않게 한다
MODEL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["records", "question", "health", "unknown"]},
        "records": {
            "type": "array",
            "maxItems": MAX_RECORDS,
            "items": {
                "type": "object",
                "properties": {
                    "kind": _enum(RecordKind),
                    "startAt": {"type": "string", "format": "date-time"},
                    "endAt": {"type": "string", "format": "date-time"},
                    "minutes": {"type": "integer", "minimum": 1, "maximum": 1440},
                    "amount": {"type": "number"},
                    "side": _enum(Side),
                    "diaper": _enum(Diaper),
                    "color": _enum(PooColor),
                    "title": {"type": "string"},
                },
                "required": ["kind"],
            },
        },
        "question": {
            "type": "object",
            "properties": {
                "what": _enum(FindWhat),
                "range": _enum(FindRangeKey),
                "measure": _enum(FindMeasure),
            },
            "required": ["what", "range", "measure"],
        },
    },
    "required": ["type"],
}

# 지시문은 글이 길어 따로 둔다. 서버 이미지에도 함께 들어간다(app/ 통째로 복사)
SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.txt").read_text(encoding="utf-8")

WEEKDAYS = ("월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일")


def user_message(text: str, now: datetime) -> str:
    return f"지금: {now.isoformat(timespec='seconds')} {WEEKDAYS[now.weekday()]}\n문장: {text}"
