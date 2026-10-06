# 003 일정 탭 — 고른 날은 줄로, 브리핑은 상세 화면으로

> 상태: 완료 (2026-10-06)
> 근거: SPEC-GROW-01 「고르기」(이 task 에서 정의를 고친다) · SPEC-HOME-06 · 08 · SPEC-HOME-07 「읽음」 · [home/010](../home/010-readable-briefing-and-lists.md)

## 목표

home/010 으로 카드 안은 읽기 쉬워졌지만, 고른 날 아래에 브리핑 · 주간 · 월간 카드가 통째로 놓여 탭이 여전히 길다.
Julian(2026-10-06): 「일정도 상세 뎁스로」. 탭의 고른 날에는 **한 줄 요약**만 두고, 카드는 눌러 들어가는 상세 화면에서 본다.

## 정한 것

- **고른 날 카드**(`DayView`): 줄로 — 「오늘 브리핑 · (요약)」 「주간 브리핑 · 이번 주 일정」 「월간 브리핑 · 5개월이 됐어요」
  (누르면 상세) → 이날 무렵 일정(그 자리에서 「했어요」, 그대로) → 이날 남긴 기록(그대로)
- **상세 화면** `/briefing?day=<날짜>&kind=daily|weekly|monthly` — 머리글은 「오늘 브리핑」 · 「10월 5일 브리핑」 · 「주간 브리핑」 ·
  「월간 브리핑」. 안은 지금의 `BriefingCard` · `WeeklyCard` · `MonthlyCard` 그대로(완료 알리기 · 되돌리기 띠 포함).
  열면 알림함의 그 줄을 읽음으로 한다(SPEC-HOME-07 읽음)
- **들어가는 길**: 홈 요약 카드의 단추(「자세히 보기」) · 홈 카드의 주간 · 월간 줄 · 알림함 줄 · 일정 탭 고른 날의 줄 — 모두 상세 화면으로.
  달력에서 날을 고르는 것은 그대로 탭 안에서
- 여정은 탭에 그대로 — 고른 날이 짧아져 한 번만 내리면 보인다

## 손댈 파일

```
src/app/briefing.tsx                    상세 화면(새 파일) · _layout.tsx 등록
src/components/schedule/day-view.tsx    카드 대신 줄
src/data/schedule.ts                    briefingHref()
src/components/briefing-card.tsx · src/app/(tabs)/index.tsx · src/app/inbox.tsx   들어가는 길
docs/menu-spec/growth.md · home.md      SPEC-GROW-01 고르기 정의, HOW
```

## 단계

1. ~~상세 화면과 href~~ — **완료.** `src/app/briefing.tsx`(머리글은 종류 · 날짜에 따라, 완료 알리기 · 되돌리기 띠 · 열면 읽음),
   `schedule.ts` 의 `briefingHref()` · `inboxCardHref()`
2. ~~고른 날을 줄로~~ — **완료.** `DayView` — 「오늘 브리핑 · (요약)」 「주간 브리핑 · …」 「월간 브리핑 · …」 줄, 일정 · 기록은 그대로
3. ~~들어가는 길~~ — **완료.** 홈 카드 단추(「자세히 보기」) · 홈 카드 주간 · 월간 줄 · 알림함 줄 · 일정 탭 줄 → 모두 `/briefing`
4. ~~문서~~ — **완료.** growth.md SPEC-GROW-01 고르기 정의 · HOW, home.md SPEC-HOME-06 · HOW
5. ~~확인~~ — **완료.** tsc · lint 통과. 웹판 390px — 일정 탭은 달력 · 줄 둘 · 여정이 첫 화면에 다 보인다. 상세는
   `/briefing?day=2026-10-6&kind=daily` · `&kind=monthly&month=5` 로 열리고 카드가 그대로 나온다. 모델 호출 0

## 완료 조건

- [x] 일정 탭 고른 날에 카드가 통째로 놓이지 않는다 — 줄 하나씩
- [x] 상세 화면에서 완료 알리기와 되돌리기가 된다
- [x] 상세 화면을 열면 알림함의 그 줄이 읽음이 된다
- [x] 홈 · 알림함 · 일정 탭 어디서 들어가도 같은 상세 화면이다
- [x] tsc · lint 통과, 전후 화면
