# Planned 문서 지도

이 폴더가 Planned 설계의 정본이다. 문서 흐름(constitution → architecture → menu-spec → task → 코드 → 확인), SPEC 번호,
작성 규칙, 작업 순서는 저장소 공통 [conventions](../../../docs/governance/conventions.md) 를 따른다.

| 문서 | 담는 것 |
|---|---|
| [constitution.md](constitution.md) | 바뀌지 않는 원칙 — 제품 8, 개발 5 |
| [product/product-brief.md](product/product-brief.md) | 왜 만드는지, 컨셉, 기능, 하지 않는 것, 비슷한 서비스, 수익, 열린 질문 |
| [architecture/main-design.md](architecture/main-design.md) | 화면 구조, 할 일이 생기는 길, 데이터 표, 서버, 알림, 디자인 |
| [menu-spec/](menu-spec/) | 메뉴별 SPEC 과 구현 방법 |
| [decisions/](decisions/README.md) | 결정 기록 — 다른 안을 버린 이유 |
| [task/](task/README.md) | SPEC 을 코드로 만드는 작업 단위 |

## 메뉴 코드

| 코드 | 문서 | 무엇 |
|---|---|---|
| `TODAY` | [today](menu-spec/today.md) | 오늘 탭 — 첫 화면, 체크, 반복 할 일, 완성도 |
| `ADD` | [add](menu-spec/add.md) | 적기 — 한 줄, 붙여 넣기와 나누기, 공유 메뉴, 라벨 칩 |
| `TOPIC` | [topic](menu-spec/topic.md) | 주제 탭 — 만들기, 추천 할 일, 기본 가이드, 보관함 |
| `NOTI` | [notify](menu-spec/notify.md) | 알림 |

마이(로그인, 탈퇴), 함께 쓰기(링크 공유), 기록 보기(둘째 판)의 SPEC 은 그 task 를 시작할 때 쓴다.

## 용어

| 말 | 뜻 |
|---|---|
| 주제 | 할 일을 묶는 상황이나 분야(오늘, 퇴근 전, 장보기, 여행 …) |
| 추천 할 일 | 지난 같은 종류의 주제, 기본 가이드, AI 시작 목록에서 온 할 일 후보 |
| 반복 할 일 | 끝낸 기록의 간격으로 다음 날짜를 계산해 제안하는 할 일 |
| 원문 | 붙여 넣거나 공유로 받은 글 그대로 |
| 고친 해석 | 사용자가 정한 「우유는 서울우유」 같은 값. 계산보다 우선한다 |
