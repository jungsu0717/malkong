# 032 물어보기 에이전트 서버 — /v1/agent (Gemini)

> 상태: 완료 (2026-11-09) · 운영 배포 revision 00027
> 근거: [main](../../menu-spec/main.md) SPEC-MAIN-12 · SPEC-MAIN-13
> 시안: https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「물어보기 에이전트 6판 시안 (2026-11-09)」 · 결정: [040](../../decisions/040-ask-agent-reads-the-day.md)

## 목표

물어보기 창의 한 번 묻기를 모델 한 번 호출로 처리한다. 문장, 최근 대화 몇 줄, 보고 있는 날의 기록(동의했을 때만), 선택한 기록을 받아
답 글과 바꿀 것 목록(추가, 수정, 삭제, 일정)을 돌려준다. 저장과 반영은 앱이 사람 확인을 받아서 한다.

## 계약 — POST /v1/agent

기기 키(`X-Device-Key`)가 있어야 한다. 이름은 바깥에서 camelCase(ApiModel 별칭), 안에서 snake_case.

요청

| 칸 | 모양 | 뜻 |
|---|---|---|
| `text` | 글 1~300자(앞뒤 공백 제거) | 이번에 쓴 문장 |
| `now` | 시간대가 붙은 ISO | 기기의 지금 |
| `history` | `{role: "user" \| "app", text: 글 1~600자}` 최대 6개, 기본 빈 목록 | 바로 앞 대화(오래된 것부터) |
| `day` | `YYYY-MM-DD` 또는 null | 보고 있는 날. 기록을 보낼 때만 |
| `records` | 아래 기록 최대 150개, 기본 빈 목록 | 그날 기록. 동의하지 않았으면 빈 목록 |
| `selected` | 기록의 `ref` 또는 null | 흐름에서 누른 기록 |

기록 한 줄(`ContextRecord`): `ref`(`r` 뒤에 숫자 1~3자리, 예 `r12`), `kind`(parse 의 RecordKind 와 같은 9가지), `startAt`(시간대 붙은 ISO),
`endAt`, `amount`, `side`, `diaper`, `color`, `title`(루틴 이름이나 메모 글, 300자까지), `note`(기록에 붙인 메모, 300자까지), `by`(남긴 사람의 가족 이름, 20자까지). 비어도 되는 칸은 모두 null 기본.
`selected` 가 records 에 없는 ref 이면 null 로 본다. ref 가 겹치면 422.

응답

| 칸 | 모양 | 뜻 |
|---|---|---|
| `type` | `answer` \| `changes` \| `question` \| `health` \| `unknown` | |
| `reply` | 늘 null | 모델이 쓴 문장은 내보내지 않는다(2026-11-09 실제 호출 뒤 바꿈) — 답 문장은 앱이 highlight 의 기록으로 쓴다 |
| `question` | parse 의 FindQuestion 또는 null | type 이 question 일 때만 — 며칠에 걸친 합계 · 평균 · 횟수는 앱이 센다 |
| `actions` | 아래 바꿀 것 최대 10개 | type 이 changes 일 때만 |
| `highlight` | ref 목록 최대 10개 | 답이 가리키는 기록(answer, changes) |

바꿀 것 한 줄(`AgentAction`) — 칸이 평평하다: `op`(`add` \| `update` \| `delete` \| `plan`), `ref`, `kind`, `startAt`, `endAt`, `minutes`, `amount`, `side`, `diaper`, `color`, `title`, `note`, `hasTime`.

- `add`: 새 기록 하나. parse 의 기록 한 줄과 같은 규칙(`_clean` 그대로 — 종류에 없는 칸은 비우고, 루틴 · 메모는 title 이 있어야 한다, 때는 기기 시간대로). `ref` 는 비운다.
- `update`: `ref` 가 보낸 기록에 있어야 한다. 서버가 `kind` 를 그 기록의 kind 로 채우고, 그 종류에 있는 칸 중 바뀌는 칸만 남긴다(parse 의 FIELDS 에 `note` 를 더해서 — note 는 breast, formula, diaper, sleep, temp, weight, height 에만, memo 는 title 이 글). 바뀌는 칸이 없으면 버린다.
- `delete`: `ref` 가 보낸 기록에 있어야 한다. 서버가 `kind` 를 채우고 나머지 칸은 비운다.
- `plan`: 할 일 · 일정. `title`, `startAt` 이 있어야 하고 `hasTime`(시각을 말했으면 true, 날만 말했으면 false, 없으면 true). 나머지 칸은 비운다.
- 맞지 않는 줄은 버린다. changes 인데 남은 줄이 없으면 unknown. 글 칸에 혼잣말 흔적이 있으면 그 칸을 버린다.
- highlight 는 보낸 ref 만 남긴다. health 와 unknown 은 reply · actions · highlight 를 비운다(앱이 정해 둔 글을 보인다). question 이면 actions 를 비운다.

