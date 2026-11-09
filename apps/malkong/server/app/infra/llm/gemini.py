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
        thinking_level: str = "minimal",
        max_output_tokens: int = 2000,
        transport: httpx2.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        # 문장 읽기(/v1/parse)는 문장을 나누기만 해서 가장 짧게(minimal) 생각한다.
        # 물어보기(/v1/agent)는 가리키는 기록을 찾고 하루 안에서 비교해야 해서
        # 한 단계 위(low)로 부른다
        self._thinking_level = thinking_level
        # 생각에 쓴 토큰도 이 수에 들어간다. 넘으면 답이 비어 오고(incomplete) unknown 이 된다
        self._max_output_tokens = max_output_tokens
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
            "generation_config": {
                "max_output_tokens": self._max_output_tokens,
                "thinking_level": self._thinking_level,
            },
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
