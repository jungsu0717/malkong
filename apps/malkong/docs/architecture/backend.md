# 백엔드 — 서버 · DB

> 근거: [constitution](../constitution.md) · [knowledge-layers](knowledge-layers.md) · [decisions/003](../decisions/003-backend-shape.md)

집에 두는 서버는 없다. 서버와 DB 는 전부 클라우드 관리형이고, 유저가 없을 때 비용이 0원에
수렴하는 구성으로 둔다.

## 전체 구성

```
앱 (Expo)
 ├─ 기기 안: sqlite — 아기 · 할 일 · 루틴 · 메모 (기본 저장소)
 └─ HTTPS → FastAPI 서버 (Cloud Run, scale-to-zero)
              ├─ 기기 키 · 기기 자격(광고 여부)
              ├─ 공공 지식(L1) 판 확인 · 묶음 내려받기
              ├─ 가족 공유 맞추기
              └─ 운영 DB (Neon, 서버리스 Postgres) — 아래 「서버가 저장하는 것」
```

서버는 2026-10-22 부터 AI 모델을 부르지 않는다. 질문 답변 · 하루 한도 · 보상형 광고 적립 · 답변 피드백은 앱이 AI 상담을 뺀 뒤
([decisions/024](../decisions/024-topic-todo-no-ai-answers.md)) 쓰이지 않아 서버에서도 지웠다(task common/022). 옛 설계는 git 기록
(이 파일의 2026-10-21 판)에 있다. 붙여 넣은 글을 할 일로 나누는 AI(헌장 13)를 붙이게 되면 그때 이 문서에 다시 정의한다.

## 서버

```
평시 ▸ AI 모델을 부르게 되면 반드시 서버를 거쳐야 한다. 모델 API 키를 앱에 포함해서는 안 된다.
평시 ▸ 서버는 요청이 없을 때 0원에 수렴하는 호스팅(scale-to-zero)에 둔다.
```

- 형태: **FastAPI 단일 경량 서버.** 역할은 셋 — 기기 키 · 자격, 공공 지식 내려받기, 가족 공유.
- 실행은 **Cloud Run**, 상태는 **Neon**(서버리스 Postgres), 비밀값은 Secret Manager 에 둔다
  — 고른 이유는 아래 「무엇을 어디에 둘 것인가」.
- 코드는 같은 repo 의 `server/` 에 있다. 코드 구조와 규칙, 로컬 실행과 배포 명령은
  [server/AGENTS.md](../../server/AGENTS.md)가 정본이다.

### 서버가 저장하는 것 — 아기 데이터가 아니라 운영 데이터다

아기 데이터는 기기 안에 두는 것이 원칙이다. 아래 것만 서버에 있다.

| 저장하는 것 | 왜 서버인가 |
|---|---|
| 디바이스 키(해시만, `device` 표) | 가족 공유의 구성원 정체이고, 운영자 기기를 알아보려면 서버가 키를 알아봐야 한다. 사람·계정과 연결하지 않는다 |
| 운영자(가족) allowlist | 앱 안에서 풀 수 없어야 한다. 가족 기기 몇 대라 DB 대신 서버 비밀값(`MALKONG_OPERATOR_DEVICE_KEYS`)에 둔다 |
| 가족 공유 사본 — 가족(초대 코드) · 구성원(기기 키 해시 · 동의한 때) · 아기(이름 · 생일) · 할 일 · 장보기 · 루틴과 그 기록(누가 했는지 이름 · 단계 포함) · 우리 아기 메모 | 가족이 같은 아기를 보려면 폰 사이에 서버가 있어야 한다. 동의하고 켠 기기의 것만. 마지막 구성원이 나가면 지운다([task my/007](../task/my/007-family-sharing.md) · [my/009](../task/my/009-family-todos-routines.md)) |

