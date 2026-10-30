# 029 스토어 그림과 문안을 기록과 가족 중심으로

> 상태: 완료 (2026-10-30) · 스토어에 올리는 것은 Julian 이 출시를 정할 때
> 근거: [decisions/036](../../decisions/036-records-for-family.md) · [product-brief](../../product/product-brief.md) 「스토어 문안」 · [store-toon](../../product/store-toon.md) 「스토어 스크린샷」

## 목표

기록이 홈 맨 위로 돌아왔고(log/003) 가족이 함께 보는 기록과 오늘 아기 소식 카드(log/004)가 생겼는데, 스토어 문안과 그림에는 기록이 없었다.
목표가 광고 수익이라 하루에 여러 번 여는 이유(기록)와 가족이 데려오는 가족을 스토어 앞에 둔다.

## 정한 것

- 여덟 장 — 홈(기록 칸) · 기록(누가 남겼는지) · 오늘 소식 카드 · 1년 화면 · 성장 · 루틴 · 내 할 일 · 장보기. 앞 석 장이 기록과 가족이다
- 옛 07-family(루틴 시간순 보기의 엄마 · 아빠)는 뺐다 — 02-log 가 같은 것을 기록으로 더 잘 보여 준다
- 일주일 그래프 장은 찍어 봤지만 뺐다 — 위쪽 절반을 첫 달 기준 안내가 차지하고, 시험 데이터 막대가 모두 같아 보였다
- 07-todo 는 「금요일 오전 10시」를 「내일 오전 10시」로 — 찍는 날이 금요일이면 「오늘」로 읽혀서 찍는 날에 따라 그림이 달라졌다
- 이름 「육아버디 - 수유 기록과 가족 공유」, 부제 「할머니, 할아버지도 함께 보는 아기 하루」 — 한국 앱스토어에서 「수유 기록」 「육아 기록」의
  앞쪽 앱은 모두 이름에 수유와 기록이 있다(iTunes 검색, 2026-10-30). 키워드에서 이름 · 부제 낱말을 뺐다
- 슬로건 「육아 할 일, 버디가 챙겨요」는 앱 시작 화면에 있어서 그대로 두고 Julian 확인으로 남긴다
- App Store Connect 의 앱 이름은 EAS 가 처음 만들 때의 「육아 루틴과 할 일」이다 — 출시 때 Julian 이 App Store Connect 에서 고친다(eas.json 의 이름은 앱을 새로 만들 때만 쓰여서 두었다)
- 앱 개인정보 답안([store-forms](../../product/store-forms.md)): 가족 공유에 육아 기록이 들어가 건강 줄에 수유 · 기저귀 · 잠 · 체온 · 키 · 몸무게를 더했다.
  데이터 종류는 그대로라 고를 칸은 늘지 않는다

## 손댄 파일

```
marketing/store/capture.mjs   기록 시험 데이터(지난 7일 + 오늘, 엄마 · 아빠 · 할머니), 장면마다 시각(clock) · 설정(settings), 장면 여덟
marketing/store/store.html    PAGES 여덟, 문구 · 코랄 테
marketing/store/render.mjs    01-home … 08-shop
marketing/store/shots/        여덟 장(family.png 삭제, log · news 추가)
marketing/store/out/          01-home … 08-shop -ios · -play
docs/product/product-brief.md 「스토어 문안」, 앱스토어 제목
docs/product/store-toon.md    「스토어 스크린샷」 표 · 시험 데이터 · 규칙(기록 앱 문장)
docs/product/store-forms.md   공통 사실 · 건강 줄 · 심사 메모
```

## 확인

- 앱 화면 여덟 장을 WSL 의 Playwright 크로미움으로 찍었다(모델 호출 0). 열여섯 장 가운데 iOS 여덟 장을 한 장의 모음 그림으로 펼쳐 보고,
  홈 · 기록 · 소식 카드 · 할 일 입력 칸은 원본으로 봤다 — 제목이 두 줄 안에 들어가고, 코랄 테가 카드를 정확히 두르고, 잘린 글이 없다

## 완료 조건

- [x] 여덟 장 iOS · Play 두 크기, 겹침 · 잘림 확인
- [x] product-brief 「스토어 문안」 · store-toon 표 · store-forms 갱신
- [ ] Julian 확인 — 이름 · 부제 · 설명, 슬로건을 바꿀지
- [ ] 위젯 장 · 위젯 문단 — TestFlight 에서 위젯을 확인한 뒤
