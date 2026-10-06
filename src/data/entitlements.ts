/**
 * 이 기기가 무엇을 쓸 수 있는가 — 광고 표시 여부와 하루 질문 한도.
 *
 * 값이 정해지는 자리는 셋이고, 아래로 갈수록 세다:
 *   1. 기본값 — 광고 보여주고 하루 10회(광고 1편에 5회, 하루 2편 — decisions/019)
 *   2. 광고 제거 구매 — 스토어가 정본이고, 여기 저장되는 건 복원용 사본이다
 *   3. 서버 자격(GET /v1/entitlements) — 운영자(가족) 기기 면제가 여기서 온다
 *
 * 서버 자격은 부팅 때 한 번 받는다(entitlements-context). 결제 SDK(RevenueCat `react-native-purchases`)는
 * AdMob 과 마찬가지로 네이티브 모듈이라 EAS 개발 빌드 단계에서 붙인다.
 */

import { readSetting, writeSetting } from './db';

export type Entitlements = {
  /** 광고를 보여줄지. 구매했거나 운영자 기기면 false */
  ads: boolean;
  /** 하루 질문 한도. null 이면 무제한 */
  dailyLimit: number | null;
  /** 보상형 광고 1편이 채우는 정밀 답변 수 */
  rewardPerAd: number;
  /** 하루에 볼 수 있는 보상형 광고 편수 */
  rewardMaxPerDay: number;
  /** 오늘 남은 정밀 답변 수 — 서버에서 받기 전이거나 무제한이면 null */
  remaining: number | null;
};

export const DEFAULT_ENTITLEMENTS: Entitlements = {
  ads: true,
  dailyLimit: 10,
  rewardPerAd: 5,
  rewardMaxPerDay: 2,
  remaining: null,
};

const ADS_REMOVED_KEY = 'ads_removed';

/** 기기에 적어 둔 광고 제거 구매 사본 — 스토어에 묻기 전·오프라인일 때 쓴다 */
export async function loadAdsRemoved(): Promise<boolean> {
  return (await readSetting(ADS_REMOVED_KEY)) === 'true';
}

/**
 * 광고 제거 구매 결과를 적어 둔다 — 구매·복원·부팅 때 스토어에 물어본 결과(purchases.ts).
 * 스토어가 정본이므로, 앱을 다시 깔면 복원으로 다시 채운다.
 */
export async function setAdsRemoved(removed: boolean): Promise<void> {
  await writeSetting(ADS_REMOVED_KEY, removed ? 'true' : 'false');
}
