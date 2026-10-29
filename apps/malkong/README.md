# 육아버디 (코드명 malkong)

육아의 주제(분유, 기저귀, 접종 · 검진, 외출, 아플 때, 이유식, 장보기)마다 할 일을 적고, 기록과 끝낸 할 일이 쌓여
다음에 먼저 꺼내 주는 앱. 빠른 기록(수유 · 기저귀 · 잠 · 체온 · 키와 몸무게)이 주제에 숫자를 채운다.

## 지금 상태 (2026-10-29)

- **방향 전환(2026-10-15)**: AI 육아 상담을 빼고 **주제별 육아 할 일과 기록**으로 바꿨다([decisions/024](docs/decisions/024-topic-todo-no-ai-answers.md)).
  헌장 · 제품 브리프 · 메인 설계를 새로 쓰고, 할 일 탭 SPEC([topic](docs/menu-spec/topic.md))을 새로 썼다. 버디 · 우리 아기 · 일정 탭의 SPEC 은 보관.
  같은 날 [topic/001](docs/task/topic/001-topic-todo-tab.md) 로 **탭 셋(할 일 · 기록 · 마이, 할 일이 첫 화면)** 이 됐다 — 주제별 할 일 · 오늘 할 일 · 두 번 터치 적기와
  날짜 읽기 · 추천 목록 · 장보기로 모이는 살 것 · 접종 · 검진 할 일 · 할 일 알림. 버디 · 우리 아기 · 일정 탭과 거기에만 쓰던 코드 37개 파일은 지웠다.
  이어서 [topic/002](docs/task/topic/002-planet-map-grid-repeat.md) 로 할 일 탭 맨 위에 **주제 그림**(예전 지식 지도의 행성을 주제로 — 이번 달 할 일 점 ·
  반복 할 일 위성 · 이번 주 완료 수), 주제는 **동그라미 그리드**, **반복 할 일**(매일 · 매주 · 매달 · 며칠마다, 「매달 1일 분유 주문」처럼 적어도 읽음,
  세 번 완료하면 반복 추천), **아침 알림**은 일주일 치를 날짜마다 그날 할 일 제목으로.
  그다음 [topic/003](docs/task/topic/003-app-filled-topics.md)([decisions/025](docs/decisions/025-app-filled-topics.md))으로 **기본 주제를 앱이 할 일을 채워 주는 다섯**
  (접종 · 검진, 신청 · 서류, 기념일, 사이즈 바꾸기, 생활 루틴)과 **내 할 일**로 바꿨다. 아기 생일로 출생신고 · 부모급여 · 100일 촬영 예약 같은
  할 일이 기한 전에 저절로 생기고, 내가 적는 할 일은 보통 할 일 앱처럼 오늘 · 예정 · 날짜 없음으로 본다. 분유 · 기저귀 · 외출 같은 예전 주제는 숨겼다.
  이어서 [topic/004](docs/task/topic/004-home-shop-tabs.md)([decisions/026](docs/decisions/026-everyday-shopping-home-tab.md))로 **탭 다섯(홈 · 할 일 · 장보기 · 기록 · 마이)** 이 됐다 —
  일상에서 깜빡하는 일과 장보기에 집중. 홈은 행성 그림과 오늘 · 장보기 · 다가오는 날 · 루틴 한눈 요약, 장보기는 살 것 → 주문했어요 → 배송 중 → 받음.
  신청 · 서류는 정부와 다른 앱이 이미 챙겨서 뺐고, 기록 탭은 그대로 두고 더 키우지 않는다.
  [topic/005](docs/task/topic/005-custom-topics.md)로 **주제 직접 만들기** — 추천 주제(어린이집 준비 · 여행 짐 · 외출 가방)를 한 번 눌러 할 일이 채워진 목록을 만들고,
  이름 · 아이콘을 골라 직접 만들고, 다시 쓰는 목록은 「모두 체크 해제」.
  [topic/006](docs/task/topic/006-thoughtful-alerts.md)로 **알림을 섬세하게** — 알림에서 바로 완료 · 1시간 뒤, 반복 할 일 「7일 만이에요」, 아기가 자는 중이면 소리 없이,
  아침 알림에 도착 예정, 저녁 8시 내일 할 일, 도착 예정일 저녁 「받으셨나요?」.
  [topic/007](docs/task/topic/007-log-to-my-shop-places.md)([decisions/027](docs/decisions/027-log-under-my-shop-by-place.md))로 **탭 넷(홈 · 할 일 · 장보기 · 마이)** —
  기록은 마이 → 기록으로 옮기고 기록 알림은 기본 꺼짐. 장보기는 살 곳별(마트 · 다이소 · 온라인 · 기타), 「다이소에서 수납함」처럼 적으면 살 곳을 읽고, 매장 지난번 목록 다시 담기.
  2026-10-16 [decisions/028](docs/decisions/028-assistant-today-routines.md)로 **육아비서** 방향 — 첫 화면 「오늘」에서 루틴(목욕 · 터미타임 · 비타민D 처럼 날마다 챙기는 일)을
  한 번 눌러 완료(몇 시에), 터미타임은 +5분 · 타이머로 오늘 누적, 정한 시각까지 안 했으면 푸시([today/001](docs/task/today/001-routines.md)). 행성 그림은 첫 화면에서 뺐다.
  루틴은 베이비타임처럼 3열 버튼 모음으로 다 보이고, 추천도 버튼으로 바로 추가된다. 「했어요」 같은 어색한 문구를 정리했다([today/002](docs/task/today/002-routine-buttons.md)).
  장보기 탭은 **리스트**(살 것 + 준비할 것)로 — 날짜가 아니라 살 것 · 준비할 것 기준, 외출 가방 · 여행 짐 같은 목록은 준비할 것으로 옮겼다([list/001](docs/task/list/001-list-tab.md)).
  [my/009](docs/task/my/009-family-todos-routines.md)로 **가족 공유에 할 일 · 리스트 · 루틴**을 싣고 「아빠 · 08:10」처럼 누가 했는지 보인다(서버 고침, 2026-10-16 운영 배포 — revision 00023).
  같은 날 캔버스 시안(https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x)으로 다시 짰다([today/003](docs/task/today/003-routine-redesign.md), [decisions/029](docs/decisions/029-routine-tab-structure.md)) —
  **탭 넷(루틴 · 할 일 · 장보기 · 마이)**. 루틴 탭은 진행 카드(「오늘 루틴 2 / 5 완료 · 다음 목욕」)와 버튼 보기 · 시간순 보기 전환,
  단계가 있는 루틴(밤잠 준비: 스와들 → 수유 → 트림 → 자장가), 재고 확인(부족한 것을 장보기에 추가), 시기별 · 있는 곳별(병원 · 산후조리원 · 집) 추천.
  할 일 탭에 준비 목록(외출 가방 · 여행 짐)과 곧 시작하는 접종 · 검진, 장보기 탭은 살 것만. 신청 · 서류는 넣지 않는다.
  2026-10-19 「알아서 다듬기」([common/022](docs/task/common/022-simplify-and-finish.md), [decisions/030](docs/decisions/030-simplify-and-finish.md)) —
  기록 화면 · 기록 알림 · 만화 · 예전 AI 상담 코드를 뺐고(코드 4,593줄), 루틴에 「오늘은 건너뛰기」 · 요일 반복, 할 일 탭은 요약 + 상세로,
  마이는 카드 셋, 약관 · 개인정보 · 자주 묻는 질문을 지금 기능대로 다시 썼다(초안).
  2026-10-20 시안 「제안 3」의 C안([today/004](docs/task/today/004-hero-and-add-form.md)) — 루틴 탭 위쪽이 먹색 머리(진행 고리 · 「3개 남았어요」 ·
  다음 루틴을 바로 하는 큰 단추)가 됐고, 완료한 버튼은 연한 코랄. 루틴 추가에서 추천을 다시 누르면 빠지고(되돌리기), 직접 만들기 · 편집은
  목록형 새 화면(반복 고르기 창, 폰의 시각 바퀴)이다.
  2026-10-21 시안 「제안 4」([decisions/031](docs/decisions/031-merge-shop-growth-tab.md)) — 장보기를 할 일 탭의 카테고리로 합쳤고([topic/008](docs/task/topic/008-todo-shop-merge.md)),
  장보기 자리에 **성장 탭**([growth/004](docs/task/growth/004-stage-tab.md)): 시기마다 바뀌는 버디(누워서 바둥 · 기기 · 걷기, AI 로 만든 움직이는 그림),
  발달 막대(CDC), 이맘때, 우리 아기 메모(이 폰에만). 탭은 루틴 · 할 일 · 성장 · 마이.
  2026-10-22 할 일 탭을 세 칸(내 할 일 · 장보기 · 아기 일정, [topic/009](docs/task/topic/009-todo-three-tabs.md))으로, 성장 탭을 한눈 요약 + 상세 화면 셋
  (발달 체크 · 해 주면 좋아요 · 알아 두면 좋아요, [growth/005](docs/task/growth/005-stage-depth.md))으로 바꿨다. 성장 탭의 새 공공 지식 85개는 같은 날 원문과 대조해 승인했다(판 2026.10.4).
  같은 날 처음 쓰는 부모로 하루 써 보고 불편한 곳 여섯을 고쳤고([common/023](docs/task/common/023-persona-polish.md)), Expo SDK 57 패치 버전을 맞췄다(expo-doctor 21/21 통과).
  2026-10-23 아이콘 · 시작 화면을 먹색 + 별로, 로고(글자 + 별)([decisions/032](docs/decisions/032-dark-icon-logo-splash.md)), 스토어 리뷰 요청([my/010](docs/task/my/010-store-review-prompt.md)).
  같은 날 엄마 · 아빠 × 신생아 · 6개월 이후 페르소나 시험 뒤 고친 것 — 12~24개월 공공 지식(접종 · 검진 · CDC 15 · 18 · 24개월, [growth/006](docs/task/growth/006-toddler-knowledge.md)),
  월령별 루틴 · 할 일 추천(2개월부터 스와들 대신 수면 조끼, [today/005](docs/task/today/005-age-recommend.md)), 생일이 바뀌면 앱 할 일 다시 맞추기 · 초대 코드로 바로 참여 ·
  온라인 쇼핑몰 묶기([common/026](docs/task/common/026-persona-fixes.md)), 성장 탭 오늘의 놀이 · 성장 일기 · 성장 소식([growth/007](docs/task/growth/007-growth-plus.md)).
  2026-10-27 TestFlight 로 써 본 뒤 루틴 타이머를 빼고 추천을 며칠마다 하는 일 중심으로 바꿨다([today/006](docs/task/today/006-periodic-routines.md)).
  2026-10-28 **첫 화면을 홈 탭으로**([today/007](docs/task/today/007-home-first-screen.md), [decisions/034](docs/decisions/034-home-tab-app-filled-first.md)) —
  기록 앱 옆에 같이 깔아 두는 앱으로 자리를 정하고, 생일로 채운 다가오는 일(접종 · 검진 · 기념일 · 사이즈)을 첫 화면에 올렸다.
  탭은 홈 · 할 일 · 성장 · 마이, 루틴은 홈의 「오늘 할 루틴 · 전체 ›」로 들어가는 화면이다.
  2026-10-29 **폰 홈 화면 위젯 · 첫 실행의 1년 화면 · 반응하는 버디**([decisions/035](docs/decisions/035-widget-first-year-buddy.md), [today/008](docs/task/today/008-home-widget.md) · [009](docs/task/today/009-buddy-reaction.md), [my/011](docs/task/my/011-first-year-reveal.md)) —
  위젯은 아이폰 `expo-widgets`(Expo 공식) + 안드로이드 `react-native-android-widget`, 앱 입구가 `index.ts`(안드로이드 위젯 작업 처리기 등록). Expo Go 에는 위젯이 없다.
  화면 문구는 점검표([korean-copy-check](../../docs/governance/korean-copy-check.md))와 `npm run copy-check` 로 본다([common/027](docs/task/common/027-copy-check.md)).
  아래 「앱」 줄은 방향 전환 전의 기록이다
