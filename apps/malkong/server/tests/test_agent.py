"""물어보기 /v1/agent (decisions/040, task common/032).

모델은 가짜를 끼운다 — 실제 Gemini 는 부르지 않는다. 기기 키는 /v1/devices 로 받는다.
"""

import asyncio
import json
import logging
from datetime import datetime

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.common.core.setting import Settings, get_settings
from app.domain.agent.prompt import MODEL_SCHEMA, SYSTEM_PROMPT
from app.domain.agent.router import get_agent_service, model_from
from app.domain.agent.service import AgentService
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import KST, EntitlementsService
from app.infra.db.usage_store import MemoryUsageStore
from app.infra.llm.base import ModelError
from app.infra.llm.gemini import GeminiModel
from app.main import create_app

NOW = "2026-11-09T14:20:00+09:00"
CAP = 3

# 보고 있는 날의 기록 — 앱이 보내는 모양 그대로
R7 = {"ref": "r7", "kind": "formula", "startAt": "2026-11-09T10:50:00+09:00", "amount": 140}
R8 = {
    "ref": "r8",
    "kind": "sleep",
    "startAt": "2026-11-09T11:30:00+09:00",
    "endAt": "2026-11-09T12:40:00+09:00",
}
R9 = {
    "ref": "r9",
    "kind": "formula",
    "startAt": "2026-11-09T13:50:00+09:00",
    "amount": 120,
    "by": "엄마",
}
R10 = {"ref": "r10", "kind": "memo", "startAt": "2026-11-09T09:00:00+09:00", "title": "첫 뒤집기"}
R11 = {"ref": "r11", "kind": "diaper", "startAt": "2026-11-09T08:00:00+09:00", "diaper": "pee"}
R12 = {"ref": "r12", "kind": "routine", "startAt": "2026-11-09T08:30:00+09:00", "title": "목욕"}
RECORDS = [R7, R8, R9, R10, R11, R12]


class FakeModel:
    """정해 둔 글을 돌려주거나 ModelError 를 던진다. 받은 것을 모아 두어 무엇을 보냈는지 본다."""

    model = "fake"

    def __init__(self) -> None:
        self.answer: str | ModelError = '{"type":"unknown"}'
        self.calls: list[tuple[str, str, dict]] = []

    async def generate_json(self, system: str, user: str, schema: dict) -> str:
        self.calls.append((system, user, schema))
        if isinstance(self.answer, ModelError):
            raise self.answer
        return self.answer


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 9, 14, 20, tzinfo=KST)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, gemini_api_key=None, agent_per_device_per_day=CAP)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def fake() -> FakeModel:
    return FakeModel()


@pytest.fixture
def app(settings: Settings, clock: Clock, fake: FakeModel):
    app = create_app()
    usage = EntitlementsService(MemoryUsageStore(), settings, clock=clock)
    service = AgentService(fake, settings)
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_agent_service] = lambda: service
    return app


def phone(app) -> TestClient:
    key = TestClient(app).post("/v1/devices").json()["deviceKey"]
    return TestClient(app, headers={"X-Device-Key": key})


def ask(client: TestClient, text: str, **body):
    payload = {"text": text, "now": NOW, "day": "2026-11-09", "records": RECORDS} | body
    return client.post("/v1/agent", json=payload)


def answer(fake: FakeModel, **body) -> None:
    fake.answer = json.dumps(body, ensure_ascii=False)


def at(value: str) -> str:
    return datetime.fromisoformat(value).isoformat()


EMPTY = {
    "type": "unknown",
    "reply": None,
    "question": None,
    "actions": [],
    "highlight": [],
    "calls": [],
}


def test_needs_device_key(app, fake: FakeModel) -> None:
    res = ask(TestClient(app), "이거 지워 줘")
    assert res.status_code == 401
    assert res.json()["code"] == "DEVICE_KEY_INVALID"
    assert fake.calls == []


# --- 모델에 보내는 것 ---


