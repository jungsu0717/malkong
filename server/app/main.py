"""육아버디(코드명 malkong) agent 서버 진입점.

구성과 정책의 정본은 docs/architecture/backend.md, API 형태는 docs/architecture/api-contract.md,
코드 구조와 규칙은 server/AGENTS.md.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.core.exception import register_exception_handlers
from app.domain.ask.router import router as ask_router
from app.domain.devices.router import router as devices_router
from app.domain.entitlements.router import router as entitlements_router
from app.domain.feedback.router import router as feedback_router
from app.domain.reward.router import router as reward_router


def create_app() -> FastAPI:
    app = FastAPI(title="malkong-server", version="0.1.0")

    # CORS 보다 먼저 등록한다 — 그래야 500 응답에도 CORS 헤더가 붙는다
    register_exception_handlers(app)

    # 웹 미리보기(localhost:8099, dev 서버 8081)에서 부를 수 있게 localhost 출처만 연다.
    # 기기 앱은 브라우저가 아니라서 CORS 와 상관이 없다.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Device-Key", "X-As-User"],
    )

    app.include_router(ask_router, prefix="/v1")
    app.include_router(devices_router, prefix="/v1")
    app.include_router(entitlements_router, prefix="/v1")
    app.include_router(feedback_router, prefix="/v1")
    app.include_router(reward_router, prefix="/v1")

    # /healthz 로 하지 않는다 — Cloud Run 은 z 로 끝나는 일부 경로를 예약해 두어
    # 그 요청이 앱까지 오지 않는다.
    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
