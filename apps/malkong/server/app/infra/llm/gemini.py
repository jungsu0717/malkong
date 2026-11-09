"""Gemini 어댑터 — Interactions API 를 REST 로 부른다(SDK 없이 httpx2 하나로).

요청 모양은 Gemini API 문서 「Structured output」의 REST 예시를 따른다(2026-11-09 확인):
POST /v1beta/interactions, 키는 x-goog-api-key 머리, JSON 모양은 response_format.schema.
store=false 로 보내 요청과 응답을 Google 쪽에 남기지 않는다.
키는 요청 머리로만 보내고 주소에는 넣지 않는다.
"""

from typing import Any

import httpx2

from app.infra.llm.base import ModelError

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"
# 문서의 REST 예시가 함께 보내는 판 — 응답 모양(steps)이 이 판 기준이다
API_REVISION = "2026-05-20"


class GeminiModel:
    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        timeout_s: float,
        transport: httpx2.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        self._client = httpx2.AsyncClient(
            timeout=timeout_s,
            transport=transport,
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
                "Api-Revision": API_REVISION,
            },
        )

    async def generate_json(self, system: str, user: str, schema: dict[str, Any]) -> str:
        body = {
            "model": self.model,
            "system_instruction": system,
            "input": user,
            "response_format": {"type": "text", "mime_type": "application/json", "schema": schema},
            # 문장을 나누는 일이라 길게 생각할 필요가 없다 — 가장 짧게 생각해 빨리 답하게 한다
            "generation_config": {"max_output_tokens": 2000, "thinking_level": "minimal"},
            "store": False,
        }
        try:
            res = await self._client.post(ENDPOINT, json=body)
        except httpx2.HTTPError as exc:
            # 예외 메시지에는 주소가 섞일 수 있어 종류만 남긴다
            raise ModelError(type(exc).__name__) from None
        if res.status_code != 200:
            raise ModelError(f"HTTP {res.status_code}")
        try:
            data = res.json()
        except ValueError:
            raise ModelError("응답이 JSON 이 아님") from None
        return output_text(data)


def output_text(interaction: Any) -> str:
    """응답의 model_output 단계에서 글만 이어 붙인다. 글이 없으면 빈 글 — 형식 검사에서 걸러진다."""
    if not isinstance(interaction, dict) or interaction.get("status") != "completed":
        return ""
    parts: list[str] = []
    for step in interaction.get("steps") or []:
        if not isinstance(step, dict) or step.get("type") != "model_output":
            continue
        for item in step.get("content") or []:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text") or ""))
    return "".join(parts)
