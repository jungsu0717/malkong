# 001 할 일 탭 — 주제 · 오늘 할 일 · 두 번 터치 적기 · 접종 · 검진 할 일, 옛 탭 걷어 내기

> 상태: 구현 완료 (2026-10-15) — 웹에서 확인. 할 일 알림 · 폰 저장은 Julian 이 아이폰(Expo Go)에서 확인
> 근거: [topic](../../menu-spec/topic.md) SPEC-TOPIC-01 · 02 · 03(한 줄 적기와 날짜 읽기까지) · 07 · 09(할 일 알림) ·
> [log](../../menu-spec/log.md) SPEC-LOG-06 · [constitution](../../constitution.md) 1 · 2 · 4 · 5 · 6 · [decisions/024](../../decisions/024-topic-todo-no-ai-answers.md)

## 목표

Julian(2026-10-15): 「플랜모리에서 얻은 아이디어를 육아버디에 녹이자 — 주제를 정해 놓고 할 일을 하는 게 차별점이고, 지금은 육아에만 집중하자.」
이 task 가 끝나면 Julian 이 아이폰(Expo Go)에서 탭 셋(기록 · 할 일 · 마이)으로 기록하고, 주제별 할 일을 적고 체크하고,
다음 접종 · 검진이 할 일로 보이는 것을 확인할 수 있다.

## 정한 것

- 탭 셋: 기록(첫 화면) · 할 일 · 마이. 버디(`chat`) · 우리 아기(`baby`) · 일정(`schedule`) 탭과 그 화면(`briefing` · `inbox` · `knowledge` · `records`)은 걷어 낸다.
  쓰던 코드는 지우되 git 기록에 남는다. 서버의 `/v1/ask` 는 이 task 에서 건드리지 않는다(앱에서 부르지 않게만)
- 기기 DB 에 `topic` · `todo` 표를 더한다. 끝낸 표시는 따로 표를 두지 않고 `todo.done_at` 칸으로 — 반복 할 일은 새 줄로 쌓으면 되므로 더 단순하다.
  라벨 · 붙여 넣은 원문 · 고친 값 표는 그 기능의 task 에서
- 기본 주제는 SPEC-TOPIC-01 대로 처음 실행할 때 만든다(이유식은 생후 5개월부터 보이게). 주제를 못 고른 한 줄이 들어갈 「그 밖의 할 일」을 더했다
- 할 일 탭 첫 화면에서 적으면 제목 낱말로 주제를 짐작하고(분유 → 분유 · 수유, 세제 사기 → 장보기), 날짜가 없으면 오늘 할 일로 둔다.
  어디에 넣었는지 칸 위에 2.5초 보인다. 「주문 · 사기 · 구매」가 들어가면 살 것으로 표시해 장보기에도 모인다
- 오늘 할 일에는 지금 기간인 접종 · 검진만 — 지난 일정까지 올리면 기록이 없는 집은 목록이 넘친다. 지난 것은 접종 · 검진 주제 안에 접어 둔다
- 「기록이 사흘 비면」 카드와 알림(옛 SPEC-BABY-07)은 걷어 냈다 — 대화 · 알림함에 묶여 있었고, 헌장 4(다그치지 않는다)와도 맞다
- 날짜 읽기(「내일」, 「금요일」, 「오전 10시」, 「10/20」)는 규칙으로, 단위 시험을 붙인다
- 접종 · 검진 할 일은 지금의 `src/data/schedule.ts` 계산을 그대로 써서 보여 준다
- 기록 탭 요약 카드에 「오늘 할 일 N」 한 줄(SPEC-LOG-06)
- 옛 헌장 번호를 가리키던 코드 주석(`헌장 2` → 5, `헌장 5` → 4 등)을 함께 고친다

## 손댄 파일

```
src/app/(tabs)/_layout.tsx · (tabs)/todo.tsx(새로) · topic/[id].tsx(새로) · (tabs)/index.tsx(요약 줄) · (tabs)/my.tsx · _layout.tsx · log-stats.tsx · notifications.tsx
src/data/todos.ts · todos-context.tsx · due-parse.ts · due-parse.test.ts · checkup-todos.ts(새로) · db.ts · db.web.ts · notifications.ts(.web)
src/components/todo/todo-item.tsx · todo-input.tsx · todo-sheet.tsx · topic-sheet.tsx · topic-icons.ts(새로) · animated-icon.tsx(스플래시 문구)
지움: (tabs)/chat · baby · schedule, briefing · inbox · knowledge · records 화면과 거기에만 쓰던 30개 파일(대화 · 알림함 · 지식 지도 · 브리핑 · 기록 요청)
tsconfig.json(allowImportingTsExtensions — 시험 파일이 ./due-parse.ts 로 가져온다)
docs/architecture/backend.md 「기기 DB 스키마」 · menu-spec/topic.md · menu-spec/log.md
```

