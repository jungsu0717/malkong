# 014 한도 정책 다시 — 광고 1편 5회, 일반 답 하루 20회, 서버 전체 하루 비용 천장

> 상태: 완료 (2026-10-06) — Cloud Run 반영은 common/005 시험판 배포와 함께(Julian 허락)
> 근거: [backend](../../architecture/backend.md) 「일일 한도」(이 task 에서 정의를 고친다) ·
> [decisions/019](../../decisions/019-generous-limits-hard-daily-budget.md) · SPEC-ASK-02(위험 신호는 언제나) ·
> [ask.md](../../menu-spec/ask.md) 「한도 표시」
> 횡단(common): 서버 한도 · 앱 한도 말풍선 · 약관 문구가 함께 바뀐다

## 목표

사용자가 조금 쓰고 막히지 않게 하면서, 돈은 서버 전체의 하루 천장 하나로 확실히 막는다(Julian 결정, 2026-10-06).

## 정한 것

| 자리 | 전 | 후 | 설정값 |
|---|---|---|---|
| 정밀 답변(기록 반영) | 하루 10회 | 그대로 | `MALKONG_DAILY_LIMIT=10` |
| 광고 충전 | 1편 = 1회, 하루 3편 | **1편 = 5회, 하루 2편** | `MALKONG_REWARD_PER_AD=5` · `MALKONG_REWARD_MAX_PER_DAY=2` |
| 정밀을 다 쓴 뒤 일반 기준 답 | 무제한 | **하루 20회** | `MALKONG_ECO_DAILY_LIMIT=20` |
| 서버 전체 하루 비용 | 없음(월 1만 원 한도뿐) | **하루 330원** 넘으면 그날 모델 답을 멈춤 | `MALKONG_DAILY_BUDGET_KRW=330` |
| 비용 계산 | — | 모델이 돌려준 토큰 × 가격 | `MALKONG_LLM_PRICE_*_USD`(3.5 Flash-Lite 값이 기본), `MALKONG_USD_TO_KRW=1400` |

- 위험 신호 안내는 모델을 부르지 않으므로 한도와 천장에 상관없이 나간다(SPEC-ASK-02)
- 운영자(가족) 기기는 한도도 천장도 없다
- 일반 기준 답도 같은 유료 모델로 가고, 아기 기록만 보내지 않는다. 옛 정의의 "무료 티어로 보낸다"는 지운다(decisions/019)
- 천장에 닿으면 서버 로그에 ERROR 한 줄을 남긴다. 이 로그로 Julian 에게 메일이 가게 하는 알림은 배포 때 함께 건다

## 손댈 파일

```
server/app/common/core/setting.py        새 설정값
server/app/infra/db/usage_store.py       일반 답 횟수(daily_usage.eco), 하루 비용 표(daily_cost) — 메모리 · Postgres 둘 다
server/app/domain/entitlements/          남은 수 계산(광고 × 5), 일반 답 한도, 하루 천장, 자격 응답에 rewardPerAd
server/app/domain/ask/service.py         일반 답도 세고, 모델을 부를 때마다 비용을 쌓고, 천장이면 503
server/tests/                            위 동작 시험
src/data/entitlements.ts · api.ts        rewardPerAd, 천장 응답
src/components/chat-bubbles.tsx          한도 말풍선 — 광고 몇 회, 일반 답까지 다 썼을 때
src/app/(tabs)/index.tsx                 천장 안내 문구
src/data/legal.ts                        약관·자주 묻는 질문의 한도 문구
docs/architecture/backend.md · api-contract.md · menu-spec/ask.md
```

## 단계

1. ~~서버~~ — **완료(2026-10-06).** 설정값, 저장소(`daily_usage.eco`, `daily_cost` — 기존 표에는 칸을 더한다),
   자격 서비스(남은 수 = 10 + 광고 편수 × 5 − 쓴 수, 일반 답 한도, 하루 천장과 넘는 순간 ERROR 로그),
   ask 서비스(일반 답도 세고, 모델을 부를 때마다 토큰 × 가격을 쌓고, 천장이면 모델 앞에서 503).
   시험 330건 + 실제 Postgres 시험 5건(`tests/test_pg_store.py`, 주소가 있을 때만)
   - 이 PC 는 회사망이라 Neon(5432)에 못 닿는다. 그래서 pgserver 로 로컬 Postgres 를 띄워 저장소 SQL 을 직접 확인했다 —
     옛 모양의 표에 칸을 더하는 경로까지. 띄우는 법은 server/AGENTS.md
2. ~~앱~~ — **완료(2026-10-06).** 자격에 `rewardPerAd`, 한도 말풍선이 「광고 1편 = 5회(하루 2편)」를 말하고 남은 선택지만
   보인다. 둘 다 없으면 「오늘은 여기까지예요」. 천장이면 그 안내를 보이고 「다시 시도」는 두지 않는다. 약관 문구.
   덤으로 고친 것: 횟수 숫자가 없을 때 「정밀 답변를」로 나오던 조사
3. ~~문서~~ — **완료(2026-10-06).** backend 「일일 한도」 정의와 「사용량을 세는 법」, api-contract, ask.md 한도 표시
4. ~~확인~~ — **완료(2026-10-06).** 로컬 서버(한도·천장을 0 으로)와 웹판으로 모델을 한 번도 부르지 않고 세 상태를 화면에서
   확인했다 — 정밀만 다 씀(일반 기준 단추만, 웹은 광고 없음), 일반까지 다 씀(「오늘은 여기까지예요」, 단추 없음, 이 상태에서도
   위험 신호 안내는 나감), 하루 천장(안내 문구, 다시 시도 없음). 실제 Neon 과 Cloud Run 확인은 common/005 의 시험판 배포 때
   - 리뷰(code-review low)에서 한 건: 모델 답을 받은 직후 비용을 적다가 저장소가 실패하면 이미 값을 치른 답을 버리고 오류를
     냈다. 비용 적기는 기록이라 실패하면 로그만 남기고 답을 돌려주게 고치고 시험을 더했다

## 완료 조건

- [x] (backend 일일 한도) 광고 1편이 확인되면 정밀 답변이 5회 늘고, 하루 2편을 넘으면 적립하지 않는다
- [x] (backend 일일 한도) 정밀을 다 쓴 뒤 일반 기준 답은 하루 20회까지이고, 그 뒤에는 429 에 `ecoAvailable: false`
- [x] (backend 일일 한도) 그날 모델 비용이 천장을 넘으면 모델 답 요청은 503 `DAILY_BUDGET_REACHED`, 위험 신호는 그대로 나간다
- [x] 운영자 기기는 한도와 천장에 걸리지 않는다
- [x] 같은 clientMessageId 재시도는 정밀 · 일반 모두 한 번만 센다
- [x] 앱: 한도 말풍선이 광고 1편 = 5회를 말하고, 일반 답까지 다 쓰면 「오늘은 여기까지」를 보인다. 천장이면 그 안내를 보인다
- [x] 서버: ruff · pytest 통과 / 앱: tsc · lint 통과
