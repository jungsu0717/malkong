# 025 앱 아이콘 · 시작 화면 · 로고

> 상태: 완료 (2026-10-23)
> 근거: [decisions/032](../../decisions/032-dark-icon-logo-splash.md) · [app-design](../../app-design/README.md) 「아이콘」 · 「시작 화면」

## 목표

시안에서 확정한 먹색 아이콘(+ 별), 루틴 · 할 일 · 성장 카드가 있는 시작 화면, 로고(글자 + 별)와 슬로건 표기를 앱에 넣는다.

## 한 것

- 그림: `assets/images/icon.png`(1024, 투명 없음 — App Store 요구), Android 적응형 전경 · 배경, `favicon.png`.
  버디 그림(`mascot/face.png` · `standing.png` · `splash-icon.png`)의 테두리 흰 점을 지웠다(어두운 바탕에서 보이던 것 — 바깥과 이어진 흰 픽셀만, 눈 하이라이트는 그대로)
- app.json: 시작 화면 바탕 `#16161A`(다크 모드도), Android 적응형 아이콘 바탕 `#16161A`
- 토큰: `splash` 먹색, 카드 `heroCard` · `heroCardLine`(비치지 않는 테두리 — 기울인 카드에 반투명 테두리를 두면 모서리가 깨졌다)
- `AnimatedSplashOverlay`(animated-icon.tsx): 모빌 · 카드 셋 · 코랄 빛(SVG 원형 그라디언트) · 로고 · 슬로건. 작은 화면은 버디 바깥 거리만 줄인다
- `brand.tsx`: `BrandLogo` · `BrandSlogan` · `BrandStar`, `growth-hero.tsx` 의 모빌을 `HeroMobile` 로 꺼내 같이 쓴다

## 완료 조건

- [x] 아이콘 · 시작 화면 · 로고 · 슬로건이 시안과 같다 — 웹에서 시작 화면을 잠시 켜 390×844 · 375×667 · 430×932 로 확인
- [x] tsc · lint · node 시험
- [ ] 기기 시작 화면과 아이콘은 첫 출시 빌드(TestFlight)에서 확인