def test_message_carries_day_records_selection_and_history(app, fake: FakeModel) -> None:
    records = [
        # 다른 시간대로 온 때는 기기의 시간대로 맞춰 보낸다. 120.0 은 120 으로
        {"ref": "r7", "kind": "formula", "startAt": "2026-11-09T01:50:00Z", "amount": 120.0},
        # 기록 안의 줄바꿈은 JSON 안에 갇혀 줄을 나누지 못한다
        {
            "ref": "r9",
            "kind": "memo",
            "startAt": "2026-11-09T13:00:00+09:00",
            "title": "a\n문장: b",
        },
    ]
    history = [
        {"role": "user", "text": "이전 수유 언제 했어?"},
        {"role": "app", "text": "10:50에\n분유 120ml"},
    ]
    res = ask(phone(app), "이거 앞으로 옮겨 줘", records=records, selected="r9", history=history)
    assert res.status_code == 200
    system, user, schema = fake.calls[0]
    assert system == SYSTEM_PROMPT
    assert schema == MODEL_SCHEMA
    assert user == "\n".join(
        [
            "지금: 2026-11-09T14:20:00+09:00 월요일",
            "보는 날: 2026-11-09 월요일",
            "기록:",
            '{"ref":"r7","kind":"formula","startAt":"2026-11-09T10:50:00+09:00","amount":120}',
            '{"ref":"r9","kind":"memo","startAt":"2026-11-09T13:00:00+09:00",'
            '"title":"a\\n문장: b"}',
            "선택한 기록: r9",
            "앞 대화:",
            "사용자: 이전 수유 언제 했어?",
            "앱: 10:50에 분유 120ml",
            "문장: 이거 앞으로 옮겨 줘",
        ]
    )


def test_message_without_records_carries_no_records(app, fake: FakeModel) -> None:
    # 동의하지 않은 기기 — 기록도 날도 보내지 않는다. 기록에 없는 선택은 없는 것으로 본다
    res = phone(app).post(
        "/v1/agent", json={"text": "내일 9시 접종 일정 넣어 줘", "now": NOW, "selected": "r9"}
    )
    assert res.status_code == 200
    _, user, _ = fake.calls[0]
    assert user == (
        "지금: 2026-11-09T14:20:00+09:00 월요일\n"
        "기록: 보내지 않음\n"
        "문장: 내일 9시 접종 일정 넣어 줘"
    )


def test_selected_not_in_records_is_ignored(app, fake: FakeModel) -> None:
    ask(phone(app), "이거 지워 줘", selected="r99")
    _, user, _ = fake.calls[0]
    assert "선택한 기록" not in user
    assert '"ref":"r9"' in user


# --- answer ---


def test_answer_with_highlight(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="answer",
        # 모델이 글을 써도 내보내지 않는다 — 답 문장은 앱이 가리키는 기록으로 쓴다
        reply="분유 120ml는 앞 수유보다 20ml 적어요시작해요와 비교하면",
        # 보내지 않은 ref 와 겹친 ref 는 뺀다
        highlight=["r9", "r99", "r7", "r9", 3],
        # answer 에 붙은 바꿀 것과 찾을 조건은 싣지 않는다
        actions=[{"op": "delete", "ref": "r9"}],
        question={"what": "feed", "range": "today", "measure": "count"},
    )
    res = ask(phone(app), "이거 앞 수유보다 많이 먹은 거야?", selected="r9")
    assert res.status_code == 200
    assert res.json() == {
        "type": "answer",
        "reply": None,
        "question": None,
        "actions": [],
        "highlight": ["r9", "r7"],
        "calls": [],
    }


def test_answer_without_highlight_stays_answer(app, fake: FakeModel) -> None:
    # 답이 되는 기록이 없다는 답 — 앱이 「그날 기록에서 찾지 못했어요」를 보인다
    answer(fake, type="answer", highlight=[])
    assert ask(phone(app), "오늘 목욕했어?").json() == {**EMPTY, "type": "answer"}


def test_highlight_keeps_ten(app, fake: FakeModel) -> None:
    records = [
        {"ref": f"r{i}", "kind": "formula", "startAt": NOW, "amount": 100} for i in range(12)
    ]
    answer(fake, type="answer", highlight=[f"r{i}" for i in range(12)])
    body = ask(phone(app), "오늘 몇 번 먹었어?", records=records).json()
    assert body["highlight"] == [f"r{i}" for i in range(10)]


# --- changes ---