## 완료 조건

- [x] 탭이 기록 · 할 일 · 마이 셋이다 — main-design 「구조」
- [x] 처음 실행하면 기본 주제가 있고, 주제마다 끝낸 수 / 전체 수가 보인다 — SPEC-TOPIC-01
- [x] 할 일 탭 맨 위에 오늘 할 일이 보이고, 누르면 끝냄 · 다시 누르면 되돌림, 끝낸 것은 지워지지 않는다 — SPEC-TOPIC-02
- [x] 입력칸 누르기와 완료로 할 일이 생기고, 「내일 오전 10시 분유 주문」이 내일 10:00 으로 읽힌다 — SPEC-TOPIC-03
- [x] 지금 기간 · 다가오는 접종 · 검진이 접종 · 검진 주제에 보이고 「했어요」 단추가 있다 — SPEC-TOPIC-07
- [ ] 알림 시각이 있는 할 일은 그 시각에 알림이 온다(허락은 첫 알림 시각을 넣을 때) — SPEC-TOPIC-09. 웹에는 알림이 없어 폰에서 확인(Julian)
- [x] 기록 탭 요약 카드에 오늘 할 일 수가 보인다 — SPEC-LOG-06
- [ ] 앱을 껐다 켜도 할 일과 끝낸 표시가 그대로다 — 웹(localStorage)에서는 확인, 폰(sqlite)은 Julian
- [x] `npx tsc --noEmit` · `npx expo lint` 통과, 날짜 읽기 단위 시험 7개 통과

## 확인

- 품질 검사: `npx tsc --noEmit` 0 · `npx expo lint` 0 · `node --test src/data/due-parse.test.ts` 7개 통과(상대 날짜 · 요일 · 이번 주 / 다음 주 ·
  지난 날짜는 내년 / 다음 달 · 시각만 · 「4단계」 「3일 치」 같은 숫자는 그대로) · `npx expo export --platform web` 성공
- 웹(390px, Playwright, 생후 4개월로 맞춤):
  - 기록 탭 요약 카드에 「오늘 할 일 2개」(지금 기간 접종 · 검진 둘), 탭은 기록 · 할 일 · 마이
  - 할 일 탭: 「내일 오전 10시 분유 주문」 → 분유 · 수유(0 / 1), 「분유 · 수유에 넣었어요」. 「젖병 소독」 → 오늘 · 분유 · 수유.
    「세제 사기」 → 오늘 · 장보기 · 살 것. 누르면 끝냄(그어지고 아래로, 1 / 2), 다시 누르면 되돌림
  - 분유 · 수유 주제: 할 일 「분유 주문 · 내일 10:00 · 살 것」, 시작 목록(이미 있는 분유 주문은 빠짐), 넣기 → 할 일로, 끝낸 것
  - 장보기 주제: 세제 사기와 분유 · 수유의 분유 주문이 함께 보인다
  - 접종 · 검진 주제: 지금 기간 둘(했어요), 다가오는 둘(D-56 · D-146), 지난 것 접기(「했다면 알려 주세요」)
  - 찾은 것과 고친 것: 웹의 한 줄 입력칸이 기본 너비 때문에 넣기 단추를 24px 밀어내던 것(`minWidth: 0`)
- 콘솔 오류: 앱 안 이동에서는 0. 시험 서버에 깨끗한 주소가 없어 `/todo` 를 바로 열었을 때의 404 와 그에 따른 hydration 오류만 있었다(시험 준비 탓)

## 남은 것 (다음 task)

- 약관 · 개인정보 처리방침 · 자주 묻는 질문(`src/data/legal.ts`)이 아직 AI 답 기준이다 — 출시 전에 새 방향으로 다시 쓴다
- 마이의 「육아버디 스토리」 만화와 스플래시 문구 — 스플래시는 브리프의 슬로건 초안(「육아의 챙길 것, 버디가 기억해요」)으로 바꿔 뒀고, 만화는 다시 만든다
- 아침 알림에 그날 할 일 수 넣기(SPEC-TOPIC-09 둘째 줄) — 지금은 고정 문구
- 가족 맞추기에 주제 · 할 일 싣기(SPEC-TOPIC-08), 서버 `/v1/ask` 내리기
