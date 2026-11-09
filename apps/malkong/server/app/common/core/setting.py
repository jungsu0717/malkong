"""서버 설정값 — 전부 환경변수에서 읽는다 (접두어 MALKONG_).

접속 주소와 키를 코드에 적지 않고 여기서만 읽는다. 값이 비어 있어도 서버는 뜬다(저장소는 메모리로,
문장 읽기는 503).

로컬에서는 server/.env 도 읽는다(git·이미지·업로드에서 모두 빠진다). Cloud Run 에는 이 파일이 없고,
비밀값은 Secret Manager 에서 환경변수로 들어온다.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MALKONG_", env_file=".env", extra="ignore")

    # 운영 데이터 저장소(Neon Postgres) 접속 주소.
    # 없으면 메모리 저장소로 돈다(인스턴스가 바뀌면 잊는다)
    database_url: SecretStr | None = None

    # 운영자(가족) 기기 키 — 쉼표로 구분. 광고 없음(backend 「운영자 기기」)
    operator_device_keys: SecretStr | None = None

    # 연결 출처(IP)당 하루 키 발급 상한 — 키를 마구 받아 가는 것을 막는다
    devices_per_ip_per_day: int = 20

    # 승인된 L1 사본이 있는 곳(scripts/sync_l1.py 가 만든다)
    l1_dir: Path = Path(__file__).resolve().parents[2] / "data" / "l1"

    # 문장 읽기(/v1/parse)에 쓰는 Gemini 키. 없으면 /v1/parse 가 503 을 주고 앱은 규칙으로 읽는다
    gemini_api_key: SecretStr | None = None
    # 문장 읽기 모델 — 새로 쓸 수 있는 Flash-Lite 가운데 가장 싼 정식판
    # (2026-11-09 Gemini 모델 · 가격 문서 기준)
    gemini_model: str = "gemini-3.1-flash-lite"
    # 모델 한 번 부를 때 기다리는 최대 시간(초). 넘으면 503 이고 앱은 규칙으로 읽는다
    model_timeout_s: float = 10.0
    # 기기마다 하루 문장 읽기 수 — 사람은 닿지 않는 수로, 남용만 막는다
    parse_per_device_per_day: int = 300

    @field_validator("database_url", "operator_device_keys", "gemini_api_key", mode="before")
    @classmethod
    def _strip_secret(cls, value: object) -> object:
        # 붙여 넣을 때 섞인 공백과 줄바꿈(\r 포함)을 지운다 — Neon 주소 앞에 \r 두 개가
        # 붙어 들어간 적이 있다(2026-10-06). 지우고 남는 것이 없으면 설정이 없는 것으로 본다
        if isinstance(value, str):
            return value.strip() or None
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
