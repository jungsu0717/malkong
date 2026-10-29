# 010 위젯 모양 다시 — 함께한 날수를 크게, 버디는 작게

> 상태: 완료 (2026-10-29) · 폰 확인은 다음 TestFlight 빌드
> 근거: SPEC-MAIN-09 · task today/008 · 시안 https://claude.ai/artifact/4CMt2A8pGPqV1xhaAg3H8x 「위젯」 세 장(2026-10-29, Julian 「ㅇㅋ 그렇게 하고」)

## 목표

TestFlight 1.0.0 (7)에서 위젯을 올려 보니 버디 그림이 위젯 전체를 덮어 글자가 안 보였다(Julian: 「아기 이미지 때문에 글자도 제대로 안 보인다」).
그림 크기를 고치고, 모양을 디데이 위젯(더데이비포)처럼 숫자 하나가 먼저 눈에 들어오게 바꾼다.

## 원인

아이폰 위젯의 `Image uiImage` 에 `resizable` 이 없었다. SwiftUI 그림은 `resizable` 이 있어야 틀 크기로 줄어들고, 없으면 원본 크기(384×355)로 그려져
26×24 틀 밖으로 넘친다. 지금은 `resizable()` 을 먼저 주고 `frame` 을 준다.

## 정한 것

- **함께한 날수를 크게** — 「함께한 지」 아래 큰 숫자(둥근 글꼴, 굵게) 「58일」. 네 자리가 되면 글자가 줄어든다(`minimumScaleFactor`)
- **다음 아기 일정** — 맨 아래에 이름표(「D-3」 「지금」 「지남」, 연한 코랄)와 이름 한 줄. 이름표 말은 홈 아기 일정 줄과 같다.
  잠금 화면 한 줄은 전처럼 「D-3 · BCG 접종」(지금 기간이면 「이번 달」)
- **「이번 주 챙길 일 N개」는 홈 화면 위젯에서 뺐다** — 큰 숫자가 둘이면 어디를 볼지 흐려진다. 잠금 화면에서 다음 일이 없을 때와 생일 전 문장으로만 쓴다
- **버디는 오른쪽 위에 작게**(26×24), 생일 전에는 44×41 로 왼쪽 위에
- **중간 크기** — 오른쪽 회색 칸에 오늘 할 루틴 셋. 루틴이 더 있으면 칸 이름 오른쪽에 「외 2개」, 누르면 루틴 화면(Julian 「루틴 3개 이상이면 어떻게 보이는데?」)
- 「태어난 지」를 「함께한 지」로 — 홈 머리를 같은 말로 바꾸는 것(Julian)에 맞췄다
- 안드로이드도 같은 모양. 위젯 고르는 화면의 미리 보기 그림(`assets/widget-preview/buddy.png`)을 새 모양으로 다시 렌더했다
- 위젯 고르는 화면 설명 「함께한 날수, 다음 아기 일정, 오늘 할 루틴」

## 손댄 파일

```
src/data/widget-data.ts(+ test)   dayCount · nextWhen · nextTitle · more, 「함께한 지」
src/widgets/buddy-widget.tsx       아이폰 — 큰 숫자 · 이름표 · resizable · 회색 루틴 칸 · 「외 N개」
src/widgets/buddy-android-widget.tsx  안드로이드 — 같은 모양
app.json                           위젯 설명
assets/widget-preview/buddy.png    안드로이드 미리 보기 그림
docs/menu-spec/main.md             SPEC-MAIN-09
```

## 확인

- 시안 세 장(밝은 · 어두운 · 루틴 5개)을 렌더해 겹침과 잘림이 없는 것을 봤다
- tsc · lint · node 시험 88개 · copy-check 통과
- `npx expo export --platform ios --no-bytecode` 로 묶어 보니 위젯 함수가 글로 바뀌어 있고 `resizable()` · `shapes.roundedRectangle` 이 그대로 들어 있다

## 완료 조건

- [x] (SPEC-MAIN-09) 큰 날수 · 이름표 · 버디 작게 · 「외 N개」 — 아이폰 · 안드로이드
- [x] `widget-data.test.ts` — 날수 · 이름표 · 이름 · 「외 N개」
- [ ] 폰: 다음 TestFlight 빌드에서 작은 · 중간 위젯, 밝은 · 어두운 화면 확인 (Julian)
