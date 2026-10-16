# 009 가족과 함께 — 할 일 · 리스트 · 루틴 맞추기와 「누가 했는지」

> 상태: 구현 완료 — 운영 배포 전 (2026-10-16). 배포는 Julian 승인 뒤
> 근거: [topic](../../menu-spec/topic.md) SPEC-TOPIC-08 · [main](../../menu-spec/main.md) SPEC-MAIN-04 · [my](../../menu-spec/my.md) SPEC-MY-05 ·
> [constitution](../../constitution.md) 7 · [decisions/021](../../decisions/021-family-by-invite-code.md) · [028](../../decisions/028-assistant-today-routines.md)

## 목표

Julian(2026-10-16): 아내와 캘린더 앱에서 그날 할 일을 만들어 같이 보던 것을 육아버디로 — 같은 루틴 · 할 일 · 리스트를 보고, 누가 했는지 보인다.
이 task 가 끝나면 가족 공유를 켠 폰끼리 할 일 · 리스트(살 것 · 준비할 것) · 루틴과 그 기록이 맞춰지고, 「08:10 아빠 했어요」처럼 누가 했는지 보인다.

## 정한 것

- **서버**: `/v1/family/sync` 에 `items` 칸을 더한다 — `{kind: topic | todo | routine | routineLog, id, updatedAt, deleted, data}`.
  서버는 내용(data)을 읽지 않고 기록 · 빠른 기록과 같은 표(`family_record`) · 같은 번호(seq) · 같은 규칙(늦게 고친 쪽이 이긴다)으로 맞춘다. 한 번에 2000줄.
  옛 앱은 `items` 를 보내지 않으니 그대로 동작하고, 옛 서버는 `items` 를 돌려주지 않으니 앱은 그때 올린 때를 넘기지 않는다
- **무엇을**: 할 일 전부(내 할 일 · 앱이 채운 것 · 장보기 · 직접 만든 목록), 직접 만든 주제(목록), 루틴, 루틴 기록
- **기본 주제는 폰마다 id 가 다르다** — 할 일을 보낼 때 주제의 kind 를 함께 싣고(`topicKind`), 받는 폰은 기본 주제면 자기 폰의 같은 kind 주제로 옮겨 넣는다.
  직접 만든 주제는 id 그대로
- **앱이 채운 할 일**(기념일 · 사이즈)은 폰마다 따로 만들어져 id 가 다르다 — 받은 줄의 `ref` 와 같은 줄이 내 폰에 있으면 그 줄에 덮어쓴다
- **지운 것**: 할 일 · 루틴 기록을 지우면 지운 표시를 올린다(지금의 지운 표시 목록을 그대로). 루틴 · 주제는 지우지 않고 숨김이라 그대로 맞춰진다
- **누가 했는지**: 폰마다 「가족 안에서 부를 이름」(엄마 · 아빠 · 할머니 · 할아버지 · 직접)을 가족 화면에서 정한다. 할 일을 완료하거나 루틴을 하면 그 이름을 줄에 남긴다
  (`todo.done_by`, `routine_log.by`). 가족 공유를 켰을 때만 화면에 「08:10 아빠 했어요」, 장보기 완료에 「아빠 · 다이소」
- **맞추는 때**: 지금처럼 앱을 열 때 · 앱으로 돌아올 때 · 바꾸고 1.5초 뒤. 할 일 · 루틴 쪽은 가족 쪽을 직접 부르지 않고 「바뀌었어요」 신호(`sync-bus.ts`)로 잇는다(화면 묶음 순서가 가족 → 할 일 → 루틴이라서)
- **알림**: 맞춘 뒤 배우자가 한 루틴 기록이 들어오면 내 폰의 그날 알림이 사라진다. 다만 내 폰이 알림 시각 전에 맞춰져야 한다 — 앱이 꺼져 있으면 서버가 깨울 수 없다
  (기기 토큰을 서버에 두지 않는다). 그래서 「배우자가 먼저 하면 내 알림 취소」는 내 폰이 그 전에 앱을 한 번 열었을 때만이다 — Julian 에게 알린다
