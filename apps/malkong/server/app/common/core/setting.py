"""서버 설정값 — 전부 환경변수에서 읽는다 (접두어 MALKONG_).

접속 주소와 키를 코드에 적지 않고 여기서만 읽는다. 값이 비어 있어도 서버는 뜬다(저장소는 메모리로).

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

    @field_validator("database_url", "operator_device_keys", mode="before")
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