def test_update_and_plan(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        reply="옮기고 일정을 넣을게요.",
        actions=[
            {
                "op": "update",
                "ref": "r9",
                # 종류는 서버가 그 기록의 것으로 채운다
                "kind": "breast",
                "startAt": "2026-11-09T13:40:00+09:00",
                # 지금 값과 같은 칸은 뺀다
                "amount": 120,
                # 분유에 없는 칸은 뺀다
                "side": "left",
                "minutes": 15,
                "note": " 조금 남김 ",
            },
            # 시간대 없이 온 때는 기기의 시간대로 보고, hasTime 이 없으면 true
            {"op": "plan", "title": "2개월 접종", "startAt": "2026-11-10T09:00:00", "ref": "r9"},
        ],
        highlight=["r9"],
    )
    res = ask(phone(app), "이거 10분 앞으로 옮기고 내일 9시에 접종 일정 넣어 줘", selected="r9")
    assert res.status_code == 200
    body = res.json()
    assert body["type"] == "changes"
    assert body["reply"] is None
    assert body["question"] is None
    assert body["highlight"] == ["r9"]
    update, plan = body["actions"]
    assert at(update.pop("startAt")) == "2026-11-09T13:40:00+09:00"
    assert update == {
        "op": "update",
        "ref": "r9",
        "kind": "formula",
        "endAt": None,
        "minutes": None,
        "amount": None,
        "side": None,
        "diaper": None,
        "color": None,
        "title": None,
        "note": "조금 남김",
        "hasTime": None,
    }
    assert at(plan.pop("startAt")) == "2026-11-10T09:00:00+09:00"
    assert plan == {
        "op": "plan",
        "ref": None,
        "kind": None,
        "endAt": None,
        "minutes": None,
        "amount": None,
        "side": None,
        "diaper": None,
        "color": None,
        "title": "2개월 접종",
        "note": None,
        "hasTime": True,
    }


def test_update_keeps_only_changed_fields_of_that_kind(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[
            # 보내지 않은 기록은 고칠 수 없다
            {"op": "update", "ref": "r99", "amount": 100},
            {"op": "update", "amount": 100},
            # 같은 때를 다른 시간대로 적은 것뿐이면 바뀌는 칸이 없어 버린다
            {"op": "update", "ref": "r7", "startAt": "2026-11-09T01:50:00Z", "amount": 140},
            # 메모는 title 이 글이고 note 가 없다
            {"op": "update", "ref": "r10", "title": "첫 뒤집기 성공", "note": "메모"},
            # 메모의 note 만 바꾸려 하면 남는 칸이 없다
            {"op": "update", "ref": "r10", "note": "메모"},
            # 소변 기저귀에는 변 색이 없다
            {"op": "update", "ref": "r11", "color": "green"},
            {"op": "update", "ref": "r11", "diaper": "poo", "color": "green"},
            # 루틴의 걸린 시간은 남긴다
            {"op": "update", "ref": "r12", "minutes": 20, "title": "목욕"},
            # 빈 글은 바뀌는 칸이 아니다
            {"op": "update", "ref": "r9", "note": "   "},
        ],
    )
    body = ask(phone(app), "고쳐 줘").json()
    assert body["type"] == "changes"
    memo, diaper, routine = body["actions"]
    assert (memo["ref"], memo["kind"], memo["title"], memo["note"]) == (
        "r10",
        "memo",
        "첫 뒤집기 성공",
        None,
    )
    assert (diaper["ref"], diaper["diaper"], diaper["color"]) == ("r11", "poo", "green")
    assert (routine["ref"], routine["kind"], routine["minutes"], routine["title"]) == (
        "r12",
        "routine",
        20,
        None,
    )


def test_delete_fills_kind_and_empties_the_rest(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[
            {"op": "delete", "ref": "r9", "amount": 120, "title": "분유", "hasTime": True},
            {"op": "delete", "ref": "r99"},
            {"op": "delete"},
        ],
        highlight=["r9"],
    )
    body = ask(phone(app), "지워 줘", selected="r9").json()
    assert body["type"] == "changes"
    assert body["reply"] is None
    assert body["actions"] == [
        {
            "op": "delete",
            "ref": "r9",
            "kind": "formula",
            "startAt": None,
            "endAt": None,
            "minutes": None,
            "amount": None,
            "side": None,
            "diaper": None,
            "color": None,
            "title": None,
            "note": None,
            "hasTime": None,
        }
    ]


