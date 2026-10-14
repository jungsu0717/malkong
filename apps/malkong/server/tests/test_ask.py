"""POST /v1/ask — 계약 모양과 파이프라인(위험 신호 → L1 검색 → 모델 → 검사).

모델은 가짜를 끼운다(server/AGENTS.md 「테스트」) — 실제 API 는 부르지 않는다.
"""

import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.common.core.setting import Settings, get_settings
from app.domain.ask.cache import ResponseCache
from app.domain.ask.router import get_ask_service, get_llm_client, get_response_cache
from app.domain.ask.schema import (
    AnswerResponse,
    AskRequest,
    Followup,
    FollowupResponse,
    RedflagResponse,
    Source,
    Usage,
)
from app.domain.entitlements.router import get_entitlements_service
from app.domain.entitlements.service import EntitlementsService
from app.infra.db.usage_store import MemoryUsageStore
from app.infra.llm.base import LlmError, LlmRequest, LlmResult, LlmUnavailable
from app.main import create_app

VALID = {
    "question": "분유를 갑자기 잘 안 먹어요",
    "baby": {"months": 3, "records": [{"kind": "기록", "label": "수유 텀 3시간 · 160ml"}]},
    "clientMessageId": "m-1",
}
FACT_Q = {
    "question": "6개월에 맞아야 하는 주사 다 알려주세요",
    "baby": {"months": 6},
    "clientMessageId": "m-2",
}


def model_out(**over) -> dict:
    """모델이 돌려주는 JSON(prompt.MODEL_OUTPUT_SCHEMA) 한 벌."""
    out = {
        "level": "일반",
        "type": "answer",
        "answer": "일반적으로는 이렇게 해요.",
        "citedIds": [],
        "followup": {"question": "", "chips": [], "recordLabel": ""},
        "records": [],
    }
    return out | over


class FakeLlm:
    """정해 둔 답을 차례로 돌려준다. 받은 요청은 남겨 두어 무엇이 모델로 갔는지 본다."""

    provider = "fake"
    model = "fake-model"

    def __init__(self, *outputs, tokens: tuple[int, int, int, int] = (0, 0, 0, 0)) -> None:
        self.outputs = list(outputs)
        self.requests: list[LlmRequest] = []
        # (입력, 그중 캐시, 출력, 생각) — 비용 천장 시험에서 쓴다
        self.tokens = tokens

    def generate(self, req: LlmRequest) -> LlmResult:
        self.requests.append(req)
        out = self.outputs.pop(0)
        if isinstance(out, Exception):
            raise out
        return LlmResult(
            data=out,
            raw_text="",
            model=self.model,
            input_tokens=self.tokens[0],
            cached_input_tokens=self.tokens[1],
            output_tokens=self.tokens[2],
            thought_tokens=self.tokens[3],
            latency_ms=0,
            stop_reason=None,
        )


@pytest.fixture
def usage() -> EntitlementsService:
    return EntitlementsService(MemoryUsageStore(), Settings(_env_file=None))


@pytest.fixture
def app(usage: EntitlementsService):
    app = create_app()
    # 진짜 팩토리는 셸 환경변수와 .env 를 읽는다 — 테스트가 그 값에 흔들리지 않게 기본은 모델 없음
    app.dependency_overrides[get_llm_client] = lambda: None
    # 사용량은 시험마다 새 메모리 저장소, 재시도 기억도 새로
    cache = ResponseCache()
    app.dependency_overrides[get_entitlements_service] = lambda: usage
    app.dependency_overrides[get_response_cache] = lambda: cache
    return app


@pytest.fixture
def client(app, usage: EntitlementsService) -> TestClient:
    # 발급받은 기기 키를 늘 싣는다(api-contract X-Device-Key)
    return TestClient(app, headers={"X-Device-Key": usage.issue_device("test")})


def use(app, llm: FakeLlm | None, *, paid: bool = False) -> None:
    app.dependency_overrides[get_llm_client] = lambda: llm
    app.dependency_overrides[get_settings] = lambda: Settings(llm_paid_tier=paid, _env_file=None)


