# 031 문장 읽기 서버 — /v1/parse (Gemini)

> 상태: 진행 (2026-11-09)
> 근거: [main](../../menu-spec/main.md) SPEC-MAIN-12 · SPEC-MAIN-13
> 시안: https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「빌드 12 피드백 5판 시안 (2026-11-09)」 · 결정: [039](../../decisions/039-ask-chat-and-feedback-5.md)

## 목표

물어보기 창에서 규칙으로 못 읽은 문장을 기록 여러 개나 찾을 조건으로 바꾼다. 모델에는 문장과 지금 시각만 보낸다.

## 정한 것

- 키는 이미 있는 `malkong-gemini-key`(로컬은 `server/.env` 의 `MALKONG_GEMINI_API_KEY`). 새 키는 필요 없다
- 모델 응답은 서버가 형식을 검사하고, 틀리면 unknown. 키가 없거나 모델이 안 되면 503 이라 앱은 규칙으로 돌아간다
- 문장과 모델 응답은 저장하지도 로그에 남기지도 않는다. 기기마다 하루 호출 수에 상한

## 완료 조건

- [ ] (SPEC-MAIN-12) 한 문장의 기록 여러 개를 읽는다
- [ ] (SPEC-MAIN-13) 묻는 말을 찾을 조건으로, 건강 질문은 health
- [ ] 운영 배포(Julian 승인)
