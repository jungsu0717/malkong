This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## 육아버디(코드명 malkong) 하네스 — 설계와 작업의 정본

서비스 이름은 **육아버디**, 대화하는 AI 이자 캐릭터는 **버디**(쪽쪽이 문 아기)다(decisions/014 · 015). 코드·저장소·GCP·EAS 의
코드명은 malkong 그대로 둔다.

설계 문서가 `docs/` 에 있고, 코드보다 먼저 읽는다. 흐름은 한 방향이다:
**architecture(전체 WHAT) → menu-spec(메뉴별 SPEC + HOW) → task(작업 단위) → 코드.**

- 지금 어디까지 왔고 다음에 무엇을 할지: [README.md](README.md) 「지금 상태」「다음 시작점」(다른 PC 에서 이어받을 때도 여기부터)
- 시작점: [docs/README.md](docs/README.md) — 문서 지도 · 작성 규칙 여덟 · SPEC ID 규칙(`SPEC-<HOME|ASK|GROW|MY>-NN`) · 작업 사이클(specify → clarify → plan/task → implement → verify)
- 모든 SPEC 위에 [docs/constitution.md](docs/constitution.md)가 있다 — 충돌하면 constitution 이 이긴다
- 작업 흐름(Julian 지시, 2026-10-03): task 를 만들고 → 끝까지 구현하고 → tsc · lint · 빠른 단위 시험 → 작업 단위로 스스로 커밋·푸시하고 다음 task 로 이어 간다. 큰 시험은 마지막에 몰아서 한다. Julian 만 정할 수 있는 것(미결, 비용, 계정·결제·법률, 의료 승인)이 생길 때만 멈춰 묻고, 그 밖의 설계 선택은 권장안으로 정해 task 에 적는다
- 기능 작업은 **근거 SPEC 이 있는 task**(`docs/task/<메뉴>/NNN-*.md`)로만 시작한다. SPEC 이 없으면 먼저 쓰고, `미결:` 이 걸려 있으면 지어내지 말고 사용자에게 물어 푼 뒤 시작한다
- 무게 있는 선택(대안 기각)은 [docs/decisions/](docs/decisions/README.md)에 ADR 로 남긴다. 스토어 문구·포지셔닝의 원천은 [docs/product/product-brief.md](docs/product/product-brief.md)
- WHAT(SPEC 문장)과 HOW(구현)를 섞지 않는다. 같은 내용을 두 곳에 적지 않는다. 문서는 덧대지 않고 정의를 갱신한다
- 육아·의료 내용은 출처 화이트리스트 원칙([knowledge-layers](docs/architecture/knowledge-layers.md))을 따르고, 위험 신호 응답 규칙(SPEC-ASK-02)을 우회하지 않는다
- 스택·스타일 결정은 [docs/app-design/README.md](docs/app-design/README.md)가 정본이다 — StyleSheet+토큰, NativeWind 미도입, Skia 는 하이브리드로

## Julian 과 일하는 방식

Claude Code 메모리는 PC 마다 따로라서, 어느 PC 에서도 지켜야 하는 것을 여기 둔다.

- Julian 은 혼자 개발하고 터미널은 익숙하지 않다. **쉬운 한국어로 짧게**, 전문 용어는 한 줄로 풀어 쓴다
- **의료 게이트**: L1 항목의 `approved` 전환은 Julian 이 「승인」이라고 말해야만 한다. 대신 누르지 않는다
- **Gemini 실제 호출은 최소로** — Julian 이 결과를 판단할 몫이다. 시험은 FakeLlm 이나 가짜 응답으로 하고,
  실제 호출이 드는 시험은 시작 전에 몇 회인지 말한다
- **시험 반복 금지** — 시험 · 측정 전에 무엇을 · 왜 · 몇 분인지 한 줄로 말한다. 고치기 → 재기가 두 바퀴를 넘으면
  멈추고 묻는다. 10분 넘는 측정은 돌리지 않는다
- **운영 배포(Cloud Run)는 매번 Julian 의 명시적 승인 뒤에만** 한다
- 키 · 비밀값은 출력 · 로그 · 커밋에 남기지 않고, 키를 넣는 명령과 로그인은 Julian 이 직접 한다. 전역 git 설정은 건드리지 않는다
- 서버에 아기 데이터를 저장하거나 로그로 남기지 않는다. AI 이미지 생성 · 교체는 더 하지 않는다
- 한국 상담 전화번호(109 등)는 넣지 않는다(Julian, 2026-10-04)
- 바뀌는 사실(도구 · 버전 · 관행)은 기억으로 답하지 말고 검색해 확인한다. 확인하겠다고 했으면 실제로 한다
- **디자인 결과물(홍보 · 스토어 그림 포함)은 앱 디자인 언어로** — 밝은 바탕 · 먹색 · 포인트는 코랄 하나 · 글은 짧게.
  색을 늘리면 「조잡하다」, 화려함은 구조로 낸다(흐름도 · 모눈 · 이름표). 그림은 고칠 때마다 직접 렌더해 보고 겹침 · 잘림을 확인한다(2026-10-05)
- **스토어 · 광고 문구는 실제 동작과 맞춘다** — 없는 출처(소아과 등) · 모델 회사 이름 · API 주소 · 내부 로직 용어를 쓰지 않는다
  ([store-toon](docs/product/store-toon.md) 「규칙」)
