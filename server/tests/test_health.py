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
    monkeypatch.setenv("MALKONG_LLM_BASE_URL", "https://example.invalid/v1")
    settings = Settings()
    assert settings.llm_model == "some-model"
    assert settings.llm_base_url == "https://example.invalid/v1"


def test_llm_settings_may_be_empty(monkeypatch) -> None:
    monkeypatch.delenv("MALKONG_LLM_MODEL", raising=False)
    monkeypatch.delenv("MALKONG_LLM_BASE_URL", raising=False)
    settings = Settings()
    assert settings.llm_model is None
    assert settings.llm_base_url is None
