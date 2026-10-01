# 앱 디자인 · 기술 스택 · 코딩 스타일

> 2026-09 시점 최신 동향 조사 반영. 스택을 바꾸는 결정은 이 문서를 먼저 고친다.

## 확정 스택

| 자리 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Expo SDK 57 + React Native 0.86 + TypeScript** | iOS·Android·웹 동시, Expo Go 로 실기기 즉시 확인, EAS 로 Mac 없이 빌드 |
| 라우팅 | **expo-router** (파일 기반) | `src/app/` 파일 하나 = 화면 하나 |
| 스타일 | **StyleSheet + 테마 토큰** (`src/constants/theme.ts`) | 의존성 최소·웹 번들 작음. NativeWind 는 Tailwind 에 익숙한 팀에서만 이점 — 우리는 도입하지 않는다 (2026 동향도 "프로토타입은 StyleSheet 로 충분" 쪽) |
| 애니메이션 | **Reanimated v4** (설치됨) — 제스처·화면 전환 | 표준. Skia 와 UI 스레드에서 연동된다 |
| 커스텀 그래픽 | **@shopify/react-native-skia** (필요 시점에 도입) | 타임라인 연결 곡선·다수 요소 애니메이션처럼 View 로는 버거운 그림만. **하이브리드가 정석** — 레이아웃·콘텐츠는 RN View, 그림만 Skia 캔버스 |
| 서버 데이터 | **TanStack Query** (agent 연결 시점에 도입) | 캐싱·재시도 표준 |
| 로컬 저장 | **expo-sqlite** (기기) + **localStorage** (웹 미리보기) | 스키마는 [backend](../architecture/backend.md) 기기 DB 절이 정본. expo-sqlite 의 웹 지원이 알파(Metro WASM 설정·COOP/COEP 헤더 필요)라 브라우저 검토가 깨지므로, `src/data/db.ts`(sqlite)와 `src/data/db.web.ts`(localStorage)로 플랫폼을 나눈다. 웹은 검토용이고 출시 대상은 iOS·Android 다 |
| 광고 | **Google AdMob + react-native-google-mobile-ads** | 배너·전면·보상형. 네이티브 모듈이라 **Expo Go 불가 → EAS 개발 빌드 단계에서 도입**. 절차는 `src/components/ad-banner.tsx` 주석. iOS 는 expo-tracking-transparency 동의 선행. **개발·가족 기기는 광고 면제 또는 테스트 광고 ID** — 실광고 자기 클릭은 AdMob 계정 정지 사유([backend](../architecture/backend.md) 운영자 절) |