- **저장소**: 2026-10-14 에 저장소가 여러 앱을 담는 `julian-studio` 가 되면서 육아버디는 `apps/malkong/` 으로 옮겼다. 모든 앱에 통하는 규칙은 루트 [AGENTS.md](../../AGENTS.md)
- **앱**: 시안 B 「단정한 비서」([decisions/012](docs/decisions/012-chat-first-three-tabs.md)), 탭 다섯 —
  **기록**(첫 화면, 2026-10-12 · 모유 · 분유 · 기저귀 · 잠 · 체온 · 몸무게 · 키를 한두 번 눌러 · 재는 중 타이머 · 날짜별 기록 · 일주일 그래프 ·
  수유 알림 · 체온 위험 안내, [log/001](docs/task/log/001-quick-log-tab.md), 헌장 5조 변경 [decisions/023](docs/decisions/023-quick-log-first-tab.md)) ·
  **버디**(데일리 브리핑(아기 안부 · 부모 안부 · 오늘 챙길 것) · 알림함 · 진짜 답 · 질문마다 다른 처리 현황 · 되묻기와 기록 · 버디의 짐작(맞아요 · 아니에요) · 위험 신호 · 피드백 · 하루 한도 · 최근 50줄부터) ·
  **우리 아기**(3D 지식 지도 — 누르면 「버디가 아는 것」 상세 · 주제별 가로 막대 · 함께한 시간 한 줄, [baby/004](docs/task/baby/004-overview-and-depth.md)) ·
  **일정**(달력 · 고른 날의 브리핑과 그날 나눈 대화 줄 · 챙길 것 여정 그래픽 · 주간 · 월간 브리핑, [decisions/017](docs/decisions/017-schedule-tab-and-inbox.md)) ·
  **마이**(알림 한 줄 → 상세 · 가족과 함께 보기(초대 코드) · 약관 초안). 광고 없이 쓰기(결제)는 첫 출시에서 뺐다(광고만, 2026-10-12).
  하루 기록이 사흘째 비면 적을 카드와 저녁 알림 한 번([decisions/016](docs/decisions/016-daily-log-out-of-briefing.md)).
  브리핑은 기기 안 규칙과 문구 틀로 만든다([decisions/018](docs/decisions/018-daily-care-briefing.md)). 부모 돌봄 L1 넷 승인(2026-10-04).
  온보딩은 생일 → 브리핑 알림 시각. 만화 5컷([my/006](docs/task/my/006-intro-toon.md))은 마이 제목 줄 오른쪽 「육아버디 스토리」에서 본다(처음 실행에는 안 뜸, [my/008](docs/task/my/008-intro-in-my.md), 2026-10-12). 광고(AdMob 배너·보상형), 캐릭터 버디 아이콘
