"""서버 설정값 — 전부 환경변수에서 읽는다 (접두어 MALKONG_).

모델은 갈아끼우는 부품이다(backend 「모델은 갈아끼우는 부품이다」): 모델 이름과 접속 주소를
코드에 적지 않고 여기서만 읽는다. 값이 비어 있어도 서버는 뜬다 — 모델 연결은 라우팅 task 몫.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MALKONG_")

    llm_model: str | None = None
    llm_base_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