# --- 계약 모양 ---


def test_answer_has_contract_shape(app, client: TestClient) -> None:
    use(app, FakeLlm(model_out()))
    res = client.post("/v1/ask", json=VALID)
    assert res.status_code == 200
    body = res.json()
    assert body["type"] == "answer"
    assert body["answer"]
    assert body["level"] in {"사실", "일반", "판단"}
    assert isinstance(body["records"], list)
    assert isinstance(body["usage"]["remaining"], int)


def test_model_answer_needs_known_device_key(app) -> None:
    use(app, FakeLlm(model_out(), model_out()))
    bare = TestClient(app)
    for headers in ({}, {"X-Device-Key": "dk_unknown"}):
        res = bare.post("/v1/ask", json=VALID, headers=headers)
        assert res.status_code == 401
        assert res.json()["code"] == "DEVICE_KEY_INVALID"


def test_fact_answer_without_sources_cannot_be_built() -> None:
    with pytest.raises(ValidationError):
        AnswerResponse(answer="근거 없는 사실", level="사실", sources=[], usage=Usage(remaining=1))


def test_general_answer_may_have_no_sources() -> None:
    res = AnswerResponse(answer="일반적으로는", level="일반", usage=Usage(remaining=1))
    assert res.sources == []


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


class FixedService:
    def __init__(self, response) -> None:
        self.response = response

    def ask(self, _req: AskRequest, _device_key: str | None, _as_user: str | None = None):
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
        # 대화 요약 — 모델이 쓰지 않았으면 null(decisions/022)
        "conversationSummary": None,
    }


def test_redflag_passes_through(app, client: TestClient) -> None:
    source = Source(id="k-x", name="출처", url="https://example.invalid")
    app.dependency_overrides[get_ask_service] = lambda: FixedService(
        RedflagResponse(answer="바로 병원에 가세요", sources=[source])
    )
    body = client.post("/v1/ask", json=VALID).json()
    assert body["type"] == "redflag"
    assert body["sources"] == [{"id": "k-x", "name": "출처", "url": "https://example.invalid"}]


# --- ① 위험 신호 (SPEC-ASK-02) ---


def test_redflag_does_not_call_the_model(app, client: TestClient) -> None:
    llm = FakeLlm()
    use(app, llm)
    body = client.post(
        "/v1/ask",
        json={"question": "열이 38.2도예요", "baby": {"months": 1}, "clientMessageId": "r-1"},
    ).json()
    assert body["type"] == "redflag"
    assert llm.requests == []
    assert [s["id"] for s in body["sources"]] == ["k-warn-0001"]
    assert "119" in body["answer"]


def test_redflag_works_even_without_a_model(app, client: TestClient) -> None:
    # 모델이 연결되지 않았어도 응급 안내는 막히지 않는다
    use(app, None)
    body = client.post(
        "/v1/ask",
        json={"question": "아기가 경련을 해요", "baby": {"months": 9}, "clientMessageId": "r-2"},
    ).json()
    assert body["type"] == "redflag"
    assert [s["id"] for s in body["sources"]] == ["k-warn-0004"]


# --- ③ 모델 — L1 검색과 검사 ---


def test_fact_answer_cites_only_given_snippets(app, client: TestClient) -> None:
    llm = FakeLlm(
        model_out(
            level="사실",
            answer="6개월에는 DTaP 3차가 있어요.",
            citedIds=["k-vacc-0601", "k-made-up"],
        )
    )
    use(app, llm)
    body = client.post("/v1/ask", json=FACT_Q).json()
    assert body["level"] == "사실"
    # 지어낸 id 는 버린다
    assert [s["id"] for s in body["sources"]] == ["k-vacc-0601"]
    assert "id: k-vacc-0601" in llm.requests[0].user


def test_fact_without_citation_is_retried_then_refused(app, client: TestClient) -> None:
    llm = FakeLlm(
        model_out(level="사실", citedIds=[]), model_out(level="사실", citedIds=["k-nope"])
    )
    use(app, llm)
    res = client.post("/v1/ask", json=FACT_Q)
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"
    assert len(llm.requests) == 2
    assert "다시 답하기" in llm.requests[1].user


