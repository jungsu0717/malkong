# API 계약 v0 — 앱 ↔ FastAPI

> 근거: [backend](backend.md)

인증은 익명 **디바이스 키**(설치 시 서버가 발급, 헤더 `X-Device-Key`)로 한다. 키는 사람 · 계정과 연결되지 않는다.
에러는 공통 형식 `{ code, message }`.
운영자(가족) 기기는 헤더 `X-As-User: 1` 을 더해 `/v1/entitlements` 를 일반 기기처럼 받을 수 있다
(일반 사용자로 보기 — [backend](backend.md) 운영자 절). 일반 기기의 이 헤더는 무시한다.

지금 서버가 하는 일은 기기 키, 기기 자격, 공공 지식(L1) 내려받기, 가족 공유, 문장 읽기, 물어보기 여섯이다. 질문 답변(`/v1/ask`) ·
보상형 광고 적립(`/v1/reward/ssv`) · 답변 피드백(`/v1/feedback`)은 2026-10-22 에 뺐다(아래 「뺀 것」).

## POST /v1/devices — 디바이스 키 발급

요청 본문 없음 → 201 `{ "deviceKey": "dk_..." }`.

```
평시     ▸ 앱은 처음 실행할 때 한 번 받아 기기 settings 에 두고, 이후 /v1 요청마다 X-Device-Key 로 보낸다.
평시     ▸ 서버는 키를 해시로만 저장한다. 키는 사람·계정과 연결되지 않는다 — 앱을 지우면 새 키를 받는다.
조건 위반 ▸ 한 연결 출처(IP)에서 하루 20개를 넘게 받으면 429 { code: "TOO_MANY_DEVICES" }.
```

## GET /v1/knowledge/version — L1 판 확인

응답: `{ "version": "2026.10.4" }`. 기기 키가 없어도 된다 — 공공 지식이라 숨길 것이 없다.
앱은 하루에 한 번 자기 판(번들 판과 받아 둔 판 가운데 새 것)과 비교한다. 판은 `연도.월.순번` 꼴이고 숫자 토막씩 비교한다.

## GET /v1/knowledge/bundle — L1 묶음 내려받기

응답: `{ "version": "2026.10.4", "items": [ ...항목 스키마 그대로... ] }` — 승인된 항목 **전부**(2026-10-22 에 165건).
항목은 [l1-knowledge-base](l1-knowledge-base.md) 「항목 스키마」 그대로라(`red_flag` 도 그대로) 앱이 번들 파일 자리에 그대로 바꿔 끼운다.
증분(`since` · `removedIds`)은 두지 않는다 — 묶음이 작아 통째로 받는 쪽이 지운 항목 관리까지 덜어 준다(task common/019).

```
평시 ▸ 앱은 받은 판이 자기 판보다 새 것이고 항목 규칙(출처 · 분류 · 월령 · id 중복)을 지킬 때만 바꿔 끼우고,
       번들과 같은 의료 게이트로 승인된 항목만 쓴다. 서버에 닿지 못하면 번들 그대로다.
```

## /v1/family — 가족 공유 (SPEC-MY-05)

요청 머리 `X-Device-Key` 필수 — 구성원의 정체가 기기 키 해시다. 로그인은 없다([decisions/021](../decisions/021-family-by-invite-code.md)).

| 호출 | 뜻 | 요청 · 응답 |
|---|---|---|
| `POST /v1/family` | 가족 만들기 | `{ consentedAt }` → 201 `{ familyId, inviteCode, members }`. 이미 가족이 있으면 409 `ALREADY_IN_FAMILY` |
| `POST /v1/family/join` | 초대 코드로 들어가기 | `{ code, consentedAt }` → `{ familyId, inviteCode, members }`. 404 `INVITE_NOT_FOUND` · 409 `FAMILY_FULL`(6명) · 409 `ALREADY_IN_FAMILY`(다른 가족) · 429 `TOO_MANY_ATTEMPTS`(기기마다 하루 20번) |
| `GET /v1/family` | 내 가족 | `{ familyId, inviteCode, members }`. 없으면 404 `NOT_IN_FAMILY` |
| `DELETE /v1/family/me` | 나가기 | 204. 마지막 구성원이 나가면 가족과 데이터를 지운다 |
| `POST /v1/family/sync` | 아기 · 기록 · 빠른 기록 · 할 일 · 루틴 · 메모 맞추기 | `{ since, baby?, records[], events[], items[] }` → `{ seq, baby, records[], events[], items[], itemKinds, members }` |