def test_add_follows_parse_record_rules(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[
            # 모유에 붙은 이름 · 양 · 메모 · ref 는 버린다
            {
                "op": "add",
                "ref": "r9",
                "kind": "breast",
                "side": "left",
                "minutes": 15,
                "title": "모유",
                "amount": 3,
                "note": "메모",
                "hasTime": True,
                "startAt": "2026-11-09T05:10:00Z",
            },
            {"op": "add", "kind": "routine", "title": " 비타민D "},
            # 종류가 없거나, 이름 없는 루틴 · 메모는 뺀다
            {"op": "add", "amount": 120},
            {"op": "add", "kind": "routine"},
            {"op": "add", "kind": "memo", "title": "  "},
            {"op": "add", "kind": "diaper", "diaper": "pee", "color": "green"},
        ],
    )
    body = ask(phone(app), "왼쪽 15분 먹이고 비타민D 먹였어").json()
    breast, routine, diaper = body["actions"]
    assert breast["op"] == "add"
    assert breast["ref"] is None
    assert (breast["kind"], breast["side"], breast["minutes"]) == ("breast", "left", 15)
    assert (breast["title"], breast["amount"], breast["note"], breast["hasTime"]) == (
        None,
        None,
        None,
        None,
    )
    assert at(breast["startAt"]) == "2026-11-09T14:10:00+09:00"
    assert (routine["kind"], routine["title"], routine["startAt"]) == ("routine", "비타민D", None)
    assert (diaper["diaper"], diaper["color"]) == ("pee", None)


def test_plan_needs_title_and_time(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[
            {"op": "plan", "startAt": "2026-11-10T09:00:00+09:00"},
            {"op": "plan", "title": "  ", "startAt": "2026-11-10T09:00:00+09:00"},
            {"op": "plan", "title": "병원 예약"},
            # 날만 말한 일정
            {
                "op": "plan",
                "title": "병원 예약",
                "startAt": "2026-11-12T00:00:00+09:00",
                "hasTime": False,
                "kind": "memo",
                "amount": 3,
            },
        ],
    )
    body = ask(phone(app), "목요일에 병원 예약 넣어 줘").json()
    (plan,) = body["actions"]
    assert (plan["title"], plan["hasTime"], plan["kind"], plan["amount"]) == (
        "병원 예약",
        False,
        None,
        None,
    )


def test_bad_action_lines_are_dropped(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[
            {"op": "move", "ref": "r9"},
            {"op": "add", "kind": "bath"},
            {"op": "add", "kind": "formula", "amount": -5},
            "지워",
            {"op": "add", "kind": "formula", "amount": 100},
        ],
    )
    body = ask(phone(app), "분유 100 먹였어").json()
    assert [(a["op"], a["kind"], a["amount"]) for a in body["actions"]] == [("add", "formula", 100)]


def test_actions_keep_ten(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[{"op": "add", "kind": "formula", "amount": 10 + i} for i in range(12)],
    )
    body = ask(phone(app), "분유 여러 번 먹였어").json()
    assert [a["amount"] for a in body["actions"]] == [10 + i for i in range(10)]


def test_changes_without_lines_is_unknown(app, fake: FakeModel) -> None:
    # 남은 줄이 없으면 모델이 글을 썼어도 unknown
    answer(
        fake,
        type="changes",
        reply="그 기록을 찾지 못했어요.",
        actions=[{"op": "delete", "ref": "r99"}],
        highlight=["r9"],
    )
    assert ask(phone(app), "그거 지워 줘").json() == EMPTY


@pytest.mark.parametrize(
    "title",
    [
        "2개월 접종Parse error: missing title/plan? No, wait",
        "2개월 접종 বয়স 확인 필요함",
        "r9 를 옮기고 일정 추가",
        "2개월 접종 예약을 추가했어요. 내일 09:00입니다.",
    ],
)
def test_plan_title_with_leaked_text_is_dropped(app, fake: FakeModel, title) -> None:
    # 실제 호출에서 본 혼잣말(2026-11-09) — 다른 나라 글자, 칸 이름, 기록 번호, 긴 문장
    answer(
        fake,
        type="changes",
        actions=[{"op": "plan", "title": title, "startAt": "2026-11-10T09:00:00+09:00"}],
    )
    assert ask(phone(app), "내일 9시에 접종 일정 넣어 줘").json() == EMPTY