오류: 401(기기 키), 422(형식), 429 `LIMIT_EXCEEDED`(기기마다 하루 상한, 설정 `agent_per_device_per_day` 기본 200), 503 `MODEL_UNAVAILABLE`(키 없음, 모델 실패).

## 정한 것

- 모델은 parse 와 같은 `gemini-3.1-flash-lite`, 같은 키. 생각 수준은 `low`(가리키는 말과 하루 안 비교를 맞히려고 parse 의 minimal 보다 한 단계 위)
- 받은 문장, 기록, 대화, 모델 답은 저장하지도 로그에 남기지도 않는다. 로그에는 실패 종류와 답 글자 수만
- `/v1/parse` 는 빌드 13 이 쓰니 그대로 둔다

## 완료 조건

- [x] (SPEC-MAIN-12 · 13) `/v1/agent` 계약대로, 가짜 모델 시험
- [x] 문서: api-contract, backend
- [x] 모델 고르기 — 3.1 Flash-Lite 그대로, 부르는 방식을 바꿈(Julian 「ㅇㅇ」, 아래 「확인」)
- [x] 운영 배포(Julian 「ㅇㅇ 승인」 — 2026-11-09, revision 00027-rdz, /health · 지식 판 2026.10.5 · /v1/agent 401(키 없이) · /privacy 에 「물어보기에서 기록 함께 읽기」)

## 확인

- 가짜 모델 시험 `tests/test_agent.py` 56개, ruff · format · pytest 131개 통과
- 실제 호출 12번(결제한 키, 2026-11-09) — 시안의 문장 여섯을 두 번. `gemini-3.1-flash-lite` + 생각 low, 한 번에 입력 약 3,450 토큰, 생각과 답 합쳐 700 토큰 안팎, 1~3.5초
  - 맞음: 「지워 줘」 → 삭제, 「이번 주 밤잠 평균은?」 → 찾을 조건, 「10분 앞으로 옮기고」의 수정
  - 틀림: 「내일 아침 9시에 2개월 접종 일정」 → 일정 이름 칸에 문장을 쓰거나 때를 빠뜨림(두 번 모두), 「이 기록에 메모: …」 → 메모를 title 에 씀,
    「앞 수유보다 많이 먹은 거야?」 → 답은 맞지만 어색한 말을 덧붙이거나(「잘 먹었어요네요」) 빈 답, 「아까 낮잠 몇 시에 깼어?」 → 같은 말을 되풀이하다 3,600 토큰에서 끊김(9초)
  - 고친 것: 스키마에 칸마다 뜻, 일정 규칙 한 줄, title 을 기록 메모로 읽기, 답 토큰 상한 4,000 → 1,500. 고친 뒤 다시 부르지는 않았다(측정 두 번을 채워서)

- 모델 비교 12번(Julian 「ㅇㅇ」, 2026-11-09) — 같은 문장 여섯을 `gemini-3.5-flash-lite` 와 `gemini-3.8-flash` 로, 생각 low, 상한 1,500
  - 둘 다 맞음: 「지워 줘」, 「이번 주 밤잠 평균은?」, 「10분 앞으로」의 수정. 3.5 Flash-Lite 는 「이 기록에 메모」도 맞음(title 을 메모로 읽는 보완 덕)
  - 둘 다 틀림: 일정 이름 칸에 모델이 스스로 생각한 말을 씀(「2개월 접종Parse error: … No, wait」), 답 글에 같은 말을 되풀이하거나 이상한 말을 덧붙임
    (「적어요시작해요와…」, 「13:10에 깼어요.단13:10에 깼어요.단…」). 3.8 Flash 의 첫 답은 10초
  - 두 모델 모두 생각 토큰이 0 으로 나왔다. 정해진 JSON 모양으로 바로 답하게 하니 모델이 생각을 답 칸 안에서 하는 것으로 보인다 — 모델 크기보다 부르는 방식의 문제
- 부르는 방식을 바꾼 뒤 6번(Julian 「ㅇㅇ」, 2026-11-09, `gemini-3.1-flash-lite` + 생각 low) — 모델은 기록과 바꿀 것만 고르고 답 문장은 앱이 쓴다.
  글 칸의 혼잣말은 서버가 버리고, 빠진 일정은 앱 규칙이 문장에서 읽는다(task today/022)
  - 여섯 모두 맞음(1.2~2.6초, 생각 90~380 토큰): 앞 수유 비교 → r13, r7 을 골라 앱이 「분유 120ml는 앞 수유(10:50, 140ml)보다 20ml 적어요.」,
    옮기기 → 13:40 수정(일정 이름 칸에는 또 혼잣말이 와서 서버가 버리고, 앱이 「2개월 접종 내일(11월 7일) 09:00」을 읽음), 지우기, 메모 → 기록 메모,
    이번 주 밤잠 평균 → 찾을 조건, 낮잠 몇 시에 깼어 → r11 을 골라 앱이 「12:00~13:10 잠 1시간 10분이에요.」
