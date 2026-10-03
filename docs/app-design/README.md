# 앱 디자인 · 기술 스택 · 코딩 스타일

> 2026-09 시점 최신 동향 조사 반영. 스택을 바꾸는 결정은 이 문서를 먼저 고친다.

## 확정 스택

| 자리 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Expo SDK 57 + React Native 0.86 + TypeScript** | iOS·Android·웹 동시, Expo Go 로 실기기 즉시 확인, EAS 로 Mac 없이 빌드 |
| 라우팅 | **expo-router** (파일 기반) | `src/app/` 파일 하나 = 화면 하나 |
| 스타일 | **StyleSheet + 테마 토큰** (`src/constants/theme.ts`) | 의존성 최소·웹 번들 작음. NativeWind 는 Tailwind 에 익숙한 팀에서만 이점 — 우리는 도입하지 않는다 (2026 동향도 "프로토타입은 StyleSheet 로 충분" 쪽) |
| 애니메이션 | **Reanimated v4** (설치됨) — 제스처·화면 전환 | 표준. Skia 와 UI 스레드에서 연동된다 |
| 커스텀 그래픽 | **@shopify/react-native-skia** (필요 시점에 도입 — 지식 지도에 썼다가 Expo Go 에서 앱이 꺼져 걷어 냄, task baby/001) | 타임라인 연결 곡선·다수 요소 애니메이션처럼 View 로는 버거운 그림만. **하이브리드가 정석** — 레이아웃·콘텐츠는 RN View, 그림만 Skia 캔버스 |
| 서버 데이터 | **TanStack Query** (ask/002 에서 도입) | 캐싱·재시도 표준. 묻기(`/v1/ask`)는 모델 호출이 다시 나가므로 자동 재시도하지 않는다 |
| 로컬 저장 | **expo-sqlite** (기기) + **localStorage** (웹 미리보기) | 스키마는 [backend](../architecture/backend.md) 기기 DB 절이 정본. expo-sqlite 의 웹 지원이 알파(Metro WASM 설정·COOP/COEP 헤더 필요)라 브라우저 검토가 깨지므로, `src/data/db.ts`(sqlite)와 `src/data/db.web.ts`(localStorage)로 플랫폼을 나눈다. 웹은 검토용이고 출시 대상은 iOS·Android 다 |
| 광고 | **Google AdMob + react-native-google-mobile-ads** (v17, task common/006) | 첫 출시는 배너(성장 탭)와 보상형(한도 충전), 전면은 「다음」. 네이티브 모듈이라 Expo Go·웹에서는 모듈을 읽지 않고 자리만 보인다(`src/data/ads.ts` · `ads.web.ts`) — 실제 광고는 **EAS 개발 빌드**(`eas.json`, expo-dev-client)부터. 시작 순서는 유럽 동의(UMP) → iOS 추적 허용(expo-tracking-transparency) → SDK 시작, 광고 등급 PG. 개발 빌드는 Google 시험 단위, 출시 빌드는 `EXPO_PUBLIC_ADMOB_*` 단위가 없으면 광고를 내지 않는다. **개발·가족 기기는 광고 면제(운영자 기기) 또는 시험 단위** — 실광고 자기 클릭은 AdMob 계정 정지 사유([backend](../architecture/backend.md) 운영자 절) |
| 글꼴 | **IBM Plex Sans KR**(`@expo-google-fonts/ibm-plex-sans-kr`, `expo-font` 의 `useFonts`) | 시안 B. 굵기 넷(400·500·600·700)만 싣는다 — 한글 글꼴이라 굵기 하나가 약 2.8MB |
| 알림 | **expo-notifications** 로컬 알림(아침 브리핑, home/004) | 서버 푸시가 아니라 기기가 매일 정한 시각에 스스로 띄운다 — 서버에 기기 토큰을 두지 않는다. Expo Go 에서도 된다. 웹은 알림 없음 |
| 햅틱 | **expo-haptics** | 보내기 · 완료 · 확인 같은 주요 행동에 가볍게 |
| 결제 (광고 제거) | **RevenueCat `react-native-purchases`** (Expo 권장, 도입은 나중) | 한 번 사면 광고가 사라지는 비소모성 상품. 네이티브 모듈이라 AdMob 과 같은 EAS 개발 빌드 단계에서 함께 붙인다. 구매 사실의 정본은 스토어이고 기기 저장은 복원용 사본 — 자리는 `src/data/entitlements.ts` |

