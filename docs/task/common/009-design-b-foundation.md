# 009 시안 B 기반 — 토큰 · 글꼴 · 공용 부품 · 탭 셋

> 상태: 완료 (2026-10-03)
> 근거: [decisions/012](../../decisions/012-chat-first-three-tabs.md) · [app-design](../../app-design/README.md) · main-design 「구조」

## 목표

Julian 이 고른 시안 B(단정한 비서)를 앱 전체에 깔 바탕을 만든다. 화면 하나하나는 뒤의 task 가 맡는다:
대화(ask/005) · 아침 브리핑(home/004) · 우리 아기(growth/001) · 마이와 온보딩(my/005) · 마감(common/010).

## 먼저 정한 것

1. **토큰** — `text` 먹색, `surface`(옅은 회색 면), `border`·`divider`(가는 선), `accent` 붉은 말 색(포인트만),
   `ink`(주요 단추 바탕). light/dark 두 벌. 예전 이름(`backgroundElement` 등)은 새 이름으로 바꾸고 남기지 않는다
2. **글꼴** — IBM Plex Sans KR 넷. 루트에서 `useFonts` 로 읽는 동안 시작 화면을 유지한다. `ThemedText` 가 굵기를 보고
   글꼴을 고른다(안드로이드는 굵기만으로 다른 파일을 찾지 못한다)
3. **글자 크기 단계** — display 28 · title 22 · heading 17 · default 16 · body 15 · small 14 · caption 12 · label 13
4. **공용 부품** `src/components/ui/` — Card · Button · Chip · Tag · IconButton · Segmented · ListRow · SectionHeader · EmptyState
5. **탭 셋** — 말콩(`index`) · 우리 아기(`baby`) · 마이. 플로팅 질문 버튼(`ask-fab`)은 지운다(SPEC-ASK-07 폐기)
6. **탭 아이콘은 자체 베이비 세트** — 말콩=말풍선 속 쪽쪽이 · 우리 아기=아기 얼굴 · 마이=곰돌이. 흔한 앱과 갈리는
   몇 안 되는 자리라 Ionicons 로 바꾸지 않는다. 보조 아이콘은 Ionicons

## 완료 조건

- [x] 토큰(`theme.ts`) · 글꼴(루트 `useFonts`, `ThemedText` 굵기별 글꼴) · 부품(`components/ui`) · 말콩이 얼굴(`brand.tsx`)
- [x] 탭 셋 — 대화가 `index`, 옛 홈이 `baby`(growth/001 에서 다시 짬), 성장은 탭에서 숨김, `ask-fab` 지움
- [x] 템플릿 찌꺼기(`collapsible` · `hint-row` · `global.css`) 지움
- [x] tsc · lint 통과