def test_note_with_leaked_text_is_not_a_change(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[
            {"op": "update", "ref": "r9", "note": "트림 highlight: r9"},
            {"op": "update", "ref": "r9", "note": "트림 두 번"},
        ],
    )
    [action] = ask(phone(app), "이 기록에 메모: 트림 두 번").json()["actions"]
    assert action["note"] == "트림 두 번"


def test_without_records_update_and_delete_are_dropped(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="changes",
        actions=[{"op": "delete", "ref": "r9"}, {"op": "update", "ref": "r9", "amount": 90}],
        highlight=["r9"],
    )
    assert ask(phone(app), "이거 지워 줘", records=[], day=None).json() == EMPTY


# --- question · health · unknown ---


def test_question(app, fake: FakeModel) -> None:
    answer(
        fake,
        type="question",
        question={"what": "night", "range": "thisWeek", "measure": "duration"},
        actions=[{"op": "add", "kind": "formula", "amount": 100}],
    )
    assert ask(phone(app), "이번 주 밤잠 평균은?").json() == {
        "type": "question",
        "reply": None,
        "question": {"what": "night", "range": "thisWeek", "measure": "duration"},
        "actions": [],
        "highlight": [],
        "calls": [],
    }


@pytest.mark.parametrize(
    "question",
    [None, {"what": "feed", "range": "recentN", "measure": "count"}, {"what": "feed"}],
)
def test_question_without_valid_condition_is_unknown(app, fake: FakeModel, question) -> None:
    answer(fake, type="question", question=question)
    assert ask(phone(app), "최근 3일 몇 번 먹었어?").json() == EMPTY


@pytest.mark.parametrize("kind", ["health", "unknown"])
def test_health_and_unknown_carry_nothing(app, fake: FakeModel, kind: str) -> None:
    answer(
        fake,
        type=kind,
        reply="병원에 가 보세요.",
        actions=[{"op": "add", "kind": "temp", "amount": 38}],
        highlight=["r9"],
        question={"what": "temp", "range": "today", "measure": "last"},
    )
    assert ask(phone(app), "열이 38도인데 괜찮아?").json() == EMPTY | {"type": kind}


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "JSON 이 아닌 글",
        "[]",
        '{"type":"advice"}',
        '{"reply":"답"}',
        '{"type":"answer","reply":3}',
        '{"type":"changes","actions":"지워"}',
    ],
)
def test_invalid_model_answer_is_unknown(app, fake: FakeModel, caplog, raw: str) -> None:
    fake.answer = raw
    secret_record = R10 | {"title": "비밀스러운 메모 글"}
    with caplog.at_level(logging.DEBUG):
        res = ask(phone(app), "아기 오늘 어땠지", records=[secret_record])
    assert res.status_code == 200
    assert res.json() == EMPTY
    # 로그에는 문장도, 기록도, 모델 답도 적히지 않는다
    assert "아기 오늘 어땠지" not in caplog.text
    assert "비밀스러운 메모 글" not in caplog.text
    if raw:
        assert raw not in caplog.text


# --- 요청 검사 · 오류 ---


