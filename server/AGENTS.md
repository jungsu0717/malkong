# 말콩 서버 — 코드 작업 규칙

이 폴더는 말콩 agent 서버(FastAPI)다. 서버가 무엇을 하고 무엇을 저장하는지는
[backend](../docs/architecture/backend.md) 서버 절이, API 모양은 [api-contract](../docs/architecture/api-contract.md)가
정본이다. 이 파일은 코드를 어떻게 쓰는지만 다룬다.

폴더 구조와 계층 규칙은 회사 FastAPI 프로젝트(neuro-ontology-manager-api)를 따른다. 무엇을 가져오고
무엇을 뺐는지는 [decisions/006](../docs/decisions/006-server-structure.md)에 있다.

## 명령 (`server/` 에서)

```bash
uv sync                                          # 의존성 설치 (가상환경은 server/.venv)
uv run uvicorn app.main:app --reload --port 8000 # 로컬 실행
uv add <패키지>                                   # 의존성 추가 (개발용은 uv add --dev)

# 게이트 — 작업을 끝냈다고 하기 전에 셋 다 통과시킨다
uv run ruff check .
uv run ruff format --check .                     # 고칠 때는 --check 를 빼고 돌린다
uv run pytest

# 실제 모델로 로컬 실행 — 모델은 환경변수로만 고른다(코드에 적지 않는다). 무료 티어 키면 아기 기록은 안 간다
MALKONG_LLM_PROVIDER=gemini MALKONG_LLM_MODEL=gemini-3.5-flash-lite uv run uvicorn app.main:app --port 8000

# L1 을 고친 뒤 — 서버 사본(app/data/l1/)을 원본(src/data/l1/)과 맞춘다. 어긋나면 tests/test_l1_copy.py 가 실패한다
uv run python -m scripts.sync_l1

# 모델 비교 (task common/003) — 실제 API 를 부르므로 돈이 든다. 모델 id 는 인자로 넘긴다
uv run python -m eval.run --model gemini:<id> [--model anthropic:<id> --vertex-project malkong]
uv run python -m eval.score eval/results/<날짜>
```

결과 폴더에는 그 판에 쓴 `system_prompt.txt` 를 함께 남긴다 — 프롬프트를 고치면 점수가 바뀌기 때문이다.

- Gemini 키는 `server/.env` 에 둔다(`MALKONG_GEMINI_API_KEY`). 이 파일은 git, Docker 빌드, gcloud 업로드에서
  모두 빠진다. 키 값을 출력하거나 로그·커밋에 남기지 않는다
- Claude 는 Vertex AI 로 부른다 — 키가 없고, 로컬은 `gcloud auth application-default login` 권한을 쓴다.
  Claude API 직결이 필요하면 `--claude-via api` 와 `MALKONG_ANTHROPIC_API_KEY`

## 배포 (Cloud Run)

배포 설정의 값(리전, 인스턴스 수, 인증 없는 호출)은 backend 「배포 설정」이 정한다. 값을 바꿀 때는
backend 를 먼저 고치고 아래 명령을 맞춘다. 이미지는 Cloud Build 가 `Dockerfile` 로 만들고,
업로드에서 뺄 것은 `.gcloudignore` 에 있다.

- GCP 프로젝트: `malkong` (번호 481623022922)
- 서비스 주소: https://malkong-server-481623022922.asia-northeast3.run.app (API 문서는 `/docs`)

```bash
# 처음 한 번 — 프로젝트를 고르고, 필요한 API 를 켜고, 빌드용 기본 서비스 계정에 빌드 권한을 준다
# (권한이 없으면 배포가 PERMISSION_DENIED 로 멈춘다)
gcloud config set project malkong
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com
gcloud projects add-iam-policy-binding malkong --condition=None \
  --member="serviceAccount:481623022922-compute@developer.gserviceaccount.com" --role="roles/run.builder"

# 처음 한 번 — Gemini 키를 Secret Manager 에 넣고(키 값은 화면에 나오지 않는다), 서버가 읽게 한다.
# 키 넣기는 Julian 이 직접 한다. 키를 바꿀 때는 create 대신 `gcloud secrets versions add` 로 같은 파이프를 쓴다
grep '^MALKONG_GEMINI_API_KEY=' .env | cut -d= -f2- | tr -d '\n' | \
  gcloud secrets create malkong-gemini-key --replication-policy=automatic --data-file=-
gcloud secrets add-iam-policy-binding malkong-gemini-key --condition=None \
  --member="serviceAccount:481623022922-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 배포 (server/ 에서) — 모델은 환경변수로, 키는 Secret Manager 에서
gcloud run deploy malkong-server --source . --region asia-northeast3 \
  --allow-unauthenticated --min-instances 0 --max-instances 2 \
  --set-env-vars MALKONG_LLM_PROVIDER=gemini,MALKONG_LLM_MODEL=gemini-3.5-flash-lite \
  --set-secrets MALKONG_GEMINI_API_KEY=malkong-gemini-key:latest

# Neon 과 운영자 기기를 넣은 뒤에는 --set-secrets 를 이렇게 늘린다(비밀값 이름은 task common/005)
#   --set-secrets MALKONG_GEMINI_API_KEY=malkong-gemini-key:latest,MALKONG_DATABASE_URL=malkong-database-url:latest,MALKONG_OPERATOR_DEVICE_KEYS=malkong-operator-keys:latest
```