- **Expo 계정** `@julian-malkong/malkong` 연결, 앱 식별자 `com.yugabuddy.app`(iOS · Android, app.json). Julian 아이폰(Expo Go)으로 볼 수 있다
- **지식(L1)**: 판 2026.10.5 — 0~35개월 접종 · 검진, CDC 2개월~2세 발달 · 놀이 · 알아 둘 것(이 줄 아래 설명은 예전 것) — 접종·검진(질병관리청·건보공단 일정)과 발달·수유·수면·생활·안전·위험 신호·부모 돌봄(미국 CDC)
- **서버**: `/v1/ask`(위험 신호 규칙 → L1 검색 → Gemini 3.5 Flash-Lite → 답 검사), 기기 키, 재시도 안전, 피드백,
  보상형 광고 확인(SSV), 하루 한도 정책 v2 — 정밀 답변 10회 · 광고 1편에 5회(하루 2편) · 그 뒤 일반 기준 답 20회 ·
  서버 전체 하루 모델 비용 천장 330원([decisions/019](docs/decisions/019-generous-limits-hard-daily-budget.md)).
  Cloud Run 에 revision 00012(2026-10-08 — **Gemini 유료** · **Neon(싱가포르)에 기기 키 · 사용량 · 하루 비용 저장** · 부모 돌봄 L1 ·
  **Julian 폰이 가족 기기로 등록**되어 「일반 사용자로 보기」 숨은 스위치가 있다([common/015](docs/task/common/015-operator-user-view.md)) ·
  위험 신호 규칙 오탐 수정(「아기 주변에서 담배 피우면」이 피 섞인 변으로 잡히던 것)과 수면 검색 낱말 보강([common/016](docs/task/common/016-l1-reach.md)) ·
  근거 없이 답한 질문을 주제 × 월령 띠로 세는 로그([common/017](docs/task/common/017-ungrounded-count.md)) ·
  **답의 모양** 결론 → 왜(이 월령에 흔한 일인지) → 지금 할 것 → 진료 기준, 우리 아기 기록을 앞머리에([ask/010](docs/task/ask/010-answer-shape.md)))가
  올라가 있다. revision 00013(2026-10-11)은 바로 앞 대화를 보고 답하기 · 「일반적으로는」 접두어 걷기([ask/012](docs/task/ask/012-conversation-context.md)).
  revision 00014(2026-10-12)는 **지식 내려받기** — 판 확인 · 승인 항목 묶음(`/v1/knowledge/version` · `bundle`, 기기 키 없이), 앱은 하루 한 번
  비교해 새 판을 받아 저장한다([common/019](docs/task/common/019-knowledge-bundle-download.md)). 지식을 고치면 승인 → `src/data/l1/version.json` 판 올리기 →
  `sync_l1` → 서버 배포로 스토어 없이 나간다. revision 00015(2026-10-12)는 **가족 공유** `/v1/family` — 초대 코드 · 기기 키로 아기 · 기록을
  폰끼리 맞춘다([my/007](docs/task/my/007-family-sharing.md)). revision 00016(2026-10-12)은 **대화 기억** — 대화 요약 · 질문 주제에 닿는 기록만 ·
  「무슨 상관이야」 같은 반박 알아듣기([ask/013](docs/task/ask/013-conversation-memory.md), [decisions/022](docs/decisions/022-conversation-memory.md)).
  revision 00017(같은 날)은 요약이 앞 내용을 잃지 않게 한 프롬프트 보강. Julian 이 폰으로 써 보는 것이 남음.
  revision 00018(같은 날)은 가족 맞추기에 기록 탭의 빠른 기록(`events`)을 싣는 것([log/001](docs/task/log/001-quick-log-tab.md)).
  revision 00020(같은 날)은 변 색 맞추기([log/002](docs/task/log/002-log-detail-and-reminders.md)). **승인 대기 L1 초안 셋**(잠 0~3개월 · 1~2세, 분유 2~5개월 간격) — 승인해야 그래프 기준표에 나온다. 자동 모드가 운영 배포를 막을 때는 Julian 이 server/AGENTS.md 「배포」 명령을 직접 친다(00012 · 00014 · 00015 가 그랬다)