@pytest.mark.parametrize(
    "body",
    [
        {"text": "", "now": NOW},
        {"text": "   ", "now": NOW},
        {"text": "가" * 301, "now": NOW},
        {"text": "지워 줘", "now": "2026-11-09T14:20:00"},
        {"text": "지워 줘"},
        # ref 가 겹치면 받지 않는다
        {"text": "지워 줘", "now": NOW, "records": [R9, R9 | {"amount": 90}]},
        {"text": "지워 줘", "now": NOW, "records": [R9 | {"ref": "9"}]},
        {"text": "지워 줘", "now": NOW, "records": [R9 | {"ref": "r1234"}]},
        {"text": "지워 줘", "now": NOW, "records": [R9 | {"kind": "bath"}]},
        {"text": "지워 줘", "now": NOW, "records": [R9 | {"startAt": "2026-11-09T13:50:00"}]},
        {"text": "지워 줘", "now": NOW, "records": [R10 | {"title": "가" * 301}]},
        {"text": "지워 줘", "now": NOW, "records": [R9 | {"by": "가" * 21}]},
        {"text": "지워 줘", "now": NOW, "records": [R9] * 151},
        {"text": "지워 줘", "now": NOW, "history": [{"role": "user", "text": "가"}] * 7},
        {"text": "지워 줘", "now": NOW, "history": [{"role": "bot", "text": "가"}]},
        {"text": "지워 줘", "now": NOW, "history": [{"role": "app", "text": "가" * 601}]},
        {"text": "지워 줘", "now": NOW, "selected": "9"},
        {"text": "지워 줘", "now": NOW, "day": "11월 9일"},
    ],
)
def test_request_is_checked(app, fake: FakeModel, body: dict) -> None:
    res = phone(app).post("/v1/agent", json=body)
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_REQUEST"
    assert fake.calls == []


def test_largest_request_is_accepted(app) -> None:
    records = [
        {"ref": f"r{i}", "kind": "memo", "startAt": NOW, "title": "가" * 300, "note": "나" * 300}
        for i in range(150)
    ]
    history = [{"role": "user", "text": "가" * 600}] * 6
    res = ask(phone(app), "가" * 300, records=records, history=history, selected="r149")
    assert res.status_code == 200


def test_missing_key_is_503(app, settings: Settings) -> None:
    assert model_from(settings) is None
    service = AgentService(model_from(settings), settings)
    app.dependency_overrides[get_agent_service] = lambda: service
    res = ask(phone(app), "지워 줘")
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"


def test_model_error_is_503(app, fake: FakeModel, caplog) -> None:
    fake.answer = ModelError("HTTP 429")
    with caplog.at_level(logging.DEBUG):
        res = ask(phone(app), "이거 지워 줘", selected="r9")
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"
    assert "HTTP 429" in caplog.text
    assert "이거 지워 줘" not in caplog.text


def test_daily_cap(app, fake: FakeModel, clock: Clock) -> None:
    client = phone(app)
    for _ in range(CAP):
        assert ask(client, "지워 줘").status_code == 200
    res = ask(client, "지워 줘")
    assert res.status_code == 429
    assert res.json()["code"] == "LIMIT_EXCEEDED"
    assert len(fake.calls) == CAP
    # 다른 기기는 막히지 않는다
    assert ask(phone(app), "지워 줘").status_code == 200
    # 한국 시간 0시가 지나면 다시 된다
    clock.now = datetime(2026, 11, 10, 0, 1, tzinfo=KST)
    assert ask(client, "지워 줘").status_code == 200


# --- 모델 만들기 — 문장 읽기와 같은 키 · 모델, 생각은 한 단계 위 ---


def test_model_thinks_one_step_more_than_parse() -> None:
    settings = Settings(_env_file=None, gemini_api_key="gk-test")
    model = model_from(settings)
    assert isinstance(model, GeminiModel)
    assert model.model == "gemini-3.1-flash-lite"
    # 만든 모델로는 부르지 않는다 — 진짜 주소로 나가지 않게 설정 값만 본다
    assert (model._thinking_level, model._max_output_tokens) == ("low", 1500)

    seen: list[dict] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return httpx2.Response(200, json={"status": "completed", "steps": []})

    def gemini(**options) -> GeminiModel:
        return GeminiModel(
            "k", "m", timeout_s=5, transport=httpx2.MockTransport(handler), **options
        )

    asyncio.run(
        gemini(thinking_level="low", max_output_tokens=4000).generate_json("지시", "문장", {})
    )
    # 문장 읽기의 기본값(minimal)은 그대로다
    asyncio.run(gemini().generate_json("지시", "문장", {}))
    assert seen[0]["generation_config"] == {"max_output_tokens": 4000, "thinking_level": "low"}
    assert seen[1]["generation_config"] == {"max_output_tokens": 2000, "thinking_level": "minimal"}


