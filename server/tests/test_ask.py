import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.domain.ask.router import get_ask_service
from app.domain.ask.schema import (
    AnswerResponse,
    AskRequest,
    Followup,
    FollowupResponse,
    RedflagResponse,
    Source,
    Usage,
)
from app.main import create_app

VALID = {
    "question": "분유를 갑자기 잘 안 먹어요",
    "baby": {"months": 3, "records": [{"kind": "기록", "label": "수유 텀 3시간 · 160ml"}]},
    "clientMessageId": "m-1",
}


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


def test_answer_has_contract_shape(client: TestClient) -> None:
    res = client.post("/v1/ask", json=VALID, headers={"X-Device-Key": "test"})
    assert res.status_code == 200
    body = res.json()
    assert body["type"] == "answer"
    assert body["answer"]
    assert isinstance(body["records"], list)
    assert isinstance(body["usage"]["remaining"], int)
    assert body["eco"] is False


def test_answer_sources_are_not_empty(client: TestClient) -> None:
    sources = client.post("/v1/ask", json=VALID).json()["sources"]
    assert len(sources) >= 1
    assert all(s["id"] and s["name"] and s["url"] for s in sources)


def test_device_key_is_optional(client: TestClient) -> None:
    assert client.post("/v1/ask", json=VALID).status_code == 200


def test_eco_mode_is_marked(client: TestClient) -> None:
    res = client.post("/v1/ask", json={**VALID, "mode": "eco"})
    assert res.json()["eco"] is True


def test_answer_without_sources_cannot_be_built() -> None:
    with pytest.raises(ValidationError):
        AnswerResponse(answer="근거 없는 답", sources=[], usage=Usage(remaining=1))


@pytest.mark.parametrize(
    "payload",
    [
        {k: v for k, v in VALID.items() if k != "clientMessageId"},
        {**VALID, "question": "   "},
        {**VALID, "baby": {"months": -1}},
        {**VALID, "baby": {"months": 3, "records": [{"kind": "메모", "label": "x"}]}},
        {**VALID, "mode": "fast"},
    ],
    ids=["missing-client-message-id", "blank-question", "negative-months", "bad-kind", "bad-mode"],
)
def test_invalid_request_uses_common_error_shape(client: TestClient, payload: dict) -> None:
    res = client.post("/v1/ask", json=payload)
    assert res.status_code == 422
    body = res.json()
    assert set(body) == {"code", "message"}
    assert body["code"] == "INVALID_REQUEST"


def test_broken_json_uses_common_error_shape(client: TestClient) -> None:
    res = client.post("/v1/ask", content=b"{oops", headers={"Content-Type": "application/json"})
    assert res.status_code == 422
    assert res.json() == {
        "code": "INVALID_REQUEST",
        "message": "요청 본문이 올바른 JSON 이 아니에요",
    }


def test_snake_case_field_name_is_also_accepted() -> None:
    req = AskRequest.model_validate(
        {"question": "q", "baby": {"months": 0}, "client_message_id": "m-1"}
    )
    assert req.client_message_id == "m-1"


# service 가 다른 type 을 돌려줄 때도 계약 모양(camelCase)으로 나가는지 — common/004 가 기댈 자리


class FixedService:
    def __init__(self, response) -> None:
        self.response = response

    def ask(self, _req: AskRequest):
        return self.response


def test_followup_is_serialized_in_camel_case(app, client: TestClient) -> None:
    followup = Followup(
        question="열이 몇 도예요?", chips=["37.5 미만", "38 이상"], record_label="체온"
    )
    app.dependency_overrides[get_ask_service] = lambda: FixedService(
        FollowupResponse(followup=followup)
    )
    body = client.post("/v1/ask", json=VALID).json()
    assert body == {
        "type": "followup",
        "followup": {
            "question": "열이 몇 도예요?",
            "chips": ["37.5 미만", "38 이상"],
            "recordLabel": "체온",
        },
    }


def test_redflag_passes_through(app, client: TestClient) -> None:
    source = Source(id="k-x", name="출처", url="https://example.invalid")
    app.dependency_overrides[get_ask_service] = lambda: FixedService(
        RedflagResponse(answer="바로 병원에 가세요", sources=[source])
    )
    body = client.post("/v1/ask", json=VALID).json()
    assert body["type"] == "redflag"
    assert body["sources"] == [{"id": "k-x", "name": "출처", "url": "https://example.invalid"}]
