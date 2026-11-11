# 029 12판 — 기록 단추를 넣고 빼는 줄, 루틴도 한 줄에, 시간을 비운 하루 초안

> 상태: 구현 완료 (2026-11-11) · 2단계(양을 적는 기록)까지 Julian 「다 올려」 — 서버 운영 배포와 빌드 19
> 근거: [main](../../menu-spec/main.md) SPEC-MAIN-08 · 16 · 03 · 결정: [046](../../decisions/046-record-bar-and-empty-draft.md)
> 시안: https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「12판 시안 — 기록 단추를 넣고 빼는 줄, 루틴도 한 줄에, 시간을 비운 하루 초안 (2026-11-11)」

## 목표

Julian(2026-11-11): 베이비타임처럼 위쪽 기록 단추를 넣고 빼는 줄, 「우리 루틴도 저 위쪽에 올려놓고 설정할때 반복을 물어보면」,
하루 초안은 「기록이 활발했던 날 기준으로 복사하고 … 시간 입력은 비워두고 빈 껍데기만」. 시안을 보고 「일단 해줘 보고 판단할게」.

## 정한 것

- 기록 단추 줄: 기록 종류와 루틴이 한 줄, 옆으로 밀기, 끝에 「편집」. 루틴 단추는 한 번 누르면 지금 완료(단계, 재고, 시간 재기는 그 시트). 이름을 누르면 루틴 편집
- 「기록 단추 편집」: −로 빼기, 손잡이로 순서, +로 넣기, 「완료」로 저장. 목욕, 터미타임, 놀이, 병원, 투약, 기타, 「직접 만들기」는 넣을 때 「반복할까요?」와 알림
- 루틴 「반복 안 함」(everyDays 0) — 오늘 할 루틴과 알림에서 빠지고, 루틴 화면에서는 「다른 날」 맨 뒤. 반복 고르기 창에도 「반복 안 함」을 더했다
- 흐름은 그날 한 루틴 완료를 모두 보인다(전에는 시간을 재는 루틴만)
- 하루 초안: 앞 7일 중 가장 바빴던 날(같으면 최근)을 빈칸으로 복사, 맨 위 「○월 ○일 기록으로 만든 초안 N개」와 「버리기」, 앞으로 올 것 줄의 점선 노드(목록은 맨 위 점선 줄)
- 빈칸 채우기 창: 양 · 걸린 시간, 「지금」 · 「어제처럼 10:30」 · 「직접 입력」, 「기록」 · 「초안에서 빼기」. 창이 노드 아래에 뜨면 노드가 화면 위쪽에 오게 스크롤한다
- 같은 종류를 기록하면 가장 가까운(2시간 안) 빈칸이 함께 채워진다. 눌러서 채운 기록은 그 칸에 묶어 두어 다른 칸을 지우지 않는다
- 초안은 그날 끝까지 폰에 저장, 다음 날 사라짐. 물어보기의 초안 카드는 「빈칸 N개」와 「버리기」, 입력 칸 안내 「빈칸을 채울 기록을 말해 주세요」
- 기록 단추 아이콘: 병원(구급상자), 투약(약), 기타(점 셋)

## 2단계 — 양을 적는 기록(Julian 「다 올려」)

- 새 기록 종류 여섯: 이유식(`solid`), 유축 수유(`pumped`), 유축(`pump`), 우유(`milk`), 물(`water`)은 ml 눈금과 메모, 간식(`snack`)은 때와 메모
- 「추가할 수 있는 단추」에 놓이고, 넣으면 줄에 그날 합계 ml 와 횟수(간식은 횟수와 마지막 시각). 흐름 노드는 옅은 코랄
- 유축 수유는 수유로 센다(「먹은 지」, 수유 횟수, 빈칸 맞추기). 하루 초안의 빈칸으로도 복사한다
- 물어보기 규칙이 「이유식 80 먹었어」 같은 말을 읽는다. 새 종류는 모델에 보내지 않는다(서버 모델 쪽 종류는 그대로)
- 가족 공유: 서버가 새 종류를 받고, 앱이 아는 종류만 내려보낸다(옛 앱에는 옛 종류만). 앱은 서버가 받는 종류만 올리고, 새 빌드로 처음 맞출 때 한 번 처음부터 받는다
- 처음 넷과 루틴만 줄 끝에 저절로 붙는다 — 새 기록 종류가 생겨도 줄이 저절로 길어지지 않는다

