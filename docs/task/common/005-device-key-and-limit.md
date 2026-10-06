# 005 디바이스 키 · 하루 한도 · 재시도 안전 · 한도 화면

> 상태: 진행 (2026-10-06) — 코드와 시험 완료, Neon 생성 완료. 남은 것: Neon 을 붙인 배포와 Cloud Run 확인(Julian 허락)
> 근거: backend 「일일 한도」 · 「운영자 기기」 · 「사용량을 세는 법」, api-contract `/v1/devices` · `/v1/entitlements` · `/v1/ask`,
> ask.md 「한도 표시」

## 목표

서버가 기기 키로 하루 정밀 답변 수를 세고, 다 쓰면 429 로 알리며, 같은 질문의 재요청을 다시 만들지 않는다.
앱은 처음 실행할 때 키를 받아 모든 요청에 싣고, 한도를 다 쓰면 "일반 기준으로 바로 답변" 선택지를 준다.

## 먼저 정한 것

1. **위험 신호는 키보다 먼저** — 키가 없거나 한도를 다 써도 위험 신호 응답은 나간다(backend 안전)
2. **세는 것은 정밀 답변 요청의 답(type=answer)뿐** — 되묻기·위험 신호·절약 모드·오류·같은 clientMessageId 재시도는
   세지 않는다. 무료 티어라 모든 답이 eco 표시를 달고 나가도, 요청이 정밀(mode 없음)이면 센다 — 한도가 지금도 동작하게
3. **재시도 응답은 메모리에만 10분** — 답에 기록이 섞일 수 있어 DB 에 쓰지 않는다. 한도는 DB 의 `counted_message` 로
   한 번만 깎인다
4. **운영자(가족) 기기는 서버 비밀값 `MALKONG_OPERATOR_DEVICE_KEYS`** — 가족 기기 몇 대라 DB 표 대신. 기기 키는
   마이의 버전 글자를 길게 누르면 보인다
5. **Neon 없이도 돈다** — `MALKONG_DATABASE_URL` 이 없으면 메모리 저장소. 인스턴스가 바뀌면 키를 잊어 401 →
   앱이 키를 새로 받아 한 번 다시 보낸다(모델 호출 전 거절이라 두 번 나가지 않는다)
6. **키 발급 남용** — 연결 출처(IP)당 하루 20개
7. 광고 충전(보상형, `/v1/reward/ssv`)은 광고 task 에서 — 지금 한도 말풍선은 일반 기준 선택지만 준다

## 단계

1. 계약·backend 문서
2. 서버 — `infra/db/usage_store.py`(메모리 · Postgres) · `domain/entitlements`(서비스 · GET /entitlements) ·
   `domain/devices`(POST /devices) · `domain/ask/cache.py` · ask 서비스에 키 확인·한도·재시도
3. 시험 — `tests/test_usage.py`
4. 앱 — `api.ts` 기기 키(받기 · 싣기 · 401 이면 새로 받아 한 번 더), 부팅 때 자격 받기(entitlements-context),
   남은 수 3회 이하 표시, 한도 말풍선(`LimitBubble`), 마이의 숨은 기기 키

## 출시 전에 Julian 이 할 것

- [ ] 서버 배포 허락(자동 모드가 운영 배포를 막는다) — 명령은 server/AGENTS.md 「배포」. **앱은 새 서버가 있어야
      답을 받는다**(키 발급 경로가 옛 서버에 없다)
- [x] Neon 프로젝트를 만들고 접속 주소를 Secret Manager `malkong-database-url` 로 넣기 — 2026-10-06 Julian
      (무료 플랜, 싱가포르 `ap-southeast-1`, 풀러 주소). 남은 것: 배포에
      `MALKONG_DATABASE_URL=malkong-database-url:latest` 를 더하고 Cloud Run 에서 확인한다
  - 붙여 넣을 때 주소 앞에 `\r` 두 개가 섞여 들어가 있었다. 비밀값은 그대로 두고, 서버가 비밀값 설정의 앞뒤 공백과
    줄바꿈을 지우게 고쳤다(`setting.py`)
  - Julian 의 WSL PC(회사망)에서는 DB 포트 5432 로 나가는 길이 막혀 있다(웹 포트 443 은 된다). 그래서 실제 Neon
    확인은 이 PC 가 아니라 Cloud Run 의 트래픽 없는 시험판에서 한다
- [ ] 가족 기기 키를 `malkong-operator-keys`(쉼표로 구분)로 넣기 → `MALKONG_OPERATOR_DEVICE_KEYS`

## 완료 조건

- [x] 키 없이 또는 모르는 키로 모델 답을 요청하면 401 `DEVICE_KEY_INVALID`, 위험 신호는 키 없이도 나간다
- [x] 정밀 답변을 하루 한도만큼 쓰면 429 `LIMIT_EXCEEDED`(resetAt · rewardAvailable · ecoAvailable), 절약 모드는 계속 답한다
- [x] 같은 clientMessageId 재요청은 같은 응답이고 모델을 다시 부르지 않으며, 한도는 한 번만 깎인다
- [x] 한국 시간 0시에 한도가 다시 찬다. 30일 지난 사용량은 지운다
- [x] 운영자 기기는 광고·한도 없음(entitlements · usage.remaining null)
- [x] 앱: 남은 수 3회 이하 표시, 다 쓰면 일반 기준 선택지, 401 이면 키를 새로 받는다
- [x] ruff · pytest(300) · tsc · lint 통과
- [ ] 배포 후 Cloud Run 에서 `/v1/devices` · `/v1/entitlements` · 위험 신호 확인(Gemini 호출 없음)
