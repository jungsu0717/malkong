# 010 기념 카드 공유 — 100일 같은 날 카드를 그림으로 만들어 보내기

> 상태: 완료 (2026-10-29) · 폰에서 공유 창 확인은 다음 TestFlight 빌드(새 네이티브 모듈)
> 근거: SPEC-STAGE-07 · 시안 https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「성장 제안 — 기념 카드」(2026-10-29, Julian 「좋게 바뀐 거면 적용해 줘」)

## 목표

기념일 당일 장면(task growth/008)을 가족에게 보낼 수 있게 한다. 부모가 캡처해 두고 싶은 날을 카드 한 장으로 만들어 주면
앱을 모르는 가족에게도 「육아버디」가 보인다.

## 정한 것

- 머리의 큰 글씨 아래 「공유하기」(기념일 당일에만) → 시트에 카드를 먼저 보여 주고, 시트의 「공유하기」로 그림을 만들어 공유 창을 연다
- 카드는 성장 탭 머리와 같은 그림(깃발 · 모빌 · 장난감 · 지금 자세의 버디)을 4:5 로 다시 놓았다. 360×450 을 기준으로 그려 화면 너비에 맞춰 키운다
- 그림은 `react-native-view-shot` 의 `captureRef`(1080×1350 PNG, 임시 파일), 공유는 `expo-sharing` 의 `shareAsync` — 둘 다 Expo 문서의 SDK 57 판 확인(2026-10-29)
- `expo-sharing` 설치가 app.json 에 플러그인을 더했다. 이 플러그인은 `ios.enabled` 를 켜야 공유 확장(새 iOS 타깃)을 만들고, 기본은 꺼져 있어 서명 설정이 늘지 않는다(소스 확인)
- 아기 이름은 넣지 않고 「우리 아기」로. 카드의 모서리는 각지게 그림으로 만들고, 시트에서만 둥글게 보인다

## 손댄 파일

```
src/components/growth/milestone-card.tsx  카드와 시트, 그림 만들기 · 공유
src/components/growth/growth-hero.tsx     「공유하기」, POSES · Bunting · Toys 내보내기(크기 조절)
src/app/(tabs)/growth.tsx                 시트 연결
package.json · app.json                   react-native-view-shot · expo-sharing
docs/menu-spec/stage.md                   SPEC-STAGE-07
```

## 확인

- 브라우저(오늘 100일인 아기)에서 머리의 「공유하기」 → 시트에 카드가 시안대로 보였다. 시트의 「공유하기」는 웹에서 그림 만들기까지 오류 없이 지나간다(웹에는 공유 창이 없다)
- tsc · lint · node 시험 · copy-check 통과

## 완료 조건

- [x] (SPEC-STAGE-07) 공유하기 단추 · 카드 시트 · 그림 만들기
- [ ] 폰: 공유 창에서 사진 저장과 메신저 보내기 (Julian, 다음 TestFlight)
