"""/v1/parse 요청 · 응답 모형 (api-contract 「POST /v1/parse」).

찾을 조건(question)의 값은 앱의 src/data/find-parse.ts(FindWhat · FindRangeKey · FindMeasure)와
같은 글자다. 앱이 그대로 rangeOf · runFind 에 넣어 숫자를 센다.
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, Field, StringConstraints

from app.common.core.schema import ApiModel

RecordKind = Literal[
    "breast", "formula", "diaper", "sleep", "temp", "weight", "height", "routine", "memo"
]
Side = Literal["left", "right"]
Diaper = Literal["pee", "poo", "both"]
PooColor = Literal["yellow", "brown", "green", "black", "red", "white"]

# find-parse.ts 의 FindWhat 그대로
FindWhat = Literal[
    "feed",
    "formula",
    "breast",
    "diaper",
    "pee",
    "poo",
    "sleep",
    "nap",
    "night",
    "temp",
    "weight",
    "height",
]
# find-parse.ts 의 FindRangeKey 가운데 다른 값 없이 범위가 정해지는 것만 둔다.
# recentN(며칠)과 date(어느 날)는 이 계약에 그 값을 실을 칸이 없어 뺐다 — 그런 말은 앱 규칙이 읽는다
FindRangeKey = Literal[
    "today", "yesterday", "lastNight", "tonight", "thisWeek", "lastWeek", "recent7", "recent30"
]
FindMeasure = Literal["count", "amount", "duration", "last"]


class ParseRequest(ApiModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    # 기기의 지금 시각 — 시간대가 붙은 ISO(예: 2026-11-06T14:20:00+09:00).
    # 「10분 전」을 이 시각에서 센다
    now: AwareDatetime


class ParsedRecord(ApiModel):
    kind: RecordKind
    # 그 일이 일어난(시작한) 때. 비어 있으면 지금. 모델이 시간대 없이 보내도 받고,
    # 서비스가 기기의 시간대(요청의 now)로 맞춰 내보낸다
    start_at: datetime | None = None
    end_at: datetime | None = None
    # 말한 걸린 시간(「15분 먹였어」 · 「1시간 잤어」)
    minutes: Annotated[int, Field(ge=1, le=24 * 60)] | None = None
    # 분유 ml · 체온 ℃ · 몸무게 kg · 키 cm
    amount: Annotated[float, Field(gt=0)] | None = None
    side: Side | None = None
    diaper: Diaper | None = None
    color: PooColor | None = None
    # 루틴 · 영양제 이름(비타민D, 터미타임, 목욕)이나 메모 글
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class FindQuestion(ApiModel):
    what: FindWhat
    range: FindRangeKey
    measure: FindMeasure


class ParseResponse(ApiModel):
    type: Literal["records", "question", "health", "unknown"]
    # type 이 records 일 때만 채운다
    records: list[ParsedRecord] = Field(default_factory=list)
    # type 이 question 일 때만 채운다
    question: FindQuestion | None = None
