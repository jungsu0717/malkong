# 육아버디 (코드명 malkong)

우리 아기 기준으로 답하는 AI 육아 비서. 궁금할 때 물어보면 월령과 우리 아기 기록에 맞춰
공공 의료·육아 지식의 출처와 함께 답하고, 아침마다 오늘 챙길 것을 먼저 알려준다.

## 지금 상태 (2026-10-08)

- **앱**: 시안 B 「단정한 비서」([decisions/012](docs/decisions/012-chat-first-three-tabs.md)), 탭 넷 —
  **버디**(첫 화면 · 데일리 브리핑(아기 안부 · 부모 안부 · 오늘 챙길 것) · 알림함 · 진짜 답 · 질문마다 다른 처리 현황 · 되묻기와 기록 · 버디의 짐작(맞아요 · 아니에요) · 위험 신호 · 피드백 · 하루 한도 · 최근 50줄부터) ·
  **우리 아기**(3D 지식 지도 — 누르면 「버디가 아는 것」 상세 · 주제별 가로 막대 · 함께한 시간 한 줄, [baby/004](docs/task/baby/004-overview-and-depth.md)) ·
  **일정**(달력 · 고른 날의 브리핑과 그날 나눈 대화 줄 · 챙길 것 여정 그래픽 · 주간 · 월간 브리핑, [decisions/017](docs/decisions/017-schedule-tab-and-inbox.md)) ·
  **마이**(알림 시각 · 기록 요청 알림과 카드 · 설정 · 광고 없이 쓰기 · 약관 초안).
  하루 기록이 사흘째 비면 적을 카드와 저녁 알림 한 번([decisions/016](docs/decisions/016-daily-log-out-of-briefing.md)).
  브리핑은 기기 안 규칙과 문구 틀로 만든다([decisions/018](docs/decisions/018-daily-care-briefing.md)). 부모 돌봄 L1 넷 승인(2026-10-04).
  온보딩은 처음 실행 만화 5컷([my/006](docs/task/my/006-intro-toon.md) — 건너뛰거나 끝까지 볼 때까지는 생일이 있는 사람에게도 뜬다) → 생일 → 브리핑 알림 시각. 광고(AdMob 배너·보상형), 캐릭터 버디 아이콘
- **Expo 계정** `@julian-malkong/malkong` 연결, 앱 식별자 `kr.malkong.app`. Julian 아이폰(Expo Go)으로 볼 수 있다
- **지식(L1)**: 승인된 77건 — 접종·검진(질병관리청·건보공단 일정)과 발달·수유·수면·생활·안전·위험 신호·부모 돌봄(미국 CDC)
- **서버**: `/v1/ask`(위험 신호 규칙 → L1 검색 → Gemini 3.5 Flash-Lite → 답 검사), 기기 키, 재시도 안전, 피드백,
  보상형 광고 확인(SSV), 하루 한도 정책 v2 — 정밀 답변 10회 · 광고 1편에 5회(하루 2편) · 그 뒤 일반 기준 답 20회 ·
  서버 전체 하루 모델 비용 천장 330원([decisions/019](docs/decisions/019-generous-limits-hard-daily-budget.md)).
  Cloud Run 에 revision 00012(2026-10-08 — **Gemini 유료** · **Neon(싱가포르)에 기기 키 · 사용량 · 하루 비용 저장** · 부모 돌봄 L1 ·
  **Julian 폰이 가족 기기로 등록**되어 「일반 사용자로 보기」 숨은 스위치가 있다([common/015](docs/task/common/015-operator-user-view.md)) ·
  위험 신호 규칙 오탐 수정(「아기 주변에서 담배 피우면」이 피 섞인 변으로 잡히던 것)과 수면 검색 낱말 보강([common/016](docs/task/common/016-l1-reach.md)) ·
  근거 없이 답한 질문을 주제 × 월령 띠로 세는 로그([common/017](docs/task/common/017-ungrounded-count.md)) ·
  **답의 모양** 결론 → 왜(이 월령에 흔한 일인지) → 지금 할 것 → 진료 기준, 우리 아기 기록을 앞머리에([ask/010](docs/task/ask/010-answer-shape.md)))가
  올라가 있다. 배포 안 된 서버 변경은 없다. 자동 모드가 운영 배포를 막을 때는 Julian 이 server/AGENTS.md 「배포」 명령을 직접 친다(00012 가 그랬다)