def test_update_reads_title_on_a_record_as_its_memo(app, fake: FakeModel) -> None:
    # 실제 호출에서 「이 기록에 메모: …」를 note 대신 title 에 쓴 일이 있다(2026-11-09)
    answer(
        fake,
        type="changes",
        actions=[{"op": "update", "ref": "r9", "title": "트림 두 번 했어"}],
    )
    body = ask(phone(app), "이 기록에 메모: 트림 두 번 했어").json()
    assert body["type"] == "changes"
    [action] = body["actions"]
    assert (action["ref"], action["note"], action["title"]) == ("r9", "트림 두 번 했어", None)


# --- 기능 목록(tools.json, decisions/043) ---


def test_tools_only_for_apps_that_say_so(app, fake: FakeModel) -> None:
    """기능 목록을 쓰는 앱에만 「앱 기능」 절과 tools 답. 빌드 15 까지의 앱은 지금처럼."""
    answer(fake, type="tools", calls=[{"tool": "feed_gap"}])
    # 보내지 않은 앱에는 tools 를 고를 수 없게 했으니, 와도 unknown
    assert ask(phone(app), "요즘 몇 시간마다 먹어?").json() == EMPTY
    system, _, schema = fake.calls[-1]
    assert "# 앱 기능" not in system
    assert "tools" not in schema["properties"]["type"]["enum"]
    assert "calls" not in schema["properties"]

    res = ask(phone(app), "요즘 몇 시간마다 먹어?", tools=True)
    assert res.json() == EMPTY | {"type": "tools", "calls": [{"tool": "feed_gap"} | NO_ARGS]}
    system, _, schema = fake.calls[-1]
    assert "# 앱 기능(tools)" in system and "find_name(name, when)" in system
    # question 은 tools 로 바뀌고, 찾을 조건의 설명 절은 「앱 기능」 절로 바뀐다
    assert "- question:" not in system and "# question" not in system
    assert "tools" in schema["properties"]["type"]["enum"]
    assert "feed_gap" in schema["properties"]["calls"]["items"]["properties"]["tool"]["enum"]


NO_ARGS = {k: None for k in ("what", "range", "rangeB", "measure", "sleep", "day", "when", "name")}


def test_tool_calls_are_checked_one_by_one(app, fake: FakeModel) -> None:
    """목록에 없는 기능, 빠진 값, 목록에 없는 값, 문장 같은 이름은 그 줄만 버린다.

    쓰지 않는 값은 지운다.
    """
    answer(
        fake,
        type="tools",
        calls=[
            {
                "tool": "compare_ranges",
                "what": "nap",
                "measure": "duration",
                "range": "thisWeek",
                "rangeB": "lastWeek",
                "name": "x",
            },
            {"tool": "total", "what": "nail", "range": "today", "measure": "count"},
            # 셀 것(measure)이 빠졌으면 서버가 채운다 — 수유는 몇 번
            {"tool": "total", "what": "feed", "range": "today"},
            {"tool": "delete_everything"},
            {"tool": "find_name", "name": "손톱 깎았는지 확인 No, wait", "when": "today"},
            {"tool": "find_name", "name": "손톱", "when": "today"},
        ],
    )
    res = ask(phone(app), "이번 주 낮잠이 지난주보다 줄었어? 손톱은?", tools=True)
    assert res.json()["calls"] == [
        NO_ARGS
        | {
            "tool": "compare_ranges",
            "what": "nap",
            "measure": "duration",
            "range": "thisWeek",
            "rangeB": "lastWeek",
        },
        NO_ARGS | {"tool": "total", "what": "feed", "range": "today", "measure": "count"},
        NO_ARGS | {"tool": "find_name", "name": "손톱", "when": "today"},
    ]


def test_tools_with_no_valid_call_is_unknown(app, fake: FakeModel) -> None:
    answer(fake, type="tools", calls=[{"tool": "total", "what": "nail"}])
    assert ask(phone(app), "손톱 몇 번 잘랐어?", tools=True).json() == EMPTY


def test_tools_examples_follow_the_catalog() -> None:
    """tools.json 의 보기는 그 기능의 값을 모두 갖추고 값이 목록 안에 있어야 한다.

    지시문의 보기가 틀리면 모델이 따라 틀린다.
    """
    from app.domain.agent.prompt import TOOLS
    from app.domain.agent.service import _call

    for tool in TOOLS["tools"]:
        assert tool["examples"], tool["name"]
        for ex in tool["examples"]:
            call = _call(ex["call"])
            assert call is not None and call.tool == tool["name"], ex


