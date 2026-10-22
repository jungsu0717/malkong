# 육아버디 서버(코드명 malkong) — 코드 작업 규칙

이 폴더는 육아버디 서버(FastAPI)다. 지금 하는 일은 기기 키, 가족 공유, 공공 지식(L1) 내려받기 셋이다. 서버가 무엇을 하고 무엇을 저장하는지는
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

# Postgres 저장소를 실제 Postgres 로 시험 — 저장소 SQL 을 고쳤으면 돌린다(평소 pytest 에서는 건너뛴다).
# 로컬 Postgres 는 pgserver 로 띄운다(설치 권한 불필요, Python 3.12 판만 있다). 운영 DB(Neon) 주소는 넣지 않는다
URI=$(uv run --no-project --python 3.12 --with pgserver python -c \
  "import pgserver; print(pgserver.get_server('/tmp/malkong-pg', cleanup_mode=None).get_uri())" | tail -1)
MALKONG_TEST_PG_URL="$URI" uv run pytest tests/test_pg_store.py
kill $(head -1 /tmp/malkong-pg/postmaster.pid)                # 끝나면 끈다

# L1 을 고친 뒤 — 서버 사본(app/data/l1/)을 원본(src/data/l1/)과 맞춘다. 어긋나면 tests/test_l1_copy.py 가 실패한다
uv run python -m scripts.sync_l1
```

- 로컬에서 쓰는 비밀값(Neon 주소 같은 것)은 `server/.env` 에 둔다. 이 파일은 git, Docker 빌드, gcloud 업로드에서
  모두 빠진다. 값을 출력하거나 로그·커밋에 남기지 않는다
- 질문 답변(`/v1/ask`) · 피드백 · 보상 광고와 모델 어댑터 · 모델 비교 도구(eval)는 2026-10-22 에 뺐다(task common/022).
  옛 코드는 git 기록에 있다

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

# 배포 (server/ 에서) — 비밀값은 Secret Manager 에서. --set-secrets 는 적은 것만 남기므로 예전 Gemini 키는 빠진다.
# --remove-env-vars 는 예전 모델 설정(MALKONG_LLM_*)을 지운다 — 2026-10-22 정리 뒤 첫 배포 한 번만 필요하다
gcloud run deploy malkong-server --source . --region asia-northeast3 \
  --allow-unauthenticated --min-instances 0 --max-instances 2 \
  --remove-env-vars MALKONG_LLM_PROVIDER,MALKONG_LLM_MODEL,MALKONG_LLM_PAID_TIER \
  --set-secrets MALKONG_DATABASE_URL=malkong-database-url:latest,MALKONG_OPERATOR_DEVICE_KEYS=malkong-operator-keys:latest

# 바꾼 판을 먼저 시험하려면 --no-traffic --tag <이름> 을 붙여 트래픽 없는 시험판으로 올리고, 확인한 뒤
# `gcloud run services update-traffic malkong-server --region asia-northeast3 --to-latest` 와 `--remove-tags <이름>` 으로 넘긴다.
# --no-traffic 을 한 번 쓰면 트래픽이 그 판에 고정되므로 --to-latest 로 풀어 줘야 다음 배포가 자동으로 넘어간다

# 서버는 2026-10-22 부터 AI 모델을 부르지 않는다(task common/022). Secret Manager 의 malkong-gemini-key 는 서버가 더 읽지 않으니
# 그대로 두어도 되고, Julian 이 나중에 지워도 된다

# 배포마다 서버 이미지가 Artifact Registry(cloud-run-source-deploy)에 남는다 — 무료 구간은 0.5GB(이미지 하나 약 75MB).
# 최근 2개만 남기고 7일 지난 것은 지우는 규칙을 한 번 걸어 둔다(규칙 파일 artifact-cleanup-policy.json). 지우는 일이라 Julian 이 직접 한다
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy --location asia-northeast3 --project malkong \
  --policy artifact-cleanup-policy.json --no-dry-run

# Neon(malkong-database-url)은 2026-10-06 부터, 가족 기기 키(malkong-operator-keys, 쉼표로 여러 개)는 2026-10-08 부터 붙어 있다(task common/005).
# 가족 기기를 더하거나 바꿀 때 Julian 이(키는 화면 · 셸 기록에 남기지 않는다):
#   read -rsp '기기 키(쉼표로 여러 개) 붙여넣고 Enter: ' KEY; printf '%s' "$KEY" | gcloud secrets versions add malkong-operator-keys --data-file=- --project malkong; unset KEY
```

- gcloud 는 Homebrew 로 깐다(`brew install --cask gcloud-cli` — 소스 컴파일 없이 Google 공식 파일을 받는다).
  로그인은 Julian 개인 구글 계정으로 `gcloud auth login`
- 배포 뒤 확인은 `/health` 와 `/v1/knowledge/version`(판 번호가 앱의 `src/data/l1/version.json` 과 같은지) 둘이면 된다

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
  domain/devices/      POST /devices — 기기 키 발급
  domain/entitlements/ 기기 키 확인 · 광고 여부(service.py) · GET /entitlements · 저장소 팩토리
  domain/family/       /family — 가족 만들기 · 참여 · 나가기 · 맞추기(아기 · 할 일 · 루틴 · 메모)
  domain/knowledge/    /knowledge/version · bundle — 승인된 L1 만 읽는 저장소(repository.py)
  data/l1/             L1 사본 — scripts/sync_l1.py 가 만든다. 손으로 고치지 않는다
  infra/db/            바깥 저장소 — Neon(Postgres)과 메모리 판. 주소가 없으면 메모리
    usage_store.py     기기 키 해시
    family_store.py    가족 · 가족 기록
scripts/               손으로 돌리는 도구(sync_l1). 서버 이미지에는 들어가지 않는다
tests/
```

도메인 이름은 api-contract 경로의 첫 토막을 쓴다 — `devices`, `entitlements`, `family`, `knowledge`.

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
- 접속 주소와 키를 코드에 적지 않는다

## 금지

- `HTTPException` 을 쓰지 않는다. 대신 `ApiException` 을 던진다
- router 에서 repository 나 DB 를 바로 부르지 않는다
- `async def` 안에서 막히는 호출(동기 DB, 동기 HTTP)을 하지 않는다. 그런 경로는 `def` 로 둔다
- 서버에 저장하거나 로그에 남겨도 되는 것은 backend 「서버가 저장하는 것」 절이 정한다.
  그 밖의 것, 특히 아기 데이터(질문 원문, 기록)는 저장하지도 로그에 남기지도 않는다
- 회사 사내 공통 패키지를 쓰지 않는다(decisions/006)

## 테스트

- 새 엔드포인트를 만들면 `tests/` 에 테스트를 하나 이상 둔다
- 저장소 같은 바깥 의존은 `app.dependency_overrides` 로 메모리 판이나 가짜를 끼워 시험한다
