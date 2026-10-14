# 001 앱 뼈대 — 탭 셋, 폰 표, 오늘 탭, 한 줄 적기, 체크

> 상태: 시작 전 — 헌장과 제품 브리프를 Julian 이 확인한 뒤 시작한다
> 근거: [today](../../menu-spec/today.md) SPEC-TODAY-01 · 02 · 04 · [add](../../menu-spec/add.md) SPEC-ADD-01 ·
> [topic](../../menu-spec/topic.md) SPEC-TOPIC-01 · [constitution](../../constitution.md) 1 · 2 · 4

## 목표

Julian 이 아이폰(Expo Go)에서 오늘 탭에 할 일을 한 줄로 적고, 체크하고, 다음 날 다시 열어도 그대로 있는 것을 확인한다.
서버와 로그인은 다음 task(common/002)에서 붙인다. 이 task 는 「매일 손이 가는지」를 Julian 이 가장 먼저 시험할 수 있게 하는 것이 목적이다.

## 정한 것

- Expo SDK 57(육아버디와 같은 판 — 나중에 워크스페이스로 묶을 때 React Native 판이 같아야 한다), expo-router, TypeScript
- 탭 셋: 오늘(첫 화면) · 주제 · 마이. 마이는 이 task 에서 빈 화면과 앱 판 번호만
- 폰 표: main-design 「데이터」의 `topic` · `item` · `completion`(나머지 표는 그 기능의 task 에서). 서버와 같은 칸 이름을 쓴다
- 처음 실행하면 「오늘」 주제 하나를 만든다
- 날짜 읽기(「내일」, 「저녁 8시」)는 이 task 에 넣는다 — 규칙만, 알림은 notify/001 에서
- 디자인: 육아버디의 토큰과 부품(카드, 칩, 시트, 목록 줄, 테마)을 복사해 온다. 포인트 색은 Julian 이 정하기 전까지 먹색 한 가지

## 손댈 파일

```
apps/planned/package.json · app.json · tsconfig.json · eslint.config.js
apps/planned/src/app/_layout.tsx · (tabs)/_layout.tsx · (tabs)/index.tsx · (tabs)/topics.tsx · (tabs)/my.tsx · topic/[id].tsx
apps/planned/src/data/db.ts · items.ts · topics.ts · due-parse.ts
apps/planned/src/components/ … (육아버디에서 복사)
```

## 완료 조건

- [ ] 앱을 열면 오늘 탭이고, 입력칸을 누르고 완료하면 할 일이 생긴다(두 번 터치) — SPEC-ADD-01
- [ ] 「내일 저녁 8시 장보기」를 적으면 할 일 줄에 내일 20:00 이 보인다 — SPEC-ADD-01
- [ ] 할 일을 누르면 끝낸 것으로, 다시 누르면 되돌린다. 끝낸 것은 아래로 내려가고 흐리다 — SPEC-TODAY-02
- [ ] 주제마다 끝낸 수 / 전체 수가 보인다 — SPEC-TODAY-04
- [ ] 처음 실행하면 「오늘」 주제가 있다 — SPEC-TOPIC-01
- [ ] 앱을 껐다 켜도 할 일과 체크가 그대로다
- [ ] `npx tsc --noEmit` · `npx expo lint` 통과, 날짜 읽기 단위 시험 통과

## 확인

(작업 뒤에 적는다)
