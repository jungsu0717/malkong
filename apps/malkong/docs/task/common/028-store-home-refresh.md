# 028 스토어 그림과 문안을 홈 기준으로 다시

> 상태: 완료 (2026-10-29) · 스토어에 올리는 것은 Julian 이 출시를 정할 때
> 근거: [product-brief](../../product/product-brief.md) 「스토어 문안」 · [store-toon](../../product/store-toon.md) 「스토어 스크린샷」 · README 「다음 시작점」 4

## 목표

첫 화면이 홈으로 바뀌었고(today/007) 첫 실행에 1년 화면이 생겼는데(my/011), 스토어 그림 첫 장은 옛 루틴 탭이었다.
스크린샷과 설명을 지금 앱 순서(홈 → 1년 → 루틴 → 할 일 → 장보기 → 성장 → 가족)로 다시 만든다.

## 정한 것

- 일곱 장 — 홈 · 첫 실행의 1년 화면 · 루틴 · 내 할 일 · 장보기 · 성장 · 가족. 아기 일정 장(옛 04-baby)은 1년 화면이 같은 약속을 더 잘 보여 줘서 뺐다
- 둘째 장 문구는 슬로건 후보 「생일만 넣으세요. 1년 치 챙길 일은 버디가 채워요」 그대로. 줄이 길어 이 장만 글자를 0.88배로
- **위젯 장은 아직 없다** — Expo Go 와 웹에는 위젯이 없어 진짜 캡처를 못 찍는다. 그린 그림을 스토어에 올리지 않는다(루트 AGENTS 「스토어 · 광고 문구는 실제 동작과 맞춘다」).
  TestFlight 에서 위젯이 확인되면 폰 홈 화면 캡처로 여덟째 장 후보
- 설명은 「생일만 넣으세요」 문단을 맨 앞에, 그다음 위젯, 그 뒤는 전과 같다(루틴 · 할 일 · 장보기 · 성장 · 가족). 위젯 문단도 폰 확인 뒤에만 넣는다
- 부제 「생일 하나로 1년 치 챙길 일을 미리」, 키워드에 위젯 · 디데이(한국 스토어에서 디데이 위젯 검색이 많다 — 2026-10-29 조사, decisions/035)
- 찍는 법은 그대로(`capture.mjs` → `render.mjs`). 1년 화면은 아기를 넣지 않은 채 온보딩의 생일 세 칸을 채우고 「다음」을 눌러 찍는다 — 장면에 `before` 를 둘 수 있게 했다

## 손댄 파일

```
marketing/store/capture.mjs   장면 일곱(home · year · routine · todo · shop · growth · family), noBaby · before
marketing/store/store.html    PAGES 일곱, 장마다 글자 배율(size)
marketing/store/render.mjs    01-home … 07-family
marketing/store/shots/        일곱 장(baby.png 삭제)
marketing/store/out/          01-home … 07-family -ios · -play (옛 01-routine … 06-family 삭제), feature.png 는 그대로
docs/product/store-toon.md    「스토어 스크린샷」 표
docs/product/product-brief.md 「스토어 문안」
```

## 확인

- 앱 화면 일곱 장을 WSL 의 Playwright 크로미움으로 찍었다(모델 호출 0). 열네 장을 한 장의 모음 그림으로 펼쳐 보고, 홈 · 1년 두 장은 원본 크기로 봤다 —
  제목이 두 줄 안에 들어가고, 코랄 테가 카드 · 줄을 정확히 두르고, 잘린 글이 없다. 크기는 1290×2796 · 1080×1920

## 완료 조건

- [x] 일곱 장 iOS · Play 두 크기, 겹침 · 잘림 확인
- [x] store-toon 표 · product-brief 「스토어 문안」 갱신
- [ ] Julian 확인 — 부제 · 슬로건 · 설명 순서. 스토어에 올리는 것은 출시 때(common/008 「애플 먼저」 8)
- [ ] 위젯 장 — TestFlight 에서 위젯을 확인한 뒤
