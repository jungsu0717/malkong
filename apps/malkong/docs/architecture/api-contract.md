# API 계약 v0 — 앱 ↔ FastAPI

> 근거: [backend](backend.md)

인증은 익명 **디바이스 키**(설치 시 서버가 발급, 헤더 `X-Device-Key`)로 한다. 키는 사람 · 계정과 연결되지 않는다.
에러는 공통 형식 `{ code, message }`.
운영자(가족) 기기는 헤더 `X-As-User: 1` 을 더해 `/v1/entitlements` 를 일반 기기처럼 받을 수 있다
(일반 사용자로 보기 — [backend](backend.md) 운영자 절). 일반 기기의 이 헤더는 무시한다.

지금 서버가 하는 일은 기기 키 · 기기 자격 · 공공 지식(L1) 내려받기 · 가족 공유 넷이다. 질문 답변(`/v1/ask`) ·
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
