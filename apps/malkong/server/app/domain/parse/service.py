"""문장 읽기 서비스 — 규칙으로 못 읽은 문장을 모델에 보내 기록이나 찾을 조건으로 바꾼다.

근거는 decisions/039. 모델에는 문장과 기기의 지금 시각만 보낸다. 모델 답은 형식을 검사해서
맞지 않으면 unknown 으로 돌려준다. 숫자는 앱이 기기 안 기록에서 센다.
문장과 모델 답은 저장하지도 로그에 남기지도 않는다(server/AGENTS.md 「금지」).
"""

import json
import logging
import threading
from collections import defaultdict
from datetime import date, datetime
from http import HTTPStatus

from pydantic import ValidationError

from app.common.core.exception import ApiException
from app.common.core.setting import Settings
from app.domain.entitlements.service import Device
from app.domain.parse.prompt import MAX_RECORDS, MODEL_SCHEMA, SYSTEM_PROMPT, user_message
from app.domain.parse.schema import ParsedRecord, ParseRequest, ParseResponse
from app.infra.llm.base import JsonModel, ModelError

logger = logging.getLogger("uvicorn.error")

UNKNOWN = ParseResponse(type="unknown")

# 기록 종류마다 쓰는 칸 — 모델이 엉뚱한 칸을 채워 보내도 여기 없는 칸은 비운다
FIELDS: dict[str, set[str]] = {
    "breast": {"start_at", "end_at", "minutes", "side"},
    "formula": {"start_at", "amount"},
    "diaper": {"start_at", "diaper", "color"},
    "sleep": {"start_at", "end_at", "minutes"},
    "temp": {"start_at", "amount"},
    "weight": {"start_at", "amount"},
    "height": {"start_at", "amount"},
    "routine": {"start_at", "end_at", "minutes", "title"},
    "memo": {"start_at", "title"},
}
OPTIONAL = ("start_at", "end_at", "minutes", "amount", "side", "diaper", "color", "title")


class ParseService:
    def __init__(self, model: JsonModel | None, settings: Settings) -> None:
        self._model = model
        self._settings = settings
        self._lock = threading.Lock()
        # (기기 키 해시, 날짜) → 오늘 읽은 문장 수. 메모리에서만 센다
        self._calls: dict[tuple[str, date], int] = defaultdict(int)

    async def parse(self, device: Device, req: ParseRequest, today: date) -> ParseResponse:
        if self._model is None:
            raise _unavailable()
        self._count(device, today)
        try:
            text = await self._model.generate_json(
                SYSTEM_PROMPT, user_message(req.text, req.now), MODEL_SCHEMA
            )
        except ModelError as exc:
            # exc 에는 예외 종류와 상태 코드만 있다
            logger.warning("parse: 모델에 닿지 못함 (%s)", exc)
            raise _unavailable() from None
        return read_answer(text, req.now)

    def _count(self, device: Device, today: date) -> None:
        with self._lock:
            # 지난날의 수는 버린다
            for stale in [k for k in self._calls if k[1] != today]:
                del self._calls[stale]
            slot = (device.key_hash, today)
            if self._calls[slot] >= self._settings.parse_per_device_per_day:
                raise ApiException(
                    HTTPStatus.TOO_MANY_REQUESTS, "LIMIT_EXCEEDED", "오늘은 더 물어볼 수 없어요"
                )
            self._calls[slot] += 1


def _unavailable() -> ApiException:
    return ApiException(
        HTTPStatus.SERVICE_UNAVAILABLE, "MODEL_UNAVAILABLE", "지금은 문장을 읽을 수 없어요"
    )


def read_answer(text: str, now: datetime) -> ParseResponse:
    """모델 답(JSON 글)을 검사해 응답으로 바꾼다. 형식이 틀리거나 뜻이 맞지 않으면 unknown."""
    try:
        answer = ParseResponse.model_validate(json.loads(text))
    except (ValueError, ValidationError):
        # 모델 답은 남기지 않는다 — 문장을 되풀이했을 수 있다
        logger.warning("parse: 모델 답의 형식이 맞지 않음 (길이 %d)", len(text))
        return UNKNOWN
    if answer.type == "records":
        records = [r for r in (_clean(r, now) for r in answer.records) if r][:MAX_RECORDS]
        return ParseResponse(type="records", records=records) if records else UNKNOWN
    if answer.type == "question":
        if not answer.question:
            return UNKNOWN
        return ParseResponse(type="question", question=answer.question)
    return ParseResponse(type=answer.type)


def _clean(record: ParsedRecord, now: datetime) -> ParsedRecord | None:
    """기록 한 줄 다듬기 — 그 종류에 없는 칸은 비우고, 때는 기기의 시간대로 맞춘다.

    이름이 있어야 하는 루틴 · 메모에 이름이 없으면 그 줄은 버린다.
    """
    keep = FIELDS[record.kind]
    values = {name: getattr(record, name) if name in keep else None for name in OPTIONAL}
    if values["title"] is not None and not values["title"]:
        values["title"] = None
    if record.kind in ("routine", "memo") and not values["title"]:
        return None
    if values["diaper"] == "pee":
        values["color"] = None
    for name in ("start_at", "end_at"):
        if values[name] is not None:
            values[name] = _local(values[name], now)
    return ParsedRecord(kind=record.kind, **values)


def _local(at: datetime, now: datetime) -> datetime:
    # 시간대 없이 온 때는 기기의 시간대로 본다
    if at.tzinfo is None:
        return at.replace(tzinfo=now.tzinfo)
    return at.astimezone(now.tzinfo)
