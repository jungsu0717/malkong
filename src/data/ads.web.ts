/**
 * 광고 — 웹 미리보기용. 웹에는 AdMob 모듈이 없어서 아무것도 하지 않는다(실제 앱은 ads.ts).
 */

export function adsModule(): null {
  return null;
}

export function adUnit(): null {
  return null;
}

export async function startAds(): Promise<boolean> {
  return false;
}

export function useAdsReady(): boolean {
  return false;
}

export function canOfferRewardedAd(): boolean {
  return false;
}

export async function watchRewardedAd(): Promise<boolean> {
  return false;
}
