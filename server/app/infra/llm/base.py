"""모델 어댑터 계약 — 어느 회사 모델이든 이 모양으로 부르고 이 모양으로 받는다.

각 회사의 공식 SDK 를 이 계약 뒤에 숨긴다(decisions/007). 그래서 모델을 바꿀 때는 어댑터와 설정값만
바뀌고, 프롬프트와 채점, /v1/ask 는 그대로다.

FastAPI 에서는 def 라우트(스레드풀)에서 부른다 — 동기 호출이라 async def 안에서 부르면 안 된다.
"""

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class LlmRequest:
    system: str
    user: str
    # 답을 이 JSON 스키마로 강제한다
    schema: dict[str, Any]
    # 생각(thinking)에 쓰는 토큰까지 포함한 상한
    max_output_tokens: int = 8000


@dataclass(frozen=True)
class LlmResult:
    data: dict[str, Any]
    raw_text: str
    # 실제로 답한 모델 — 거절 뒤 대체 모델이 답했으면 요청한 모델과 다르다
    model: str
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    thought_tokens: int
    latency_ms: int
    stop_reason: str | None


class LlmError(Exception):
    """모델이 답하지 못했다 — 거절, 잘린 출력, 형식이 깨진 JSON."""


class LlmClient(Protocol):
    provider: str
    model: str

    def generate(self, req: LlmRequest) -> LlmResult: ...
