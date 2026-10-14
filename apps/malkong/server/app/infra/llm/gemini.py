"""Gemini 어댑터 — google-genai SDK 의 Interactions API.

store=False 로 보내 대화를 Google 서버에 남기지 않는다. 무료 티어는 입력이 제품 개선에 쓰일 수
있으므로 실제 아기 데이터를 보내면 안 된다(backend 「모델은 갈아끼우는 부품이다」).
"""

import json
import time

from google import genai
from google.genai import types

from app.infra.llm.base import UNAVAILABLE_STATUS, LlmError, LlmRequest, LlmResult, LlmUnavailable


class GeminiClient:
    provider = "gemini"

    def __init__(self, api_key: str, model: str, *, timeout_s: float | None = None) -> None:
        # SDK 기본은 시간 제한이 없다 — 서버에서는 꼭 건다(api-contract: 시간 초과면 503).
        # SDK 의 자체 재시도는 잠깐의 서버 장애(5xx)에만 한 번 — 기본값이면 요금 한도 초과(429)에도
        # 몇십 초를 되풀이해 앱이 답 없이 기다린다(2026-10-04). 재시도를 0 으로는 끌 수 없다
        # (SDK 가 0 을 1 로 바꾸고, Interactions 경로는 그 값을 재시도 횟수로 읽는다)
        http_options = types.HttpOptions(
            timeout=int(timeout_s * 1000) if timeout_s else None,
            retry_options=types.HttpRetryOptions(
                attempts=1, http_status_codes=[500, 502, 503, 504]
            ),
        )
        self._client = genai.Client(api_key=api_key, http_options=http_options)
        self.model = model

    def generate(self, req: LlmRequest) -> LlmResult:
        started = time.perf_counter()
        try:
            interaction = self._client.interactions.create(
                model=self.model,
                system_instruction=req.system,
                input=req.user,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": req.schema,
                },
                generation_config={"max_output_tokens": req.max_output_tokens},
                store=False,
            )
        except Exception as exc:
            # Interactions API 의 오류는 google.genai.errors 가 아닌 별도 계층이다 —
            # 상태 코드로 나눠 계약의 오류로 바꾼다. 메시지는 싣지 않는다(요청 내용이 섞일 수 있다)
            status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
            name = f"{type(exc).__name__} {status or ''}".strip()
            if status in UNAVAILABLE_STATUS:
                raise LlmUnavailable(name) from exc
            raise LlmError(name) from exc
        latency_ms = round((time.perf_counter() - started) * 1000)

        text = interaction.output_text or ""
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            # 메시지에 모델 출력을 넣지 않는다 — 로그로 새면 아기 데이터를 되풀이한 문장이 남는다
            raise LlmError(f"JSON 이 아닌 답 (길이 {len(text)})") from exc

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
