"""개인정보 처리방침 · 이용약관 웹 페이지(task common/024)."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_privacy_and_terms_pages() -> None:
    client = TestClient(create_app())
    for path, title in [("/privacy", "개인정보 처리방침"), ("/terms", "이용약관")]:
        res = client.get(path)
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/html")
        assert title in res.text