def test_refused_by_provider_fails_fast_without_retry(app, client: TestClient) -> None:
    # 요금 한도 초과(429) 같은 거절은 다시 불러도 같다 — 한 번만 부르고 바로 503
    llm = FakeLlm(LlmUnavailable("RateLimitError 429"), model_out())
    use(app, llm)
    res = client.post("/v1/ask", json=VALID)
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"
    assert len(llm.requests) == 1


def test_general_answer_is_marked_by_level_not_by_prefix(app, client: TestClient) -> None:
    # 근거 없음 표시는 앱의 「일반 정보」 배지가 맡는다(SPEC-ASK-08, task ask/012)
    # — 답 글은 그대로 나간다
    use(app, FakeLlm(model_out(level="일반", answer="목욕은 짧게 시켜요.")))
    body = client.post(
        "/v1/ask",
        json={"question": "손톱은 어떻게 잘라요?", "baby": {"months": 2}, "clientMessageId": "g"},
    ).json()
    assert body["level"] == "일반"
    assert body["sources"] == []
    assert body["answer"] == "목욕은 짧게 시켜요."


# --- 바로 앞 대화 (SPEC-ASK-01, task ask/012) ---


def _with_history(question: str, history: list[dict], mid: str = "h") -> dict:
    return {"question": question, "baby": {"months": 1}, "history": history, "clientMessageId": mid}


def test_history_goes_to_the_model_in_order(app, client: TestClient) -> None:
    llm = FakeLlm(model_out(level="일반", answer="두 달 정도는요."))
    use(app, llm)
    history = [
        {"role": "user", "text": "태열 예방하려면 얼마나 시원하게 해 줘야 해요?"},
        {"role": "buddy", "text": "실내는 22~24도 정도로\n유지해요."},
    ]
    res = client.post("/v1/ask", json=_with_history("몇 개월까지 그렇게 해야 해요?", history))
    assert res.status_code == 200
    user = llm.requests[0].user
    assert "바로 앞 대화:" in user
    head = user.index("- 부모: 태열 예방하려면 얼마나 시원하게 해 줘야 해요?")
    tail = user.index("- 버디: 실내는 22~24도 정도로 유지해요.")  # 줄 바꿈은 한 줄로 눌린다
    assert head < tail < user.index("질문: 몇 개월까지 그렇게 해야 해요?")


def test_history_is_trimmed_to_recent_turns_and_length(app, client: TestClient) -> None:
    llm = FakeLlm(model_out(level="일반", answer="답"))
    use(app, llm)
    history = [{"role": "user", "text": f"질문 {i}"} for i in range(7)]
    history.append({"role": "buddy", "text": "가" * 700})
    client.post("/v1/ask", json=_with_history("그건요?", history))
    user = llm.requests[0].user
    assert "질문 1" not in user and "질문 2" in user  # 최근 6턴만
    assert "가" * 600 in user and "가" * 601 not in user  # 한 턴 600자


def test_history_is_optional(app, client: TestClient) -> None:
    llm = FakeLlm(model_out(level="일반", answer="답"))
    use(app, llm)
    assert client.post("/v1/ask", json=VALID).status_code == 200
    assert "바로 앞 대화:\n- 없음" in llm.requests[0].user


def test_question_pointing_back_retrieves_with_the_previous_question(
    app, client: TestClient
) -> None:
    # 「몇 개월까지 그렇게?」만으로는 L1 이 안 잡힌다 — 직전 질문(BCG)의 조각을 건넨다
    llm = FakeLlm(model_out(level="사실", answer="생후 4주 안에요.", citedIds=["k-vacc-0001"]))
    use(app, llm)
    history = [
        {"role": "user", "text": "BCG 언제 맞아요?"},
        {"role": "buddy", "text": "생후 4주 안에 한 번이에요."},
    ]
    body = client.post(
        "/v1/ask", json=_with_history("몇 개월까지 그렇게 해야 해요?", history)
    ).json()
    assert "id: k-vacc-0001" in llm.requests[0].user
    assert body["sources"][0]["id"] == "k-vacc-0001"


