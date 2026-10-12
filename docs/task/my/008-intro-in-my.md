# 008 만화를 처음 실행에서 빼고 마이 「육아버디 스토리」로

> 상태: 끝 (2026-10-12)
> 근거: SPEC-MY-07(이 task 에서 「처음 실행 만화」를 「마이 제목 줄의 육아버디 스토리」로 바꾼다) · [my/006](006-intro-toon.md) · [store-toon](../../product/store-toon.md)

## 목표

Julian(2026-10-12): 「만화도 처음에 뜨지 말고 마이 페이지에 메뉴 하나로 넣어서 볼 수 있게」. 처음 실행은 온보딩(생일)부터 바로 시작하고,
만화 다섯 컷은 마이 제목 줄 오른쪽 끝의 「육아버디 스토리」에서 본다(Julian, 같은 날 — 메뉴 줄은 무겁고 「credit 같은 느낌」으로 → 제목 줄 오른쪽).

## 정한 것

- `src/app/_layout.tsx` 의 문은 생일이 없을 때 온보딩으로만 보낸다. 「봤는지」 설정(`intro_seen`)은 더 쓰지 않아 preferences 에서 뺐다
  (폰에 남은 값은 무시된다)
- `src/app/intro.tsx` 는 보기 화면 — 위의 「건너뛰기」와 마지막 컷의 「시작하기」가 「닫기」가 되어 온 곳(마이)으로 돌아간다.
  주소로 바로 열어 돌아갈 곳이 없으면 홈으로
- 마이 제목 「마이」와 같은 줄 오른쪽 끝에 작은 글 「육아버디 스토리」 — 누르면 `/intro`

## 손댄 파일

```
src/app/_layout.tsx · src/app/intro.tsx · src/app/(tabs)/my.tsx · src/data/preferences-context.tsx
docs/menu-spec/my.md(SPEC-MY-07) · docs/product/store-toon.md(쓰는 곳) · README · docs/task/my/006
```

## 완료 조건

- [x] 처음 실행에 만화가 뜨지 않고 온보딩부터
- [x] 마이 「육아버디 스토리」 → 만화 → 닫기 → 마이
- [x] tsc · lint · 웹에서 한 바퀴
