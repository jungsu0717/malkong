# 002 광고는 AdMob 으로 시작한다

> 상태: 확정 (2026-09-30)

## 맥락

구독·과금 전까지 수익은 광고다. 배너(홈·성장)와 전면(완결 시점)이 필요하다.

## 결정

Google AdMob + `react-native-google-mobile-ads`. 네이티브 모듈이라 Expo Go 에서는 돌지 않으므로
EAS 개발 빌드 단계에서 도입하고, 그 전까지는 placeholder(`src/components/ad-banner.tsx`)로 자리만 둔다.
iOS 는 ATT 동의(expo-tracking-transparency)를 선행한다. 절차는 그 파일 주석과
[app-design](../app-design/README.md) 광고 행에 있다.

## 기각한 대안과 이유

- **카카오 AdFit** — 국내 단가는 볼 만하지만 RN 래퍼가 커뮤니티 품질이라 유지보수 위험이 크다.
  규모가 생기면 미디에이션으로 재검토.
- **광고 없이 시작** — 수익 검증을 미루게 된다. placeholder 라도 광고 자리를 처음부터 설계에 넣어야
  나중에 UI 를 뜯지 않는다.
- **구독 우선** — 가치 증명 전 구독은 전환이 안 된다. 과금은 기능이 쌓인 뒤의 결정.

## 주의

아기 건강 데이터를 광고 타게팅에 넘기지 않는다 — [constitution](../constitution.md) 제품 원칙 4.
