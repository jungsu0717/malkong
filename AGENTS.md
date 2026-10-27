# julian-studio — 모든 앱에 통하는 규칙

이 저장소에는 Julian 이 혼자 만드는 앱이 여러 개 들어 있다. 이 파일은 어느 앱에서 일하든 가장 먼저 읽는 규칙이다.
앱 폴더의 `AGENTS.md` 는 그 앱만의 규칙을 더할 뿐이고, 여기 규칙을 바꾸지 않는다.
Claude Code 메모리는 PC 마다 따로라서, 어느 PC 에서도 지켜야 하는 것을 여기에 둔다.

앱 목록과 폴더 구조는 [README.md](README.md) 에 있다.

## 읽는 순서

1. 이 파일
2. [docs/governance/conventions.md](docs/governance/conventions.md) — 문서 체계, SPEC 번호, 작성 규칙, 작업 순서
3. `apps/<앱>/AGENTS.md` — 그 앱만의 규칙
4. `apps/<앱>/README.md` 「지금 상태」「다음 시작점」 — 다른 PC 에서 이어받을 때도 여기부터

명령(`npm`, `npx expo`, `uv`)은 그 앱 폴더 안에서 실행한다. 루트에는 `package.json` 이 없다. 두 앱이 실제로 같은 코드를
쓰게 되면 그때 `packages/` 와 워크스페이스를 만든다. 새 앱을 시작할 때는 [docs/_templates/](docs/_templates/) 를 복사한다.

## 하지 말 것 1순위 — 어색한 말을 쓰지 않는다

Julian(2026-10-14): 무조건 지킨다.

- 사람끼리 대화하거나 다른 서비스에서 쓰지 않는 낱말과 문장은 쓰지 않는다. 비슷한 결의 말도 쓰지 않는다.
- 지적받은 예: 「자리에 선 것」, 「막는 것」, 「때가 된 것」, 「다음 주제의 씨앗」, 「쉼표 자리」, 「알림은 약속이다」.
  화면 단추 · 제목도 같다(2026-10-15 재지적): 「넣기」 → 추가, 「시작 목록」 → 추천, 「끝낸 것」 → 완료, 「그 밖의 할 일」 → 기타,
  「알아서」 → 자동 분류, 「고치기」 → 편집 · 수정, 「다시 보이기」 → 숨김 해제. 조사가 어긋난 문장(「육아의 챙길 것」)도 쓰지 않는다.
  새 화면을 만들면 문구를 다른 앱에서 본 말인지 하나씩 대 보고 나서 보여 준다.
- 채팅 답변, 문서, 앱 화면 문구, 코드 주석, 커밋 메시지에 모두 해당한다.
- 평소 사람이 말하듯, 다른 앱에서 흔히 보는 말로 쓴다(예: 「반복 할 일」, 「추천 할 일」, 「시험 데이터」).
  기능 이름을 지을 때와 내용을 한 줄로 줄일 때 특히 조심한다.

## Julian 과 일하는 방식

- Julian 은 혼자 개발하고 터미널은 익숙하지 않다. **쉬운 한국어로 짧게** 쓰고, 전문 용어는 한 줄로 풀어 쓴다.
  주어를 잘라 낸 짧은 단정문(「~선다」, 「~남는다」)은 쓰지 않는다
- **작업 흐름**(Julian, 2026-10-03): task 를 만들고 → 끝까지 구현하고 → 품질 검사와 빠른 단위 시험 → 작업 단위로 스스로
  커밋 · 푸시하고 다음 task 로 이어 간다. 큰 시험은 마지막에 몰아서 한다. Julian 만 정할 수 있는 것(미결, 비용, 계정 · 결제 · 법률,
  앱마다 정한 승인 절차)이 생길 때만 멈춰 묻고, 그 밖의 설계 선택은 권장안으로 정해 task 에 적는다
- 기능 작업은 근거 SPEC 이 있는 task 로만 시작한다(conventions 「작업 순서」)
- **AI 모델 실제 호출은 최소로** — 결과를 판단하는 것은 Julian 의 몫이다. 시험은 가짜 응답으로 하고, 실제 호출이 드는 시험은
  시작 전에 몇 회인지 말한다
- **시험 반복 금지** — 시험 · 측정 전에 무엇을, 왜, 몇 분 걸리는지 한 줄로 말한다. 고치고 다시 재는 일이 두 번을 넘으면
  멈추고 묻는다. 10분 넘는 측정은 돌리지 않는다
- **운영 배포는 매번 Julian 의 명시적 승인 뒤에만** 한다
- 키와 비밀값은 출력 · 로그 · 커밋에 남기지 않는다. 키를 넣는 명령과 로그인은 Julian 이 직접 한다. 전역 git 설정은 건드리지 않는다
- 바뀌는 사실(도구, 버전, 관행, 가격)은 기억으로 답하지 않고 검색해 확인한다. 확인하겠다고 했으면 실제로 한다
- **디자인 결과물(홍보 · 스토어 그림 포함)은 그 앱의 디자인 언어로** 만든다. 색을 늘리면 조잡해지므로 화려함은 구조로 낸다
  (흐름도, 모눈, 이름표). 그림은 고칠 때마다 직접 렌더해 보고 겹침과 잘림을 확인한다
- **화면은 한눈 요약과 상세 화면으로 나눈다**(Julian, 2026-10-06). 탭에는 요약과 바로 할 행동만 두고, 긴 목록과 카드는 줄을 눌러
  들어가는 상세 화면에 둔다. 같은 숫자를 한 화면에 두 번 그리지 않는다. 기계적으로 들리는 알림 문구나 통계 칸 대신 내용 문장으로 쓴다
- **화면 문구는 최소로**(Julian, 2026-10-21): 「CDC 는 이 앱을 보증하지 않아요」 같은 당연한 고지와 구구절절한 설명을 화면에 쓰지 않는다.
  매우 단순하고 바로 알 수 있는 화면이 목표다. 출처 이용 조건처럼 꼭 남겨야 하는 문장은 약관 · 고지 문서에만 둔다
- **화면을 바꿀 때는 시안 먼저**(Julian, 2026-10-16): 코드를 고치기 전에 Claude 캔버스 시안(artifact, Figma 처럼 화면을 펼쳐 보는 것)에
  그려 이야기하고, Julian 이 확정하면 그때 앱에 반영한다. 육아버디 시안: https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x
  캔버스에는 지금 이야기하는 시안에 관련된 화면만 둔다 — 관련 없는 화면과 버린 안, 옛 캡처는 지운다(Julian, 2026-10-22 · 10-27).
  지운 화면은 캔버스 이전 판에서 되살릴 수 있다
- **스토어 · 광고 문구는 실제 동작과 맞춘다** — 없는 기능, 없는 출처, 모델 회사 이름, API 주소, 내부 로직 용어를 쓰지 않는다

## Expo — 모든 앱 공통

Every app in `apps/` is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

### Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in that app's `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

### Commands (run inside `apps/<app>/`)

Use `bunx` instead of `npx` if the app uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

### Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

### Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples. Run it from the app folder.
Docs: https://docs.expo.dev/eas/index.md

### Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
- Apps in one repo must share the same React Native version once they are linked as workspaces (Expo monorepo guide). Until then each app keeps its own `node_modules`.