동향 근거: [Expo 공식 — NativeWind 고품질 UI](https://expo.dev/blog/building-high-quality-uis-with-expo-and-nativewind) ·
[Expo 공식 — Reanimated·Skia 로 AI 앱 감각 만들기](https://expo.dev/blog/making-ai-feel-human-in-a-mobile-app-with-expo-reanimated-and-skia) ·
[State of React Native — 그래픽·애니메이션](https://results.stateofreactnative.com/en-US/animations/) ·
[Skia 애니메이션 공식 문서](https://shopify.github.io/react-native-skia/docs/animations/animations/) ·
[2026 애니메이션 라이브러리 비교](https://www.pkgpulse.com/guides/react-native-reanimated-vs-moti-vs-skia-animation-2026)

## 디자인 원칙 — Toss 를 기준으로

- 흰 배경 + 회색 카드(`backgroundElement`, radius 16~24) + **포인트 색 하나**(`accent` #3182F6)
- 큰 제목·짧은 한글 라벨 — 탭·버튼은 한 단어(홈·물어보기·성장·마이)
- 화면당 주요 행동 하나. 설명보다 여백
- 색은 반드시 `theme.ts` 토큰으로 쓴다 — 화면에 hex 를 직접 적지 않는다 (예외: 경고 `#F04452` 는 토큰화 예정)
- 다크 모드는 토큰이 자동 처리 — light/dark 두 벌을 항상 같이 채운다

## 아이콘 — 아기자기함은 아이콘이 맡고, 레이아웃은 미니멀을 지킨다

- **탭·브랜드 아이콘 = 자체 베이비 아이콘 세트** (`src/components/baby-icons.tsx`, react-native-svg):
  홈=아기 얼굴 · 물어보기=쪽쪽이 · 성장=딸랑이 · 마이=곰돌이 + 쪽쪽이 문 아기(생각 중·로딩).
  규격 통일(24×24 · 선 1.8 · 끝 둥글게) — 세트감이 깨지면 안 되므로 새 아이콘도 이 규격으로 그린다.
- **보조 UI 아이콘(셰브론·링크·전송 등)은 Ionicons 유지** (`@expo/vector-icons`, MIT). 다른 벡터
  패밀리를 더 섞지 않는다.
- 아기자기함의 자리는 아이콘·일러스트·모션까지다. 카드 레이아웃·여백·타이포는 토스식 미니멀을
  유지한다 — 화면 전체를 캐릭터로 채우지 않는다.
- **런처 아이콘(홈 화면)은 브랜드 자산** — 1024×1024 원본 + Android adaptive icon 레이어(전경/배경)를
  직접 만들어 `app.json` 에 넣는다. 자리는 `assets/images/android-icon-*.png`.

## 로딩과 모션

| 상황 | 방법 |
|---|---|
| 콘텐츠 로딩 (카드·리스트) | **스켈레톤** + shimmer (Reanimated) — 스피너를 깔지 않는다 (Toss 방식) |
| 생각 중 (답변 대기) | **처리 현황 블록** (`thinking-status.tsx`, SPEC-ASK-05) — 대기 문구 3.2초 순환 + 접이식 생각 과정, selvas 통합 chat(neuro-frontend `packages/chat` ThinkingIndicator·ChatTrace) 이식. Orb 자리 = 쪽쪽이 문 아기 얼굴(`PacifierBabyIcon`) 맥동 |
| 큰 로딩 (초기 구동·화면 단위) | **붉은 말을 탄 쪽쪽이 아기(나폴레옹 포즈) 브랜드 모션** — 말콩의 유래(말띠 해의 콩알이)가 모션이 됨. 말 색은 `horse` 토큰. 정식은 Lottie 자산 제작(`lottie-react-native`), 그 전 임시 = `baby-loading.tsx`(`RidingBabyIcon` 가로 질주 + 바운스). 미리보기는 마이 탭 하단(시안 전용) |
| 짧은 차단 동작 (1초 미만) | 기본 ActivityIndicator |
| 스플래시 | expo-splash-screen + AnimatedSplashOverlay (템플릿 그대로) |
| 화면 전환·미세 반응 | Reanimated |

## 라우트 구조

```
src/app/_layout.tsx        루트 Stack — 테마 · BabyProvider · 온보딩 게이트
src/app/(tabs)/_layout.tsx 하단 탭 4개 (그룹이라 URL 에는 (tabs) 가 나타나지 않는다)
src/app/(tabs)/*.tsx       홈 · 물어보기 · 성장 · 마이
src/app/onboarding.tsx     탭 밖 전체 화면. `?edit=1` 이면 프로필 수정으로 쓰인다
```

## 코딩 스타일

- `src/app/` 에는 화면(라우트)만. 부품은 `src/components/`, 훅은 `src/hooks/`, 데이터 모형은 `src/data/`
- 텍스트는 `ThemedText`(type: title·subtitle·default·small·smallBold·code), 배경은 `ThemedView` 로 통일
- Expo API 는 기억으로 쓰지 않는다 — `package.json` 의 SDK 판을 확인하고 그 판의 문서를 본다 (루트 AGENTS.md)
- 패키지 추가는 항상 `npx expo install` (SDK 호환 판을 잡아 준다). 설치 직후엔 서버 재시작
- 끝났다고 하기 전에: `npx tsc --noEmit` + `npx expo lint` 통과

## changelog

- 2026-09-30 최초 작성 — 스택 확정, NativeWind 미도입 결정, Skia 하이브리드 경로
