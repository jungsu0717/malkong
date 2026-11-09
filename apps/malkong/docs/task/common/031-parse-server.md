# 031 문장 읽기 서버 — /v1/parse (Gemini)

> 상태: 구현 완료 (2026-11-09) · 운영 배포는 Julian 승인 뒤
> 근거: [main](../../menu-spec/main.md) SPEC-MAIN-12 · SPEC-MAIN-13
> 시안: https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「빌드 12 피드백 5판 시안 (2026-11-09)」 · 결정: [039](../../decisions/039-ask-chat-and-feedback-5.md)

## 목표

물어보기 창에서 규칙으로 못 읽은 문장을 기록 여러 개나 찾을 조건으로 바꾼다. 모델에는 문장과 지금 시각만 보낸다.

## 정한 것

- 키는 이미 있는 `malkong-gemini-key`(로컬은 `server/.env` 의 `MALKONG_GEMINI_API_KEY`). 새 키는 필요 없다
- 모델 응답은 서버가 형식을 검사하고, 틀리면 unknown. 키가 없거나 모델이 안 되면 503 이라 앱은 규칙으로 돌아간다
- 문장과 모델 응답은 저장하지도 로그에 남기지도 않는다. 기기마다 하루 호출 수에 상한

## 완료 조건

- [x] (SPEC-MAIN-12) 한 문장의 기록 여러 개를 읽는다
- [x] (SPEC-MAIN-13) 묻는 말을 찾을 조건으로, 건강 질문은 health
- [ ] 운영 배포(Julian 승인)

## 확인

- `POST /v1/parse` — 모델 `gemini-3.1-flash-lite`(설정 `MALKONG_GEMINI_MODEL`), Gemini Interactions API 를 REST 로, 답 모양을 정해서 받는다.
  키가 없거나 모델이 안 되면 503 `MODEL_UNAVAILABLE`, 기기마다 하루 300번을 넘으면 429 `LIMIT_EXCEEDED`. 로그에는 실패 종류와 답 글자 수만 남긴다
- 가짜 모델 시험 `tests/test_parse.py` 32개, ruff · format · pytest 75개 통과
- 실제 호출 10번(2026-11-09): 「10분 전에 대소변 기저귀 갈고 분유 120 먹였어」 → 기저귀 둘 다와 분유 120, 둘 다 14:10. 「열이 38도인데 괜찮아?」 → health.
  「왼쪽 15분 먹이고 비타민D 먹였어」 → 모유 왼쪽과 루틴 비타민D 는 맞았지만 15분을 놓쳤다. 지시문을 고쳤고 다시 확인은 하지 않았다
- 앱의 찾기 범위 중 「최근 N일」, 「N월 N일」은 서버 답에 칸이 없어 unknown 이다. 이 말들은 앱 규칙(find-parse)이 먼저 읽는다
- 남은 것: Gemini 키가 유료 등급인지(무료 등급이면 Google 이 입력을 제품 개선에 쓸 수 있다) Julian 확인, 운영 배포(Julian 승인)