동향 근거: [Expo 공식 — NativeWind 고품질 UI](https://expo.dev/blog/building-high-quality-uis-with-expo-and-nativewind) ·
[Expo 공식 — Reanimated·Skia 로 AI 앱 감각 만들기](https://expo.dev/blog/making-ai-feel-human-in-a-mobile-app-with-expo-reanimated-and-skia) ·
[State of React Native — 그래픽·애니메이션](https://results.stateofreactnative.com/en-US/animations/) ·
[Skia 애니메이션 공식 문서](https://shopify.github.io/react-native-skia/docs/animations/animations/) ·
[2026 애니메이션 라이브러리 비교](https://www.pkgpulse.com/guides/react-native-reanimated-vs-moti-vs-skia-animation-2026)

## 디자인 원칙 — 시안 B 「단정한 비서」 (2026-10-03, [decisions/012](../decisions/012-chat-first-three-tabs.md))

- 흰 바탕 + **먹색 글자**(`text` #16161A) + 옅은 회색 면(`surface`)과 가는 선(`border`). 그림자는 쓰지 않는다
- **붉은 말 색(`accent` #C64536)은 포인트에만** — D-day, 「기록 참고」 표시, 확인 단추, 현재 위치. 넓은 면을
  칠하지 않는다. 주요 단추는 먹색(`ink`) 바탕에 흰 글자
- 큰 제목(26~28, 굵게, 자간 -3%) · 짧은 한글 라벨. 탭은 짧게(말콩 · 우리 아기 · 성장 · 마이)
- 글꼴은 **IBM Plex Sans KR** 400 · 500 · 600 · 700(`@expo-google-fonts/ibm-plex-sans-kr`, 굵기마다 파일
  하나 — 패키지 첫 파일에서 가져오면 일곱 굵기가 다 번들에 들어가므로 굵기별 하위 경로에서 가져온다).
  `ThemedText` 가 굵기에 맞는 글꼴을 고른다 — 화면에서 `fontFamily` 를 직접 적지 않는다
- 답은 말풍선이 아니라 **문서처럼** — 질문은 굵은 한 줄, 답은 본문, 그 아래 수위·출처·기록 표시 한 줄
- 색은 반드시 `theme.ts` 토큰으로 쓴다 — 화면에 hex 를 직접 적지 않는다. 경고·위험 신호는 `danger`·`dangerSoft`
  에만. 위험 신호 카드는 색만이 아니라 **모양**(채운 경고 머리 · 119 단추)으로 포인트 색과 갈린다
- 다크 모드는 토큰이 자동 처리 — light/dark 두 벌을 항상 같이 채운다
- 누르는 자리는 44pt 이상, 주요 행동에는 가벼운 햅틱(`expo-haptics`)

## 아이콘 — 캐릭터 「버디」 하나, 나머지는 선 아이콘

- **캐릭터 버디**(쪽쪽이 문 아기, [decisions/015](../decisions/015-character-buddy.md)) — 원본은 캐릭터 시트 한 장
  `assets/brand/buddy-sheet.jpg`, 잘라 낸 그림은 `assets/images/mascot/`(얼굴 · 서 있는 모습).
  앱 안에서는 `BuddyMark`(얼굴) · `BuddyAvatar`(동그란 바탕 위 얼굴, `src/components/brand.tsx`)로만 쓴다
- **탭 아이콘은 자체 베이비 세트**(`baby-icons.tsx`, 24×24 · 선 1.8 · 끝 둥글게) — 버디=말풍선 속 쪽쪽이 ·
  우리 아기=아기 얼굴 · 성장=딸랑이 · 마이=곰돌이. 같은 규격의 소품 아이콘 쪽쪽이 · 젖병은 큰 로딩에 쓴다
- **보조 UI 아이콘은 Ionicons**(`@expo/vector-icons`, MIT) — 외곽선. 다른 벡터 패밀리를 더 섞지 않는다
- **런처 아이콘** — 우주복 노랑(#FDD686) 바탕에 버디 얼굴. Android adaptive 전경(안전 영역 안 얼굴) · 배경(노랑) ·
  단색(테마 아이콘, 흰 실루엣). **알림 아이콘**(Android 상태 표시줄) — 흰 실루엣 96px, `expo-notifications` 플러그인.
  만드는 법은 `scripts/brand/`
- **시작 화면** — 흰 바탕(다크 모드는 #0E0E11)에 서 있는 버디

## 로딩과 모션

| 상황 | 방법 |
|---|---|
| 콘텐츠 로딩 (카드·리스트) | **스켈레톤** + shimmer (Reanimated) — 스피너를 깔지 않는다 (Toss 방식) |
| 생각 중 (답변 대기) | **처리 현황 블록** (`thinking-status.tsx`, SPEC-ASK-05) — 대기 문구 3.2초 순환 + 접이식 생각 과정, selvas 통합 chat(neuro-frontend `packages/chat` ThinkingIndicator·ChatTrace) 이식. Orb 자리 = 버디 얼굴(`BuddyMark`) 맥동 |
| 큰 로딩 (초기 구동·화면 단위) | **육아 소품 아이콘이 톡톡 바뀐다** — 동그란 accentSoft 바탕 안에서 쪽쪽이 → 젖병 → 딸랑이 → 곰돌이(베이비 아이콘 세트)가 0.7초마다 뿅 커지며 바뀌고, 바뀔 때 바탕이 살짝 튄다(`baby-loading.tsx`, Reanimated). 캐릭터 그림은 쓰지 않는다 |
| 짧은 차단 동작 (1초 미만) | 기본 ActivityIndicator |
| 스플래시 | expo-splash-screen(흰 바탕 · 서 있는 버디) → 글꼴과 기기 저장을 읽는 동안 같은 그림을 유지 → `AnimatedSplashOverlay` 가 흐리며 걷힌다 |
| 빈 화면 | 버디 얼굴 + 한 줄 안내 + 할 수 있는 행동 하나(`EmptyState`) |
| 화면 전환·미세 반응 | Reanimated |

## 광고 자리

- **성장 · 이번 달**: 「챙길 것」 → **배너** → 나머지. 스크롤하지 않아도 보이되 첫인상과 핵심
  카드보다 앞서지 않는다(SPEC-HOME-05)
- **성장 · 타임라인**: 바닥에 둔다. 가로 타임라인이 화면을 채우는 것이 이 보기의 값이라, 위를 잘라내지 않는다(SPEC-GROW-04)
- **버디(대화) · 우리 아기(지식 지도)**: 두지 않는다. 대화 흐름을 끊고, 되묻기·답변 사이에 광고가 끼면 신뢰가 깎인다. 지식 지도는 이 앱의 얼굴이라 광고와 섞지 않는다
- 광고를 없앤 사용자에게는 `AdBanner` 가 아무것도 그리지 않아 자리까지 사라진다(SPEC-MY-06)

## 라우트 구조

```
src/app/_layout.tsx          루트 Stack — 글꼴 · 테마 · 데이터 Provider · 온보딩 게이트
src/app/(tabs)/_layout.tsx   하단 탭 4개 (그룹이라 URL 에는 (tabs) 가 나타나지 않는다)
src/app/(tabs)/index.tsx     말콩 — 대화(첫 화면)
src/app/(tabs)/baby.tsx      우리 아기 — 버디가 아는 것(지식 지도 · 프로필 · 제안)
src/app/(tabs)/growth.tsx    성장 — 이번 달 · 타임라인
src/app/records.tsx          기록 보기·고치기
src/app/(tabs)/my.tsx        마이
src/app/briefings.tsx        지난 브리핑 보관함
src/app/onboarding.tsx       탭 밖 전체 화면. `?edit=1` 이면 프로필 수정으로 쓰인다
src/app/legal/[doc].tsx      약관·고지
```

## 코딩 스타일

- `src/app/` 에는 화면(라우트)만. 부품은 `src/components/`, 훅은 `src/hooks/`, 데이터 모형은 `src/data/`
- 텍스트는 `ThemedText`(type: display·title·heading·default·body·small·caption·label), 배경은 `ThemedView` 로 통일.
  카드·단추·칩·빈 화면 같은 공용 부품은 `src/components/ui/`
- Expo API 는 기억으로 쓰지 않는다 — `package.json` 의 SDK 판을 확인하고 그 판의 문서를 본다 (루트 AGENTS.md)
- 패키지 추가는 항상 `npx expo install` (SDK 호환 판을 잡아 준다). 설치 직후엔 서버 재시작
- 끝났다고 하기 전에: `npx tsc --noEmit` + `npx expo lint` 통과

## changelog

- 2026-09-30 최초 작성 — 스택 확정, NativeWind 미도입 결정, Skia 하이브리드 경로
- 2026-10-04 캐릭터 버디(쪽쪽이 문 아기, AI 시트 한 장) — 아이콘 · 시작 화면 · 로딩 · 알림 아이콘 (decisions/015)
- 2026-10-03 시안 B 로 다시 짬 — 토큰·글꼴·아이콘·광고 자리·라우트(탭 셋) 갱신 (decisions/012, task common/009)
