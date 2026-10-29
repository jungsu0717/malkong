# 008 폰 홈 화면 위젯 — 버디 · 태어난 지 며칠 · 이번 주 챙길 일 · 오늘 할 루틴

> 상태: 완료 (2026-10-29) · 폰 확인 남음(Expo Go 에는 위젯이 없다 — TestFlight · 안드로이드 빌드)
> 근거: SPEC-MAIN-09 · SPEC-MAIN-08 · decisions/035

## 목표

앱을 열지 않아도 폰 홈 화면과 잠금 화면에서 버디와 다음 챙길 일이 보이게 한다. 루틴은 위젯에서 바로 완료한다.
기록 앱 옆에 두는 앱(decisions/034)이 매일 눈에 들어오는 길이다.

## 정한 것 (권장안 — Julian 「캔버스 시안 말고 바로 반영」)

- **보이는 것**: 버디 얼굴 · 「태어난 지 58일」 · 「이번 주 챙길 일 3개」 · 가장 가까운 다가오는 일 「D-3 · BCG 접종」. 중간 크기와 안드로이드에는 오늘 할 루틴 세 개(안 한 것 먼저)
- **D-day 를 앞에** — 「D-3 · BCG 접종」. 한국에서 많이 쓰는 디데이 위젯과 같은 읽는 순서다. 「지금」인 접종 · 검진은 「이번 달」, 기한이 지난 앱 할 일은 「지남」
- **위젯에서 완료**: 체크 루틴만 그 자리에서 토글. 단계 · 재고 확인 루틴은 시트가 필요해 루틴 화면을 연다.
  앱이 꺼져 있을 때 누른 것은 `pending` 목록으로 남겨 두고 앱이 앞으로 오면 `check` 로 반영한다(아이폰은 위젯 저장소의 타임라인에 같이 저장되는 것을 확인함 — expo-widgets `AppIntent.swift`)
- **일주일 치 미리 넣기** — 자정이 지나도 앱 없이 날짜 · 수 · 그날 루틴이 바뀌게 오늘부터 7일 치를 타임라인으로 넣는다. 안드로이드는 같은 것을 설정값에 두고 30분마다 다시 그린다
- **아이폰**은 Expo 공식 `expo-widgets`(SDK 57, 알파). 위젯 함수는 `'widget'` 표시로 따로 묶여 위젯 안에서 돌아서, 색 · 글은 모두 함수 안에 적거나 props 로 받는다
- **안드로이드**는 `react-native-android-widget` 0.25 — Expo 공식 패키지의 안드로이드 쪽은 글자 하나만 그리는 빈 껍데기라서(2026-10-29 소스 확인). 뿌리 `index.ts` 에서 작업 처리기를 등록하고 `package.json` `main` 을 거기로
- **Expo Go · 웹**에는 두 모듈이 없어 불러오지 않는다(`widgets-native.ts`). 위젯은 TestFlight · 개발 빌드에서만 보인다
- 색은 앱과 같다 — 흰 바탕(다크는 먹색), 먹색 글씨, 포인트는 코랄 하나. 잠금 화면은 시스템이 흑백으로 그리므로 색을 지정하지 않는다
- 스트릭 · 못 한 날 수는 두지 않는다(헌장 4). 아기 이름도 두지 않는다(알림과 같은 이유 — 잠금 화면에 보인다)

## 손댈 파일

- `src/data/widget-data.ts`(+ test) · `src/data/baby-rows.ts`(아기 일정 줄 셈을 화면에서 떼어 냄) · `src/data/widget-sync.tsx` · `src/data/widgets-native.ts`
- `src/widgets/buddy-widget.tsx`(아이폰) · `ios-widgets.ts` · `buddy-android-widget.tsx` · `android-widgets.tsx` · 뿌리 `index.ts`
- `app.json`(두 플러그인) · `package.json`(`main`, `expo-widgets` · `react-native-android-widget` · `expo-file-system` · `expo-asset`) · `assets/widget-preview/buddy.png`

## 완료 조건

- [x] (SPEC-MAIN-09) 아이폰 작은 · 중간 · 잠금 화면 네모 · 한 줄, 안드로이드 4×2 늘이고 줄이기 — 설정과 코드 (폰 확인은 다음 빌드)
- [x] (SPEC-MAIN-09) 버디 얼굴 · 태어난 지 며칠 · 이번 주 챙길 일 · 다가오는 일 한 줄 · 오늘 할 루틴 셋 — `widget-data.test.ts`
- [x] (SPEC-MAIN-09) 루틴 줄 누르면 완료(체크 루틴만), 단계 · 재고 확인은 루틴 화면, 앱이 앞으로 오면 `pending` 반영
- [x] (SPEC-MAIN-09) 일주일 치 타임라인, 앱에서 바뀌면 바로 다시 넣기
- [x] (SPEC-MAIN-09) 그 밖의 곳은 홈 열기, 생일 없으면 「아기 생일을 넣으면 채워져요」, 이름 · 기록 · 광고 · 스트릭 없음
- [x] tsc · lint · node 시험, `npx expo config` 가 두 플러그인을 읽음
- [ ] 폰: TestFlight(아이폰) · 개발 빌드(안드로이드)에서 위젯 추가 · 자정 넘김 · 위젯 완료 → 앱 반영 확인 (Julian)
