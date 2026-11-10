"""/v1/agent 요청 · 응답 모형 (api-contract 「POST /v1/agent」, task common/032).

기록 종류와 칸의 값, 찾을 조건은 문장 읽기(parse)의 것을 그대로 쓴다.
앱이 두 응답을 같은 코드로 읽는다.
"""

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, Field, StringConstraints, model_validator

from app.common.core.schema import ApiModel
from app.domain.parse.schema import Diaper, FindQuestion, PooColor, RecordKind, Side

# 앱이 기록마다 붙이는 이름 — r 뒤에 숫자 1~3자리(r12)
Ref = Annotated[str, StringConstraints(pattern=r"^r[0-9]{1,3}$")]
Text300 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]

# tools 는 앱이 기능 목록(tools.json)을 쓸 수 있다고 알렸을 때만(decisions/043)
AgentType = Literal["answer", "changes", "question", "tools", "health", "unknown"]
ActionOp = Literal["add", "update", "delete", "plan"]


class HistoryTurn(ApiModel):
    # user 는 사람이 쓴 문장, app 은 앱이 보인 답
    role: Literal["user", "app"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class ContextRecord(ApiModel):
    """보고 있는 날의 기록 한 줄. 모델이 「이거」와 하루 안 비교를 알아듣게 보낸다."""

    ref: Ref
    kind: RecordKind
    start_at: AwareDatetime
    end_at: AwareDatetime | None = None
    amount: float | None = None
    side: Side | None = None
    diaper: Diaper | None = None
    color: PooColor | None = None
    # 루틴 이름이나 메모 글
    title: Text300 | None = None
    # 기록에 붙인 메모
    note: Text300 | None = None
    # 남긴 사람의 가족 이름
    by: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None


class AgentRequest(ApiModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    # 기기의 지금 시각 — 시간대가 붙은 ISO. 「10분 전」, 「내일 아침 9시」를 이 시각에서 센다
    now: AwareDatetime
    # 바로 앞 대화, 오래된 것부터
    history: Annotated[list[HistoryTurn], Field(max_length=6)] = Field(default_factory=list)
    # 보고 있는 날. 기록을 보낼 때만 온다
    day: date | None = None
    # 그날 기록. 동의하지 않았으면 빈 목록
    records: Annotated[list[ContextRecord], Field(max_length=150)] = Field(default_factory=list)
    # 흐름에서 누른 기록
    selected: Ref | None = None
    # 앱이 기능 목록(tools.json)을 실행할 수 있으면 true — 빌드 15 까지의 앱은 보내지 않는다
    tools: bool = False

    @model_validator(mode="after")
    def _check_refs(self) -> "AgentRequest":
        refs = [r.ref for r in self.records]
        if len(set(refs)) != len(refs):
            raise ValueError("기록의 ref 가 겹쳐요")
        # 보내지 않은 기록을 선택했다고 하면 선택이 없는 것으로 본다
        if self.selected not in refs:
            self.selected = None
        return self


class AgentAction(ApiModel):
    """바꿀 것 한 줄. 칸은 평평하고, op 마다 쓰는 칸이 다르다(service.py 가 맞춘다)."""

    op: ActionOp
    # update · delete 가 가리키는 기록
    ref: str | None = None
    kind: RecordKind | None = None
    # 때는 모델이 시간대 없이 보내도 받고, 서비스가 기기의 시간대로 맞춰 내보낸다
    start_at: datetime | None = None
    end_at: datetime | None = None
    minutes: Annotated[int, Field(ge=1, le=24 * 60)] | None = None
    amount: Annotated[float, Field(gt=0)] | None = None
    side: Side | None = None
    diaper: Diaper | None = None
    color: PooColor | None = None
    # 루틴 · 메모 글이나 일정 이름
    title: Text300 | None = None
    # 기록에 붙인 메모(update 만)
    note: Text300 | None = None
    # plan 만 — 시각을 말했으면 true, 날만 말했으면 false
    has_time: bool | None = None


class ToolCall(ApiModel):
    """앱 기능 하나와 그 값(tools.json). 칸은 평평하고, 기능마다 쓰는 칸만 남긴다(service.py)."""

    tool: str
    what: str | None = None
    range: str | None = None
    range_b: str | None = None
    measure: str | None = None
    sleep: str | None = None
    day: str | None = None
    when: str | None = None
    name: str | None = None


class AgentResponse(ApiModel):
    type: AgentType
    # answer 의 답 글, changes 의 짧은 설명(없어도 된다)
    reply: str | None = None
    # type 이 question 일 때만 — 며칠에 걸친 횟수 · 합계 · 평균은 앱이 센다
    question: FindQuestion | None = None
    # type 이 changes 일 때만
    actions: list[AgentAction] = Field(default_factory=list)
    # 답이 가리키는 기록의 ref
    highlight: list[str] = Field(default_factory=list)
    # type 이 tools 일 때만 — 앱이 기기 안 기록으로 실행할 기능
    calls: list[ToolCall] = Field(default_factory=list)


class ModelAnswer(ApiModel):
    """모델이 돌려준 JSON 의 겉모양. 줄과 칸은 하나씩 따로 검사해서 맞지 않는 줄만 버린다."""

    type: AgentType
    reply: str | None = None
    question: Any = None
    actions: list[Any] = Field(default_factory=list)
    highlight: list[Any] = Field(default_factory=list)
    calls: list[Any] = Field(default_factory=list)
