"""모델 어댑터 계약 — 문장 읽기(/v1/parse)가 이 모양으로 모델을 부른다.

어느 회사 모델이든 이 계약 뒤에 두면 서비스와 시험은 그대로다. 시험에서는 가짜 모델을 끼운다.
"""

from typing import Any, Protocol


class ModelError(Exception):
    """모델에 닿지 못했거나 모델 회사가 요청을 받지 않았다 — 네트워크, 시간 초과, 4xx · 5xx.

    메시지에는 예외 종류와 상태 코드만 싣는다. 보낸 문장과 모델 출력은 로그로 샐 수 있어서
    싣지 않는다.
    """


class JsonModel(Protocol):
    model: str

    async def generate_json(self, system: str, user: str, schema: dict[str, Any]) -> str:
        """답을 schema 모양의 JSON 글로 받는다. 형식 검사는 부르는 쪽이 한다."""
        ...