# --- 대화 기억: 반박 · 가리키는 말 · 대화 요약 (decisions/022, task ask/013) ---

BCG_TURNS = [
    {"role": "user", "text": "BCG 언제 맞아요?"},
    {"role": "buddy", "text": "분유를 먹이고 계시니, 생후 4주 안에 한 번 맞히면 돼요."},
]


def _given_ids(user: str) -> list[str]:
    return [
        line.split("|")[0].removeprefix("- id: ").strip()
        for line in user.splitlines()
        if line.startswith("- id: ")
    ]


def test_objection_retrieves_with_the_original_question(app, client: TestClient) -> None:
    # 「분유 먹이는 거랑 무슨 상관이에요?」— 낱말(분유)이 아니라 원래 질문(BCG)으로 찾는다
    llm = FakeLlm(
        model_out(
            level="사실", answer="분유 이야기는 상관없었어요. 4주 안에요.", citedIds=["k-vacc-0001"]
        )
    )
    use(app, llm)
    body = client.post(
        "/v1/ask", json=_with_history("분유 먹이는 거랑 무슨 상관이에요?", BCG_TURNS)
    ).json()
    user = llm.requests[0].user
    assert "원래 질문: BCG 언제 맞아요?" in user
    assert _given_ids(user) and all(i.startswith("k-vacc") for i in _given_ids(user))
    assert body["sources"][0]["id"] == "k-vacc-0001"


def test_objection_is_answered_not_asked_back(app, client: TestClient) -> None:
    # 지적에 되물으면 흘려듣는 셈이다 — 되묻기가 오면 한 번 더, 이번엔 답으로
    asked = model_out(
        type="followup",
        answer="",
        followup={
            "question": "수유 방식이 어떻게 돼요?",
            "chips": ["모유", "분유"],
            "recordLabel": "수유 방식",
        },
    )
    llm = FakeLlm(asked, model_out(level="일반", answer="분유 이야기는 상관없었어요."))
    use(app, llm)
    body = client.post(
        "/v1/ask", json=_with_history("그게 아니라 에어컨 얘기였어요", BCG_TURNS)
    ).json()
    assert body["type"] == "answer"
    assert "이번에는 되묻지 않는다" in llm.requests[1].user


def test_plain_question_is_not_an_objection(app, client: TestClient) -> None:
    # 「상관없어요?」는 보통 질문이다 — 반박으로 보지 않는다
    llm = FakeLlm(model_out(level="일반", answer="답"))
    use(app, llm)
    client.post("/v1/ask", json=_with_history("밤에 깨도 상관없어요?", BCG_TURNS))
    assert "원래 질문:" not in llm.requests[0].user


def test_new_question_does_not_borrow_the_previous_topic(app, client: TestClient) -> None:
    # 가리키는 말이 없는 새 질문(에어컨)은 앞 질문(BCG)의 지식을 빌려 오지 않는다
    llm = FakeLlm(model_out(level="일반", answer="답"))
    use(app, llm)
    client.post("/v1/ask", json=_with_history("에어컨 틀어도 돼요?", BCG_TURNS))
    user = llm.requests[0].user
    assert _given_ids(user) == []
    assert "표준 지식:\n- 이 질문에 맞는 표준 지식 없음" in user


def test_summary_goes_in_and_comes_back(app, client: TestClient) -> None:
    llm = FakeLlm(
        model_out(level="일반", answer="답", summary="  에어컨을 물었다.\n분유는 상관없다고 했다. ")
    )
    use(app, llm)
    req = _with_history("창문은요?", BCG_TURNS) | {
        "conversationSummary": "에어컨 질문에 답했다.\n부모가 분유는 상관없다고 했다."
    }
    body = client.post("/v1/ask", json=req).json()
    user = llm.requests[0].user
    assert "이전 대화 요약:\n- 에어컨 질문에 답했다. 부모가 분유는 상관없다고 했다." in user
    assert user.index("이전 대화 요약:") < user.index("바로 앞 대화:")
    assert body["conversationSummary"] == "에어컨을 물었다. 분유는 상관없다고 했다."


