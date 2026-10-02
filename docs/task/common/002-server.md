# 002 agent 서버 뼈대 — 목업 답변을 Cloud Run 까지 한 번 통과

> 상태: 완료 (2026-10-02)
> 근거: SPEC-ASK-01 의 바탕(답변은 반드시 서버를 거친다) — 정본: [backend](../../architecture/backend.md) 서버 절 · [api-contract](../../architecture/api-contract.md) `POST /v1/ask`
> 횡단(common): 물어보기 답변, 일일 한도, 또래 집계가 모두 이 서버 위에서 돌아간다

## 목표

FastAPI 서버를 만들어 `POST /v1/ask` 가 api-contract 모양의 목업 답변을 돌려주게 하고, 그 서버를
Cloud Run 에 배포해 인터넷에서 호출되는 것까지 확인한다.

모델 호출, 라우팅, 한도는 이 task 에 넣지 않는다. 미결이 하나도 걸려 있지 않은 부분만 먼저 배포까지
끝내 두면, 다음 task 들은 배포 걱정 없이 기능에만 집중할 수 있다.

## 기술 선택 (2026-10-02 확정)

| 자리 | 선택 | 이유 |
|---|---|---|
| 코드 위치 | 같은 repo 의 `server/` | 앱과 서버가 L1 JSON 한 벌과 `docs/` 하네스를 함께 쓴다. repo 를 나누면 L1 판이 두 곳에서 따로 놀게 된다 |
| 언어와 패키지 관리 | Python 3.13 + uv | uv 는 WSL 에 이미 설치돼 있다. 3.13 은 LLM SDK 같은 의존성 호환을 넉넉히 보려고 최신 바로 아래 판으로 고른다 |
| 웹 프레임워크 | FastAPI + Pydantic v2 | backend 문서의 결정 그대로. 요청과 응답 모형을 Pydantic 으로 적으면 api-contract 와 한 줄씩 맞춰 볼 수 있다 |
| 코드 구조와 컨벤션 | 회사 FastAPI 프로젝트(neuro-ontology-manager-api)의 폴더 구조와 계층 규칙을 따른다. 규칙은 `server/AGENTS.md` 에 적는다 | 기능별 폴더(`app/domain/<기능>/`)와 Router → Service → Repository 순서를 지금 정해 두면, api-contract 의 엔드포인트 여섯 묶음이 같은 모양으로 늘어난다. 사내 공통 패키지와 응답 감싸기(`BaseResponse`)는 가져오지 않는다 — 이유는 decisions/006 |
| 설정값 | pydantic-settings (환경변수) | 모델 이름과 접속 주소를 코드가 아니라 설정값으로 둔다 — backend 「모델은 갈아끼우는 부품이다」 |
| 서버 품질 게이트 | ruff(검사와 서식) + pytest | 앱 쪽의 tsc + lint 에 해당하는 서버 몫 |
| 배포 | Dockerfile + `gcloud run deploy --source` | 이미지는 Cloud Build 가 만든다. 로컬 Docker 를 띄울 필요가 없다 |
| 리전 | asia-northeast3 (서울) | 사용자가 한국에 있어서 왕복 지연이 가장 짧다 |

## 손댈 파일

```
server/
  AGENTS.md             서버 구조, 계층 규칙, 금지 사항, 실행과 게이트 명령
  CLAUDE.md             @AGENTS.md 한 줄 (서버 파일을 다룰 때 에이전트가 함께 읽는다)
  pyproject.toml        의존성, ruff, pytest 설정 (uv)
  uv.lock
  Dockerfile            python:3.13-slim + uv, PORT 환경변수로 뜬다
  .dockerignore
  .gcloudignore         gcloud run deploy --source 가 올리지 않을 것 (.venv 등)
  app/
    main.py             create_app() — 라우터 등록, CORS, 에러 핸들러 연결, GET /health
    common/core/
      setting.py        환경변수 설정
      exception.py      ApiException + 공통 에러 핸들러 ({ code, message })
      schema.py         ApiModel — JSON 은 camelCase, 파이썬은 snake_case 로 바꿔 주는 공통 바탕
    domain/ask/
      router.py         POST /v1/ask — 요청을 받아 service 를 부르기만 한다
      schema.py         요청과 응답 모형 (answer, followup, redflag 세 type)
      service.py        목업 답변 — common/004 에서 라우팅이 들어갈 자리
  tests/
    test_health.py      상태 확인, 설정값을 환경변수에서 읽는지
    test_ask.py         응답 모양, 출처, 잘못된 요청, 다른 type 의 직렬화
    test_common.py      공통 에러 형식, CORS
docs/decisions/006-server-structure.md   회사 구조를 따르되 사내 패키지와 응답 감싸기는 뺀 이유
.gitignore              파이썬 캐시 폴더 추가
```

