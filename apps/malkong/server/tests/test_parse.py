"""문장 읽기 /v1/parse (decisions/039, task common/031).

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
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import KST, EntitlementsService
from app.domain.parse.prompt import MODEL_SCHEMA, SYSTEM_PROMPT
from app.domain.parse.router import get_parse_service, model_from
from app.domain.parse.service import ParseService
from app.infra.db.usage_store import MemoryUsageStore
from app.infra.llm.base import ModelError
from app.infra.llm.gemini import ENDPOINT, GeminiModel
from app.main import create_app

NOW = "2026-11-09T14:20:00+09:00"
CAP = 3


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
    return Settings(_env_file=None, gemini_api_key=None, parse_per_device_per_day=CAP)


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
    service = ParseService(fake, settings)
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_parse_service] = lambda: service
    return app


def phone(app) -> TestClient:
    key = TestClient(app).post("/v1/devices").json()["deviceKey"]
    return TestClient(app, headers={"X-Device-Key": key})


def ask(client: TestClient, text: str, now: str = NOW):
    return client.post("/v1/parse", json={"text": text, "now": now})


def test_needs_device_key(app) -> None:
    res = ask(TestClient(app), "분유 120 먹였어")
    assert res.status_code == 401
    assert res.json()["code"] == "DEVICE_KEY_INVALID"


def test_several_records_in_one_sentence(app, fake: FakeModel) -> None:
    fake.answer = json.dumps(
        {
            "type": "records",
            "records": [
                # 다른 시간대로 와도 기기의 시간대(+09:00)로 맞춰 내보낸다
                {"kind": "diaper", "diaper": "both", "startAt": "2026-11-09T05:10:00Z"},
                {"kind": "formula", "amount": 120, "startAt": "2026-11-09T14:10:00+09:00"},
            ],
        }
    )
    res = ask(phone(app), "10분 전에 대소변 기저귀 갈고 분유 120 먹였어")
    assert res.status_code == 200
    body = res.json()
    assert body["type"] == "records"
    assert body["question"] is None
    diaper, formula = body["records"]
    assert diaper["kind"] == "diaper"
    assert diaper["diaper"] == "both"
    assert datetime.fromisoformat(diaper["startAt"]).isoformat() == "2026-11-09T14:10:00+09:00"
    assert formula["kind"] == "formula"
    assert formula["amount"] == 120
    assert formula["minutes"] is None

    # 모델에는 지시문과 문장, 지금 시각만 간다
    system, user, schema = fake.calls[0]
    assert system == SYSTEM_PROMPT
    assert schema == MODEL_SCHEMA
    sentence = "10분 전에 대소변 기저귀 갈고 분유 120 먹였어"
    assert user == f"지금: 2026-11-09T14:20:00+09:00 월요일\n문장: {sentence}"


def test_record_fields_are_cleaned(app, fake: FakeModel) -> None:
    fake.answer = json.dumps(
        {
            "type": "records",
            "records": [
                # 모유에 붙은 이름과 양은 버린다
                {"kind": "breast", "side": "left", "minutes": 15, "title": "모유", "amount": 3},
                # 시간대 없이 온 때는 기기의 시간대로 본다
                {"kind": "sleep", "startAt": "2026-11-09T09:00:00", "minutes": 40},
                {"kind": "routine", "title": " 비타민D "},
                # 이름 없는 루틴 · 메모는 뺀다
                {"kind": "routine"},
                {"kind": "memo", "title": "  "},
                # 소변에는 변 색이 없다
                {"kind": "diaper", "diaper": "pee", "color": "green"},
            ],
        }
    )
    body = ask(phone(app), "왼쪽 15분 먹이고 비타민D 먹였어").json()
    breast, sleep, routine, diaper = body["records"]
    assert breast["side"] == "left"
    assert breast["minutes"] == 15
    assert breast["title"] is None
    assert breast["amount"] is None
    assert datetime.fromisoformat(sleep["startAt"]).isoformat() == "2026-11-09T09:00:00+09:00"
    assert routine["title"] == "비타민D"
    assert diaper["diaper"] == "pee"
    assert diaper["color"] is None


def test_question(app, fake: FakeModel) -> None:
    fake.answer = json.dumps(
        {
            "type": "question",
            "records": [{"kind": "formula", "amount": 100}],
            "question": {"what": "feed", "range": "lastNight", "measure": "count"},
        }
    )
    body = ask(phone(app), "어젯밤에 몇 번 먹었어?").json()
    assert body == {
        "type": "question",
        "records": [],
        "question": {"what": "feed", "range": "lastNight", "measure": "count"},
    }


def test_health_question_carries_nothing(app, fake: FakeModel) -> None:
    fake.answer = json.dumps(
        {
            "type": "health",
            "records": [{"kind": "temp", "amount": 38}],
            "question": {"what": "temp", "range": "today", "measure": "last"},
        }
    )
    body = ask(phone(app), "열이 38도인데 괜찮아?").json()
    assert body == {"type": "health", "records": [], "question": None}


@pytest.mark.parametrize(
    "answer",
    [
        "",
        "JSON 이 아닌 글",
        "[]",
        '{"type":"advice"}',
        '{"type":"records","records":[]}',
        '{"type":"records","records":[{"kind":"bath"}]}',
        '{"type":"records","records":[{"kind":"formula","amount":-5}]}',
        '{"type":"question"}',
        # 범위에 다른 값이 필요한 recentN · date 는 받지 않는다
        '{"type":"question","question":{"what":"feed","range":"recentN","measure":"count"}}',
    ],
)
def test_invalid_model_answer_is_unknown(app, fake: FakeModel, caplog, answer: str) -> None:
    fake.answer = answer
    with caplog.at_level(logging.WARNING):
        res = ask(phone(app), "아기 오늘 어땠지")
    assert res.status_code == 200
    assert res.json() == {"type": "unknown", "records": [], "question": None}
    # 로그에는 문장도 모델 답도 적히지 않는다
    assert "아기 오늘 어땠지" not in caplog.text
    if answer:
        assert answer not in caplog.text


def test_missing_key_is_503(app, settings: Settings) -> None:
    assert model_from(settings) is None
    service = ParseService(model_from(settings), settings)
    app.dependency_overrides[get_parse_service] = lambda: service
    res = ask(phone(app), "분유 120 먹였어")
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"


def test_model_error_is_503(app, fake: FakeModel) -> None:
    fake.answer = ModelError("HTTP 429")
    res = ask(phone(app), "분유 120 먹였어")
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"


def test_daily_cap(app, fake: FakeModel, clock: Clock) -> None:
    client = phone(app)
    for _ in range(CAP):
        assert ask(client, "분유 120 먹였어").status_code == 200
    res = ask(client, "분유 120 먹였어")
    assert res.status_code == 429
    assert res.json()["code"] == "LIMIT_EXCEEDED"
    assert len(fake.calls) == CAP
    # 다른 기기는 막히지 않는다
    assert ask(phone(app), "분유 120 먹였어").status_code == 200
    # 한국 시간 0시가 지나면 다시 된다
    clock.now = datetime(2026, 11, 10, 0, 1, tzinfo=KST)
    assert ask(client, "분유 120 먹였어").status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {"text": "", "now": NOW},
        {"text": "   ", "now": NOW},
        {"text": "가" * 301, "now": NOW},
        {"now": NOW},
        # 시간대가 없는 지금은 받지 않는다 — 「10분 전」을 셀 수 없다
        {"text": "분유 120 먹였어", "now": "2026-11-09T14:20:00"},
        {"text": "분유 120 먹였어"},
    ],
)
def test_request_is_checked(app, fake: FakeModel, body: dict) -> None:
    res = phone(app).post("/v1/parse", json=body)
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_REQUEST"
    assert fake.calls == []


def test_longest_text_is_accepted(app) -> None:
    assert ask(phone(app), "가" * 300).status_code == 200


# --- Gemini 어댑터 — 가짜 전송으로 요청과 응답 모양만 본다 ---


def gemini(handler) -> GeminiModel:
    return GeminiModel(
        "test-key", "gemini-test", timeout_s=5, transport=httpx2.MockTransport(handler)
    )


def test_gemini_request_and_output() -> None:
    seen: dict = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return httpx2.Response(
            200,
            json={
                "status": "completed",
                "steps": [
                    {"type": "thought", "signature": "x"},
                    {"type": "model_output", "content": [{"type": "text", "text": '{"type":'}]},
                    {"type": "model_output", "content": [{"type": "text", "text": '"health"}'}]},
                ],
            },
        )

    text = asyncio.run(gemini(handler).generate_json("지시", "문장", {"type": "object"}))
    assert text == '{"type":"health"}'
    assert seen["url"] == ENDPOINT
    # 키는 요청 머리로만 가고 주소에는 없다
    assert seen["key"] == "test-key"
    assert "test-key" not in seen["url"]
    body = seen["body"]
    assert body["model"] == "gemini-test"
    assert body["store"] is False
    assert body["system_instruction"] == "지시"
    assert body["input"] == "문장"
    assert body["response_format"]["mime_type"] == "application/json"
    assert body["response_format"]["schema"] == {"type": "object"}


def test_gemini_incomplete_answer_is_empty() -> None:
    def handler(_: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"status": "incomplete", "steps": []})

    assert asyncio.run(gemini(handler).generate_json("지시", "문장", {})) == ""


@pytest.mark.parametrize("status", [400, 403, 429, 500])
def test_gemini_http_error(status: int) -> None:
    def handler(_: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(status, json={"error": {"message": "문장이 섞인 메시지"}})

    with pytest.raises(ModelError) as err:
        asyncio.run(gemini(handler).generate_json("지시", "문장", {}))
    assert str(err.value) == f"HTTP {status}"


def test_gemini_network_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("연결 실패", request=request)

    with pytest.raises(ModelError) as err:
        asyncio.run(gemini(handler).generate_json("지시", "문장", {}))
    assert str(err.value) == "ConnectError"


def test_model_is_built_when_key_is_set() -> None:
    settings = Settings(_env_file=None, gemini_api_key="  gk-test \r\n")
    model = model_from(settings)
    assert isinstance(model, GeminiModel)
    assert model.model == "gemini-3.1-flash-lite"