def test_tool_calls_fill_missing_values(app, fake: FakeModel) -> None:
    """실제 호출(2026-11-10)에서 본 모양 — 기간을 when 에 쓰고 measure 와 rangeB 를 비웠다.

    서버가 채운다.
    """
    answer(
        fake,
        type="tools",
        calls=[
            {"tool": "compare_ranges", "what": "feed", "when": "today"},
            {"tool": "compare_ranges", "what": "feed", "when": "yesterday"},
            {"tool": "total", "what": "night", "when": "yesterday"},
            {"tool": "wake"},
        ],
    )
    res = ask(phone(app), "오늘 어제보다 많이 먹었어? 어젯밤은?", tools=True)
    assert res.json()["calls"] == [
        NO_ARGS
        | {
            "tool": "compare_ranges",
            "what": "feed",
            "measure": "count",
            "range": "today",
            "rangeB": "yesterday",
        },
        NO_ARGS | {"tool": "total", "what": "night", "range": "yesterday", "measure": "duration"},
        NO_ARGS | {"tool": "wake", "sleep": "any"},
    ]
    # 어제와 견줄 기간은 정해 둔 것이 없어 둘째 줄은 버린다


@pytest.mark.parametrize(
    ("text", "call", "want"),
    [
        # 두 번째 실제 호출(2026-11-10)에서 본 모양 — 기간을 오늘로 잡거나 비웠다
        (
            "이번 주 낮잠이 지난주보다 줄었어?",
            {
                "tool": "compare_ranges",
                "what": "nap",
                "measure": "duration",
                "range": "today",
                "rangeB": "yesterday",
            },
            {
                "tool": "compare_ranges",
                "what": "nap",
                "measure": "duration",
                "range": "thisWeek",
                "rangeB": "lastWeek",
            },
        ),
        (
            "어젯밤 몇 시간 잤어?",
            {"tool": "total", "what": "night", "measure": "duration"},
            {"tool": "total", "what": "night", "measure": "duration", "range": "lastNight"},
        ),
        (
            "어제 밤에 몇 시간 잤어?",
            {"tool": "total", "what": "night", "range": "yesterday", "measure": "duration"},
            {"tool": "total", "what": "night", "measure": "duration", "range": "lastNight"},
        ),
        # 기간 낱말이 없으면 모델이 고른 값 그대로
        (
            "요즘 분유 하루 평균 얼마나 먹어?",
            {"tool": "average", "what": "formula", "range": "recent7", "measure": "amount"},
            {"tool": "average", "what": "formula", "range": "recent7", "measure": "amount"},
        ),
    ],
)
def test_tool_range_follows_the_sentence(
    app, fake: FakeModel, text: str, call: dict, want: dict
) -> None:
    answer(fake, type="tools", calls=[call])
    assert ask(phone(app), text, tools=True).json()["calls"] == [NO_ARGS | want]


def test_agent_can_be_switched_off(app, settings: Settings, fake: FakeModel) -> None:
    """MALKONG_AGENT_ENABLED=false 면 모델을 부르지 않고 503.

    앱은 규칙과 카드로만 답한다(decisions/044).
    """
    off = settings.model_copy(update={"agent_enabled": False})
    app.dependency_overrides[get_agent_service] = lambda: AgentService(fake, off)
    res = ask(phone(app), "이거 지워 줘")
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"
    assert fake.calls == []


def test_agent_logs_only_the_answer_kind(app, fake: FakeModel, caplog) -> None:
    """로그에는 답의 종류와 기능 이름, 보낸 기록 수만 — 문장과 기록 내용은 적지 않는다."""
    answer(fake, type="tools", calls=[{"tool": "find_name", "name": "손톱", "when": "today"}])
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        ask(phone(app), "오늘 손톱 잘랐나?", tools=True)
    lines = [r.getMessage() for r in caplog.records if r.getMessage().startswith("agent: 답")]
    assert lines == ["agent: 답 tools (find_name) 기록 6개"]
    assert "손톱" not in caplog.text
