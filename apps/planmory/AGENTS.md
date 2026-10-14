# Planmory(플랜모리, 코드명 planmory) — 이 앱만의 규칙

먼저 저장소 루트 [AGENTS.md](../../AGENTS.md) 를 읽는다(하지 말 것 1순위, Julian 과 일하는 방식, Expo 규칙). 이 파일은 거기에
Planmory 만의 것을 더한다. 명령은 이 폴더(`apps/planmory/`)에서 실행한다.

## 하네스 — 설계와 작업의 정본

설계 문서가 `docs/` 에 있고 코드보다 먼저 읽는다. 문서 체계와 작업 순서는 저장소 공통 규칙
[conventions](../../docs/governance/conventions.md) 를 따른다.

- 지금 어디까지 왔고 다음에 무엇을 할지: [README.md](README.md) 「지금 상태」「다음 시작점」
- 문서 지도와 메뉴 코드(`SPEC-<TODAY|ADD|TOPIC|NOTI>-NN`): [docs/README.md](docs/README.md)
- 모든 SPEC 위에 [docs/constitution.md](docs/constitution.md) 가 있다 — 충돌하면 constitution 이 이긴다
- 방향과 스토어 문구의 원천: [docs/product/product-brief.md](docs/product/product-brief.md)
- 화면 구조, 데이터, 서버: [docs/architecture/main-design.md](docs/architecture/main-design.md)

## Planmory 만의 규칙

- **데이터는 서버가 원본이다**(육아버디와 반대 — [decisions/002](docs/decisions/002-server-as-source.md)). 그래도 탈퇴하면 서버의 기록을
  전부 지우고, 붙여 넣은 원문도 같은 규칙을 따른다
- **AI 모델은 두 곳에만 쓴다** — 붙여 넣은 글을 할 일로 나눌 때, 주제를 만들 때 시작 목록 한 번([decisions/003](docs/decisions/003-ai-two-uses.md)).
  다른 곳에 모델을 붙이려면 먼저 Julian 에게 묻는다
- 앱 화면 문구는 다른 할 일 앱에서 흔히 보는 말로 쓴다(「반복 할 일」, 「추천 할 일」, 「보관함」). 루트 「하지 말 것 1순위」를 특히 지킨다
- 육아버디에서 코드를 가져올 때는 처음에는 복사한다. 두 앱이 같이 고치게 되는 코드가 생기면 그때 `packages/` 로 옮긴다
