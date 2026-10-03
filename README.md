# 육아버디 (코드명 malkong)

우리 아기 기준으로 답하는 AI 육아 비서. 궁금할 때 물어보면 월령과 우리 아기 기록에 맞춰
공공 의료·육아 지식의 출처와 함께 답하고, 아침마다 오늘 챙길 것을 먼저 알려준다.

## 지금 상태 (2026-10-04)

- **앱**: 시안 B 「단정한 비서」([decisions/012](docs/decisions/012-chat-first-three-tabs.md)), 탭 넷([013](docs/decisions/013-four-tabs-knowledge.md)) —
  **버디**(첫 화면 · 아침 브리핑 요약 · 브리핑함 · 진짜 답 · 되묻기와 기록 · 위험 신호 · 피드백 · 하루 한도) ·
  **우리 아기**(3D 지식 지도 · 버디가 아는 정도와 단계 · 한눈에 보는 프로필 · 하루 기록 · 그 자리에서 알려 주기 · 함께 쌓아 온 것) ·
  **성장**(이번 달 챙길 것 · 발달 포인트 · 타임라인) · **마이**(알림 시각 · 기록 요청 알림과 카드 · 설정 · 광고 없이 쓰기 · 약관 초안).
  하루 기록이 사흘째 비면 적을 카드와 저녁 알림 한 번([decisions/016](docs/decisions/016-daily-log-out-of-briefing.md)).
  온보딩은 생일 → 브리핑 알림 시각. 광고(AdMob 배너·보상형), 캐릭터 버디 아이콘
- **Expo 계정** `@julian-malkong/malkong` 연결, 앱 식별자 `kr.malkong.app`. Julian 아이폰(Expo Go)으로 볼 수 있다
- **지식(L1)**: 승인된 73건 — 접종·검진(질병관리청·건보공단 일정)과 발달·수유·수면·생활·안전·위험 신호(미국 CDC)
- **서버**: `/v1/ask`(위험 신호 규칙 → L1 검색 → Gemini 3.5 Flash-Lite → 답 검사), 기기 키, 하루 한도, 재시도 안전,
  피드백, 보상형 광고 확인(SSV). Cloud Run 에 새 판(revision 00007, 2026-10-04 — **Gemini 유료**: 기록을 보내고 되묻는다 · 모델 회사가 거절하면 곧바로 503)이 올라가 있다 — 하루 한도는 아직
  메모리에 세어서 서버가 다시 시작되면 0 으로 돌아간다(Neon 을 붙이면 풀린다)
- 웹 화면 몰아 시험 통과(시안 B 포함, [common/008](docs/task/common/008-first-release-check.md)). 아이콘·광고·결제는 개발 빌드부터
- 끝난 작업과 진척의 정본은 [docs/task/](docs/task/) 의 task 파일이다

## 다음 시작점 (2026-10-03 저녁)

1. **Julian 이 아이폰(Expo Go)으로 며칠 써 본다** — 답 · 브리핑 · 지식 지도 · 디자인에서 걸리는 것을 모은다
2. ~~Gemini 유료 전환~~ — 2026-10-03 완료(Malkong 프로젝트 키, 월 한도 1만 원 — 처음엔 10원으로 잘못 넣어 10-04 에 모든 질문이 거절됐다). 이제 기록을 보내고 되묻는다
3. Claude 몫: 써 본 피드백 반영 → 답변 완성도 다듬기(위험 신호 — Julian 승인) → 스토어 등록 준비(스크린샷 · 소개 문구는
   [product-brief](docs/product/product-brief.md) · 개인정보 처리방침 웹 주소)
4. 출시 전 Julian 몫(계정·결제·법률): Apple 개발자($99) → 개발 빌드로 아이콘·광고·결제 확인 → Neon · AdMob · 스토어 계정 ·
   RevenueCat · 약관 정보 → 「육아버디」 상표 출원(변리사) · 주소(선택). 목록은
   [common/008](docs/task/common/008-first-release-check.md) · [common/011](docs/task/common/011-rename-yugabuddy.md)

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
