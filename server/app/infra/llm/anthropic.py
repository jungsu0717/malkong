"""Claude 어댑터 — anthropic 공식 SDK 의 Messages API.

부르는 길은 둘이다.
- **Vertex AI (기본)**: 같은 GCP 프로젝트로 부른다. API 키 대신 로컬은 gcloud 로그인
  (application-default), Cloud Run 은 서비스 계정 권한을 쓴다. 결제도 GCP 로 묶인다
- **Claude API 직결**: Anthropic 콘솔 키로 부른다. 거절 시 자동 대체(fallbacks)는 이쪽에만 있다

공통:
- JSON 형식은 output_config.format 으로 강제한다(OpenAI 호환 계층은 이것을 무시한다 — decisions/007)
- 시스템 프롬프트는 모든 질문에 같으므로 캐싱한다(backend 「③의 공통 프롬프트는 프롬프트 캐싱」)
"""

import json
import time
from typing import Any

import anthropic

from app.infra.llm.base import LlmError, LlmRequest, LlmResult


class AnthropicClient:
    provider = "anthropic"

    def __init__(
        self,
        model: str,
        *,
        vertex_project: str | None = None,
        vertex_region: str = "global",
        api_key: str | None = None,
    ) -> None:
        if vertex_project:
            self._client: Any = anthropic.AnthropicVertex(
                project_id=vertex_project, region=vertex_region
            )
            self._fallbacks = False
        elif api_key:
            self._client = anthropic.Anthropic(api_key=api_key)
            self._fallbacks = True
        else:
            raise ValueError("vertex_project 나 api_key 중 하나가 있어야 한다")
        self.model = model

    def generate(self, req: LlmRequest) -> LlmResult:
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": req.max_output_tokens,
            "system": [
                {"type": "text", "text": req.system, "cache_control": {"type": "ephemeral"}}
            ],
            "messages": [{"role": "user", "content": req.user}],
            "output_config": {"format": {"type": "json_schema", "schema": req.schema}},
        }
        started = time.perf_counter()
        if self._fallbacks:
            # 안전 분류기가 거절하면 서버 쪽에서 대체 모델로 다시 돌린다.
            # 답한 모델은 result.model 에 남는다
            response = self._client.beta.messages.create(
                **params, betas=["server-side-fallback-2026-07-01"], fallbacks="default"
            )
        else:
            response = self._client.messages.create(**params)
        latency_ms = round((time.perf_counter() - started) * 1000)

        if response.stop_reason == "refusal":
            raise LlmError(f"거절됨: {getattr(response, 'stop_details', None)}")
        if response.stop_reason == "max_tokens":
            raise LlmError("출력이 상한에서 잘렸다")

        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise LlmError(f"JSON 이 아닌 답: {text[:200]!r}") from exc

        usage = response.usage
        return LlmResult(
            data=data,
            raw_text=text,
            model=response.model,
            input_tokens=(usage.input_tokens or 0)
            + (usage.cache_read_input_tokens or 0)
            + (usage.cache_creation_input_tokens or 0),
            cached_input_tokens=usage.cache_read_input_tokens or 0,
            # Claude 는 생각 토큰을 출력 토큰에 합쳐 센다 — 따로 나뉘지 않는다
            output_tokens=usage.output_tokens or 0,
            thought_tokens=0,
            latency_ms=latency_ms,
            stop_reason=response.stop_reason,
        )
