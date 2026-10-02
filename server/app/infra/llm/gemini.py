"""Gemini 어댑터 — google-genai SDK 의 Interactions API.

store=False 로 보내 대화를 Google 서버에 남기지 않는다. 무료 티어는 입력이 제품 개선에 쓰일 수
있으므로 실제 아기 데이터를 보내면 안 된다(backend 「모델은 갈아끼우는 부품이다」).
"""

import json
import time

from google import genai

from app.infra.llm.base import LlmError, LlmRequest, LlmResult


class GeminiClient:
    provider = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self._client = genai.Client(api_key=api_key)
        self.model = model

    def generate(self, req: LlmRequest) -> LlmResult:
        started = time.perf_counter()
        interaction = self._client.interactions.create(
            model=self.model,
            system_instruction=req.system,
            input=req.user,
            response_format={"type": "text", "mime_type": "application/json", "schema": req.schema},
            generation_config={"max_output_tokens": req.max_output_tokens},
            store=False,
        )
        latency_ms = round((time.perf_counter() - started) * 1000)

        text = interaction.output_text or ""
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise LlmError(f"JSON 이 아닌 답: {text[:200]!r}") from exc

        usage = interaction.usage
        return LlmResult(
            data=data,
            raw_text=text,
            model=getattr(interaction, "model", None) or self.model,
            input_tokens=(usage and usage.total_input_tokens) or 0,
            cached_input_tokens=(usage and usage.total_cached_tokens) or 0,
            output_tokens=(usage and usage.total_output_tokens) or 0,
            thought_tokens=(usage and usage.total_thought_tokens) or 0,
            latency_ms=latency_ms,
            stop_reason=getattr(interaction, "status", None),
        )
