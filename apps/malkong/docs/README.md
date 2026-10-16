# 말콩(malkong) 문서 체계

> 두 가지를 Neuro 에서 본떴다 — **문서 하네스는 `neuro-spec`의 구조**를, **지식층은 Neuro 의
> Knowledge Foundation(K1~K4)**을 줄여서 가져왔다. 무엇을 가져오고 무엇을 두고 왔는지는
> [knowledge-layers](architecture/knowledge-layers.md) 첫 절에 적어 두었다. 가져온 것은 구조와
> 원칙이고, 회사 문서의 내용을 옮겨 오지는 않는다.

이 폴더가 육아버디 설계의 정본이다. 문서 흐름(constitution → architecture → menu-spec → task → 코드 → 확인)은
[conventions](../../../docs/governance/conventions.md) 「문서 흐름」을 따르고, 아래는 육아버디의 실제 문서 지도다.

| 문서 | 담는 것 | 갱신 시점 |
|---|---|---|
| `constitution.md` | 불변 원칙 — 제품 8 + 개발 5. 모든 SPEC 위에 있다 | 거의 안 바뀜. 바꾸면 changelog |
| `product/` | 제품 브리프 — 계기·컨셉·차별성·스토어 문구의 원천 | 포지셔닝이 바뀔 때 |
| `architecture/` | 제품 전체의 방향(main-design) · 지식층(knowledge-layers) · 서버/DB/LLM/기기 DB 스키마(backend) · L1 지식베이스 실체(l1-knowledge-base) · 앱↔서버 API(api-contract) | 방향이 바뀔 때만 |
| `menu-spec/` | 메뉴별 상세 설계(탭 다섯 — main-design 「구조」). SPEC 문장(WHAT)과 구현 방법(HOW) | 기능이 정해지거나 바뀔 때 |
| `app-design/` | 디자인 시스템 · 기술 스택 · 코딩 스타일. 최신(SOTA) 근거 포함 | 스택·스타일 결정이 바뀔 때 |
| `decisions/` | 결정 기록(ADR) — 대안을 기각한 이유. 정의는 다른 문서가 소유 | 무게 있는 선택마다 |
| `task/` | spec을 코드로 만드는 작업 단위. 메뉴별 폴더에 누적 | 작업 시작·진행·완료마다 |

## SPEC 번호와 작성 규칙

SPEC 번호, 문서 작성 규칙 여덟, 작업 순서는 저장소 공통 규칙 [conventions](../../../docs/governance/conventions.md) 를 따른다.
육아버디가 더하는 것만 여기 적는다.

- 메뉴 코드는 지금 `MAIN`(루틴 탭) · `TOPIC`(할 일 탭) · `SHOP`(장보기 탭) · `LOG`(마이 → 기록) · `MY`(마이). `HOME` · `ASK` · `BABY` · `GROW` 는
  2026-10-15 방향 전환으로 보관했다(decisions/024) — 문서는 남기고 지금의 SPEC 으로 쓰지 않는다. 홈은 그래서 `HOME` 이 아니라 `MAIN` 이다
- 작성 규칙 8 「출처를 남긴다」: 접종 · 검진 일정과 위험 신호 안내처럼 의료에 닿는 내용은 출처 화이트리스트의 근거를 적는다([knowledge-layers](architecture/knowledge-layers.md)).
- 작업 순서 4 「구현」의 품질 검사는 [constitution](constitution.md) 개발 원칙 11 이 정한다.

## 용어

| 말 | 뜻 |
|---|---|
| 주제 | 할 일을 묶는 육아의 한 갈래 — 분유, 기저귀, 접종 · 검진, 외출, 아플 때, 이유식, 장보기 |
| 늘 사던 것 | 같은 할 일에 붙었던 라벨(분유 브랜드와 단계, 기저귀 사이즈)을 다시 채워 주는 것 |
| 떨어지기 전 알림 | 산 개수와 기록으로 남은 양을 계산해 주문 할 일을 제안하는 것 |
| 반복 할 일 | 끝낸 간격의 가운데 값으로 다음 날짜를 계산해 제안하는 할 일 |
| L1 | 공공 지식 — 지금은 접종 · 검진 일정과 기록의 위험 신호 안내에만 쓴다 — [knowledge-layers](architecture/knowledge-layers.md) |