- 웹 화면 몰아 시험 통과(시안 B 포함, [common/008](docs/task/common/008-first-release-check.md)). 아이콘·광고는 개발 빌드부터
- **홍보 자료(보관 — 배포 때 · 앱 첫 실행에 쓴다)**: 만화 「아빠가 육아 앱을 만든 이유」 5컷 · 릴스 30초(`marketing/toon/`, 앱 첫 실행에도 들어가 있다),
  스토어 첫 장 「검색 대신, 근거로 답해요」 — 지식층 · 답 파이프라인 흐름도 + 진짜 앱 화면(`marketing/store/`, 앱스토어 · 구글 플레이 두 크기).
  정본 · 규칙은 [store-toon](docs/product/store-toon.md)
- **설계 문서와 코드를 맞췄다(2026-10-05)**: 질문 처리 단계(위험 신호 규칙 → 재시도 캐시 → 모델 → 답 검사)의 된 것 · 아직인 것 ·
  모델 호출 횟수 · 모델을 부르지 않는 기기 안 화면은 [backend](docs/architecture/backend.md) 「LLM 파이프라인」, L2 가 쌓이는 길은
  [knowledge-layers](docs/architecture/knowledge-layers.md) 「채워지는 경로」
- **온톨로지 세미나 뒤 정리(2026-10-08)**: 지식층은 규칙으로 판단하는 작은 루프로 둔다 — 그래프 · 벡터 DB · 온톨로지 스택 · 대화방 나누기 ·
  온디바이스 모델은 넣지 않는다([decisions/020](docs/decisions/020-rule-based-judgment-loop.md)). 어휘 대응표(분류 아홉 ↔ 영역 여섯,
  [knowledge-layers](docs/architecture/knowledge-layers.md) 「어휘」) · 승인된 지식은 모두 어느 질문에는 닿아야 한다는 시험(평가 질문 30 → 56개,
  [common/016](docs/task/common/016-l1-reach.md)) · 근거 없음 로그([common/017](docs/task/common/017-ungrounded-count.md)) ·
  버디의 짐작은 확인 뒤 기록([ask/008](docs/task/ask/008-confirm-guess.md)) · 대화는 최근 50줄부터, 날짜에서 그날 대화로([ask/009](docs/task/ask/009-recent-window-and-day-jump.md))
