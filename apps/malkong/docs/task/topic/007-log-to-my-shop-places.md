# 007 기록을 마이로 옮기고, 장보기를 살 곳별로

> 상태: 구현 완료 (2026-10-15) — 웹에서 확인
> 근거: [shop](../../menu-spec/shop.md) SPEC-SHOP-01 · 02 · 03 · [my](../../menu-spec/my.md) SPEC-MY-08 · [log](../../menu-spec/log.md) ·
> [decisions/027](../../decisions/027-log-under-my-shop-by-place.md)

## 목표

Julian(2026-10-15): 「기록은 두는 게 맞을까? 장보기가 택배 주문만 있는 것 같은데, 이유식 장보기 · 다이소 물품 구매 같은 것도 있잖아」 → 제안에 「ㅇㅇ」.

## 정한 것

- 기록 화면을 `(tabs)/log.tsx` 에서 `src/app/log.tsx`(쌓이는 화면, 머리줄 「기록」)로 옮기고, 마이에 「기록」 줄. 기록 알림은 정한 적이 없으면 꺼짐
- 홈의 「태어난 지 며칠」을 기록 화면과 같게 태어난 날을 1일로 센다(전에는 하루 적게 보였다)
- 살 곳은 `todo.store` 칸을 쓴다. 주문한 뒤에는 그 칸에 주문한 곳이 들어갈 수 있어서, 주문한 것의 살 곳은 늘 「온라인」으로 본다
- 묶음 순서: 매장(칩 순서 — 최근 쓴 곳) → 온라인 → 기타. 살 곳을 안 정한 묶음 이름은 「기타」, 칩은 「선택 안 함」
- 매장 지난번 목록: 그 매장에서 마지막으로 완료한 날 같이 완료한 것이 둘 이상일 때만
- 바닥 칸 칩은 할 일 탭과 같은 부품(`TodoInput` 의 options)으로 — 할 일 탭은 「내 할 일」 · 직접 만든 주제, 장보기는 「선택 안 함」 · 살 곳

## 손댄 파일

```
src/app/log.tsx(옛 (tabs)/log.tsx) · _layout.tsx · (tabs)/_layout.tsx · (tabs)/my.tsx · (tabs)/index.tsx · (tabs)/shop.tsx · (tabs)/todo.tsx
src/components/todo/shop-item-sheet.tsx(새로) · order-sheet.tsx · todo-input.tsx · src/data/todos.ts · preferences-context.tsx
docs/decisions/027 · menu-spec/shop.md · log.md · my.md · architecture/main-design.md · README.md
```

## 완료 조건

- [x] 탭이 홈 · 할 일 · 장보기 · 마이이고, 마이 → 기록으로 기록 화면이 열린다 — SPEC-MY-08
- [x] 장보기가 살 곳별로 묶이고, 「다이소에서 …」를 읽고, 「주문했어요」는 온라인 묶음에만 — SPEC-SHOP-01 · 02
- [x] 매장 지난번 목록 다시 담기 — SPEC-SHOP-03
- [x] `npx tsc --noEmit` · `npx expo lint` 통과

## 확인

- 품질 검사: `npx tsc --noEmit` 0 · `npx expo lint` 0 · `npx expo export --platform web` 성공
- 웹(390px, Playwright): 탭 넷. 「다이소에서 아기 수납함」 「다이소에서 이름 스티커」 「마트에서 애호박」 「마트에서 쌀가루」, 온라인 칩으로 「기저귀 5단계」 →
  다이소 2 · 마트 2 · 온라인 1(주문했어요) · 기타 1(전에 적은 물티슈). 애호박 · 쌀가루 체크 → 「다시 담기」에 「마트 지난번 목록 2개」.
  바닥 칩 「선택 안 함 · 온라인 · 마트 · 다이소」, 칩을 고르면 칸 안내가 「온라인에서 살 것 추가」