## 손댄 파일

```
src/data/record-bar.ts · record-bar.test.ts(새 파일) — 줄 순서, 뺀 단추, 추가할 수 있는 단추
src/components/flow/record-panel.tsx — 옆으로 미는 단추 줄과 「편집」
src/components/flow/record-bar-sheet.tsx(새 파일) — 기록 단추 편집, 반복 묻기
src/data/day-draft.ts · day-draft.test.ts — 빈칸 초안(가장 바쁜 날, 빈칸 맞추기, 채우기)
src/hooks/use-day-shells.ts(새 파일) — 초안 저장과 채우기 · src/components/flow/shell-popover.tsx(새 파일, draft-popover 지움)
src/components/flow/day-view.tsx · day-list.tsx · flow-graph.tsx(ShellNode) · ask-sheet.tsx · src/app/index.tsx
src/data/routine.ts · routine.test.ts · family-items.ts · routines-context.tsx · events-context.tsx · preferences-context.tsx
src/components/routine/repeat-picker.tsx · routine-icon.tsx · src/app/routines.tsx · src/data/agent-tools.ts
src/data/events.ts · event-summary.ts · day-flow.ts · day-facts.ts · add-parse.ts(+시험) · agent.ts · family.ts · api.ts
src/components/log/kinds.ts · log-sheet.tsx · src/app/records.tsx · src/components/growth/memo-sheet.tsx
server/app/domain/family/schema.py · service.py · tests/test_family.py
docs: decisions/046 · 041, main SPEC-MAIN-08 · 16 · 03, api-contract, README
```

## 완료 조건

- [x] 단추 줄을 옆으로 밀고 끝의 「편집」에서 빼기, 끌어서 순서, 넣기, 「완료」로 저장(웹)
- [x] 목욕 · 놀이 같은 단추를 넣을 때 「반복할까요?」와 알림, 반복 안 함 루틴은 오늘 할 루틴에 나오지 않음
- [x] 루틴 단추 한 번 = 지금 완료 한 줄
- [x] 「전체 기록 작성해줘」 → 가장 바쁜 날을 빈칸으로, 다시 켜도 남아 있음(웹)
- [x] 빈칸을 눌러 「지금」으로 기록, 위쪽 기저귀 단추로 기록하면 가까운 기저귀 빈칸이 함께 채워짐, 「오후 낮잠은 안 잤어」로 빈칸 빼기, 「버리기」(웹)
- [x] 앱 tsc · lint · 시험(189) · copy-check, 서버 ruff · pytest(145)
- [x] 2단계: 이유식을 줄에 넣고 기록 → 줄에 「80ml 1번」, 흐름에 「이유식 80ml」(웹)
- [x] 서버 운영 배포(revision 00031, `/health` 와 지식 판 2026.10.5 확인, openapi 에 `eventKinds` 와 새 종류)와 빌드 1.0.0 (19) EAS 에 올리고 TestFlight 자동 제출 — Julian 「다 올려」(2026-11-11)

## 확인

- 웹(2026-11-11, `/v1/agent` 는 막아 둠 — 모델 호출 없음). 시험 기록은 확인 뒤 지웠다
  - 단추 줄: 비타민D 를 맨 앞으로 끌기, 손톱 깎기 빼기, 체온 넣기, 터미타임(매일, 알림 10:00), 놀이(반복 안 함) 추가 → 줄 끝에 체온, 터미타임 「매일 10:00」, 놀이
  - 놀이 단추 → 놀이 완료 한 줄
  - 「전체 기록 작성해줘」 → 「11월 5일 기록이 가장 많아서 그날을 복사했어요」, 「빈칸 13개」. 오늘 할 루틴인 목욕은 빈칸으로 한 번 더 놓지 않음
  - 분유 120ml 빈칸 → 「지금 11:56」 → 분유 기록, 13개 → 12개. 기저귀 단추로 소변 → 10:35 대변 빈칸이 채워져 11개. 「오후 낮잠은 안 잤어」 → 15:25 낮잠 50분 빼서 10개
