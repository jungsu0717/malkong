# 026 에이전트가 앱 기능 목록을 알고 고른다 — 한 번 호출, 실행은 앱

> 상태: 구현 완료 (2026-11-10) · Julian 「승인」으로 서버 배포와 빌드 16
> 근거: [main](../../menu-spec/main.md) SPEC-MAIN-15 · [constitution](../../constitution.md) 13 · 결정: [043](../../decisions/043-agent-knows-app-tools.md)

## 목표

Julian(2026-11-10): 「우리 기능이 뭔지 정확히 지식층에 알고있다면 그 기능들 조합해서 mcp 처럼 짜주는것도 불가능하진 않을텐데?」 → 추천안(한 번 호출 안에서 기능 고르기)에 「ㅇㅇ 너가 추천한 방식으로 해줘」.
규칙으로 못 읽은 물음을 모델이 앱 기능으로 바꾸고, 앱이 기기 안 기록으로 실행해 확실한 숫자로 답한다.

## 정한 것

- 기능 목록 `server/app/domain/agent/tools.json`(13개) — 값의 목록(what · range · rangeB · measure · sleep · day · when)과 찾을 이름(name, 20자), 기능마다 보기 문장
- 서버(`prompt.py`): 요청의 `tools` 가 true 면 지시문을 바꾼다 — answer 는 가리키는 기록으로 좁히고, question 줄을 tools 로, 찾을 조건 설명 절을 「앱 기능」 절로, 보기에 기능 보기를 더한다.
  지시문 토막이 없어지면 `_cut` 이 멈춰 시험이 알린다. 답 모양에 `calls`(3개까지)
- 서버(`service.py`): 줄마다 검사 — 목록에 없는 기능, 빠지거나 목록 밖인 값, 혼잣말 흔적이 있는 이름은 버리고 쓰지 않는 칸은 비운다. `tools` 를 안 보낸 요청에 tools 가 오면 unknown
- 앱(`src/data/agent-tools.ts`): `runTool` — total · average · last 는 찾기 규칙(answerFor, 평소 한 줄 포함), compare_ranges 는 새 `compareRanges`(여러 날은 하루 평균, 오늘과 어제는 같은 시각까지,
  이번 주와 견주는 지난주는 달력의 지난주), feed_gap 은 새 `feedGapAnswer`, wake · who · find_name · day_summary · compare_previous 는 ask-local, day_draft · write_diary · show_week 는 화면 동작
- 물어보기 창은 에이전트에 늘 `tools: true` 를 보낸다. 에이전트가 고른 하루 초안은 남은 말을 모델로 다시 보내지 않는다
- 서버 시험(`test_agent.py`)과 앱 시험(`agent-tools.test.ts`)이 둘 다 tools.json 을 읽는다 — 앱 시험은 기능 이름과 값이 같은지, 보기마다 앱이 실행할 수 있는지 본다

## 손댄 파일

```
server/app/domain/agent/tools.json(새로) · prompt.py · schema.py · service.py · tests/test_agent.py
src/data/agent-tools.ts · agent-tools.test.ts(새로) · ask-local.ts(findTerms · wakeFor · whoFor, 비교의 종류 값) · ask.ts(valueText) · api.ts
src/components/flow/ask-sheet.tsx — tools 보내기, calls 실행
docs: decisions/043, knowledge-layers, api-contract, constitution 13, main SPEC-MAIN-15
```

## 완료 조건

- [x] (SPEC-MAIN-15) 기능 목록 한 파일, 서버가 지시문과 답 모양을 만들고 줄마다 검사
- [x] (SPEC-MAIN-15) 앱이 13개 기능을 기기 안 기록으로 실행, 답 문장은 앱
- [x] (헌장 13) 보는 날 밖의 기록은 모델에 가지 않는다, 한 번 묻는 데 한 번 호출
- [x] 빌드 15 와 지금 서버가 그대로 맞물린다(요청 `tools`)
- [x] 서버 게이트(ruff · format · pytest 137개), 앱 tsc · lint · 시험 179개 · copy-check
- [x] 실제 모델로 고르는지 확인 — 두 번(열 문장씩), 아래 「확인」
- [ ] 서버 배포, 빌드(Julian 승인 뒤)

## 확인

- 가짜 모델 시험: tools 를 보낸 요청에만 「앱 기능」 절과 tools 답, 목록에 없는 기능 · 값 · 문장 같은 이름은 그 줄만 버림, tools.json 보기가 모두 검사를 통과
- 앱 시험: 「이번 주 낮잠은 하루 평균 1시간 10분, 지난주는 1시간 40분이에요. 지난주보다 30분 줄었어요.」,
  「오늘 분유는 지금까지 420ml, 어제 이 시각까지는 400ml였어요. 어제보다 20ml 늘었어요.」,
  「최근 사흘 수유 간격은 3시간쯤이에요. 마지막 수유(13:10 분유 160ml)에서 1시간 50분 지났어요. 다음은 16:10쯤이에요.」
- 실제 모델(로컬 서버, gemini-3.1-flash-lite, 생각 low). 처음 세 번 시도는 Gemini 가 503(「high demand」)으로 답하지 않았다.
  - 첫 측정(열 번 + 원래 답을 본 세 번): 일곱 맞음. 「손톱 잘랐나?」 → find_name(손톱, today), 「오늘 전체 뭐했어?」 → day_summary, 「요즘 몇 시간마다 먹어?」 → feed_gap,
    「평소 패턴대로 오늘 하루 채워놔」 → day_draft, 「아침에 언제 일어났더라」 → wake(night), 「마지막으로 목욕한 게 언제야」 → find_name(목욕, last), 「이유식 언제부터?」 → unknown.
    틀린 셋(「이번 주 낮잠이 지난주보다 줄었어?」, 「오늘 어제보다 많이 먹었어?」, 「어젯밤 몇 시간 잤어?」)은 기능은 맞았는데 기간을 range 대신 when 에 쓰고 measure · rangeB 를 비워
    서버 검사에서 버려졌다 → 칸마다 쓰는 기능을 지시문과 스키마에 적고, 서버가 빠진 값을 채운다(`_fill`)
  - 둘째 측정(열 번): 여덟 맞음(「오늘 어제보다 많이 먹었어?」 → compare_ranges(feed, today, yesterday, count) 포함, 「아침에 언제 일어났더라」는 answer 로 밤잠 기록).
    틀린 둘은 모델이 기간을 비운 것을 서버가 「오늘」로 채운 것(「이번 주 … 지난주」, 「어젯밤」) → 기간은 문장의 낱말로 읽는다(`ranges_in`, 기간을 쓰는 줄이 하나일 때).
    본 모양 그대로 가짜 답 시험에 넣었다. 측정을 두 번 채워 다시 부르지 않았다
  - 걸린 시간 1.5~4.7초(첫 측정은 붐빔 뒤라 2.4~6.4초)