- **동의 문구**: 가족 공유 동의 글에 할 일 · 리스트 · 루틴을 더한다(헌장 7). 이미 켠 폰은 다시 묻지 않는다(출시 전, 가족 공유를 쓰는 폰은 Julian 집뿐)
- **배포**: 서버를 바꾸므로 운영 배포가 필요하다 — 시험과 로컬 확인을 마친 뒤 Julian 승인을 받고 배포한다

## 완료 조건

- [x] 서버: items 를 받고 돌려준다, 늦게 고친 쪽이 이긴다, 지운 표시가 간다 — `uv run pytest` · ruff 통과
- [x] 앱: 할 일 · 주제 · 루틴 · 루틴 기록을 싣고 받아 적용한다(기본 주제 kind 로 옮기기, ref 로 합치기) — 단위 시험
- [x] 가족 화면에서 「가족 안에서 부를 이름」을 정하고, 루틴 · 할 일 완료에 남고 보인다
- [x] `npx tsc --noEmit` · `npx expo lint` 통과
- [ ] 운영 배포(Julian 승인 뒤) 후 두 폰에서 확인 — Julian

## 손댄 파일

```
server/app/domain/family/schema.py(ItemIn · items) · service.py · server/tests/test_family.py(시험 둘)
src/data/family-items.ts · family-items.test.ts(새로) · family.ts(items 싣기 · 적용 · 이름) · sync-events.ts(가족 폰에서 바뀜 신호) · api.ts ·
todos-context.tsx · routines-context.tsx(맞추기 요청 · 지운 표시 · 누가 · 다시 읽기) · db.ts · db.web.ts(done_by · by) · todos.ts · routine.ts(firstBy)
src/app/family.tsx(가족 안에서 부를 이름 · 동의 글) · (tabs)/index.tsx(「아빠 했어요」) · src/components/todo/todo-item.tsx(「엄마 완료」)
docs/architecture/api-contract.md · backend.md · menu-spec/topic.md(SPEC-TOPIC-08) · main.md · my.md(SPEC-MY-05)
```

## 확인

- 서버: `uv run ruff check .` · `uv run ruff format --check .` 통과, `uv run pytest` 409개 통과(새 시험 둘: items 가 기록 · 빠른 기록과 갈라서 오고
  표시가 새지 않는다 · 늦게 고친 쪽이 이긴다 · 지운 루틴 기록이 간다, 모르는 kind · 너무 큰 data 는 422). 저장소 SQL 은 바꾸지 않아 Postgres 시험은 돌리지 않았다
- 앱: `npx tsc --noEmit` 0 · `npx expo lint` 0 · 단위 시험 35개 통과(새 다섯: 올릴 것 · 기본 주제 kind 로 옮기기 · 늦게 고친 쪽과 지운 표시 · ref 로 합치기 ·
  루틴과 기록 · 누가 · 타이머는 내 폰 것)
- 내 PC 끝에서 끝까지(메모리 저장소 서버 — 운영 DB 를 쓰지 않으려고 `MALKONG_DATABASE_URL` 을 비우고 띄움, 웹 창 둘을 두 폰으로):
  아빠 창에서 가족 만들기 · 이름 「아빠」, 엄마 창에서 초대 코드로 들어가기 · 「엄마」 → 아빠가 목욕 루틴을 추가해 했어요, 「다이소에서 아기 수납함」 →
  엄마 창을 다시 여니 오늘에 「목욕 · 13:47 아빠 했어요」, 리스트에 수납함 → 엄마가 수납함 체크 → 아빠 창 리스트 완료에 「다이소 · 엄마 완료」

## 남은 것

- **운영 배포(Julian 승인 필요)** — 서버를 바꿨다. 배포 전에는 앱이 items 를 보내도 옛 서버가 버리고, 앱은 올린 때를 넘기지 않아 배포 뒤 첫 맞추기에 한꺼번에 올라간다
- 두 폰에서 확인 — Julian(아이폰) · 아내분 폰
- 배우자가 먼저 하면 내 알림이 지워지는 것은 내 폰이 알림 시각 전에 맞춰졌을 때만이다(서버가 폰을 깨우지 않는다 — 기기 토큰을 서버에 두지 않기로 했다)
