# 말콩 서버 이미지 — Cloud Run 이 PORT 환경변수(기본 8080)를 넣어 준다.
# 빌드는 Cloud Build 가 한다(gcloud run deploy --source). 명령은 AGENTS.md 「명령」.
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# 의존성 층을 먼저 만들어 코드만 바뀔 때는 이 층을 다시 쓴다
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev

COPY app ./app

RUN useradd --create-home --uid 10001 malkong
USER malkong

ENV PATH="/srv/.venv/bin:$PATH"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
