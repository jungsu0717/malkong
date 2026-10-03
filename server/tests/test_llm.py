"""모델 어댑터와 프롬프트 — 실제 API 를 부르지 않고 SDK 자리에 가짜를 끼워 본다."""

import json
from types import SimpleNamespace

import pytest

from app.domain.ask.prompt import (
    MODEL_OUTPUT_SCHEMA,
    SYSTEM_PROMPT,
    BabyRecordLine,
    L1Snippet,
    ModelOutput,
    build_user_message,
)
from app.infra.llm.anthropic import AnthropicClient
from app.infra.llm.base import LlmError, LlmRequest, LlmUnavailable
from app.infra.llm.gemini import GeminiClient

SAMPLE = {
    "level": "사실",
    "type": "answer",
    "answer": "4개월에는 DTaP 2차가 있어요.",
    "citedIds": ["k-vacc-0401"],
    "followup": {"question": "", "chips": [], "recordLabel": ""},
    "records": [],
}
REQ = LlmRequest(system=SYSTEM_PROMPT, user="질문: q", schema=MODEL_OUTPUT_SCHEMA)


class Recorder:
    """create(**kwargs) 를 받아 적어 두고 정해 둔 응답을 돌려주는 가짜."""

    def __init__(self, response) -> None:
        self.response = response
        self.kwargs: dict = {}

    def create(self, **kwargs):
        self.kwargs = kwargs
        return self.response


# --- 프롬프트 ---


def _assert_strict(schema: dict) -> None:
    # 두 회사의 JSON 형식 강제가 모두 받아들이는 모양: 모든 속성이 required, 추가 속성 금지
    if schema.get("type") == "object":
        assert set(schema["required"]) == set(schema["properties"])
        assert schema["additionalProperties"] is False
        for child in schema["properties"].values():
            _assert_strict(child)
    if schema.get("type") == "array":
        _assert_strict(schema["items"])


def test_output_schema_is_strict_everywhere() -> None:
    _assert_strict(MODEL_OUTPUT_SCHEMA)
    assert "$ref" not in json.dumps(MODEL_OUTPUT_SCHEMA)


def test_output_schema_matches_model_output() -> None:
    out = ModelOutput.model_validate(SAMPLE)
    assert out.cited_ids == ["k-vacc-0401"]
    assert set(out.model_dump(by_alias=True)) == set(MODEL_OUTPUT_SCHEMA["properties"])


def test_user_message_carries_context() -> None:
    msg = build_user_message(
        "이번 달 접종 뭐 있어요?",
        4,
        [BabyRecordLine("기록", "2개월 접종 완료")],
        [
            L1Snippet(
                "k-vacc-0401", "DTaP 2차", "DTaP 두 번째 접종이에요.", "질병관리청 예방접종도우미"
            )
        ],
    )
    assert "생후 4개월" in msg
    assert "[기록] 2개월 접종 완료" in msg
    assert "id: k-vacc-0401" in msg
    assert msg.endswith("질문: 이번 달 접종 뭐 있어요?")


def test_user_message_says_when_context_is_empty() -> None:
    msg = build_user_message("q", 3, [], [])
    assert "- 없음" in msg
    assert "표준 지식 없음" in msg


# --- Gemini ---


def _gemini(response) -> tuple[GeminiClient, Recorder]:
    client = GeminiClient(api_key="test", model="gemini-test")
    recorder = Recorder(response)
    client._client = SimpleNamespace(interactions=recorder)
    return client, recorder


def test_gemini_maps_usage_and_does_not_store() -> None:
    usage = SimpleNamespace(
        total_input_tokens=1200,
        total_cached_tokens=800,
        total_output_tokens=90,
        total_thought_tokens=300,
    )
    client, rec = _gemini(
        SimpleNamespace(output_text=json.dumps(SAMPLE), usage=usage, model=None, status="completed")
    )
    result = client.generate(REQ)
    assert result.data == SAMPLE
    assert (result.input_tokens, result.cached_input_tokens) == (1200, 800)
    assert (result.output_tokens, result.thought_tokens) == (90, 300)
    assert result.model == "gemini-test"
    assert rec.kwargs["store"] is False
    assert rec.kwargs["system_instruction"] == SYSTEM_PROMPT
    assert rec.kwargs["response_format"]["schema"] is MODEL_OUTPUT_SCHEMA


def test_gemini_rejects_non_json() -> None:
    client, _ = _gemini(
        SimpleNamespace(output_text="죄송해요", usage=None, model=None, status=None)
    )
    with pytest.raises(LlmError):
        client.generate(REQ)


