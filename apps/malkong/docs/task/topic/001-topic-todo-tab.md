# 001 할 일 탭 — 주제 · 오늘 할 일 · 두 번 터치 적기 · 접종 · 검진 할 일, 옛 탭 걷어 내기

> 상태: 시작 전 — 헌장 · 제품 브리프 · topic SPEC 을 Julian 이 확인하고 SPEC 의 `미결:` 둘을 정한 뒤 시작한다
> 근거: [topic](../../menu-spec/topic.md) SPEC-TOPIC-01 · 02 · 03(한 줄 적기와 날짜 읽기까지) · 07 · 09(할 일 알림) ·
> [log](../../menu-spec/log.md) SPEC-LOG-06 · [constitution](../../constitution.md) 1 · 2 · 4 · 5 · 6 · [decisions/024](../../decisions/024-topic-todo-no-ai-answers.md)

## 목표

Julian(2026-10-15): 「플랜모리에서 얻은 아이디어를 육아버디에 녹이자 — 주제를 정해 놓고 할 일을 하는 게 차별점이고, 지금은 육아에만 집중하자.」
이 task 가 끝나면 Julian 이 아이폰(Expo Go)에서 탭 셋(기록 · 할 일 · 마이)으로 기록하고, 주제별 할 일을 적고 체크하고,
다음 접종 · 검진이 할 일로 보이는 것을 확인할 수 있다.

## 정한 것

- 탭 셋: 기록(첫 화면) · 할 일 · 마이. 버디(`chat`) · 우리 아기(`baby`) · 일정(`schedule`) 탭과 그 화면(`briefing` · `inbox` · `knowledge` · `records`)은 걷어 낸다.
  쓰던 코드는 지우되 git 기록에 남는다. 서버의 `/v1/ask` 는 이 task 에서 건드리지 않는다(앱에서 부르지 않게만)
- 기기 DB 에 할 일 쪽 표(`topic` · `todo` · `todo_label` · `todo_done`)를 더한다. 붙여 넣은 원문(`raw_input`)과 고친 값(`override`)은 그 기능의 task 에서
- 기본 주제는 SPEC-TOPIC-01 대로 처음 실행할 때 만든다(이유식은 생후 5개월부터 보이게)
- 날짜 읽기(「내일」, 「금요일」, 「오전 10시」, 「10/20」)는 규칙으로, 단위 시험을 붙인다
- 접종 · 검진 할 일은 지금의 `src/data/schedule.ts` 계산을 그대로 써서 보여 준다
- 기록 탭 요약 카드에 「오늘 할 일 N」 한 줄(SPEC-LOG-06)
- 옛 헌장 번호를 가리키던 코드 주석(`헌장 2` → 5, `헌장 5` → 4 등)을 함께 고친다

## 손댈 파일

```
src/app/(tabs)/_layout.tsx · (tabs)/todo.tsx(새로) · topic/[id].tsx(새로) · (tabs)/index.tsx(요약 줄)
src/app/(tabs)/chat.tsx · baby.tsx · schedule.tsx · briefing.tsx · inbox.tsx · knowledge.tsx · records.tsx (걷어 냄)
src/data/db.ts · db.web.ts(할 일 표) · todos.ts · topics.ts · due-parse.ts(새로) · notifications.ts(할 일 알림)
docs/architecture/backend.md 「기기 DB 스키마」
```

## 완료 조건

- [ ] 탭이 기록 · 할 일 · 마이 셋이다 — main-design 「구조」
- [ ] 처음 실행하면 기본 주제가 있고, 주제마다 끝낸 수 / 전체 수가 보인다 — SPEC-TOPIC-01
- [ ] 할 일 탭 맨 위에 오늘 할 일이 보이고, 누르면 끝냄 · 다시 누르면 되돌림, 끝낸 것은 지워지지 않는다 — SPEC-TOPIC-02
- [ ] 입력칸 누르기와 완료로 할 일이 생기고, 「내일 오전 10시 분유 주문」이 내일 10:00 으로 읽힌다 — SPEC-TOPIC-03
- [ ] 다음 접종 · 검진이 접종 · 검진 주제의 할 일로 보이고 「했어요」로 끝낼 수 있다 — SPEC-TOPIC-07
- [ ] 알림 시각이 있는 할 일은 그 시각에 알림이 온다(허락은 첫 알림 시각을 넣을 때) — SPEC-TOPIC-09
- [ ] 기록 탭 요약 카드에 오늘 할 일 수가 보인다 — SPEC-LOG-06
- [ ] 앱을 껐다 켜도 할 일과 끝낸 표시가 그대로다
- [ ] `npx tsc --noEmit` · `npx expo lint` 통과, 날짜 읽기 단위 시험 통과

## 확인

(작업 뒤에 적는다)
