# 009 성장 탭에서 바로 — 발달 체크 카드, 이맘때 챙기면 좋은 일 카드

> 상태: 완료 (2026-10-29) · 폰 확인은 다음 TestFlight 빌드
> 근거: SPEC-STAGE-06 · 시안 https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「성장 제안」(2026-10-29, Julian 「좋게 바뀐 거면 적용해 줘」)

## 목표

Julian(2026-10-29): 「필요한 정보나 기능적으로도 개선이 됐으면 했어」. 성장 탭은 그림 아래가 들어가야만 보이는 줄 목록이었다 —
발달 체크는 「2 / 11」 숫자만, 시기에 맞는 준비 할 일은 할 일 탭 추천 안에만 있었다.

## 정한 것

- **발달 체크 카드** — 안 한 것 둘과 가장 최근에 한 것 하나(`checkPreview`), 「했어요」는 발달 체크 화면과 같은 기록(`toggleCheck`, 좋은 순간 `happyMoment`)
- **이맘때 챙기면 좋은 일 카드** — 할 일 추천의 지금 시기 묶음(`todoRecommend` 에 시기 이름 `label` 을 더함)에서 셋(`prepPreview`), 「+」로 내 할 일에 추가, 아래에 다음 시기 한 줄
- 방금 누른 줄은 자리를 지킨다 — 누르자마자 사라지거나 아래로 내려가 무엇이 됐는지 놓치던 것을 브라우저에서 확인하고 고쳤다
- 할 일 제목 비교는 `titleKey`(빈칸 무시) 하나로 — 할 일 추천 화면과 같은 셈
- 키 · 몸무게 기록과 성장 곡선은 넣지 않는다 — 기록 앱과 경쟁하지 않기(decisions/030 · 034), 숫자로 정상 판정하지 않기(제품 브리프 「하지 않는 것」)

## 손댄 파일

```
src/components/growth/growth-cards.tsx  CheckCard · PrepCard
src/app/(tabs)/growth.tsx               카드 둘, 목록은 성장 일기 · 알아 두면 좋아요
src/data/stage.ts(+ test)               checkPreview
src/data/recommend.ts(+ test)           todoRecommend label, prepPreview
src/app/todo-recommend.tsx              titleKey
docs/menu-spec/stage.md                 SPEC-STAGE-01 · 06
```

## 확인

- 브라우저(390×844, 생일 2026-07-22 — 오늘 100일 · 3개월)에서 카드 둘을 봤다. 「했어요」를 누르니 「1 / 13」, 그 줄이 「D+100」이 되고 성장 일기 줄에 나타났다.
  「+」를 누르니 내 할 일에 들어가고 줄은 체크로 그 자리에 있다
- tsc · lint · node 시험 · copy-check 통과

## 완료 조건

- [x] (SPEC-STAGE-06) 발달 체크 카드 · 이맘때 챙기면 좋은 일 카드
- [ ] 폰: 다음 TestFlight 빌드 (Julian)
