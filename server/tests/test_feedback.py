"""POST /v1/feedback (SPEC-ASK-06, task ask/003) — 기기 키와 떼어 저장하고, 원문은 동의했을 때만."""

import pytest
from fastapi.testclient import TestClient

from app.common.core.setting import Settings
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.domain.feedback.router import get_feedback_service
from app.domain.feedback.service import MAX_PER_DEVICE_PER_DAY, FeedbackService
from app.infra.db.feedback_store import MemoryFeedbackStore
from app.infra.db.usage_store import MemoryUsageStore
from app.main import create_app

BODY = {
    "answerId": "msg-1",
    "rating": "down",
    "comment": "  너무 길어요 ",
    "answer": {"level": "일반", "sourceIds": ["k-feed-0001"], "eco": True},
}


@pytest.fixture
def store() -> MemoryFeedbackStore:
    return MemoryFeedbackStore()


@pytest.fixture
def client(store: MemoryFeedbackStore) -> TestClient:
    app = create_app()
    usage = EntitlementsService(MemoryUsageStore(), Settings(_env_file=None))
    service = FeedbackService(store)
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_feedback_service] = lambda: service
    return TestClient(app, headers={"X-Device-Key": usage.issue_device("t")})


def test_feedback_is_saved_without_the_device_key(client: TestClient, store) -> None:
    assert client.post("/v1/feedback", json=BODY).status_code == 204
    ((_, row),) = store.rows.values()
    assert row.rating == "down"
    assert row.comment == "너무 길어요"
    assert row.level == "일반" and row.source_ids == ["k-feed-0001"] and row.eco
    assert row.shared_question is None and row.shared_answer is None
    # 키도, 앱의 말풍선 id 도 그대로 남지 않는다
    key = client.headers["X-Device-Key"]
    assert key not in repr(row) and "msg-1" not in repr(row)


def test_shared_text_only_when_sent(client: TestClient, store) -> None:
    shared = {**BODY, "shared": {"question": "분유를 안 먹어요", "answer": "일반적으로는…"}}
    client.post("/v1/feedback", json=shared)
    ((_, row),) = store.rows.values()
    assert row.shared_question == "분유를 안 먹어요"


def test_same_answer_keeps_the_last_feedback(client: TestClient, store) -> None:
    client.post("/v1/feedback", json=BODY)
    client.post("/v1/feedback", json={**BODY, "rating": "up", "comment": None})
    ((_, row),) = store.rows.values()
    assert row.rating == "up"


def test_feedback_needs_a_key(store) -> None:
    app = create_app()
    app.dependency_overrides[get_feedback_service] = lambda: FeedbackService(store)
    app.dependency_overrides[get_entitlements_service] = lambda: EntitlementsService(
        MemoryUsageStore(), Settings(_env_file=None)
    )
    assert TestClient(app).post("/v1/feedback", json=BODY).status_code == 401


def test_feedback_per_device_is_capped(client: TestClient) -> None:
    for i in range(MAX_PER_DEVICE_PER_DAY):
        assert client.post("/v1/feedback", json={**BODY, "answerId": f"m-{i}"}).status_code == 204
    res = client.post("/v1/feedback", json={**BODY, "answerId": "one-more"})
    assert res.status_code == 429
    assert res.json()["code"] == "TOO_MANY_FEEDBACK"


@pytest.mark.parametrize(
    "payload",
    [
        {**BODY, "rating": "meh"},
        {**BODY, "comment": "가" * 501},
        {k: v for k, v in BODY.items() if k != "answerId"},
    ],
    ids=["bad-rating", "long-comment", "no-answer-id"],
)
def test_invalid_feedback(client: TestClient, payload: dict) -> None:
    assert client.post("/v1/feedback", json=payload).status_code == 422
