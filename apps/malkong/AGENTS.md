# 육아버디(코드명 malkong) — 이 앱만의 규칙

먼저 저장소 루트 [AGENTS.md](../../AGENTS.md) 를 읽는다(하지 말 것 1순위, Julian 과 일하는 방식, Expo 규칙). 이 파일은 거기에
육아버디만의 것을 더한다. 명령은 이 폴더(`apps/malkong/`)에서 실행한다.

## 하네스 — 설계와 작업의 정본

서비스 이름은 **육아버디**, 캐릭터는 **버디**(쪽쪽이 문 아기)다(decisions/014 · 015). 코드 · GCP · EAS 의 코드명은 malkong 그대로 둔다.
2026-10-15 부터 **주제별 육아 할 일과 기록** 앱이다 — AI 육아 상담은 뺐다([decisions/024](docs/decisions/024-topic-todo-no-ai-answers.md)).

설계 문서가 `docs/` 에 있고, 코드보다 먼저 읽는다. 문서 체계와 작업 순서는 저장소 공통 규칙
[conventions](../../docs/governance/conventions.md) 를 따른다.

- 지금 어디까지 왔고 다음에 무엇을 할지: [README.md](README.md) 「지금 상태」「다음 시작점」(다른 PC 에서 이어받을 때도 여기부터)
- 문서 지도와 메뉴 코드(지금 `SPEC-<LOG|TOPIC|MY>-NN`, 나머지는 보관): [docs/README.md](docs/README.md)
- 모든 SPEC 위에 [docs/constitution.md](docs/constitution.md)가 있다 — 충돌하면 constitution 이 이긴다
- 무게 있는 선택(다른 안을 버린 것)은 [docs/decisions/](docs/decisions/README.md)에 남긴다. 스토어 문구와 포지셔닝의 원천은
  [docs/product/product-brief.md](docs/product/product-brief.md)
- 앱은 육아 질문에 답하지 않고 의료 판단을 하지 않는다(헌장 5). 의료에 닿는 것은 접종 · 검진 일정과 기록의 위험 신호 고정 안내뿐이고,
  둘 다 출처 화이트리스트 원칙([knowledge-layers](docs/architecture/knowledge-layers.md))을 따른다
- 스택 · 스타일 결정은 [docs/app-design/README.md](docs/app-design/README.md)가 정본이다 — StyleSheet+토큰, NativeWind 미도입, Skia 는 하이브리드로
- 서버 명령과 배포는 [server/AGENTS.md](server/AGENTS.md)

## 육아버디만의 규칙

- **의료 승인**: L1 항목(접종 · 검진 일정, 위험 신호 안내)의 `approved` 전환은 Julian 이 「승인」이라고 말해야만 한다. 대신 누르지 않는다.
  루트 작업 흐름의 「앱마다 정한 승인 절차」가 이것이다
- **AI 모델**: 붙여 넣은 글을 할 일로 나눌 때만 쓴다(헌장 13). 다른 곳에 붙이려면 먼저 Julian 에게 묻는다. 시험은 FakeLlm 이나 가짜 응답으로 한다
- 서버에 아기 데이터를 저장하거나 로그로 남기지 않는다(가족 공유에 동의한 사본은 예외 — decisions/021). AI 이미지 생성 · 교체는 더 하지 않는다
- 한국 상담 전화번호(109 등)는 넣지 않는다(Julian, 2026-10-04). 「119 전화하기」 같은 전화 단추도 두지 않는다
- **디자인 언어**: 밝은 바탕 · 먹색 · 포인트는 코랄 하나 · 글은 짧게(2026-10-05). 홍보 · 스토어 그림도 같다
- 「도착했어요」 같은 알림 문구나 「함께 쌓아 온 것」 같은 통계 칸 이름은 쓰지 않는다(루트 「화면은 한눈 요약과 상세 화면으로」의 육아버디 사례)
- 스토어 · 광고 문구에 없는 출처(소아과 등)를 쓰지 않는다 — [store-toon](docs/product/store-toon.md) 「규칙」
