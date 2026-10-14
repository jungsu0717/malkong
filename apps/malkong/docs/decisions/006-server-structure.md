# 006 서버 코드는 회사 FastAPI 구조를 따르되, 사내 패키지와 응답 감싸기는 빼고

> 상태: 확정 (2026-10-02)

## 맥락

서버(`server/`)를 처음 만들 때 엔드포인트는 `/v1/ask` 하나였지만, api-contract 에는 이미 여섯 묶음
(ask, knowledge, entitlements, reward, feedback, cohort)이 정해져 있다. 파일이 적은 지금 구조를 정해 두지
않으면, 기능이 붙을 때마다 각자 다른 모양으로 늘어난다.

Julian 은 회사에서 FastAPI 프로젝트(neuro-ontology-manager-api)를 맡고 있어서, 그 구조를 따르면
두 곳을 오갈 때 익숙한 자리에서 코드를 찾을 수 있다.

## 결정

회사 프로젝트의 **폴더 구조와 계층 규칙**만 가져온다 — `app/domain/<기능>/` 아래 router, schema, service 를
두고, Router → Service → Repository 순서로만 부르고, 에러는 자체 예외와 공통 핸들러로 처리한다.
규칙의 정의는 [server/AGENTS.md](../../server/AGENTS.md)에 있다.

## 기각한 대안과 이유

- **회사 사내 공통 패키지(neuro-fastapi-common, neuro-auth-common)를 그대로 쓰기** — 회사 내부 PyPI 에서만
  받을 수 있어서 Cloud Build 가 설치하지 못한다. 개인 프로젝트에 회사 코드를 들이는 것도 맞지 않다.
  필요한 것(공통 에러 핸들러, 설정)은 몇십 줄이라 직접 쓴다
- **응답 감싸기 `BaseResponse { success, message, code, data }`** — api-contract 는 응답 최상위가
  `{ type, answer, ... }` 이고 에러가 `{ code, message }` 라서 정면으로 부딪친다. 계약을 바꿀 만한 이득도 없다.
  성공과 실패는 HTTP 상태 코드로 가른다
- **poetry, black, isort** — 이미 uv 와 ruff 로 정했다(task common/002). ruff 하나가 검사, 서식, import 정렬을
  다 한다
- **`internal/` 라우터 분리, dependency-injector** — 회사 쪽은 서버끼리 부르는 경로가 있어서 둔 것이다.
  말콩 서버를 부르는 쪽은 앱과 AdMob 보상 콜백뿐이라 내부용 경로를 따로 둘 일이 없고, 의존성 주입은
  FastAPI `Depends` 로 충분하다
- **구조를 정하지 않고 파일 몇 개로 두기** — 지금은 가장 가볍지만, 라우팅, 캐시, 한도가 들어오는
  common/004 에서 어차피 나눠야 한다. 그때 나누면 옮길 파일이 더 많다
