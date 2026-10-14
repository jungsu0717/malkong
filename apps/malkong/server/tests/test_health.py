from fastapi.testclient import TestClient

from app.common.core.setting import Settings
from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_llm_settings_come_from_env(monkeypatch) -> None:
    monkeypatch.setenv("MALKONG_LLM_MODEL", "some-model")
    monkeypatch.setenv("MALKONG_LLM_PROVIDER", "gemini")
    settings = Settings(_env_file=None)  # 로컬 server/.env 와 상관없이 환경변수만 본다
    assert settings.llm_model == "some-model"
    assert settings.llm_provider == "gemini"


def test_llm_settings_may_be_empty(monkeypatch) -> None:
    monkeypatch.delenv("MALKONG_LLM_MODEL", raising=False)
    monkeypatch.delenv("MALKONG_LLM_PROVIDER", raising=False)
    settings = Settings(_env_file=None)  # 로컬 server/.env 와 상관없이 환경변수만 본다
    assert settings.llm_model is None
    assert settings.llm_provider is None


def test_secrets_are_stripped_of_pasted_whitespace(monkeypatch) -> None:
    monkeypatch.setenv("MALKONG_DATABASE_URL", "\r\rpostgresql://u:p@host/db\n")
    monkeypatch.setenv("MALKONG_GEMINI_API_KEY", "  \r\n ")
    settings = Settings(_env_file=None)  # 로컬 server/.env 와 상관없이 환경변수만 본다
    assert settings.database_url.get_secret_value() == "postgresql://u:p@host/db"
    assert settings.gemini_api_key is None
