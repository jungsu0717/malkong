# 004 광고 없이 쓰기 — 구매와 복원

> 상태: 진행 (2026-10-03) — 코드 완료. 실제 결제 확인은 개발 빌드에서, 스토어·RevenueCat 설정은 Julian
> 근거: SPEC-MY-06 · app-design 확정 스택(RevenueCat `react-native-purchases`)

## 목표

마이에서 한 번 결제해 광고를 없애고, 다시 깐 기기에서 복원할 수 있게 한다. 구매 사실의 정본은 스토어다.

## 먼저 정한 것

1. **RevenueCat entitlement `no_ads`**, 상품은 현재 offering 의 lifetime 꾸러미(없으면 첫 꾸러미)
2. **스토어에 물은 결과가 이긴다** — 부팅 때 `getCustomerInfo` 로 기기 사본(`ads_removed`)을 맞춘다. 못 물으면 사본을 그대로 쓴다
3. **운영자 면제와 구매를 섞지 않는다** — 광고 표시 = 서버 자격 ∧ ¬구매. 전에는 구매 상태를 고치면 운영자 면제가 풀릴 수 있었다
4. 웹은 결제가 없고(`purchases.web.ts`), Expo Go 는 SDK 가 흉내 모드라 결제가 실제로 일어나지 않는다

## 출시 전에 Julian 이 할 것

- [ ] App Store Connect · Google Play Console 에 비소모성 상품(예: `malkong_no_ads`) 만들기 — 가격 정하기
- [ ] RevenueCat 프로젝트 → 두 스토어 연결 → entitlement `no_ads` · offering(lifetime 꾸러미)
- [ ] 공개 SDK 키 두 개를 EAS 환경변수 `EXPO_PUBLIC_REVENUECAT_IOS_KEY` · `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` 로

## 완료 조건

- [x] (SPEC-MY-06) 마이에서 한 번 결제해 광고를 없앨 수 있다(가격은 스토어에서 받아 보인다)
- [x] (SPEC-MY-06 구매 후) 배너와 광고 자리가 모두 사라진다 — `ads` 자격 하나를 모든 광고 부품이 본다
- [x] (SPEC-MY-06 복원) 「구매 복원」, 부팅 때 스토어 확인
- [x] (SPEC-MY-06 금지) 광고만 없앤다 — 한도·답변은 서버 자격이 정하고 구매와 상관없다
- [x] tsc · lint 통과
- [ ] 개발 빌드에서 샌드박스 결제·복원 확인