def test_summary_is_optional_and_trimmed(app, client: TestClient) -> None:
    llm = FakeLlm(model_out(level="일반", answer="답"), model_out(level="일반", answer="답"))
    use(app, llm)
    body = client.post("/v1/ask", json=VALID).json()
    assert "이전 대화 요약:\n- 없음" in llm.requests[0].user
    assert body["conversationSummary"] is None
    long = VALID | {"clientMessageId": "m-long", "conversationSummary": "가" * 900}
    assert client.post("/v1/ask", json=long).status_code == 200
    assert "가" * 600 in llm.requests[1].user and "가" * 601 not in llm.requests[1].user


def test_system_prompt_uses_records_only_when_they_change_the_answer() -> None:
    from app.domain.ask.prompt import MODEL_OUTPUT_SCHEMA, SYSTEM_PROMPT

    assert "첫 두 문장" not in SYSTEM_PROMPT
    assert "답을 바꾸는 기록만" in SYSTEM_PROMPT
    assert "## 대화 이어 가기" in SYSTEM_PROMPT
    assert "summary" in MODEL_OUTPUT_SCHEMA["required"]


def _ungrounded(caplog) -> list[str]:
    return [r.getMessage() for r in caplog.records if "근거 없음" in r.getMessage()]


def test_ungrounded_answer_is_counted_without_the_question(app, client: TestClient, caplog) -> None:
    # 근거 없이 일반론으로 답하면 분류 × 월령 띠 × 검색 건수만 한 줄 —
    # 질문 원문은 없다 (task common/017)
    use(app, FakeLlm(model_out(level="일반", answer="목욕은 짧게 시켜요.")))
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        client.post(
            "/v1/ask",
            json={
                "question": "손톱은 어떻게 잘라요?",
                "baby": {"months": 2},
                "clientMessageId": "u1",
            },
        )
    assert _ungrounded(caplog) == ["ask: 근거 없음 kinds=없음 band=0~3 retrieved=0"]
    assert "손톱" not in caplog.text


def test_ungrounded_answer_keeps_its_topic_and_band(app, client: TestClient, caplog) -> None:
    use(app, FakeLlm(model_out(level="일반", answer="일반적으로는 매일 시켜도 돼요.")))
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        client.post(
            "/v1/ask",
            json={
                "question": "아기 목욕은 매일 시켜도 되나요?",
                "baby": {"months": 8},
                "clientMessageId": "u2",
            },
        )
    (line,) = _ungrounded(caplog)
    assert line.startswith("ask: 근거 없음 kinds=안전 band=7~12 retrieved=")


def test_cited_answer_is_not_counted_as_ungrounded(app, client: TestClient, caplog) -> None:
    use(app, FakeLlm(model_out(level="사실", answer="6개월엔 이렇게요.", citedIds=["k-vacc-0601"])))
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        client.post("/v1/ask", json=FACT_Q)
    assert _ungrounded(caplog) == []


def test_judgment_reassurance_is_regenerated(app, client: TestClient) -> None:
    llm = FakeLlm(
        model_out(level="판단", answer="걱정하지 마세요, 괜찮을 거예요."),
        model_out(level="판단", answer="이런 점을 살펴보고 소아청소년과 진료를 받아 보세요."),
    )
    use(app, llm)
    body = client.post(
        "/v1/ask",
        json={
            "question": "눈곱이 자주 끼는데 괜찮은 거죠?",
            "baby": {"months": 2},
            "clientMessageId": "j",
        },
    ).json()
    assert body["level"] == "판단"
    assert "괜찮" not in body["answer"]
    assert len(llm.requests) == 2


def test_judgment_reassurance_twice_falls_back(app, client: TestClient) -> None:
    llm = FakeLlm(
        model_out(level="판단", answer="정상이에요."), model_out(level="판단", answer="문제없어요.")
    )
    use(app, llm)
    body = client.post(
        "/v1/ask", json={"question": "괜찮은가요?", "baby": {"months": 2}, "clientMessageId": "j2"}
    ).json()
    assert body["level"] == "판단"
    assert "진료" in body["answer"]
    assert "정상" not in body["answer"] and "문제없" not in body["answer"]


