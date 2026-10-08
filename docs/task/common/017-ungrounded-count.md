# 017 근거 없이 답한 질문 세기 — 지식의 빈 곳을 숫자로

> 상태: 완료 (2026-10-08)
> 근거: [knowledge-layers](../../architecture/knowledge-layers.md) 「비어 있는 곳 찾기」(이 task 에서 「나중에 볼 것」의 첫 항목을 정의로 올린다) ·
> [backend](../../architecture/backend.md) 「서버가 저장하는 것」(로그 한 줄을 더한다) · SPEC-ASK-08(근거 없는 일반 답은 그렇다고 밝힌다)
> 횡단(common): 서버 로그 · 운영 명령

## 목표

Julian(2026-10-08): 「버디가 근거 없이 일반론으로 답한 질문이 하루 몇 건인지 센다(내용은 안 남김). 지식을 어디부터 채울지 이 숫자로
정한다」. 온톨로지 세미나 5교시 「애매한 표현을 규칙으로 쌓고 있는가」 — 지금은 L1 의 어디를 채울지 감으로 정한다.

## 정한 것

- **무엇을 센다**: 모델 답의 수위가 「일반」이고 출처가 없는 답. 되묻기 · 위험 신호 · 사실 · 판단 답은 세지 않는다
- **무엇을 남긴다**: 질문의 분류(접종 · 수유 · 수면 … L1 검색과 같은 낱말 규칙, 없으면 「없음」) · 월령 띠(0~3 · 4~6 · 7~12 · 13~24) ·
  검색이 건넨 항목 수. **질문 원문과 기기 키는 남기지 않는다** — 월령도 그대로 적지 않고 띠로 뭉갠다
- **어디에**: DB 가 아니라 Cloud Run 로그 한 줄(`ask: 근거 없음 kinds=수면 band=4~6 retrieved=0`). 기본 30일 보관이면 충분하다.
  표가 필요해지면 그때 코호트 집계(SPEC-GROW-05)와 합친다 — 월령 띠를 같은 넷으로 둔 이유
- **읽는 법**: `server/AGENTS.md` 「명령」의 `gcloud logging read … | sort | uniq -c`. 주제 × 띠별 건수가 나온다
- backend 의 코호트 미결 「질문 주제 분류 방법(규칙 vs 소형 모델)」은 여기서 **규칙**으로 답이 났다 — L1 검색이 이미 쓰는 분류 낱말을 그대로 쓴다

## 손댄 파일

```
server/app/domain/ask/service.py     답을 돌려주기 전에 한 줄 · month_band()
server/app/domain/ask/retrieval.py   question_kinds() 공개
server/tests/test_ask.py             세어지는가 · 원문이 안 남는가 · 출처 있는 답은 안 세는가
docs/architecture/backend.md         「서버가 저장하는 것」 표 한 줄
docs/architecture/knowledge-layers.md 「비어 있는 곳 찾기」
server/AGENTS.md                     세는 명령
```

## 확인

서버 시험 전체 통과(모델 호출 0). 운영 반영은 다음 배포 때 함께 간다(폰 키 등록 뒤, Julian 승인).

## 완료 조건

- [x] 근거 없는 일반 답마다 분류 · 월령 띠 · 검색 건수가 한 줄 남고, 질문 원문은 어디에도 없다
- [x] 출처 있는 답 · 되묻기 · 위험 신호는 세지 않는다
- [x] ruff · pytest 통과