```
금지 ▸ 아기 프로필 · 기록은 이 DB 에 넣지 않는다. 가족 공유를 켠 사용자의 동기화 사본만 예외다.
```

Neon 에는 질문 답변 시절의 표 `daily_usage` · `counted_message` · `reward_tx` · `daily_cost` · `feedback` 이 남아 있다.
서버는 더 만들지도 읽지도 않는다. 지우는 일은 운영 DB 를 건드리는 일이라 Julian 이 정한다.

### 무엇을 어디에 둘 것인가 (2026-10-02 조사)

| 자리 | 선택 | 이유 |
|---|---|---|
| 실행 | **Cloud Run** | 컨테이너형 서버리스 중 FastAPI 에 가장 맞는 선택으로 평가된다 — 0 으로 내려가면서도 진짜 컨테이너를 준다 |
| 상태 | **Neon** (서버리스 Postgres) | 쿼리가 없으면 컴퓨트가 0 으로 내려가 **노는 동안 0원**, 요청이 오면 바로 깨어난다 |
| 비밀값 | Secret Manager | 접속 주소 · 키를 코드 · 앱에 넣지 않는다는 규칙 때문에 |

- **Supabase 에서 Neon 으로 바꿨다.** Supabase 무료 티어는 한동안 안 쓰면 프로젝트를 재우는 방식이라
  깨어날 때 걸린다. Neon 은 컴퓨트만 내려갔다 올라와서 우리 "0원에 수렴" 원칙에 더 맞는다.
- `주의:` Cloud Run 은 **요청을 처리하지 않는 동안 CPU 를 조인다.** 서버에서 도는 백그라운드 작업을 넣을 때 설정을 챙긴다.

