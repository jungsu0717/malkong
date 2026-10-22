"""GET /privacy · /terms · /support — 처리방침 · 약관 · 자주 묻는 질문 페이지(task common/024).

스토어에 넣을 공개 주소다. 본문 정본은 앱의 src/data/legal.ts 이고, 페이지는
`node scripts/export-legal.mjs`(앱 폴더에서)가 app/data/legal/ 에 만든다. 손으로 고치지 않는다.
"""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["legal"])

LEGAL_DIR = Path(__file__).resolve().parents[2] / "data" / "legal"


def _page(name: str) -> HTMLResponse:
    return HTMLResponse((LEGAL_DIR / f"{name}.html").read_text(encoding="utf-8"))


@router.get("/privacy", summary="개인정보 처리방침", response_class=HTMLResponse)
def privacy() -> HTMLResponse:
    return _page("privacy")


@router.get("/terms", summary="이용약관", response_class=HTMLResponse)
def terms() -> HTMLResponse:
    return _page("terms")


@router.get(
    "/support", summary="자주 묻는 질문과 문의 — App Store 의 지원 URL", response_class=HTMLResponse
)
def support() -> HTMLResponse:
    return _page("faq")