# --- Claude ---


def _anthropic(response, *, vertex: bool = False) -> tuple[AnthropicClient, Recorder]:
    if vertex:
        client = AnthropicClient("claude-test", vertex_project="test-project")
    else:
        client = AnthropicClient("claude-test", api_key="test")
    recorder = Recorder(response)
    client._client = SimpleNamespace(messages=recorder, beta=SimpleNamespace(messages=recorder))
    return client, recorder


def _claude_response(text: str, stop_reason: str = "end_turn", model: str = "claude-test"):
    usage = SimpleNamespace(
        input_tokens=100,
        cache_read_input_tokens=1500,
        cache_creation_input_tokens=0,
        output_tokens=400,
    )
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[
            SimpleNamespace(type="thinking", thinking=""),
            SimpleNamespace(type="text", text=text),
        ],
        usage=usage,
        model=model,
    )


def test_anthropic_maps_usage_and_caches_system() -> None:
    client, rec = _anthropic(_claude_response(json.dumps(SAMPLE)))
    result = client.generate(REQ)
    assert result.data == SAMPLE
    assert (result.input_tokens, result.cached_input_tokens) == (1600, 1500)
    assert result.output_tokens == 400
    assert rec.kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert rec.kwargs["output_config"]["format"]["schema"] is MODEL_OUTPUT_SCHEMA


def test_anthropic_reports_fallback_model() -> None:
    client, _ = _anthropic(_claude_response(json.dumps(SAMPLE), model="claude-other"))
    assert client.generate(REQ).model == "claude-other"


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_anthropic_raises_when_no_usable_answer(stop_reason: str) -> None:
    client, _ = _anthropic(_claude_response("", stop_reason=stop_reason))
    with pytest.raises(LlmError):
        client.generate(REQ)


def test_anthropic_direct_api_asks_for_fallback() -> None:
    client, rec = _anthropic(_claude_response(json.dumps(SAMPLE)))
    client.generate(REQ)
    assert rec.kwargs["fallbacks"] == "default"


def test_anthropic_on_vertex_skips_fallback_but_keeps_format_and_cache() -> None:
    # Vertex 에는 서버 쪽 자동 대체가 없다 — 보내면 거절된다
    client, rec = _anthropic(_claude_response(json.dumps(SAMPLE)), vertex=True)
    assert client.generate(REQ).data == SAMPLE
    assert "fallbacks" not in rec.kwargs and "betas" not in rec.kwargs
    assert rec.kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert rec.kwargs["output_config"]["format"]["schema"] is MODEL_OUTPUT_SCHEMA


def test_anthropic_needs_a_way_in() -> None:
    with pytest.raises(ValueError):
        AnthropicClient("claude-test")


class StatusError(Exception):
    """SDK 의 API 오류 흉내 — 상태 코드만 싣는다."""

    def __init__(self, status_code: int) -> None:
        super().__init__("spend cap")
        self.status_code = status_code


class Raiser:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def create(self, **kwargs):
        raise self.exc


@pytest.mark.parametrize("status", [401, 403, 429])
def test_gemini_maps_refusal_status_to_unavailable(status: int) -> None:
    client = GeminiClient(api_key="test", model="gemini-test")
    client._client = SimpleNamespace(interactions=Raiser(StatusError(status)))
    with pytest.raises(LlmUnavailable):
        client.generate(REQ)


def test_gemini_maps_other_api_errors_to_llm_error() -> None:
    client = GeminiClient(api_key="test", model="gemini-test")
    client._client = SimpleNamespace(interactions=Raiser(StatusError(500)))
    with pytest.raises(LlmError) as info:
        client.generate(REQ)
    assert not isinstance(info.value, LlmUnavailable)
    # 메시지에 요청·응답 내용을 싣지 않는다
    assert "spend cap" not in str(info.value)


def test_gemini_sdk_does_not_retry_refusals() -> None:
    # SDK 가 429 를 되풀이하면 앱이 90초 넘게 기다렸다 — 다시 부르는 것은 5xx 뿐이어야 한다
    from google.genai._gaos.google_genai import _translate_retry_config

    client = GeminiClient(api_key="test", model="gemini-test", timeout_s=20)
    config = _translate_retry_config(client._client._api_client._http_options)
    assert config.max_retries <= 1
    assert set(config.status_codes_override or []) == {"500", "502", "503", "504"}
