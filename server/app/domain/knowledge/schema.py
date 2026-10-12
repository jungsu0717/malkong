"""L1 판 확인 · 묶음 응답 — docs/architecture/api-contract.md 「GET /v1/knowledge/*」."""

from typing import Any

from app.common.core.schema import ApiModel


class KnowledgeVersion(ApiModel):
    version: str


class KnowledgeBundle(ApiModel):
    version: str
    # 항목은 l1-knowledge-base 「항목 스키마」 그대로 — 앱 번들 파일과 같은 모양이라 그대로
    # 바꿔 끼운다. 그래서 camelCase 로 바꾸지 않는다(red_flag 그대로)
    items: list[dict[str, Any]]