- 웹 화면 몰아 시험 통과(시안 B 포함, [common/008](docs/task/common/008-first-release-check.md)). 아이콘·광고·결제는 개발 빌드부터
- **홍보 자료(보관 — 배포 때 · 앱 첫 실행에 쓴다)**: 만화 「아빠가 육아 앱을 만든 이유」 5컷 · 릴스 30초(`marketing/toon/`, 앱 첫 실행에도 들어가 있다),
  스토어 첫 장 「검색 대신, 근거로 답해요」 — 지식층 · 답 파이프라인 흐름도 + 진짜 앱 화면(`marketing/store/`, 앱스토어 · 구글 플레이 두 크기).
  정본 · 규칙은 [store-toon](docs/product/store-toon.md)
- **설계 문서와 코드를 맞췄다(2026-10-05)**: 질문 처리 단계(위험 신호 규칙 → 재시도 캐시 → 모델 → 답 검사)의 된 것 · 아직인 것 ·
  모델 호출 횟수 · 모델을 부르지 않는 기기 안 화면은 [backend](docs/architecture/backend.md) 「LLM 파이프라인」, L2 가 쌓이는 길은
  [knowledge-layers](docs/architecture/knowledge-layers.md) 「채워지는 경로」
- **온톨로지 세미나 뒤 정리(2026-10-08)**: 지식층은 규칙으로 판단하는 작은 루프로 둔다 — 그래프 · 벡터 DB · 온톨로지 스택 · 대화방 나누기 ·
  온디바이스 모델은 넣지 않는다([decisions/020](docs/decisions/020-rule-based-judgment-loop.md)). 어휘 대응표(분류 아홉 ↔ 영역 여섯,
  [knowledge-layers](docs/architecture/knowledge-layers.md) 「어휘」) · 승인된 지식은 모두 어느 질문에는 닿아야 한다는 시험(평가 질문 30 → 56개,
  [common/016](docs/task/common/016-l1-reach.md)) · 근거 없음 로그([common/017](docs/task/common/017-ungrounded-count.md)) ·
  버디의 짐작은 확인 뒤 기록([ask/008](docs/task/ask/008-confirm-guess.md)) · 대화는 최근 50줄부터, 날짜에서 그날 대화로([ask/009](docs/task/ask/009-recent-window-and-day-jump.md))
- 끝난 작업과 진척의 정본은 [docs/task/](docs/task/) 의 task 파일이다

## 다음 시작점 (2026-10-08)

1. **폰이 가족 기기로 보이는지 확인**(Julian) — 등록 · 배포는 끝났다([common/005](docs/task/common/005-device-key-and-limit.md)).
   앱을 다시 열고 마이 탭 맨 아래 「육아버디 v1.0.0」을 1초 꾹 → 「일반 사용자로 보기」 스위치가 보여야 한다. 그 스위치로
   일반 사용자 화면(남은 횟수 · 광고 자리 · 한도 말풍선)을 오가며 본다. 안 보이면 비밀값에 빈 값이 들어간 것 — 005 「출시 전에 Julian 이 할 것」 마지막 칸
2. **Julian 이 아이폰(Expo Go)으로 며칠 써 본다** — 답 · 안부 브리핑 · 일정 탭 · 알림함 · 지식 지도 · 디자인에서 걸리는 것을 모은다.
   맥에서 `REACT_NATIVE_PACKAGER_HOSTNAME=<맥 IP> npx expo start --go` 로 켠다(아래 「실행」 — `--go` 를 빼면 Expo Go 가 못 연다).
   웹으로는 못 본 것: 처음 실행 만화를 손가락으로 넘기기(아직 닫지 않았으니 다음에 열면 뜬다) · 기록이 사흘 비었을 때 저녁 8시 알림과
   그 알림을 누르면 뜨는 카드 · 일정 탭 여정 그래픽의 움직임과 가로 넘기기 · 시트를 열었을 때 키보드.
   안부 문구(`src/data/care-signals.ts`) 검토는 나중에(Julian). 하루 천장에 닿으면 메일로 알리는 설정은 Julian 이 받을 메일 주소를 정하면 건다
3. **로그인은 가족 공유를 만들 때**(Julian 결정, 2026-10-06) — 앱은 로그인 없이 쓰고, 가족 공유를 켜는 순간에만 로그인.
   소셜 로그인을 쓰면 애플 규정 4.8 로 Apple 로그인이 필수라 조합은 Apple + 카카오, 네이버는 나중. 기기 키는 그때 계정에 묶는다