가상환경은 uv 기본 위치(`server/.venv`)에 두고 git 에는 올리지 않는다. 가상환경이 있어도 웹 내보내기
(Metro 번들)가 10초 안팎으로 끝나는 것을 확인했다.

## Julian 이 해야 할 일 (한 번만)

1. 개인 구글 계정으로 GCP 프로젝트를 만들고 결제 계정을 연결한다. Cloud Run 은 무료 한도 안에서
   쓰더라도 결제 계정이 연결돼 있어야 켜진다. 프로젝트 ID 를 알려주면 된다
2. 예산 알림을 낮은 금액으로 걸어 둔다(제안: 월 1만 원). 알림만 보내고 자동으로 멈추지는 않는다
3. 제가 WSL 에 gcloud 를 설치하면 `! gcloud auth login` 으로 로그인한다

## 단계

1. ~~**서버 뼈대** — `server/` 에 uv 프로젝트, FastAPI 앱, 설정값, 상태 확인용 `GET /health`~~ —
   **완료(2026-10-02).** Python 3.13, FastAPI 0.142. 설정값은 `MALKONG_LLM_MODEL`·`MALKONG_LLM_BASE_URL`
   환경변수로 읽고, 비어 있어도 서버가 뜬다. 로컬에서 띄워 `/health` 가 200 을 돌려주는 것을 확인했다.
   경로를 `/healthz` 로 하지 않은 이유는 Cloud Run 이 z 로 끝나는 일부 경로를 예약해 두어서
   그 요청이 우리 앱까지 오지 않기 때문이다([Cloud Run known issues](https://cloud.google.com/run/docs/known-issues))
2. ~~**`/v1/ask` 목업** — api-contract 의 요청과 응답을 Pydantic 모형으로 그대로 옮긴다~~ —
   **완료(2026-10-02).** 세 type(answer, followup, redflag)의 모형을 모두 정의했고, JSON 필드는 계약대로
   camelCase 다. 목업은 질문과 상관없이 `type=answer` 고정 답변을 돌려준다. 답 문장은 승인된 접종 항목
   `k-vacc-0401`(DTaP 2차)의 내용만 옮겼고 출처도 그 항목의 것이다. 남은 횟수는 9로 고정했다.
   answer 모형은 sources 가 비어 있으면 만들어지지 않게 막아 두었다.
   - 에러는 모두 `{ code, message }` 로 나간다 — 형식이 틀린 요청은 422 `INVALID_REQUEST`(어느 필드가
     틀렸는지 message 에 적는다), 없는 경로와 메서드는 `NOT_FOUND`·`METHOD_NOT_ALLOWED`, 예상 못 한 오류는
     500 `INTERNAL_ERROR`
   - `X-Device-Key` 헤더는 받기만 하고 검사하지 않는다
   - CORS 는 `localhost`·`127.0.0.1` 출처(포트 무관)만 연다. 다른 출처의 사전 요청은 400 으로 거절된다
   - 로컬에서 띄워 정상 요청, eco 요청, 필드 누락, 깨진 JSON, 없는 경로, CORS 허용과 거절을 curl 로 확인했다
3. ~~**구조 맞추기** — 2단계까지 만든 파일을 위 「손댈 파일」의 모양으로 옮긴다~~ — **완료(2026-10-02).**
   규칙은 [server/AGENTS.md](../../../server/AGENTS.md), 이유와 기각한 것은
   [decisions/006](../../decisions/006-server-structure.md)에 적었다.
   - 목업 답변은 `AskService` 로 옮겼고, router 는 `Depends(get_ask_service)` 로 받은 service 를 부르기만 한다
   - `/v1` 접두어는 `main.py` 의 `create_app()` 이 라우터를 등록할 때 붙인다
   - 여러 도메인이 함께 쓰는 camelCase 바탕(`ApiModel`)은 `common/core/schema.py` 로 뺐다.
     처음 목록에 없던 파일이라 「손댈 파일」에 더했다
   - Repository 층은 만들지 않았다. 저장할 곳(Neon)이 생기는 common/004 에서 만든다
   - 옮긴 뒤 2단계의 curl 확인을 모두 다시 돌려 응답과 상태 코드가 그대로인 것을 확인했다.
     `ApiException` 을 던지면 그 상태 코드와 `{ code, message }` 로 나가는 것도 확인했다
4. ~~**테스트와 게이트** — pytest 로 응답 모양, 출처, 잘못된 요청의 에러 형식을 확인한다~~ — **완료(2026-10-02).**
   테스트 26건. `test_ask.py` 는 응답 모양, 출처가 비어 있지 않은지(빈 출처로는 answer 모형이 만들어지지
   않는 것까지), 잘못된 요청 다섯 가지와 깨진 JSON 의 에러 형식, service 가 followup 과 redflag 를 돌려줄 때도
   계약 모양(camelCase)으로 나가는지를 본다. `test_common.py` 는 `ApiException`, 500, 404, 405 의 에러 형식과
   CORS 허용과 거절을 본다. ruff 검사, 서식 확인, pytest 와 앱의 tsc, lint 가 모두 통과한다.
   - 리뷰(code-review low)에서 지적이 하나 나왔다. 예상 못 한 오류의 500 응답에 CORS 헤더가 빠져서,
     웹 미리보기에서는 본문 대신 CORS 실패로만 보인다는 것이다. 테스트로 재현한 뒤, 500 처리를
     `Exception` 핸들러에서 CORS 안쪽의 미들웨어(`UnexpectedErrorMiddleware`)로 옮겨 고쳤다.
     이 경우를 확인하는 테스트도 더했다
5. ~~**배포** — gcloud 를 WSL 사용자 홈에 설치하고(sudo 없이), Run·Cloud Build·Artifact Registry API 를 켠 뒤
   서울 리전에 배포한다~~ — **완료(2026-10-02).** 배포 설정은 아래와 같이 둔다.
   - 진척(2026-10-02): `Dockerfile`, `.dockerignore`, `.gcloudignore` 를 만들었다. WSL 에서는 Docker 를 쓸 수
     없어서, 이미지 안에서 할 일(개발 의존성 없이 설치하고 `PORT` 로 띄우기)을 로컬에서 같은 명령으로 흉내 내
     `/health` 와 `/v1/ask` 가 200 을 돌려주는 것을 확인했다. gcloud 587.0.0 을 `~/google-cloud-sdk` 에 설치하고
     `~/.local/bin/gcloud` 로 연결했다
   - **배포 완료(2026-10-02).** 프로젝트 `malkong`, 서비스 `malkong-server`, 주소는
     https://malkong-server-481623022922.asia-northeast3.run.app. 배포하면서 두 가지를 처리했다.
     결제 계정은 만들어져 있었지만 프로젝트에 연결되지 않은 상태라서 연결했다. 그리고 새 프로젝트에서는
     빌드용 기본 서비스 계정에 권한이 없어 배포가 `PERMISSION_DENIED` 로 멈춰서, 공식 문서가 정한
     Cloud Run Builder(`roles/run.builder`) 역할 하나만 주었다. 이 절차는 `server/AGENTS.md` 「배포」에 적었다
   - 배포된 설정: 최대 인스턴스 2, 최소 인스턴스는 값이 없어 기본값 0, `allUsers` 에 호출 권한, CPU 1개, 메모리 512Mi
   - 인터넷에서 확인: `/health` 200, `POST /v1/ask` 200 과 목업 답변, 잘못된 요청 422 `INVALID_REQUEST`,
     없는 경로 404 `NOT_FOUND`. 브라우저로 `/docs` 를 열어 `POST /v1/ask` 를 실행한 화면(200, 422)을 캡처했다
   - **0으로 내려가는 것과 콜드 스타트(1회 측정)**: 마지막 요청(04:42:32 UTC) 15분 뒤인 04:57:35 에 인스턴스가
     꺼졌다(uvicorn 종료 로그). 꺼진 뒤 첫 `/health` 는 **2.3초**, 바로 다음 요청은 0.08초, 이어진 `/v1/ask` 는
     0.08초였다. 첫 요청 때 새 인스턴스가 처음부터 뜬 것도 로그로 확인했다.
     2.3초는 물어보기 처리 현황 문구(SPEC-ASK-05)로 덮을 수 있는 길이라서 최소 인스턴스를 1로 올릴 이유는
     없다. 모델 호출이 붙으면 전체 대기 시간은 모델 쪽이 좌우한다
   - 최소 인스턴스 0 — 요청이 없으면 0원에 수렴해야 한다(backend 서버 절)
   - 최대 인스턴스 2 (제안) — 비용이 갑자기 불어나는 것을 막는 상한
   - 인증 없는 호출 허용 — 앱이 로그인 없이 부르기 때문이다. 남용은 한도 task 의 디바이스 키와
     일일 한도가 막는다. 지금의 목업은 LLM 을 부르지 않아서 비용이 생길 일이 없다
   - 배포 후 인스턴스가 0으로 내려간 상태에서 첫 요청이 얼마나 걸리는지(콜드 스타트) 재서 이 파일에
     적는다. 처리 현황 대기 문구로 그 시간을 덮을 수 있는지 판단하는 근거가 된다
6. ~~**문서 갱신** — backend 서버 절에 코드 위치와 배포 설정을 정의로 적는다~~ — **완료(2026-10-02).**
   backend 서버 절에 코드 위치와 「배포 설정」 표(리전, 최소·최대 인스턴스, 인증 없는 호출, 상태 확인 경로)를
   적었고, 로컬 실행과 배포 명령은 `server/AGENTS.md` 에만 두었다. constitution 원칙 8 에 서버 게이트를 더했다.
   두 문서 모두 changelog 에 한 줄씩 적었다. 배포 뒤 재는 콜드 스타트는 이 task 파일에 적는다

## 완료 조건

- [x] (backend 서버 절) 서울 리전 Cloud Run 에 배포되어, 인터넷에서 `POST /v1/ask` 가 목업 답변을 돌려준다
- [x] (backend 서버 절) 최소 인스턴스가 0이고, 요청이 없을 때 인스턴스가 0으로 내려간 것을 확인했다
- [x] (backend 모델 부품) 모델 이름과 접속 주소를 환경변수로 읽는 자리가 있다. 코드에 모델 이름을 적지 않는다
- [x] (api-contract) `type=answer` 응답의 sources 가 비어 있지 않다
- [x] (api-contract) 잘못된 요청의 에러가 `{ code, message }` 형식이다
- [x] 콜드 스타트 시간을 재서 이 파일에 적었다
- [x] 서버 코드가 `server/AGENTS.md` 의 구조와 계층 규칙을 따르고, 그 선택의 이유가 decisions/006 에 있다
- [x] 서버: ruff · pytest 통과 / 앱: `.gitignore` 변경 뒤 tsc · lint 통과

## 이 task 다음

- `common/003` 모델 비교 — 같은 질문 20~30개를 두 급의 모델에 돌려 보고 하나로 고정한다(backend 미결)
- `common/004` 라우팅과 한도 — 위험 신호 규칙 필터, 캐시, 모델 호출, L1 검색, 일일 한도, entitlements,
  Neon 연결(이때 Repository 층을 만든다), 같은 clientMessageId 재시도 처리, Secret Manager.
  모델을 붙일 때 그 서비스(Gemini API)에 **지출 한도 예산**을 따로 하나 건다 — 지금 예산은 알림만 보내고,
  지출 한도는 서비스 하나씩만 걸 수 있는 프리뷰 기능이다([spend cap](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)).
  시작 전에 api-contract 에 **디바이스 키 발급 API 를 먼저 적어야 한다** — 지금 문서에는 "설치 시
  서버가 발급한다"는 말만 있고 발급 API 가 없다. 서버가 `src/data/l1/` 을 읽으려면 배포 빌드 범위를
  repo 루트로 넓혀야 하는 것도 이 task 에서 함께 정한다
- `ask/002` 물어보기 화면을 예시 고정값에서 실제 서버 호출로 바꾼다(TanStack Query 도입)