`consentedAt` 은 아기 · 건강 기록의 서버 저장 · 가족 공유에 동의한 때(ISO) — 구성원 행에 남는다.
`baby` 는 기기 DB 의 `baby` 행 그대로(`id` · `name` · `birthDate` · `createdAt` · `updatedAt`), `records[]` 는 `record` 행 그대로에
`deleted`(지운 기록 표시)를 더한 것. `events[]` 는 기록 탭의 빠른 기록 — `care_event` 행 그대로(`id` · `kind` · `startAt` ·
`endAt` · `amount` · `side` · `diaper` · `color`(변 색) · `note` · `by`(남긴 사람의 가족 이름, 20자까지) · `createdAt` · `updatedAt`)에 `deleted` 를 더한 것이다(SPEC-LOG-07).
옛 서버는 `by` 를 모르고 버린다 — 앱은 받은 줄에 `by` 가 없으면 가진 이름을 지우지 않는다. `kind` 는
breast · formula · diaper · sleep · temp · weight · height 가운데 하나. 서버는 내용을 읽지 않고 맞추기만 한다 — 빠른 기록도
기록과 같은 번호로 센다. 응답에 `events` 가 없으면 옛 서버다(앱은 빠른 기록을 올린 때를 넘기지 않는다).
`items[]` 는 할 일 · 주제 · 루틴 · 루틴 기록(task my/009)과 우리 아기 메모 — `{ kind: topic | todo | routine | routineLog | memo, id, updatedAt, deleted, data }`.
`data` 는 기기 DB 의 줄 그대로(할 일에는 주제 kind 를 `topicKind` 로 더한다)이고 서버는 읽지 않는다(한 줄 4000자까지, 한 번에 2000줄).
기록과 같은 표 · 같은 번호 · 같은 규칙(늦게 고친 쪽이 이긴다)으로 맞춘다. 응답에 `items` 가 없으면 옛 서버다(앱은 할 일 · 루틴을 올린 때를 넘기지 않는다).
응답의 `itemKinds` 는 이 서버가 받는 `kind` 목록이다 — 앱은 여기 있는 종류만 올린다(옛 서버에 `memo` 를 보내 요청 전체가 422 로 거절되지 않게).

```
평시 ▸ 늦게 고친 쪽이 이긴다 — 기록 · 아기 모두 updatedAt(ISO) 비교. 서버는 기록마다 늘어나는 번호(seq)를 매기고,
       sync 는 since 보다 큰 번호의 기록 전부(지운 표시 포함)와 아기 · 구성원 수를 돌려준다. 처음이면 since=0.
평시 ▸ 응답의 seq 가 다음 since 다. 올린 기록이 더 이르면(이미 더 늦게 고친 것이 있으면) 지지 않고 번호도 안 움직인다.
금지 ▸ 대화(chat_message)는 이 API 로 올라가지 않는다.
```

## GET /v1/entitlements — 기기 자격

요청 머리 `X-Device-Key`. 응답: `{ "ads": true, "operator": false }` — 운영자(가족) 기기는 `{ "ads": false, "operator": true }`.
`operator` 는 키가 운영자 allowlist 에 있는지다 — `X-As-User: 1` 로 일반 기기처럼 받는 중에도 true 라서,
앱은 이 값으로 숨은 「일반 사용자로 보기」 스위치를 보인다.
키가 없거나 모르는 키면 401 `DEVICE_KEY_INVALID`. 앱은 부팅 시 1회 받아 광고 표시에 쓴다.
지정은 서버 allowlist([backend](backend.md) 운영자 절).

## GET /privacy · /terms · /support — 개인정보 처리방침 · 이용약관 · 자주 묻는 질문 웹 페이지

스토어에 넣을 공개 주소다(`/v1` 없음, 기기 키 없음). `/support` 는 자주 묻는 질문과 문의 이메일 — App Store 의 지원 URL. HTML 한 장을 그대로 준다. 본문 정본은 앱의 `src/data/legal.ts` 이고,
`node scripts/export-legal.mjs`(앱 폴더)가 `server/app/data/legal/` 에 만든다. 본문과 어긋나면 `legal-html.test.ts` 가 실패한다(task common/024).

