# 008 장보기를 할 일 탭의 카테고리로

> 상태: 완료 (2026-10-21)
> 근거: [topic](../../menu-spec/topic.md) SPEC-TOPIC-02 · [shop](../../menu-spec/shop.md) · [decisions/031](../../decisions/031-merge-shop-growth-tab.md)
> 시안: https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「제안 4」 — 할 일 (전체) · 할 일 (장보기 카테고리)

## 정한 것

- 할 일 탭 위에 카테고리 버튼: 전체 · 장보기 N · 접종 · 검진 · 기념일 · 사이즈 바꾸기 · 내 할 일(기본 주제는 숨기지 않는다)
- 장보기 카테고리 = 예전 장보기 탭 내용 그대로(`components/todo/shop-content.tsx` 의 `ShopContent` · `ShopInput`)
- 다른 카테고리 = 주제 내용(`components/todo/topic-content.tsx` 의 `TopicContent`) — 준비 목록 화면(topic/[id])도 같은 것을 쓴다
- 전체: 날짜 있는 장보기는 오늘 · 예정에, 날짜 없는 살 것은 「장보기 5개 · 마트 3 · 온라인 2 ›」 한 줄. 아래 두 줄(준비 목록 · 추천 할 일)
- 「주제별 보기」 화면과 장보기 탭을 뺐다. 다른 화면에서 `/todo?cat=shop` · `?cat=<주제 id>` 로 카테고리를 골라 연다

## 완료 조건

- [x] 카테고리 버튼과 카테고리별 내용 · 바닥 칸
- [x] 장보기 탭 · 주제별 보기 화면 제거, 기본 주제 링크는 할 일 탭 카테고리로
- [x] tsc · lint · 단위 시험, 웹 390px 확인

## 확인