4. **한도 우회(앱 데이터 지우기 · 다시 깔기 → 새 키)는 알고 둔다**(2026-10-06) — 기록을 다 잃고 얻는 건 10회(약 10원)라 지금은 막지 않는다.
   돈은 IP 당 하루 키 20개 · 서버 하루 천장이 막는다. 사용자가 늘면 키를 다시 깔아도 남는 자리(iOS 키체인 · Android 기기 식별값, Google 정책 확인)에 두고,
   로그인이 들어오면 계정 기준으로 센다
5. **Julian 이 고를 다음 후보** — 서버가 진행 단계를 실시간으로 보내기(SSE, 배포 필요 · 모델 비용 그대로,
   [ask/007](docs/task/ask/007-question-aware-trace.md) 「정한 것」 4) · 수면 · 수유 · 울음 · 변 같은 일상 주제 L1 늘리기(항목마다 Julian 승인) ·
   「모두에게 더 똑똑해지는」 고리 — 근거 없이 답한 질문을 주제 × 월령 띠로 세는 로그는 들어갔다([common/017](docs/task/common/017-ungrounded-count.md),
   배포 뒤 쌓인다, 보는 명령은 server/AGENTS.md). 많이 나온 주제부터 L1 초안 → Julian 승인. 자주 묻는 질문 캐시(backend ②′)는 그 뒤에. 지금 「쓸수록 똑똑해지는」 것은 우리 아기 기록(L2)뿐이다
6. Claude 몫: 써 본 피드백 반영 → 답변 완성도 다듬기(위험 신호 — Julian 승인) → 스토어 등록 준비 — 첫 장은 됐고, 남은 것은
   스크린샷 4장(아침 안부 · 위험 신호 · 일정 · 우리 아기, `marketing/store/capture.mjs` 로 진짜 화면) · 구글 플레이 그래픽 이미지(1024×500) ·
   소개 문구([product-brief](docs/product/product-brief.md)) · 개인정보 처리방침 웹 주소
7. **Julian 결정 대기(2026-10-08)**: ① 바로 앞 질문과 답 몇 개를 새 질문과 함께 보내 「그럼 몇 시에 재워요?」 같은 이어 묻기가 되게 할지
   (지금 서버는 새 질문 한 문장만 받아 「그럼」이 무엇인지 모른다. 서버 저장 없음, 1건 1원 미만) ·
   ② 답변 피드백(좋아요 · 별로예요)이 실제로 눌리는지 보고 「셋 중 하나 고르기」로 바꿀지(온톨로지 세미나 5교시 사례).
   비용 · 수익 방향은 바뀔 수 있어 결정 기록으로 남기지 않는다(Julian, 2026-10-08)
8. 출시 전 Julian 몫(계정·결제·법률): Apple 개발자($99) → 개발 빌드로 아이콘·광고·결제 확인 → AdMob · 스토어 계정 ·
   RevenueCat · 약관 정보 → 「육아버디」 상표 출원(변리사) · 주소(선택). 목록은
   [common/008](docs/task/common/008-first-release-check.md) · [common/011](docs/task/common/011-rename-yugabuddy.md)

## 다른 PC 에서 시작하기

Claude Code 의 메모리는 PC 마다 따로라서, 이어받는 기준은 이 README 와 `docs/task/` 다. Julian 과 일하는 방식도
메모리가 아니라 [AGENTS.md](AGENTS.md) 「Julian 과 일하는 방식」에 둔다. 명령어는 AGENTS.md(앱)와
[server/AGENTS.md](server/AGENTS.md)(서버)에 있다. 아래는 git 에 없어서 PC 마다 새로 준비해야 하는 것만 적는다.
새 PC 의 Claude 에게는 "README 다른 PC 에서 시작하기대로 준비해 줘" 라고 하면 된다.

- **코드 받기**: GitHub CLI(`gh`)를 깔고 `gh auth login`(개인 계정 jungsu0717, Julian 이 직접) →
  `gh repo clone jungsu0717/malkong`. 이미 받아 둔 PC 면 repo 안에서 `git pull`