## POST /v1/parse — 문장 읽기 (SPEC-MAIN-12 · 13)

물어보기 창에서 앱 규칙(`add-parse.ts` · `find-parse.ts`)으로 못 읽은 문장, 특히 한 문장에 기록이 여럿인 문장을 기록이나 찾을 조건으로 바꾼다
([decisions/039](../decisions/039-ask-chat-and-feedback-5.md)). 요청 머리 `X-Device-Key` 필수.
서버는 문장과 지금 시각만 모델에 보내고, 모델은 문장을 아래 모양으로 바꾸기만 한다. 숫자는 앱이 기기 안 기록에서 센다.
무엇을 보내고 무엇을 저장하지 않는지는 [backend](backend.md) 「문장 읽기」.

요청: `{ "text": "10분 전에 대소변 기저귀 갈고 분유 120 먹였어", "now": "2026-11-06T14:20:00+09:00" }`
— `text` 는 앞뒤 공백을 빼고 1~300자, `now` 는 기기의 지금 시각(시간대가 붙은 ISO). 시간대가 없으면 422.

응답:

```json
{
  "type": "records",
  "records": [
    { "kind": "diaper", "startAt": "2026-11-06T14:10:00+09:00", "endAt": null, "minutes": null, "amount": null,
      "side": null, "diaper": "both", "color": null, "title": null },
    { "kind": "formula", "startAt": "2026-11-06T14:10:00+09:00", "endAt": null, "minutes": null, "amount": 120,
      "side": null, "diaper": null, "color": null, "title": null }
  ],
  "question": null
}
```

| 칸 | 뜻 |
|---|---|
| `type` | `records`(기록으로 남길 말) · `question`(기록을 묻는 말) · `health`(열, 발진, 약처럼 의료 판단을 묻는 말) · `unknown`(그 밖이나 읽지 못한 말) |
| `records[]` | `type` 이 records 일 때만 채운다(한 문장에 10줄까지). 그 밖에는 `[]` |
| `kind` | breast · formula · diaper · sleep · temp · weight · height · routine · memo |
| `startAt` · `endAt` | 그 일이 일어난(시작한) 때와 끝난 때. `now` 와 같은 시간대의 ISO. 때를 말하지 않았으면 `startAt` 은 null(지금) |
| `minutes` | 말한 걸린 시간(「15분 먹였어」, 「1시간 잤어」). 걸린 시간만 말했으면 `startAt` 은 null 이고 시작 시각은 앱이 정한다 |
| `amount` | 분유 ml · 체온 ℃ · 몸무게 kg · 키 cm |
| `side` · `diaper` · `color` | 모유 left · right / 기저귀 pee · poo · both / 변 색 yellow · brown · green · black · red · white |
| `title` | 루틴 · 영양제 이름(비타민D, 유산균, 터미타임, 목욕)이나 메모 글. routine · memo 줄에는 늘 있다 |
| `question` | `type` 이 question 일 때만 `{ what, range, measure }`, 그 밖에는 null |

`question` 의 값은 앱 `src/data/find-parse.ts` 의 글자 그대로다 — 앱이 그대로 `rangeOf` · `runFind` 에 넣는다.

- `what`: feed · formula · breast · diaper · pee · poo · sleep · nap · night · temp · weight · height
- `range`: today · yesterday · lastNight · tonight · thisWeek · lastWeek · recent7 · recent30.
  `recentN`(최근 N일)과 `date`(N월 N일)는 며칠인지, 어느 날인지 실을 칸이 없어서 받지 않는다. 그런 기간을 물으면 `unknown` 이고, 앱 규칙이 읽는다
- `measure`: count · amount · duration · last

```
평시     ▸ 서버는 모델 답의 형식을 검사한다. JSON 이 아니거나 값이 목록 밖이거나 뜻이 맞지 않으면(빈 records, 칸 없는 question)
           { type: "unknown", records: [], question: null } 를 준다.
평시     ▸ 기록 종류에 없는 칸(모유의 amount, 소변의 color 같은 것)은 서버가 비우고, 이름 없는 routine · memo 줄은 뺀다.
평시     ▸ health 에는 아무 칸도 싣지 않는다. 앱이 정해 둔 한 줄만 보이고, 서버도 모델도 답하는 글을 만들지 않는다.
조건 위반 ▸ 키가 없거나 모르는 키면 401 DEVICE_KEY_INVALID. 형식이 틀린 요청은 422 INVALID_REQUEST.
조건 위반 ▸ 기기마다 하루(한국 시간 0시에 바뀐다) 300번을 넘으면 429 LIMIT_EXCEEDED.
조건 위반 ▸ 서버에 모델 키가 없거나 모델에 닿지 못하면(네트워크, 10초 시간 초과, 모델 회사의 4xx · 5xx) 503 MODEL_UNAVAILABLE.
           앱은 규칙으로 읽은 만큼만 쓴다.
```