- gcloud 는 Homebrew 로 깐다(`brew install --cask gcloud-cli` — 소스 컴파일 없이 Google 공식 파일을 받는다).
  로그인은 Julian 개인 구글 계정으로 `gcloud auth login`
- 배포 뒤 확인은 Gemini 무료 할당량을 아끼려고 `/health` · 위험 신호 질문 하나(모델을 부르지 않는다) ·
  사실 질문 하나만 한다

## 구조

```
app/
  main.py              create_app() — 미들웨어, 에러 핸들러, 라우터 등록. GET /health
  common/core/         여러 도메인이 함께 쓰는 것
    setting.py         환경변수 설정
    exception.py       ApiException 과 공통 에러 핸들러
    schema.py          ApiModel (camelCase 변환) 같은 공통 모형
  domain/<기능>/       api-contract 의 엔드포인트 묶음 하나가 폴더 하나
    router.py
    schema.py
    service.py
  domain/ask/prompt.py 말콩이 시스템 프롬프트(system_prompt.txt)와 모델 출력 JSON 모양
  domain/ask/redflag.py 위험 신호 문장 매칭 규칙 — 모델보다 먼저(SPEC-ASK-02)
  domain/ask/retrieval.py L1 검색 — 질문에 맞는 승인된 항목을 골라 모델에 건넨다
  domain/knowledge/repository.py 승인된 L1 만 읽는 저장소
  data/l1/             L1 사본 — scripts/sync_l1.py 가 만든다. 손으로 고치지 않는다
  domain/ask/cache.py  같은 clientMessageId 응답을 메모리에 10분 — 재시도 안전
  domain/entitlements/ 기기 키 확인·하루 한도(service.py) · GET /entitlements · 저장소 팩토리
  domain/devices/      POST /devices — 기기 키 발급
  infra/               바깥 시스템에 닿는 것
    llm/               모델 어댑터 — 각 회사 공식 SDK 를 base.py 계약 뒤에 둔다(decisions/007)
    db/usage_store.py  사용량 저장소 — Neon(Postgres)과 메모리 판. 주소가 없으면 메모리
scripts/               손으로 돌리는 도구(sync_l1). 서버 이미지에는 들어가지 않는다
tests/
eval/                  모델 비교 장치 — 질문 세트, 실행, 채점, 결과. 서버 이미지에는 들어가지 않는다
  redflag_phrases.json 위험 신호 검증 문장 표(task common/004). expect 는 잡을 k-warn id · "없음" ·
                       "아님:<id>"(그 id 는 나오면 안 됨) · "되도록:<id>". 실제 모델로 재면 무료 할당량을 쓴다
```

도메인 이름은 api-contract 경로의 첫 토막을 쓴다 — `ask`, `knowledge`, `entitlements`, `reward`,
`feedback`, `cohort`.

## 계층 규칙 — Router → Service → Repository

- router 는 요청을 받아 service 를 부르고 그 결과를 돌려주기만 한다. 판단과 계산은 service 가 한다
- service 는 router 가 `Depends` 로 받는다. 팩토리 `get_<도메인>_service()` 는 그 도메인의 `router.py` 에 둔다
- repository 는 저장소를 읽고 쓰는 일만 한다. repository 를 부르는 것은 service 뿐이다
- 버전 접두어 `/v1` 은 `main.py` 에서 붙인다. 도메인 router 에는 계약 경로에서 `/v1` 을 뺀 경로를 적는다
- 라우트마다 `response_model` 을 적는다. 에러 응답 모양은 `responses={422: {"model": ErrorBody}}` 처럼 알린다
- 요청과 응답 모형은 `domain/<기능>/schema.py` 에 두고 `ApiModel` 을 상속한다. 그러면 JSON 필드는
  계약대로 camelCase, 파이썬 이름은 snake_case 가 된다

## 에러

- 모든 에러는 `{ code, message }` 로 나간다. 형식이 틀린 요청, 없는 경로, 예상 못 한 오류도
  `common/core/exception.py` 의 핸들러가 같은 형식으로 바꾼다
- 우리 코드가 에러를 낼 때는 `ApiException(상태, code, message)` 를 던진다
- code 는 대문자 스네이크로 쓴다(`INVALID_REQUEST`). api-contract 에 적힌 code 가 있으면 그대로 쓴다

## 설정

- 설정값은 환경변수(접두어 `MALKONG_`)로만 받고, `common/core/setting.py` 한 곳에서 읽는다
- 모델 이름, 접속 주소, 키를 코드에 적지 않는다(backend 「모델은 갈아끼우는 부품이다」)

## 금지

- `HTTPException` 을 쓰지 않는다. 대신 `ApiException` 을 던진다
- router 에서 repository 나 DB 를 바로 부르지 않는다
- `async def` 안에서 막히는 호출(동기 DB, 동기 HTTP)을 하지 않는다. 그런 경로는 `def` 로 둔다
- 서버에 저장하거나 로그에 남겨도 되는 것은 backend 「서버가 저장하는 것」 절이 정한다.
  그 밖의 것, 특히 아기 데이터(질문 원문, 기록)는 저장하지도 로그에 남기지도 않는다
- 회사 사내 공통 패키지를 쓰지 않는다(decisions/006)

## 테스트

- 새 엔드포인트를 만들면 `tests/` 에 테스트를 하나 이상 둔다
- LLM 같은 바깥 호출은 `app.dependency_overrides` 로 가짜를 끼워 시험한다
