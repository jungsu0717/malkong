"""GET /v1/knowledge/version · /v1/knowledge/bundle — L1 판 확인과 묶음 내려받기.

/v1 은 main.py 가 붙인다.

기기 키가 없어도 된다 — 공공 지식이라 숨길 것이 없다(task common/019).
L1 저장소 팩토리도 여기 둔다.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends

from app.common.core.setting import get_settings
from app.domain.knowledge.repository import L1Repository
from app.domain.knowledge.schema import KnowledgeBundle, KnowledgeVersion

router = APIRouter(tags=["knowledge"])


@lru_cache
def get_l1_repository() -> L1Repository:
    return L1Repository(get_settings().l1_dir)


@router.get("/knowledge/version", summary="L1 판 확인", response_model=KnowledgeVersion)
def version(repo: Annotated[L1Repository, Depends(get_l1_repository)]) -> KnowledgeVersion:
    return KnowledgeVersion(version=repo.version)


@router.get(
    "/knowledge/bundle",
    summary="L1 묶음 — 승인된 항목 전부",
    response_model=KnowledgeBundle,
)
def bundle(repo: Annotated[L1Repository, Depends(get_l1_repository)]) -> KnowledgeBundle:
    return KnowledgeBundle(version=repo.version, items=repo.bundle())