## POST /v1/agent — 물어보기 (SPEC-MAIN-12 · 13)

물어보기 창에서 「이거」, 「옮겨 줘」, 「지워 줘」처럼 화면을 가리키거나 기록을 고치는 말과 앱 규칙으로 못 읽은 말을 받아
답 글이나 바꿀 것 목록으로 돌려준다([decisions/040](../decisions/040-ask-agent-reads-the-day.md), task common/032). 요청 머리 `X-Device-Key` 필수.
한 번 묻는 데 모델은 한 번 부른다. 서버는 기록을 바꾸지도 저장하지도 않고, 반영은 앱이 사람 확인을 받아서 한다.
무엇을 보내고 무엇을 저장하지 않는지는 [backend](backend.md) 「물어보기」. 빌드 13 이 쓰는 `/v1/parse` 는 그대로 둔다.

요청:

```json
{
  "text": "이거 10분 앞으로 옮기고, 내일 아침 9시에 2개월 접종 일정 넣어 줘",
  "now": "2026-11-06T14:20:00+09:00",
  "history": [
    { "role": "user", "text": "이전 수유 언제 했어?" },
    { "role": "app", "text": "13:50에 분유 120ml 먹었어요." }
  ],
  "day": "2026-11-06",
  "records": [
    { "ref": "r7", "kind": "formula", "startAt": "2026-11-06T10:50:00+09:00", "amount": 140 },
    { "ref": "r9", "kind": "formula", "startAt": "2026-11-06T13:50:00+09:00", "amount": 120, "by": "엄마" }
  ],
  "selected": "r9"
}
```

| 칸 | 뜻 |
|---|---|
| `text` | 이번에 쓴 문장. 앞뒤 공백을 빼고 1~300자 |
| `now` | 기기의 지금 시각(시간대가 붙은 ISO). 시간대가 없으면 422 |
| `history[]` | 바로 앞 대화, 오래된 것부터 6개까지. `role` 은 `user`(사람이 쓴 말)나 `app`(앱이 보인 답), `text` 는 1~600자. 없으면 `[]` |
| `day` | 보고 있는 날(`YYYY-MM-DD`). 기록을 보낼 때만 채우고, 아니면 null |
| `records[]` | 그날 기록, 150개까지. 처음 한 번 동의하지 않았으면 `[]` |
| `selected` | 흐름에서 누른 기록의 `ref`, 없으면 null. `records` 에 없는 ref 이면 null 로 본다 |

기록 한 줄(`records[]`)의 칸은 다음과 같다. `ref` 와 `kind`, `startAt` 은 꼭 있어야 하고, 나머지는 비워도 되며 기본이 null 이다.

| 칸 | 뜻 |
|---|---|
| `ref` | 앱이 붙인 기록 이름. `r` 뒤에 숫자 1~3자리(`r12`). 한 요청 안에서 겹치면 422 |
| `kind` | parse 와 같은 9가지 |
| `startAt` · `endAt` | 시간대가 붙은 ISO. 서버가 `now` 의 시간대로 맞춰 모델에 보낸다 |
| `amount` · `side` · `diaper` · `color` | parse 기록 한 줄과 같은 뜻과 값 |
| `title` | 루틴 이름이나 메모 글, 300자까지 |
| `note` | 기록에 붙인 메모, 300자까지 |
| `by` | 남긴 사람의 가족 이름, 20자까지 |

걸린 시간(`minutes`)은 받지 않는다 — 시작과 끝 때로 보낸다. 계약에 없는 칸은 무시한다.

응답:

```json
{
  "type": "changes",
  "reply": null,
  "question": null,
  "actions": [
    { "op": "update", "ref": "r9", "kind": "formula", "startAt": "2026-11-06T13:40:00+09:00", "endAt": null,
      "minutes": null, "amount": null, "side": null, "diaper": null, "color": null, "title": null, "note": null,
      "hasTime": null },
    { "op": "plan", "ref": null, "kind": null, "startAt": "2026-11-07T09:00:00+09:00", "endAt": null,
      "minutes": null, "amount": null, "side": null, "diaper": null, "color": null, "title": "2개월 접종", "note": null,
      "hasTime": true }
  ],
  "highlight": ["r9"]
}
```

| 칸 | 뜻 |
|---|---|
| `type` | `answer`(보는 날 기록으로 답한 물음), `changes`(더하기, 고치기, 지우기, 일정), `question`(며칠에 걸친 숫자를 묻는 말), `health`(의료 판단을 묻는 말), `unknown`(그 밖이나 읽지 못한 말) |
| `reply` | answer 의 답 글(늘 있다), changes 의 짧은 설명(없을 수 있다). 앞뒤 공백을 빼고 300자까지 |
| `question` | `type` 이 question 일 때만 parse 와 같은 `{ what, range, measure }`, 그 밖에는 null. 앱이 기기 안 기록에서 센다 |
| `actions[]` | `type` 이 changes 일 때만 채운다(10줄까지). 그 밖에는 `[]` |
| `highlight[]` | 답이 가리키는 기록의 `ref`, 10개까지. 요청에 보낸 ref 만 온다 |

바꿀 것 한 줄(`actions[]`)은 칸이 평평하다. 칸은 늘 모두 오고, `op` 마다 아래 칸만 채워지며 나머지는 null 이다.

| `op` | 채워지는 칸 |
|---|---|
| `add` | 새 기록. `kind` 와 parse 기록 한 줄의 칸(`startAt`, `endAt`, `minutes`, `amount`, `side`, `diaper`, `color`, `title`). 다듬는 규칙도 parse 와 같다 — 종류에 없는 칸은 비우고, routine 과 memo 에는 `title` 이 늘 있다. 때를 말하지 않았으면 `startAt` 은 null(지금) |
| `update` | 보낸 기록 고치기. `ref`, 그 기록의 `kind`, 바뀌는 칸만. 바뀌는 칸은 그 종류에 있는 칸 가운데 보낸 값과 다른 것이다. 종류마다 parse 의 칸을 쓰고, breast, formula, diaper, sleep, temp, weight, height 에는 `note` 를 더한다. routine 과 memo 는 `title` 이 글이고 `note` 가 없다. `minutes` 가 오면 걸린 시간을 그만큼으로 바꾸라는 뜻이다 |
| `delete` | 보낸 기록 지우기. `ref` 와 그 기록의 `kind` 만 |
| `plan` | 할 일이나 일정. `title`, `startAt`, `hasTime`(시각을 말했으면 true, 날만 말했으면 false) |

```
평시     ▸ 서버는 모델 답을 칸마다 검사한다. 겉모양이 틀리면(JSON 이 아님, 목록 밖의 type) unknown 을 준다.
평시     ▸ 맞지 않는 줄은 버린다 — 보내지 않은 ref 를 가리키는 update 와 delete, 바뀌는 칸이 없는 update,
           title 이나 startAt 이 없는 plan, 종류가 없거나 이름 없는 routine · memo 인 add, 값이 목록 밖인 줄.
           때는 모두 `now` 의 시간대로 맞춘다.
평시     ▸ changes 인데 남은 줄이 없으면 reply 가 있을 때 answer, 없으면 unknown 이다.
           reply 가 빈 answer 와 조건이 맞지 않는 question 도 unknown 이다.
평시     ▸ health 와 unknown 은 reply, actions, highlight 를 비워 보낸다. 앱이 정해 둔 글을 보인다(헌장 5).
평시     ▸ question 이면 actions 를 비운다.
조건 위반 ▸ 키가 없거나 모르는 키면 401 DEVICE_KEY_INVALID. 형식이 틀린 요청(겹친 ref 포함)은 422 INVALID_REQUEST.
조건 위반 ▸ 기기마다 하루(한국 시간 0시에 바뀐다) 200번을 넘으면 429 LIMIT_EXCEEDED. 문장 읽기의 300번과 따로 센다.
조건 위반 ▸ 서버에 모델 키가 없거나 모델에 닿지 못하면(네트워크, 15초 시간 초과, 모델 회사의 4xx · 5xx) 503 MODEL_UNAVAILABLE.
```

