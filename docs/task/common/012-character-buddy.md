# 012 캐릭터 버디 — 앱 아이콘 · 시작 화면 · 로딩 · 알림 아이콘

> 상태: 진행 (2026-10-04) — 코드·그림 완료. 아이콘 · 시작 화면 · 알림 아이콘은 개발 빌드에서 확인(Expo Go 는 Expo Go 것)
> 근거: [decisions/015](../../decisions/015-character-buddy.md) · app-design 「아이콘」 · 「로딩과 모션」

## 한 것

- Nano Banana Pro 로 캐릭터 시트 한 장(약 190원) → `scripts/brand/cut_sheet.py` 로 흰 바탕을 걷고 칸별로 잘랐다
  (가장자리에서 이어진 밝은 무채색만 바탕 — 눈 반짝임은 남는다, 떨어진 그림자 찌꺼기는 가장 큰 덩어리만 남겨 지운다,
  물결은 흰색으로 흐려지는 그라디언트라 초록 채널로 알파를 만든다)
- `scripts/brand/make_assets.py` — 아이콘(노랑 바탕 + 얼굴) · Android adaptive 전경 · 배경 · 시작 화면 · 웹 아이콘 · 앱 안 그림.
  단색 · 알림 아이콘은 `silhouette-*.html`(도형)을 headless Chrome 으로 찍었다
- 앱: `brand.tsx`(`BuddyMark` · `BuddyAvatar`), `animated-icon.tsx`(서 있는 버디),
  지식 지도 가운데 얼굴, app.json(아이콘 · 시작 화면 · `expo-notifications` 알림 아이콘과 색)
- 큰 로딩: 처음엔 「@」 다리로 달리는 버디를 겹쳐 움직였으나 Julian 이 "짜치다"로 뺐다. `baby-loading.tsx` 는 소품 선 아이콘
  넷(쪽쪽이 · 젖병 · 딸랑이 · 곰돌이)이 톡톡 바뀌는 로딩으로 바꾸고 `BottleIcon` 을 더했다. 달리기 그림 셋(`run-*.png`)은 지웠다
- 지운 것: 붉은 말 러너 · 쪽쪽이 얼굴 SVG(`RidingBabyIcon` · `PacifierBabyIcon`), `horse` 토큰, 다크 모드 시작 화면 그림

## 완료 조건

- [x] tsc · lint 통과, 웹에서 대화 머리 · 지식 지도 가운데 얼굴 확인
- [ ] 개발 빌드에서 홈 화면 아이콘 · 시작 화면 · 알림 아이콘
- [ ] (출시 전) 디자이너 최종본 · 도형 상표 검토