def test_followup_from_model(app, client: TestClient) -> None:
    llm = FakeLlm(
        model_out(
            type="followup",
            answer="",
            followup={
                "question": "수유 방식이 어떻게 돼요?",
                "chips": ["모유", "분유", "잘 모르겠어요"],
                "recordLabel": "수유 방식",
            },
        )
    )
    # 되묻기는 기록을 보낼 수 있는 유료 티어에서만 나온다 — 무료 티어는 test_eco_never_asks_back
    use(app, llm, paid=True)
    body = client.post("/v1/ask", json=VALID).json()
    assert body["type"] == "followup"
    assert body["followup"]["recordLabel"] == "수유 방식"


def test_model_error_is_retried(app, client: TestClient) -> None:
    use(app, FakeLlm(LlmError("잘림"), model_out()))
    assert client.post("/v1/ask", json=VALID).json()["type"] == "answer"


def test_no_model_is_503(app, client: TestClient) -> None:
    use(app, None)
    res = client.post("/v1/ask", json=VALID)
    assert res.status_code == 503
    assert res.json()["code"] == "MODEL_UNAVAILABLE"


# --- 무료 티어에는 아기 기록을 보내지 않는다 ---


def test_free_tier_strips_records_and_marks_eco(app, client: TestClient) -> None:
    llm = FakeLlm(model_out())
    use(app, llm, paid=False)
    body = client.post("/v1/ask", json=VALID).json()
    assert body["eco"] is True
    assert "수유 텀 3시간" not in llm.requests[0].user


def test_paid_tier_sends_records(app, client: TestClient) -> None:
    llm = FakeLlm(model_out())
    use(app, llm, paid=True)
    body = client.post("/v1/ask", json=VALID).json()
    assert body["eco"] is False
    assert "수유 텀 3시간" in llm.requests[0].user


def test_eco_mode_strips_records_even_on_paid_tier(app, client: TestClient) -> None:
    llm = FakeLlm(model_out())
    use(app, llm, paid=True)
    body = client.post("/v1/ask", json={**VALID, "mode": "eco"}).json()
    assert body["eco"] is True
    assert "수유 텀 3시간" not in llm.requests[0].user


@pytest.mark.parametrize(
    "answer",
    [
        "걱정하지 마세요",
        "괜찮을 거예요",
        "정상이에요",
        "문제없어요",
    ],
)
def test_reassurance_phrases_are_caught(answer: str) -> None:
    from app.domain.ask.service import REASSURANCE

    assert REASSURANCE.search(answer)


def test_individual_difference_is_not_reassurance() -> None:
    # 판정이 아니라 사실이다 — 이것까지 잡으면 판단 답이 고정 문장으로 떨어진다(task ask/004)
    from app.domain.ask.service import REASSURANCE

    assert not REASSURANCE.search("아기마다 발달 속도에 차이가 있어요")


# --- 코드 리뷰에서 나온 경로 ---


def test_eco_never_asks_back(app, client: TestClient) -> None:
    # 무료 티어는 기록을 못 보내므로, 되묻으면 칩으로 답해도 같은 질문이 돌아온다 — 되묻지 않게 한다
    followup = {
        "question": "수유 방식이 어떻게 돼요?",
        "chips": ["분유", "모유"],
        "recordLabel": "수유 방식",
    }
    llm = FakeLlm(
        model_out(type="followup", answer="", followup=followup),
        model_out(level="일반", answer="일반적으로는 이렇게 해요."),
    )
    use(app, llm, paid=False)
    body = client.post("/v1/ask", json=VALID).json()
    assert body["type"] == "answer"
    assert "되묻지 말고" in llm.requests[0].user
    assert "되묻지 않는다" in llm.requests[1].user