## 뺀 것 (2026-10-22, task common/022)

앱이 AI 상담을 뺀 뒤([decisions/024](../decisions/024-topic-todo-no-ai-answers.md)) 부르지 않게 된 것을 서버에서도 지웠다.
옛 계약은 git 기록(이 파일의 2026-10-21 판)에 있다.

- `POST /v1/ask` — 질문 답변(위험 신호 규칙 · L1 검색 · 모델 · 답 검사)과 하루 한도 · 일반 기준 답 · 하루 비용 천장
- `GET /v1/reward/ssv` — 보상형 광고 적립
- `POST /v1/feedback` — 답변 피드백
- `GET /v1/cohort/faq` — 또래 질문 묶음(만들지 않았다)

## changelog

- 2026-09-30 최초 작성 (v0)
- 2026-10-02 `/v1/ask` 응답에 level, 일반 정보일 때만 빈 sources, 지어낸 id 금지, 503 MODEL_UNAVAILABLE (task common/004)
- 2026-10-04 모델 회사가 한도로 거절하면 곧바로 503 (task ask/006)
- 2026-10-03 `/v1/reward/ssv` 를 GET 으로 바로잡고 검증·적립 규칙(user_id = 기기 키 해시) (task common/006)
- 2026-10-03 `/v1/feedback` 요청 모양(answer 정보 · 동의한 원문만 shared · 기기 키와 분리) (task ask/003)
- 2026-10-03 `POST /v1/devices`, `X-Device-Key` 필수(위험 신호는 예외)·401 DEVICE_KEY_INVALID, entitlements 에 remaining, usage.remaining 은 운영자 기기에서 null (task common/005)
- 2026-10-06 한도 정책 v2 — 429 의 ecoAvailable 을 일반 기준 답 한도로, 503 DAILY_BUDGET_REACHED, 자격에 rewardPerAd (task common/014)
- 2026-10-06 운영자 기기의 `X-As-User` 헤더, 자격에 operator (task common/015)
- 2026-10-11 `/v1/ask` 요청에 `history`(바로 앞 대화 최대 6턴) — 앞 질문을 모른 채 답하던 것을 고침 (task ask/012)
- 2026-10-12 `/v1/knowledge/version` · `/v1/knowledge/bundle` 을 구현 — 증분(`since` · `removedIds`) 대신 승인 항목 전부, 기기 키 없이 (task common/019)
- 2026-10-12 `/v1/family` — 가족 만들기 · 초대 코드로 들어가기 · 나가기 · 아기 · 기록 맞추기(늦게 고친 쪽이 이김, seq) (task my/007)
- 2026-10-12 `/v1/ask` 요청에 `conversationSummary`, 답 · 되묻기 응답에 `conversationSummary` — 대화 요약은 폰이 들고 다닌다. `baby.records` 는 질문 주제에 닿는 것만 (decisions/022, task ask/013)
- 2026-10-12 `/v1/family/sync` 에 `events[]` — 기록 탭의 빠른 기록(care_event 모양 + deleted). 서버는 기록과 같은 표 · 같은 번호로 맞추고 돌려줄 때 가른다. 옛 앱은 보내지 않아도 된다 (SPEC-LOG-07, task log/001)
- 2026-10-30 `events[]` 에 `by`(누가 남겼는지) (SPEC-LOG-07, task log/003)
- 2026-10-22 질문 답변 · 보상 광고 · 피드백 · 또래 질문을 뺌, 자격은 `{ ads, operator }` 만, 가족 맞추기에 메모(`memo`)와 `itemKinds` (task common/022 · 024)
- 2026-10-22 `GET /privacy` · `/terms` 웹 페이지 (task common/024)
- 2026-11-09 `POST /v1/parse` — 물어보기 창의 문장 읽기(한 문장의 기록 여럿, 찾을 조건, health, unknown), 기기마다 하루 300번, 503 MODEL_UNAVAILABLE (decisions/039, task common/031)
- 2026-11-09 `POST /v1/agent` — 물어보기. 문장, 앞 대화, 동의했을 때 보고 있는 날의 기록과 선택한 기록을 받아 답 글(answer)이나 바꿀 것(add, update, delete, plan), 찾을 조건, health, unknown 을 돌려준다. 기기마다 하루 200번 (decisions/040, task common/032)
