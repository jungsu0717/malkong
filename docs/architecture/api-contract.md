# API 계약 v0 — 앱 ↔ FastAPI

> 근거: [backend](backend.md) · [ask 대화 상세](../menu-spec/ask.md)

인증은 초기엔 익명 **디바이스 키**(설치 시 서버가 발급, 헤더 `X-Device-Key`)로 하고 한도 집계에만 쓴다.
로그인 도입 시 계정 토큰이 이를 대체한다. 에러는 공통 형식 `{ code, message }`.

## POST /v1/ask — 질문

요청:
```json
{
  "question": "분유를 갑자기 잘 안 먹어요",
  "baby": { "months": 3, "records": [ { "kind": "기록", "label": "수유 텀 3시간 · 160ml" } ] },
  "clientMessageId": "로컬 메시지 id (중복 방지)"
}
```

응답 200 — `type` 으로 갈린다:

| type | 뜻 | 함께 오는 것 |
|---|---|---|
| `answer` | 답변 | `answer`, `level`(사실·일반·판단), `sources[{id,name,url}]`, `records[]`(저장 제안 — kind·label·covers?), `usage{remaining}`(오늘 남은 정밀 답변 수, 운영자 기기는 null) |
| `followup` | 답변 전 되묻기 | `followup{question, chips[], recordLabel}` — 답을 받으면 같은 API 로 재요청 |
| `redflag` | 위험 신호 고정 응답 | `answer`(병원·119 안내), `sources[]` — LLM 미호출 |

```
평시     ▸ type=answer 의 sources 는 비어 있어서는 안 된다. 예외는 공공 지식에 근거가 없는 답 하나다 —
          level 이 "일반" 또는 "판단"이고 인용이 없을 때 sources 는 비어 있고, 앱은 "공공 지식 근거 없음 ·
          일반 정보"를 표시한다. level 이 "사실"이면 sources 는 반드시 있다.
평시     ▸ sources 의 id 는 서버가 모델에 건넨 L1 조각의 id 여야 한다. 모델이 지어낸 id 는 내보내지 않는다.
조건 위반 ▸ 모델이 답하지 못하면(거절·형식 오류·시간 초과) 503 { code: "MODEL_UNAVAILABLE" } 를 반환한다.
조건 위반 ▸ 일일 한도 초과면 429 { code: "LIMIT_EXCEEDED", resetAt, rewardAvailable, ecoAvailable }
          를 반환하고, 앱은 광고 충전(정밀)과 절약 모드(일반 기준) 선택지를 제시한다.
평시     ▸ 요청에 "mode": "eco" 가 오면 서버는 L2 기록 없이 무료 경로로 답하고, 응답에
          "eco": true 를 넣는다 — 앱은 "일반 기준 답변" 표시를 붙인다(backend 일일 한도 절).
          eco 답에는 되묻기(followup)가 오지 않는다 — 기록을 쓸 수 없는데 되물으면 같은 질문이 되풀이된다.
평시     ▸ 같은 clientMessageId 재요청은 새로 처리하지 않고 같은 응답을 돌려준다(재시도 안전).
          한도는 같은 clientMessageId 에 한 번만 차감한다.
평시     ▸ 요청 머리에 `X-Device-Key`(POST /v1/devices 로 받은 키)를 보내야 한다. 키가 없거나 서버가 모르는
          키면 401 { code: "DEVICE_KEY_INVALID" } — 앱은 키를 새로 받아 한 번 다시 보낸다.
안전     ▸ 위험 신호 응답(redflag)은 키·한도와 상관없이 언제나 나간다.
```

## POST /v1/devices — 디바이스 키 발급

요청 본문 없음 → 201 `{ "deviceKey": "dk_..." }`.

```
평시     ▸ 앱은 처음 실행할 때 한 번 받아 기기 settings 에 두고, 이후 /v1 요청마다 X-Device-Key 로 보낸다.
평시     ▸ 서버는 키를 해시로만 저장한다. 키는 사람·계정과 연결되지 않는다 — 앱을 지우면 새 키를 받는다.
조건 위반 ▸ 한 연결 출처(IP)에서 하루 20개를 넘게 받으면 429 { code: "TOO_MANY_DEVICES" }.
```

## GET /v1/knowledge/version — L1 판 확인

응답: `{ "version": "2026.09.1" }`. 앱은 자기 번들 판과 비교한다.

## GET /v1/knowledge/bundle?since=<판> — L1 증분 갱신

응답: `{ "version": "...", "items": [ ...항목 스키마... ], "removedIds": [] }`.
[l1-knowledge-base](l1-knowledge-base.md) 스키마 그대로.

## GET /v1/entitlements — 기기 자격

요청 머리 `X-Device-Key`. 응답: `{ "ads": true, "dailyLimit": 10, "rewardMaxPerDay": 3, "remaining": 7 }` —
운영자(가족) 기기는 `{ "ads": false, "dailyLimit": null, "rewardMaxPerDay": 0, "remaining": null }`.
키가 없거나 모르는 키면 401 `DEVICE_KEY_INVALID`. 앱은 부팅 시 1회 받아 광고 표시·한도 안내에 쓴다.
지정은 서버 allowlist([backend](backend.md) 운영자 절). 차감·리셋 규칙은 backend 의 일일 한도 절이 정본.

## POST /v1/reward/ssv — 보상형 광고 적립 (AdMob 서버가 호출)

AdMob 의 서버 측 검증(SSV) 콜백. 서명 검증 후 해당 디바이스 키에 +1회 적립(하루 3회 상한).
앱의 자체 신고로는 적립하지 않는다 — 광고를 끝까지 봤다는 판정은 AdMob→서버 경로만 믿는다.

## POST /v1/feedback — 답변 피드백 (SPEC-ASK-06)

요청: `{ "answerId": "...", "rating": "up" | "down", "comment": "선택" }` → 204.
서버는 기기 식별자와 분리해 저장한다.

## GET /v1/cohort/faq?months=<월령> — 또래 질문 묶음 (SPEC-GROW-05)

응답: `{ "band": "3~4개월", "items": [ { "topic": "...", "question": "대표 질문(재서술)",
"answerId": "캐시 답변 id", "count": 128 } ] }` — 익명 집계만. 표본이 작으면 서버가 밴드를 넓혀 돌려준다.

아침 브리핑은 1단계가 온디바이스 생성이라 API 가 없다([backend](backend.md) 능동 브리핑 절).
서버 생성으로 올라갈 때 푸시 토큰 등록과 함께 정의한다.

## 미결

- 답변 스트리밍(SSE) 여부 — v0 는 단건 JSON 으로 시작하고, 체감이 느리면 도입. 도입할 때
  처리 단계(trace) 이벤트도 함께 정의한다 — 화면 쪽 표시 규칙은 SPEC-ASK-05 가 이미 정해 두었다

## changelog

- 2026-09-30 최초 작성 (v0)
- 2026-10-02 `/v1/ask` 응답에 level, 일반 정보일 때만 빈 sources, 지어낸 id 금지, 503 MODEL_UNAVAILABLE (task common/004)
- 2026-10-03 `POST /v1/devices`, `X-Device-Key` 필수(위험 신호는 예외)·401 DEVICE_KEY_INVALID, entitlements 에 remaining, usage.remaining 은 운영자 기기에서 null (task common/005)
