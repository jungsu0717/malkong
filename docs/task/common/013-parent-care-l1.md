# 013 부모 돌봄 L1 — 잠 · 끼니 · 마음

> 상태: 완료 (2026-10-04) — Julian 승인(의료 게이트), 서버 사본 · 검색까지. 서버 배포는 다음 배포 때
> 근거: SPEC-HOME-06 ② 부모 안부 · constitution 1 · [knowledge-layers](../../architecture/knowledge-layers.md) 출처 규칙

## 목표

부모 안부에 붙일 팁(아기 잘 때 같이 쉬기, 도움 청하기, 산후 우울 신호와 상담 안내)을 화이트리스트 출처에서 재서술해 L1 로.
새 분류 「부모」. draft 로 넣고 Julian 이 승인하기 전에는 화면에 나가지 않는다(로더가 거른다).

## 넣은 것 (`src/data/l1/parent.json`, 2026-10-04 Julian 승인 → approved)

| id | 제목 | 출처(미국 CDC, 퍼블릭 도메인) | 어디에 붙나 |
|---|---|---|---|
| k-parent-0001 | 울음이 길어 화가 날 땐 — 아기를 안전한 곳에 눕히고 잠깐 자리를 떠나요(흔들지 않기) | [About Abusive Head Trauma](https://www.cdc.gov/child-abuse-neglect/about/about-abusive-head-trauma.html) | 보챔 안부 「거의 못 잤어요」 |
| k-parent-0002 | 부모의 몸과 마음도 챙겨요 | [Positive Parenting Tips: Infants](https://www.cdc.gov/child-development/positive-parenting-tips/infants.html) | 잠 「거의 못 잤어요」 · 끼니 「자주 걸러요」 |
| k-parent-0003 | 며칠 울적함과 산후 우울은 달라요 — 세고 오래가면 의사와 이야기해요 | [Symptoms of Depression Among Women](https://www.cdc.gov/reproductive-health/depression/index.html) | 컨디션 「좀 지쳤어요」 |
| k-parent-0004 | 나나 아기를 해칠 생각이 들면 — 혼자 견디지 말고 바로 알려요(위급하면 119) | 같은 곳 | 컨디션 「좀 지쳤어요」 |

- 「아기 잘 때 같이 자기」는 CDC 에서 그 말 그대로의 권고를 찾지 못했다 — 의료 지식이 아닌 버디의 한 마디(문구 틀)로만 둔다
- 한국 상담 번호(자살예방상담전화 109 등)는 넣지 않는다(2026-10-04 Julian 결정). 위급하면 119 만
- 서버 사본 `server/app/data/l1/parent.json`(`scripts.sync_l1`) · 서버 검색 분류어 「부모」(산후 · 우울 · 지쳤 · 화나 · 해치 · 못 달래 …,
  「재우기 힘들어요」 같은 흔한 말은 뺐다) · 검색 시험 둘(「아기가 안 달래져서 화가 나요」 → 0001, 「산후우울증인지 걱정돼요」 → 0003)

## 완료 조건

- [x] 출처 확인(퍼블릭 도메인 — 미국 CDC)
- [x] Julian 승인 → approved · 서버 복사 · 서버 시험 324건 통과
- [ ] 서버 배포(답변에 부모 돌봄 근거가 붙는 것은 배포 뒤) — Julian 승인 필요