- 끝난 작업과 진척의 정본은 [docs/task/](docs/task/) 의 task 파일이다

## 다음 시작점 (2026-10-26) — 애플 먼저, Julian 만 할 수 있는 것

Julian(2026-10-22): 애플만 먼저 출시한다. 순서 전체는 [common/008](docs/task/common/008-first-release-check.md) 「애플 먼저」.
애플 개발자 · AdMob(iOS id 둘) · 운영자 정보는 끝났다(2026-10-23). 첫 빌드는 TestFlight 에 올라갔다(2026-10-26).

1. ~~서버 배포~~ — 2026-10-26 revision 00024-zc4, 공공 지식 판 2026.10.5(236개)
2. ~~첫 iOS 빌드~~ — 2026-10-26 빌드 1.0.0 (3), `--auto-submit` 으로 App Store Connect 에 올림(TestFlight 만, 심사 제출 아님).
   2026-10-29 빌드 1.0.0 (7) — 홈 탭 · 위젯 · 1년 화면 · 버디가 들어감. 위젯 확장과 App Group 이 앱 파일 안에 들어간 것을 확인했다(빌드 4~6 은 권한 설정 중 멈춘 번호)
3. **TestFlight 로 써 보기** — Julian 폰의 TestFlight 앱. 진짜 광고가 나오니 누르지 않는다
   - 2026-10-27 써 본 뒤 고친 것(task today/006): 루틴 타이머 빼기, 추천을 며칠마다 하는 일 중심으로, iOS 알림 스위치 어긋남.
     2026-10-28 첫 화면을 홈으로(task today/007). 2026-10-29 위젯 · 첫 실행 1년 화면 · 버디 반응(task today/008 · 009, my/011).
     모두 다음 빌드(`npx eas-cli@latest build --platform ios --profile production --auto-submit`)에 들어간다. 위젯은 TestFlight 에서 홈 화면에 추가해 보고,
     위젯에서 루틴을 완료한 뒤 앱을 열었을 때 반영되는지 본다(앱이 꺼진 채로 눌러 보기)
   - 2026-10-29 빌드 (7)을 써 본 뒤 고친 것 — **빌드 1.0.0 (8)로 TestFlight 에 올림**(2026-10-29): 위젯 모양(버디 그림이 위젯을 덮던 것, 큰 날수 · 「외 N개」, today/010),
     홈 칸 나누기(루틴 가로 한 줄 · 「아기 일정」 · 「함께한 지」, today/011), 성장 탭 움직임 · 기념일 장면(growth/008), 성장 탭 카드 둘(growth/009),
     기념 카드 공유(growth/010, 새 네이티브 모듈 react-native-view-shot · expo-sharing), 아기 일정 앞날 일정 편집 · 접종 · 검진 예약일(topic/010).
     폰에서 볼 것: 위젯 작은 칸 · 중간 칸(밝은 · 어두운 모드), 홈 루틴 가로 넘기기, 성장 탭 움직임, 공유 창에서 사진 저장 · 메신저 보내기, 예약 알림.
     빌드 명령: `EXPO_NO_CAPABILITY_SYNC=1 npx eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive --no-wait`.
     `--non-interactive` 로 자동 제출하려면 eas.json 제출 설정에 App Store 앱 번호(`ascAppId`)가 있어야 한다 — 빌드 8 때 넣었다
   - **위젯이 들어간 첫 빌드**: Apple 개발자 사이트에서 App Groups(`group.com.yugabuddy.app`)를 만들고 앱 · 위젯 App ID 둘 다에 켰다(Julian, 2026-10-29).
     EAS 가 이 권한을 자동으로 켜는 기능이 Apple API 오류로 깨져 있어서(eas-cli issue 3986, 열림) 빌드 명령 앞에 늘 `EXPO_NO_CAPABILITY_SYNC=1` 을 붙인다.
     위젯 쪽 인증서는 처음 한 번 대화형 빌드(`--non-interactive` 없이)로 만들어야 한다 — 그 뒤로는 비대화형으로 된다. 빌드 번호는 원격(remote)이라 CLI 가 올린다
