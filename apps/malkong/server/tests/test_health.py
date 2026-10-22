from fastapi.testclient import TestClient

from app.common.core.setting import Settings
from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_removed_endpoints_are_gone() -> None:
    # 질문 답변 · 피드백 · 보상 광고는 2026-10-22 에 뺐다(task common/022)
    for path in ("/v1/ask", "/v1/feedback", "/v1/reward/ssv"):
        assert client.post(path, json={}).status_code in (404, 405)


def test_secrets_are_stripped_of_pasted_whitespace(monkeypatch) -> None:
    monkeypatch.setenv("MALKONG_DATABASE_URL", "\r\rpostgresql://u:p@host/db\n")
    monkeypatch.setenv("MALKONG_OPERATOR_DEVICE_KEYS", "  \r\n ")
    settings = Settings(_env_file=None)  # 로컬 server/.env 와 상관없이 환경변수만 본다
    assert settings.database_url.get_secret_value() == "postgresql://u:p@host/db"
    assert settings.operator_device_keys is None