- **git 계정**: 이 repo 는 개인 계정(jungsu0717)으로만 커밋한다. 회사 계정과 섞이지 않게 **repo 로컬 설정**만 쓰고
  전역 설정은 건드리지 않는다. 받은 repo 안에서:
  ```bash
  git config --local user.name jungsu0717
  git config --local user.email 6903839+jungsu0717@users.noreply.github.com
  git config --local --add credential.https://github.com.helper ''
  git config --local --add credential.https://github.com.helper '!gh auth git-credential'
  ```
  (빈 helper 줄이 키체인에 남은 다른 계정 자격을 먼저 끊는다)
- **앱**: Node 22.13 이상을 설치하고 `npm install` (22.8 은 경고가 뜨지만 돈다). 앱은 기본으로 배포된 Cloud Run 서버에
  묻기 때문에 앱만 고칠 때는 키도 서버도 필요 없다
- **Expo 로그인(아이폰 Expo Go 로 볼 때)**: 2026년부터 아이폰 Expo Go 는 PC 의 Expo CLI 와 **같은 계정으로 로그인**되어 있어야
  개발 서버의 앱을 연다. 계정은 구글로 가입한 `julian-malkong`(비밀번호 없음) 이라 `npx expo login` 대신
  `npx eas-cli@latest login --device` 로 — 터미널에 뜨는 주소를 브라우저에서 열어 구글로 승인한다(Expo CLI · EAS CLI 가 로그인을 공유).
  폰의 Expo Go 도 같은 계정으로 로그인
- **WSL(윈도우) PC 에서 폰으로 볼 때**: WSL 은 윈도우 안의 가상 네트워크라 맥처럼 와이파이 주소로는 폰이 못 들어온다. 터널로 켠다 —
  `npm i -g @expo/ngrok` 한 번, 그 뒤 `npx expo start --go --tunnel`(QR 을 폰 카메라로). 인터넷을 한 번 거쳐 느리지만 어느 와이파이든 된다.
  이 창의 `!` 명령은 비밀번호 · 승인 입력을 못 받으므로 로그인과 개발 서버는 따로 연 터미널에서
- **서버**: uv 를 설치하고 `server/` 에서 `uv sync` (Python 3.13 은 uv 가 받는다)
- **Gemini 키(서버를 로컬에서 돌릴 때만)**: git 에 없다. https://aistudio.google.com/apikey 의 「Default Gemini Project」
  무료 키를 `server/.env` 에 `MALKONG_GEMINI_API_KEY=...` 한 줄로 둔다(Julian 이 직접). 무료 키라
  `MALKONG_LLM_PAID_TIER` 는 켜지 않는다 — 아기 기록이 안 간다. 유료 키(Malkong 프로젝트, 월 한도 1만 원)는
  Cloud Run 비밀값에만 있고 Julian 이 관리한다([server/AGENTS.md](server/AGENTS.md) 배포 절)
- **배포할 때만**: gcloud CLI 설치 → `gcloud auth login`(개인 구글 계정) → `gcloud config set project malkong`
- **홍보 그림을 다시 만들 때만**(`marketing/toon/render.sh` · `marketing/store/render.sh`): macOS 와 Google Chrome(`/Applications`) —
  크롬으로 그림을 찍는다. 릴스 mp4 는 Xcode 명령줄 도구의 `swiftc`(`xcode-select --install`), 스토어의 진짜 앱 화면 찍기
  (`marketing/store/capture.mjs`)는 Node 22 이상과 웹 개발 서버(`npx expo start --web --port 8099`)가 필요하다. 글꼴은 웹에서 받으니 인터넷이 있어야 한다

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
REACT_NATIVE_PACKAGER_HOSTNAME=<맥 IP> npx expo start --go   # 아이폰 Expo Go — 맥 IP 는 `ipconfig getifaddr en0`
npx expo start --web  # 웹 미리보기
npx tsc --noEmit      # 타입 검사
npx expo lint         # 린트
```

`--go` 는 꼭 붙인다 — `expo-dev-client` 가 깔려 있어서 빼면 개발 빌드용으로 켜져 Expo Go 가 열지 못한다.
`REACT_NATIVE_PACKAGER_HOSTNAME` 은 폰이 찾아올 맥 주소를 정해 둔다(와이파이가 바뀌면 숫자도 바꾼다).
화면이 이상하거나 고친 것이 안 보일 때만 `--clear` 를 더한다.

## 스택

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router · StyleSheet + 테마 토큰 ·
react-native-svg · expo-sqlite(기기 저장). 백엔드는 FastAPI(예정).