4. **출시는 Julian 이 정할 때** — 스토어 정보 붙여 넣기 · 심사 제출은 common/008 「애플 먼저」 8.
   스토어 스크린샷 일곱 장과 설명은 2026-10-29 홈 기준으로 다시 만들었다(task common/028, 부제 · 슬로건은 Julian 확인 전). 위젯 장은 폰에서 확인한 뒤 추가

출시 뒤 첫 업데이트 후보: 키 · 몸무게(기록 앱과 경쟁하지 않기 · 숫자로 판정하지 않기와 부딪쳐 Julian 결정 필요), 구글 플레이(테스터 12명 · 14일), `app-ads.txt` 용 도메인.
달마다 카드는 기념 카드 공유(growth/010)로 들어갔다.
폰(Expo Go)으로 볼 때는 켜 둔 `npx expo start` 를 한 번 다시 켠다.

## 다른 PC 에서 시작하기

코드 받기, git 계정, Node, Expo 로그인, WSL 터널처럼 모든 앱에 공통인 준비는 저장소 루트
[README.md](../../README.md) 「다른 PC 에서 시작하기」에 있다. 여기는 육아버디만 더 필요한 것이다.
Julian 과 일하는 방식은 루트 [AGENTS.md](../../AGENTS.md) 와 이 폴더의 [AGENTS.md](AGENTS.md), 서버 명령은
[server/AGENTS.md](server/AGENTS.md)에 있다.

