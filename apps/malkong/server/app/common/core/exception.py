"""에러는 모두 { code, message } 로 내보낸다 — api-contract 공통 에러 형식.

FastAPI 기본 형식({ detail })을 덮어쓴다. 우리 코드는 HTTPException 대신 ApiException 을 던지고,
여기 핸들러가 공통 형식으로 바꾼다. 없는 경로처럼 프레임워크가 내는 에러도 같은 형식으로 맞춘다.
"""

import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# uvicorn 이 이미 출력 설정을 해 둔 로거에 남긴다 — Cloud Run 에서는 그대로 Cloud Logging 으로 간다
logger = logging.getLogger("uvicorn.error")


class ErrorBody(BaseModel):
    code: str
    message: str


class ApiException(Exception):
    """code 는 대문자 스네이크. api-contract 에 적힌 code 가 있으면 그것을 그대로 쓴다.

    `extra` 는 계약이 그 오류에 더 싣기로 한 칸이다(예: 429 LIMIT_EXCEEDED 의 resetAt).
    """

    def __init__(
        self, status: HTTPStatus, code: str, message: str, extra: dict | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra or {}


def error_response(
    status: int, code: str, message: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=ErrorBody(code=code, message=message).model_dump(),
        headers=headers,
    )


async def on_api_error(_: Request, exc: ApiException) -> JSONResponse:
    if exc.extra:
        content = ErrorBody(code=exc.code, message=exc.message).model_dump() | exc.extra
        return JSONResponse(status_code=exc.status, content=content)
    return error_response(exc.status, exc.code, exc.message)


async def on_invalid_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    if any(err["type"] == "json_invalid" for err in errors):
        return error_response(422, "INVALID_REQUEST", "요청 본문이 올바른 JSON 이 아니에요")
    fields = sorted({".".join(str(p) for p in err["loc"][1:]) or "body" for err in errors})
    return error_response(
        422, "INVALID_REQUEST", f"요청 형식이 올바르지 않아요: {', '.join(fields)}"
    )


async def on_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    try:
        code = HTTPStatus(exc.status_code).name
    except ValueError:
        code = f"HTTP_{exc.status_code}"
    return error_response(exc.status_code, code, str(exc.detail), exc.headers)


class UnexpectedErrorMiddleware:
    """예상 못 한 오류를 500 { code, message } 로 바꾼다.

    `Exception` 핸들러로 등록하면 Starlette 가 그 응답을 모든 미들웨어 바깥에서 만들어 CORS 헤더가
    빠진다. 그러면 웹 미리보기에서는 본문 대신 CORS 실패로만 보인다.
    그래서 CORS 안쪽에 미들웨어로 둔다.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = False

        async def send_tracking(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, send_tracking)
        except Exception:
            logger.exception("처리하지 못한 오류")
            if started:
                raise
            response = error_response(500, "INTERNAL_ERROR", "서버에서 문제가 생겼어요")
            await response(scope, receive, send)


def register_exception_handlers(app: FastAPI) -> None:
    """CORS 미들웨어보다 먼저 불러야 한다 — 나중에 더한 미들웨어가 바깥을 감싼다."""
    app.add_exception_handler(ApiException, on_api_error)
    app.add_exception_handler(RequestValidationError, on_invalid_request)
    app.add_exception_handler(StarletteHTTPException, on_http_error)
    app.add_middleware(UnexpectedErrorMiddleware)