def test_empty_answer_is_retried(app, client: TestClient) -> None:
    llm = FakeLlm(model_out(answer="   "), model_out(answer="일반적으로는 이래요."))
    use(app, llm)
    assert client.post("/v1/ask", json=VALID).json()["answer"] == "일반적으로는 이래요."
    assert len(llm.requests) == 2


def test_followup_is_cleaned_and_always_offers_dont_know(app, client: TestClient) -> None:
    followup = {
        "question": " 체온이 몇 도예요? ",
        "chips": ["37.5 미만", " ", "38 이상"],
        "recordLabel": "체온",
    }
    use(app, FakeLlm(model_out(type="followup", answer="", followup=followup)), paid=True)
    body = client.post("/v1/ask", json=VALID).json()
    assert body["followup"]["question"] == "체온이 몇 도예요?"
    assert body["followup"]["chips"] == ["37.5 미만", "38 이상", "잘 모르겠어요"]


def test_followup_without_label_is_retried(app, client: TestClient) -> None:
    bad = {"question": "몇 도예요?", "chips": ["37", "38"], "recordLabel": ""}
    good = {"question": "몇 도예요?", "chips": ["37", "38"], "recordLabel": "체온"}
    llm = FakeLlm(
        model_out(type="followup", answer="", followup=bad),
        model_out(type="followup", answer="", followup=good),
    )
    use(app, llm, paid=True)
    assert client.post("/v1/ask", json=VALID).json()["followup"]["recordLabel"] == "체온"


def test_judgment_then_broken_is_503(app, client: TestClient) -> None:
    # 판단 고정 문장은 마지막 시도까지 안심 표현이 남았을 때만이다 — 모델이 깨지면 503
    llm = FakeLlm(model_out(level="판단", answer="괜찮아요."), LlmError("잘림"))
    use(app, llm)
    res = client.post("/v1/ask", json={**VALID, "question": "괜찮은 거죠?"})
    assert res.status_code == 503


def test_twice_broken_is_503(app, client: TestClient) -> None:
    use(app, FakeLlm(LlmError("a"), LlmError("b")))
    assert client.post("/v1/ask", json=VALID).status_code == 503


def test_programming_errors_are_not_hidden(app, usage: EntitlementsService) -> None:
    # 우리 코드의 버그는 503 으로 덮지 않고 500 으로 흘려 traceback 을 남긴다
    use(app, FakeLlm(AttributeError("버그")))
    key = {"X-Device-Key": usage.issue_device("test")}
    res = TestClient(app, raise_server_exceptions=False, headers=key).post("/v1/ask", json=VALID)
    assert res.status_code == 500


def test_bad_model_settings_do_not_block_redflag(monkeypatch) -> None:
    # 어댑터를 만들다 실패해도 None 이 되어 위험 신호 응답은 그대로 나간다
    from app.domain.ask import router

    monkeypatch.setattr(
        router,
        "get_settings",
        lambda: Settings(llm_provider="anthropic", llm_model="x", _env_file=None),
    )
    assert router.get_llm_client.__wrapped__() is None


# --- 두 번째 겹 — 모델이 표시한 위험 신호 (decisions/010) ---


def test_model_flag_turns_answer_into_fixed_redflag(app, client: TestClient) -> None:
    use(app, FakeLlm(model_out(redFlag="k-warn-0003", answer="모델이 쓴 답")))
    body = client.post(
        "/v1/ask",
        json={"question": "애기가 좀 이상해요", "baby": {"months": 6}, "clientMessageId": "f"},
    ).json()
    assert body["type"] == "redflag"
    assert [s["id"] for s in body["sources"]] == ["k-warn-0003"]
    assert "모델이 쓴 답" not in body["answer"]
    assert "119" in body["answer"]


def test_under_three_month_fever_flag_is_ignored_for_older_babies(app, client: TestClient) -> None:
    use(app, FakeLlm(model_out(redFlag="k-warn-0001", answer="일반적으로는 이래요.")))
    body = client.post(
        "/v1/ask",
        json={"question": "애기가 좀 이상해요", "baby": {"months": 8}, "clientMessageId": "f2"},
    ).json()
    assert body["type"] == "answer"