- **앱**: 이 폴더(`apps/malkong/`)에서 `npm install`. 앱은 기본으로 배포된 Cloud Run 서버에 묻기 때문에 앱만 고칠 때는 키도 서버도 필요 없다
- **서버**: uv 를 설치하고 `server/` 에서 `uv sync` (Python 3.13 은 uv 가 받는다)
- **Gemini 키(서버를 로컬에서 돌릴 때만)**: git 에 없다. https://aistudio.google.com/apikey 의 「Default Gemini Project」
  무료 키를 `server/.env` 에 `MALKONG_GEMINI_API_KEY=...` 한 줄로 둔다(Julian 이 직접). 무료 키라
  `MALKONG_LLM_PAID_TIER` 는 켜지 않는다 — 아기 기록이 안 간다. 유료 키(Malkong 프로젝트, 월 한도 1만 원)는
  Cloud Run 비밀값에만 있고 Julian 이 관리한다([server/AGENTS.md](server/AGENTS.md) 배포 절)
- **배포할 때만**: gcloud CLI 설치 → `gcloud auth login`(개인 구글 계정) → `gcloud config set project malkong`
- **홍보 그림을 다시 만들 때만**(`marketing/toon/render.sh` · `marketing/store/render.sh`): macOS 와 Google Chrome(`/Applications`) —
  크롬으로 그림을 찍는다. 릴스 mp4 는 Xcode 명령줄 도구의 `swiftc`(`xcode-select --install`), 스토어의 진짜 앱 화면 찍기
  (`marketing/store/capture.mjs`)는 Node 22 이상과 웹 개발 서버(`npx expo start --web --port 8099`)가 필요하다. 글꼴은 웹에서 받으니 인터넷이 있어야 한다