조사 근거: [FastAPI 호스팅 비교 2026](https://www.pandastack.ai/blog/best-fastapi-hosting-platforms-2026/) ·
[백엔드 배포 도구 2026](https://northflank.com/blog/best-tools-to-deploy-backends) ·
[Neon vs Supabase 2026](https://dev.to/raxxostudios/supabase-vs-neon-choosing-a-serverless-database-in-2026-23n4)

### 배포 설정

| 설정 | 값 | 이유 |
|---|---|---|
| 리전 | asia-northeast3 (서울) | 사용자가 한국에 있어서 왕복 지연이 가장 짧다 |
| 최소 인스턴스 | 0 | 요청이 없으면 0원에 수렴해야 한다(이 절 첫 규칙) |
| 최대 인스턴스 | 2 | 비용이 갑자기 불어나는 것을 막는 상한 |
| 인증 없는 호출 | 허용 | 앱이 로그인 없이 부르기 때문이다. 가족 공유는 디바이스 키가 있어야 하고, 키 발급은 연결 출처(IP)당 하루 20개로 막는다 |
| 상태 확인 경로 | `GET /health` | `/healthz` 처럼 z 로 끝나는 일부 경로는 Cloud Run 이 예약해 두어 앱까지 오지 않는다 |

### 기기 키

- 앱은 처음 실행할 때 `POST /v1/devices` 로 키를 받아 기기 settings 에 둔다. 서버는 SHA-256 해시만 `device` 표에 둔다.
- 키 발급 남용은 연결 출처(IP)당 하루 20개로 막는다(하루는 한국 시간 0시에 바뀐다). 이 수는 메모리에서만 센다.
- `MALKONG_DATABASE_URL`(Neon)이 없으면 메모리 저장소로 돈다 — 인스턴스가 바뀌면 키를 잊으므로 앱은 401 을 받고
  키를 새로 받는다.

## DB — 두 단계

| 단계 | 어디에 | 무엇을 |
|---|---|---|
| 지금 | **기기 sqlite** (expo-sqlite) | 아기 프로필 · 할 일 · 루틴 · 우리 아기 메모. 가족 공유를 켜면 이것들을 서버 사본과 맞춘다 |
| 지금 | **앱 내장 + 원격 갱신** | L1 지식(월령별 표준). 크기가 작아 앱에 실어 나가고 서버에서 판만 갱신 |
| 지금 | **Neon** (서버리스 Postgres) | 운영 데이터 — 디바이스 키 해시. 아기 데이터는 넣지 않는다 |
| 지금 — 가족 공유를 켠 기기만 | 같은 **Neon** 에 `family` · `family_member` · `family_baby` · `family_record` | 아기 프로필 + 할 일 · 루틴 · 메모의 동기화 사본(`family_record` 한 표에 표시를 달아 함께). 기기 키로 묶이고 명시 동의와 함께만. 로그인은 나중에 가족을 계정에 묶을 때(task my/007) |

```
평시 ▸ 가족 공유를 켜도 무엇이 올라가는지 사용자에게 보여야 한다(가족 화면의 동의 문장).
```

가족 공유(한 아기를 여러 양육자가 함께 보기)가 서버가 아기 데이터를 갖는 유일한 이유다 — SPEC-MY-05. 2026-10-12 부터 초대 코드 · 기기 키로 돈다.

### 사진·파일 — 어디에 두는가

지금 앱은 사진을 다루지 않는다. 넣게 되면 원칙은 위의 데이터 위치 규칙 그대로다 — 기기에 원본을 두고,
가족 공유를 켜면 동기화 사본을 클라우드 저장소(후보: 서버와 같은 GCP 프로젝트의 Cloud Storage)에 둔다.

### 운영자(가족) 기기 — 광고 면제

```
평시 ▸ 서버가 운영자(가족)로 지정한 디바이스 키에는 앱이 광고를 보여주지 않아야 한다.
      지정은 서버 allowlist 로만 한다(앱 안에서 풀 수 없다).
평시 ▸ 운영자 기기가 「일반 사용자로 보기」를 켜면(요청 머리 `X-As-User: 1`) 서버는 그 요청에 일반 기기와
      같은 광고 여부를 돌려줘야 한다. 이 머리는 권한을 낮추기만 하므로 일반 기기에서는 보지 않는다.
```

- 앱은 부팅 시 기기 자격(entitlements — `{ ads, operator }`)을 받아 따른다([api-contract](api-contract.md)).
- 「일반 사용자로 보기」는 운영자가 자기 기기 하나로 일반 사용자 화면을 시험하려고 둔다. 스위치는 마이의 숨은 메뉴에
  있고 운영자 기기에만 보인다(task common/015).
- 광고 정책상으로도 필수다: 본인 기기에서 실광고를 반복 노출·클릭하면 AdMob 계정 정지 사유라서,
  개발·가족 기기는 광고 면제 또는 테스트 광고 ID 로만 간다.

### 알림

아침 알림 · 루틴 알림 · 할 일 알림은 기기 안 규칙으로 만들어 로컬 알림(expo-notifications 예약)으로 보낸다 — 서버가 필요 없다.
가족이 한 루틴의 알림을 다른 폰에서도 바로 지우는 서버 푸시는 애플 개발자 계정이 생긴 뒤에 다룬다(task common/022).

## 기기 DB 스키마 (expo-sqlite)

```sql
CREATE TABLE baby (                        -- 아기 프로필 (당분간 1행)
  id          TEXT PRIMARY KEY,
  name        TEXT,                        -- 선택
  birth_date  TEXT NOT NULL,               -- YYYY-MM-DD. 월령·D+일수는 저장하지 않고 계산한다
  created_at  TEXT NOT NULL,
  updated_at  TEXT                         -- 마지막으로 고친 때 — 가족 공유의 「늦게 고친 쪽이 이긴다」 기준
);
CREATE TABLE record (                      -- L2 — 기록과 요약
  id                 TEXT PRIMARY KEY,
  baby_id            TEXT NOT NULL REFERENCES baby(id),
  kind               TEXT NOT NULL CHECK (kind IN ('기록','요약')),
  label              TEXT NOT NULL,        -- "수유 텀 3시간 · 160ml"
  covers             TEXT,                 -- 완료 처리하는 L1 항목 id 목록, JSON 배열 (홈 추천 차집합의 근거)
  when_label         TEXT,                 -- "10월 8일 대화에서" 같은 시점 표기
  source_message_id  TEXT,                 -- 어느 대화에서 나왔나
  stale              INTEGER NOT NULL DEFAULT 0,   -- 요약이 낡았다고 표시되면 1
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE TABLE care_event (                  -- 빠른 기록 (SPEC-LOG-01, decisions/023) — 수유 · 기저귀 · 잠 · 체온 · 키와 몸무게
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,               -- breast · formula · diaper · sleep · temp · weight · height
  start_at    TEXT NOT NULL,               -- 그 일이 일어난(시작한) 때 ISO
  end_at      TEXT,                        -- 모유 · 잠의 끝. 비어 있으면 재는 중
  amount      REAL,                        -- 분유 ml · 체온 ℃ · 몸무게 kg · 키 cm
  side        TEXT,                        -- 모유 left · right
  diaper      TEXT,                        -- pee · poo · both
  color       TEXT,                        -- 변 색 yellow · brown · green · black · red · white (대변이 있을 때)
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL                -- 가족 공유의 「늦게 고친 쪽이 이긴다」 기준
);
CREATE INDEX ix_event_start ON care_event(start_at);
CREATE TABLE topic (                       -- 할 일 주제 (SPEC-TOPIC-01, decisions/024)
  id          TEXT PRIMARY KEY,            -- tp-…
  kind        TEXT NOT NULL,               -- checkup · milestone · size · routine · general(내 할 일) · shopping(장보기 탭) · custom. 예전 feeding · diaper · outing · sick · solids · paperwork 는 숨김
  title       TEXT NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0,  -- 숨긴 주제 — 지우지 않는다
  sort        INTEGER NOT NULL DEFAULT 0,
  icon        TEXT,                        -- 직접 만든 주제의 아이콘(Ionicons 이름, SPEC-TOPIC-12). 기본 주제는 비움
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE todo (                        -- 할 일 (SPEC-TOPIC-02 · 03) — 끝낸 것도 지우지 않는다(헌장 2)
  id          TEXT PRIMARY KEY,            -- td-…
  topic_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  note        TEXT,
  due_at      TEXT,                        -- 기한 ISO — 시각이 없으면 그날 0시
  has_time    INTEGER NOT NULL DEFAULT 0,  -- 시각까지 정했으면 1 — 그 시각에 알림(SPEC-TOPIC-09)
  buy         INTEGER NOT NULL DEFAULT 0,  -- 살 것 — 장보기 주제에도 모인다
  source      TEXT NOT NULL,               -- manual · starter · repeat(반복 할 일을 완료해 생긴 다음 차례) · auto(앱이 생일로 만듦) · stock(재고 확인에서 부족, task today/003) (나중: paste)
  done_at     TEXT,                        -- 끝낸 때. 되돌리면 비운다. 반복 할 일은 완료할 때 다음 날짜로 새 줄을 쌓는다
  done_by     TEXT,                        -- 누가 완료했나 — 가족 공유를 켠 폰의 「가족 안에서 부를 이름」(task my/009)
  repeat      TEXT,                        -- 반복 규칙(SPEC-TOPIC-06) — daily · weekly:2,5 · monthly:1 · every:3. 없으면 비움
  ref         TEXT,                        -- 앱이 만든 할 일의 규칙 열쇠(SPEC-TOPIC-11, auto-todos.ts) — day:100-photo 등. 직접 적은 할 일은 비움
  ordered_at  TEXT,                        -- 장보기(SPEC-SHOP-02) — 「주문했어요」를 누른 때. 있으면 배송 중
  arrive_at   TEXT,                        -- 장보기 — 도착 예정일(그날 0시)
  store       TEXT,                        -- 장보기 — 어디서(사용자가 적은 이름)
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX ix_todo_topic ON todo(topic_id);
CREATE TABLE routine (                     -- 루틴(SPEC-MAIN-02 · 03 · 05 · 06, decisions/028 · 029) — 목욕 · 터미타임처럼 날마다(또는 N일마다) 챙기는 일
  id             TEXT PRIMARY KEY,         -- rt-…
  title          TEXT NOT NULL,
  kind           TEXT NOT NULL,            -- check(누르면 완료, 단계를 둘 수 있다) · minutes(분을 쌓는다) · stock(재고 확인)
  every_days     INTEGER NOT NULL DEFAULT 1, -- 1 매일, N 이면 지난번에 한 날부터 N일마다
  time           TEXT,                     -- 알림 시각 HH:MM — 없으면 알리지 않는다
  goal_minutes   INTEGER,                  -- 타이머 루틴의 하루 목표(없어도 된다)
  hidden         INTEGER NOT NULL DEFAULT 0, -- 지운 루틴 — 지난 기록은 남긴다
  sort           INTEGER NOT NULL DEFAULT 0,
  running_since  TEXT,                     -- 타이머를 켠 때
  items          TEXT,                     -- JSON 글 배열 — check 는 단계(없으면 비움), stock 은 확인할 물건(task today/003)
  weekdays       TEXT,                     -- JSON 숫자 배열(0 일요일 ~ 6 토요일) — 요일 반복. 있으면 every_days 대신 쓴다(task common/022)
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE TABLE routine_log (                 -- 루틴을 한 번 할 때마다 한 줄 — 오늘 했는지 · 오늘 몇 분 · 지난번은 여기서 센다(헌장 3)
  id          TEXT PRIMARY KEY,            -- rl-…
  routine_id  TEXT NOT NULL,
  at          TEXT NOT NULL,               -- 한 때
  minutes     INTEGER,                     -- 타이머 루틴의 분. 체크는 비움
  by          TEXT,                        -- 누가 했나 — 가족 공유 이름(task my/009)
  step        INTEGER,                     -- 단계 번호(0부터). 루틴 전체를 끝낸 줄은 비움 — 오늘 했는지 · 지난번은 비운 줄로만 센다(task today/003)
  skip        INTEGER NOT NULL DEFAULT 0,  -- 1 이면 「오늘은 건너뛰기」 줄 — 한 것으로 세지 않는다(task common/022)
  created_at  TEXT NOT NULL
);
CREATE INDEX ix_routine_log ON routine_log(routine_id, at);
CREATE TABLE chat_message (                -- 대화 — 2026-10-15 부터 쓰지 않는다(decisions/024). 옛 기기의 표는 남는다
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('user','malkong')),
  content     TEXT NOT NULL,
  meta_json   TEXT,                        -- sources · followup · 저장된 record id 등
  created_at  TEXT NOT NULL
);
CREATE TABLE settings (                    -- 작은 설정값 (광고 제거 구매 사본 · 브리핑 시각 등)
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
CREATE TABLE inbox_card (                  -- 알림함 — 2026-10-15 부터 쓰지 않는다(decisions/024). 옛 기기의 표는 남는다
  id           TEXT PRIMARY KEY,           -- daily-<날짜> · weekly-<월요일> · monthly-<월령> · nudge-<날짜>
  kind         TEXT NOT NULL,              -- daily · weekly · monthly · nudge (나중: family)
  payload_json TEXT NOT NULL,              -- 제목 · 요약 한 줄 · 가리키는 날짜
  read_at      TEXT,                       -- 열어 본 때 — 배지는 이것이 빈 줄의 수
  created_at   TEXT NOT NULL
);
CREATE INDEX ix_chat_created  ON chat_message(created_at);
CREATE INDEX ix_inbox_created ON inbox_card(created_at);
```

- 월령은 항상 `birth_date` 에서 계산한다 — 저장해 두면 낡는다.
- 사용량의 정본은 서버다. 기기에는 표시용 잔여 횟수만 캐시한다.
- 가족 공유(task my/007)에서 `baby`·`record` 만 동기화 대상이다(SPEC-MY-05). `chat_message` 는 올라가지 않는다.
  폰 쪽 상태(가족 정보 · 받은 번호 · 올린 때 · 지운 기록 표시)는 `settings` 의 `family.*` 칸에 둔다.

## changelog

- 2026-09-30 최초 작성 — 서버 형태·DB 2단계·LLM 라우팅 확정 (Julian 결정)
- 2026-10-01 record.covers 를 L1 id 목록(JSON 배열)으로 — 기록 하나가 여러 항목을 닫는다. covers 색인 제거
- 2026-10-02 모델을 하나로 고정(라우팅 ③④ 합침) · 세는 단위는 횟수로 두고 토큰은 서버 안에서 막는다 ·
  어느 급을 쓸지는 비교 측정 후 결정 (사내 AI 담당 조언 반영)
- 2026-10-02 호스팅·DB 확정: Cloud Run + Neon. 서버가 저장하는 운영 데이터 다섯을 명시(빠져 있던 부분) ·
  가족 공유 DB 후보를 Supabase 에서 Neon 으로 바꿈
- 2026-10-02 서버 코드 위치(`server/`)와 배포 설정(서울, 인스턴스 0~2, 인증 없는 호출)을 정의 (task common/002)
- 2026-10-02 모델 연결을 OpenAI 호환 API 대신 각 회사 공식 SDK + 우리 어댑터로 바꿈, Claude 는 Vertex AI 로
  (decisions/007, task common/003)
- 2026-10-02 사진 저장 위치 — 프로필·기록 사진만 가족 공유 때 동기화 사본, 질문 사진은 챗 이력처럼 기기에만,
  모델에는 읽게만 하고 저장하지 않음 · 무료 티어로 사진 금지
- 2026-10-02 운영 모델을 Gemini 3.5 Flash-Lite 로 정함 — 「어느 급」 미결 해소, 고르는 방식을 "가장 싼 모델부터
  같은 질문 세트로 재서 기준을 넘는 첫 모델"로 정의 (decisions/008, task common/003)
- 2026-10-02 위험 신호를 두 겹으로 — 규칙이 먼저, 놓친 것은 모델이 범주만 표시하고 서버가 고정 안내로 바꾼다
  (decisions/010, 규칙만으로는 새 말투의 51% 만 잡았다)
- 2026-10-07 온디바이스 모델은 도입하지 않는다로 확정 — 「저위험 작업에 한해 재검토」 조항 삭제 (Julian)
- 2026-10-06 일일 한도를 다시 정의 — 광고 1편 = 정밀 5회(하루 2편), 일반 기준 답 하루 20회(무료 티어로 보내지 않음),
  서버 전체 하루 비용 천장 (decisions/019, task common/014)
- 2026-10-06 운영자 기기의 「일반 사용자로 보기」(`X-As-User`) (task common/015)
- 2026-10-08 서버가 저장하는 것에 「근거 없음 로그」(분류 × 월령 띠, 원문 없음) 추가 (task common/017)
- 2026-10-12 가족 공유 — 서버가 아기 · 기록 사본을 갖는다(초대 코드 · 기기 키, 동의 뒤). Neon 에 family 표 넷, 기기 baby 에 updated_at (task my/007)
- 2026-10-22 서버의 질문 답변 · LLM 파이프라인 · 하루 한도 · 보상 광고 · 피드백 · 코호트 절을 뺌 — 서버는 기기 키 · 자격 · L1 내려받기 · 가족 공유만, 자격은 `{ ads, operator }`, 가족 사본에 메모 (task common/022 · 024)
