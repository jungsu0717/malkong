/** 광고 없이 쓰기 — 웹 미리보기에는 스토어 결제가 없다(실제 앱은 purchases.ts). */

export const NO_ADS_ENTITLEMENT = 'no_ads';

export type NoAdsOffer = { price: string; pkg: unknown };
export type BuyResult = 'bought' | 'cancelled' | 'failed';

export function purchasesAvailable(): boolean {
  return false;
}

export async function noAdsOffer(): Promise<NoAdsOffer | null> {
  return null;
}

export async function buyNoAds(): Promise<BuyResult> {
  return 'failed';
}

export async function restoreNoAds(): Promise<boolean | null> {
  return null;
}

export async function ownsNoAds(): Promise<boolean | null> {
  return null;
}
