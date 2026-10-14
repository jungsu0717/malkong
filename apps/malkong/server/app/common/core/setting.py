"""서버 설정값 — 전부 환경변수에서 읽는다 (접두어 MALKONG_).

모델은 갈아끼우는 부품이다(backend 「모델은 갈아끼우는 부품이다」): 모델 이름과 접속 정보를
코드에 적지 않고 여기서만 읽는다. 값이 비어 있어도 서버는 뜬다 — 모델 연결은 라우팅 task 몫.

로컬에서는 server/.env 도 읽는다(git·이미지·업로드에서 모두 빠진다). Cloud Run 에는 이 파일이 없고,
키는 Secret Manager 에서 환경변수로 들어온다.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MALKONG_", env_file=".env", extra="ignore")

    # 어느 회사 어댑터로 부를지(gemini | anthropic)와 그 모델 id
    llm_provider: str | None = None
    llm_model: str | None = None

    gemini_api_key: SecretStr | None = None
    # Claude 는 Vertex AI(같은 GCP 프로젝트)로 부르는 것이 기본이다 — 키 대신 계정 권한을 쓴다
    vertex_project: str | None = None
    vertex_region: str = "global"
    # Claude API 직결로 부를 때만 쓴다
    anthropic_api_key: SecretStr | None = None

    # 결제가 연결된 유료 티어인가. 꺼져 있으면(무료 티어 — 입력이 학습에 쓰일 수 있다)
    # 아기 기록을 모델에 보내지 않고 응답에 eco 를 단다(backend 일일 한도 절 · task common/004).
    # 유료 전환은 Julian 이 한다
    llm_paid_tier: bool = False

    # 한도와 하루 비용 천장(backend 「일일 한도」, decisions/019).
    # 실제 사용량을 보고 앱 업데이트 없이 바꾼다
    # 하루 정밀 답변 수
    daily_limit: int = 10
    # 보상형 광고 1편이 채우는 정밀 답변 수와 하루 편수
    reward_per_ad: int = 5
    reward_max_per_day: int = 2
    # 정밀 답변을 다 쓴 뒤 일반 기준 답의 하루 상한 — 사람은 닿지 않는 수로, 남용만 막는다
    eco_daily_limit: int = 20
    # 서버 전체의 하루 모델 비용 천장(원). 넘으면 그날은 모델 답을 멈춘다 — Gemini 월 지출 한도 ÷ 30
    daily_budget_krw: int = 330
    usd_to_krw: float = 1400
    # 모델 가격(백만 토큰당 달러) — 기본값은 Gemini 3.5 Flash-Lite(2026-10-02 가격표).
    # 모델을 바꾸면 함께 바꾼다
    llm_price_input_usd: float = 0.30
    llm_price_cached_usd: float = 0.03
    llm_price_output_usd: float = 2.50

    # 운영 데이터 저장소(Neon Postgres) 접속 주소.
    # 없으면 메모리 저장소로 돈다(인스턴스가 바뀌면 잊는다)
    database_url: SecretStr | None = None

    # 운영자(가족) 기기 키 — 쉼표로 구분. 한도 없음·광고 없음(backend 「운영자 기기」)
    operator_device_keys: SecretStr | None = None

    # 연결 출처(IP)당 하루 키 발급 상한 — 키를 새로 받아 한도를 피하는 것을 막는다
    devices_per_ip_per_day: int = 20

    # 모델 한 번 부를 때 기다리는 최대 시간(초). 넘으면 그 시도는 실패로 보고 한 번 더 해 본다
    llm_timeout_s: float = 20.0

    # 승인된 L1 사본이 있는 곳(scripts/sync_l1.py 가 만든다)
    l1_dir: Path = Path(__file__).resolve().parents[2] / "data" / "l1"

    @field_validator(
        "gemini_api_key", "anthropic_api_key", "database_url", "operator_device_keys", mode="before"
    )
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
