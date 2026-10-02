from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient

from app.common.core.exception import ApiException
from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app()

    @app.get("/__api-error")
    def api_error() -> None:
        raise ApiException(HTTPStatus.TOO_MANY_REQUESTS, "LIMIT_EXCEEDED", "오늘 질문을 다 썼어요")

    @app.get("/__crash")
    def crash() -> None:
        raise RuntimeError("boom")

    return TestClient(app, raise_server_exceptions=False)


def test_api_exception_uses_its_status_and_code(client: TestClient) -> None:
    res = client.get("/__api-error")
    assert res.status_code == 429
    assert res.json() == {"code": "LIMIT_EXCEEDED", "message": "오늘 질문을 다 썼어요"}


def test_unexpected_error_hides_details(client: TestClient) -> None:
    res = client.get("/__crash")
    assert res.status_code == 500
    assert res.json() == {"code": "INTERNAL_ERROR", "message": "서버에서 문제가 생겼어요"}


def test_unknown_path_uses_common_error_shape(client: TestClient) -> None:
    res = client.get("/nope")
    assert res.status_code == 404
    assert res.json()["code"] == "NOT_FOUND"


def test_wrong_method_keeps_allow_header(client: TestClient) -> None:
    res = client.get("/v1/ask")
    assert res.status_code == 405
    assert res.json()["code"] == "METHOD_NOT_ALLOWED"
    assert res.headers["allow"] == "POST"


@pytest.mark.parametrize("origin", ["http://localhost:8099", "http://127.0.0.1:8081"])
def test_cors_allows_localhost(client: TestClient, origin: str) -> None:
    res = client.options(
        "/v1/ask",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-device-key",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("origin", ["https://evil.example", "http://localhost.evil.example"])
def test_cors_rejects_other_origins(client: TestClient, origin: str) -> None:
    res = client.options(
        "/v1/ask", headers={"Origin": origin, "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in res.headers


def test_unexpected_error_keeps_cors_headers(client: TestClient) -> None:
    # 웹 미리보기에서 500 이 CORS 실패로 가려지지 않고 { code, message } 로 보여야 한다
    res = client.get("/__crash", headers={"Origin": "http://localhost:8099"})
    assert res.status_code == 500
    assert res.headers.get("access-control-allow-origin") == "http://localhost:8099"
