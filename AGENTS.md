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
- 작업 흐름(Julian 지시, 2026-10-02): task 를 만들고 → 끝까지 구현하고 → 리뷰와 검증을 돌리고 → 커밋할지 묻고 → 승인되면 다음 task 로 이어 간다. 단계마다 끊지 않고, Julian 이 결정해야 하는 것(미결, 대안 선택, 비용, 계정·결제 같은 Julian 만 할 수 있는 일)이 생길 때만 묻는다. 커밋·푸시는 매번 승인을 받은 뒤에만 한다
- 기능 작업은 **근거 SPEC 이 있는 task**(`docs/task/<메뉴>/NNN-*.md`)로만 시작한다. SPEC 이 없으면 먼저 쓰고, `미결:` 이 걸려 있으면 지어내지 말고 사용자에게 물어 푼 뒤 시작한다
- 무게 있는 선택(대안 기각)은 [docs/decisions/](docs/decisions/README.md)에 ADR 로 남긴다. 스토어 문구·포지셔닝의 원천은 [docs/product/product-brief.md](docs/product/product-brief.md)
- WHAT(SPEC 문장)과 HOW(구현)를 섞지 않는다. 같은 내용을 두 곳에 적지 않는다. 문서는 덧대지 않고 정의를 갱신한다
- 육아·의료 내용은 출처 화이트리스트 원칙([knowledge-layers](docs/architecture/knowledge-layers.md))을 따르고, 위험 신호 응답 규칙(SPEC-ASK-02)을 우회하지 않는다
- 스택·스타일 결정은 [docs/app-design/README.md](docs/app-design/README.md)가 정본이다 — StyleSheet+토큰, NativeWind 미도입, Skia 는 하이브리드로
