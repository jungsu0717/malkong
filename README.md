# 말콩 (malkong)

우리 아기 기준으로 답하는 AI 육아 비서. 궁금할 때 물어보면 월령과 우리 아기 기록에 맞춰
공공 의료·육아 지식의 출처와 함께 답하고, 아침마다 오늘 챙길 것을 먼저 알려준다.

## 지금 상태 (2026-10-02)

- **앱**: 4개 탭(홈·물어보기·성장·마이) 화면 뼈대. 온보딩(생일 → 월령), 홈 「챙길 것」과 완료 기록이 동작한다.
  물어보기 답변은 아직 예시 고정값이다 — 앱은 서버를 부르지 않는다
- **지식(L1)**: 승인된 73건 — 접종·검진(질병관리청·건보공단 일정)과 발달·수유·수면·생활·안전·위험 신호(미국 CDC).
  남은 일은 출처 1곳 라이선스 확인과 국내 출처 보강([common/001](docs/task/common/001-l1-knowledge-build.md))
- **서버**: Cloud Run 에서 `POST /v1/ask` 가 실제로 답한다 — 위험 신호 규칙 필터 → L1 검색 → Gemini 3.5 Flash-Lite →
  답 검사([common/004](docs/task/common/004-real-answer.md)). Gemini 키는 Secret Manager 에 있다.
  지금 키는 무료 티어라 아기 기록은 모델로 보내지 않는다
- 끝난 작업과 진척의 정본은 [docs/task/](docs/task/) 의 task 파일이다

## 다음 시작점

1. **`ask/002`** — 앱 물어보기 화면을 예시 고정값에서 실제 서버 호출로 바꾼다. 응답의 `level` 과 빈 `sources`
   ("공공 지식 근거 없음 · 일반 정보" 표시)를 화면에 반영한다
2. **`common/005`** — 디바이스 키 발급·일일 한도·Neon·같은 clientMessageId 재시도. Neon 계정은 Julian 이 만든다.
   디바이스 키 발급 API 는 [api-contract](docs/architecture/api-contract.md)에 먼저 적어야 한다
3. **답변 완성도** — 앱 화면이 다 된 뒤에 한다. 위험 신호 다듬기와 Julian 승인([common/004](docs/task/common/004-real-answer.md)
   「알려진 문제」). 그 전까지 Gemini 무료 할당량은 Julian 이 결과물을 판단하는 데 쓴다
4. **실사용 전** — Gemini 를 유료 티어로 바꾸고 지출 한도 예산을 건다(그때 `MALKONG_LLM_PAID_TIER=true`)

## 다른 PC 에서 시작하기

Claude Code 의 메모리는 PC 마다 따로라서, 이어받는 기준은 이 README 와 `docs/task/` 다.
명령어는 [AGENTS.md](AGENTS.md)(앱)와 [server/AGENTS.md](server/AGENTS.md)(서버)에 있다. 아래는 git 에 없어서
PC 마다 새로 준비해야 하는 것만 적는다.

- **git 계정**: 이 repo 는 개인 계정(jungsu0717)으로만 커밋한다. 회사 계정과 섞이지 않게 **repo 로컬 설정**으로
  `user.name=jungsu0717`, `user.email=6903839+jungsu0717@users.noreply.github.com` 을 둔다.
  인증도 repo 로컬 `credential.helper` 로 개인 계정 것을 쓰고, 전역 설정은 건드리지 않는다
- **앱**: Node 를 설치하고 `npm install`
- **서버**: uv 를 설치하고 `server/` 에서 `uv sync` (Python 3.13 은 uv 가 받는다)
- **Gemini 키**: git 에 없다. https://aistudio.google.com/apikey 의 「Default Gemini Project」(결제가 연결되지 않은
  프로젝트)에서 키를 만들거나 복사해 `server/.env` 에 `MALKONG_GEMINI_API_KEY=...` 한 줄로 둔다.
  `malkong` 프로젝트의 키는 선불 등급이 되어 402 로 막힌다
- **배포할 때만**: gcloud CLI 설치 → `gcloud auth login`(개인 구글 계정) → `gcloud config set project malkong`

## 핵심 개념

- **지식을 두 층으로 나눈다** — L1(공공 의료·육아 표준)과 L2(우리 아기 기록·요약).
- **대화가 곧 기록이다** — 따로 기록하게 하지 않고, 답하기 전에 필요한 것만 되묻고 그 답을 쌓는다.
- **표준과 기록의 차이가 추천이 된다** — L1 − L2 차집합이 홈의 "지금 챙길 것"이다.
- **위험한 순간엔 답을 만들지 않는다** — 규칙 필터가 먼저 걸러 병원·119 로 안내한다.

## 문서

설계가 정본이고 코드보다 먼저 읽는다. 진입점은 [docs/README.md](docs/README.md) — 문서 지도,
작성 규칙, SPEC ID 규칙, 작업 사이클이 거기 있다.

| 폴더 | 담는 것 |
|---|---|
| `docs/constitution.md` | 모든 SPEC 위에 있는 불변 원칙 |
| `docs/product/` | 제품 브리프 — 계기·컨셉·차별성·스토어 문구의 원천 |
| `docs/architecture/` | 전체 방향 · 지식층 · 서버/DB/LLM · L1 지식베이스 · API 계약 |
| `docs/menu-spec/` | 탭 4개의 SPEC(WHAT)과 구현 방법(HOW) |
| `docs/app-design/` | 디자인 시스템 · 기술 스택 · 코딩 스타일 |
| `docs/decisions/` | 결정 기록(ADR) — 대안을 기각한 이유 |
| `docs/task/` | SPEC 을 코드로 만드는 작업 단위 |

## 실행

```bash
npm install
npx expo start        # 실기기는 Expo Go, 웹 미리보기는 --web
npx tsc --noEmit      # 타입 검사
npx expo lint         # 린트
```

## 스택

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router · StyleSheet + 테마 토큰 ·
react-native-svg · expo-sqlite(기기 저장). 백엔드는 FastAPI(예정).