## 핵심 개념

- **지식을 두 층으로 나눈다** — L1(공공 의료·육아 표준)과 L2(우리 아기 기록·요약).
- **대화가 곧 기록이다** — 따로 기록하게 하지 않고, 답하기 전에 필요한 것만 되묻고 그 답을 쌓는다.
- **표준과 기록의 차이가 추천이 된다** — L1 − L2 차집합이 홈의 "지금 챙길 것"이다.
- **위험한 순간엔 답을 만들지 않는다** — 규칙 필터가 먼저 걸러 병원·119 로 안내한다.

## 문서

설계가 정본이고 코드보다 먼저 읽는다. 진입점은 [docs/README.md](docs/README.md)(문서 지도와 메뉴 코드)이고,
작성 규칙과 작업 순서는 저장소 공통 [conventions](../../docs/governance/conventions.md)에 있다.

| 폴더 | 담는 것 |
|---|---|
| `docs/constitution.md` | 모든 SPEC 위에 있는 불변 원칙 |
| `docs/product/` | 제품 브리프 — 계기·컨셉·차별성·스토어 문구의 원천 |
| `docs/architecture/` | 전체 방향 · 지식층 · 서버/DB/LLM · L1 지식베이스 · API 계약 |
| `docs/menu-spec/` | 탭 4개의 SPEC(WHAT)과 구현 방법(HOW) |
| `docs/app-design/` | 디자인 시스템 · 기술 스택 · 코딩 스타일 |
| `docs/decisions/` | 결정 기록(ADR) — 대안을 기각한 이유 |
| `docs/task/` | SPEC 을 코드로 만드는 작업 단위 |

## 실행

모든 명령은 이 폴더(`apps/malkong/`)에서 친다. 저장소를 받은 곳에서 `cd apps/malkong` 부터.

```bash
npm install
REACT_NATIVE_PACKAGER_HOSTNAME=<맥 IP> npx expo start --go   # 아이폰 Expo Go — 맥 IP 는 `ipconfig getifaddr en0`
npx expo start --web  # 웹 미리보기
npx tsc --noEmit      # 타입 검사
npx expo lint         # 린트
```

`--go` 는 꼭 붙인다 — `expo-dev-client` 가 깔려 있어서 빼면 개발 빌드용으로 켜져 Expo Go 가 열지 못한다.
`REACT_NATIVE_PACKAGER_HOSTNAME` 은 폰이 찾아올 맥 주소를 정해 둔다(와이파이가 바뀌면 숫자도 바꾼다).
화면이 이상하거나 고친 것이 안 보일 때만 `--clear` 를 더한다.

## 스택

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router · StyleSheet + 테마 토큰 ·
react-native-svg · expo-sqlite(기기 저장). 백엔드는 FastAPI(예정).
