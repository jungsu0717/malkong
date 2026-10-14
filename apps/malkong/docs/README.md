# 말콩(malkong) 문서 체계

> 두 가지를 Neuro 에서 본떴다 — **문서 하네스는 `neuro-spec`의 구조**를, **지식층은 Neuro 의
> Knowledge Foundation(K1~K4)**을 줄여서 가져왔다. 무엇을 가져오고 무엇을 두고 왔는지는
> [knowledge-layers](architecture/knowledge-layers.md) 첫 절에 적어 두었다. 가져온 것은 구조와
> 원칙이고, 회사 문서의 내용을 옮겨 오지는 않는다.

이 폴더가 육아버디 설계의 정본이다. 문서 흐름(constitution → architecture → menu-spec → task → 코드 → 확인)은
[conventions](../../../docs/governance/conventions.md) 「문서 흐름」을 따르고, 아래는 육아버디의 실제 문서 지도다.

| 문서 | 담는 것 | 갱신 시점 |
|---|---|---|
| `constitution.md` | 불변 원칙 — 제품 5 + 개발 4. 모든 SPEC 위에 있다 | 거의 안 바뀜. 바꾸면 changelog |
| `product/` | 제품 브리프 — 계기·컨셉·차별성·스토어 문구의 원천 | 포지셔닝이 바뀔 때 |
| `architecture/` | 제품 전체의 방향(main-design) · 지식층(knowledge-layers) · 서버/DB/LLM/기기 DB 스키마(backend) · L1 지식베이스 실체(l1-knowledge-base) · 앱↔서버 API(api-contract) | 방향이 바뀔 때만 |
| `menu-spec/` | 메뉴별 상세 설계(탭 넷 — main-design 「구조」). SPEC 문장(WHAT)과 구현 방법(HOW) | 기능이 정해지거나 바뀔 때 |
| `app-design/` | 디자인 시스템 · 기술 스택 · 코딩 스타일. 최신(SOTA) 근거 포함 | 스택·스타일 결정이 바뀔 때 |
| `decisions/` | 결정 기록(ADR) — 대안을 기각한 이유. 정의는 다른 문서가 소유 | 무게 있는 선택마다 |
| `task/` | spec을 코드로 만드는 작업 단위. 메뉴별 폴더에 누적 | 작업 시작·진행·완료마다 |

## SPEC 번호와 작성 규칙

SPEC 번호, 문서 작성 규칙 여덟, 작업 순서는 저장소 공통 규칙 [conventions](../../../docs/governance/conventions.md) 를 따른다.
육아버디가 더하는 것만 여기 적는다.

- 메뉴 코드는 `LOG` · `HOME` · `ASK` · `BABY` · `GROW` · `MY`. (`HOME` 은 홈 탭이 없어진 뒤에도 그 SPEC 이 버디 탭의 브리핑과
  성장 탭의 이번 달로 이어져 코드를 그대로 쓴다)
- 작성 규칙 8 「출처를 남긴다」: 육아 · 의료 내용은 출처 화이트리스트의 근거를 적는다([knowledge-layers](architecture/knowledge-layers.md)).
- 작업 순서 4 「구현」의 품질 검사는 [constitution](constitution.md) 개발 원칙 8 이 정한다.

## 용어

| 말 | 뜻 |
|---|---|
| 말콩이 | 물어보기 탭의 agent 이름 |
| L1 / L2 | 공공 지식 층 / 우리 아기 지식 층 — [knowledge-layers](architecture/knowledge-layers.md) |
| 기록 / 요약 | L2 안의 사실 / 해석 구분 |
| covers | L2-기록이 완료 처리하는 L1 항목을 가리키는 연결 |
| 챙길 것 | 표준(L1) − 기록(L2) 차집합에서 나오는 홈 추천 |
