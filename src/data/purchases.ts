/**
 * 광고 없이 쓰기 — 한 번 사는 상품 (SPEC-MY-06, task my/004).
 *
 * 결제는 RevenueCat(`react-native-purchases`)이 App Store·Google Play 와 이어 준다. 구매 사실의 정본은
 * 스토어이고, 기기 settings 의 `ads_removed` 는 오프라인일 때 쓰는 사본이다(entitlements.ts).
 *
 * - RevenueCat 의 entitlement 이름은 `no_ads`, 현재 offering 의 lifetime 꾸러미가 상품이다
 * - 공개 SDK 키는 빌드 때 박히는 `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY`. 없으면 「준비 중」
 * - Expo Go 에서는 SDK 가 흉내 모드로 돌아 실제 결제가 되지 않는다. 웹은 purchases.web.ts
 */

import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

export const NO_ADS_ENTITLEMENT = 'no_ads';

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configured = false;

function ready(): boolean {
  if (!API_KEY) return false;
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  }
  return true;
}

export function purchasesAvailable(): boolean {
  return !!API_KEY;
}

const owns = (info: CustomerInfo) => NO_ADS_ENTITLEMENT in info.entitlements.active;

export type NoAdsOffer = { price: string; pkg: PurchasesPackage };

/** 상품과 가격 — 스토어에서 못 받으면 null */
export async function noAdsOffer(): Promise<NoAdsOffer | null> {
  if (!ready()) return null;
  try {
    const offering = (await Purchases.getOfferings()).current;
    const pkg = offering?.lifetime ?? offering?.availablePackages[0] ?? null;
    return pkg ? { price: pkg.product.priceString, pkg } : null;
  } catch {
    return null;
  }
}

export type BuyResult = 'bought' | 'cancelled' | 'failed';

export async function buyNoAds(offer: NoAdsOffer): Promise<BuyResult> {
  if (!ready()) return 'failed';
  try {
    const { customerInfo } = await Purchases.purchasePackage(offer.pkg);
    return owns(customerInfo) ? 'bought' : 'failed';
  } catch (error) {
    return (error as { userCancelled?: boolean | null }).userCancelled ? 'cancelled' : 'failed';
  }
}

/** 다시 깐 기기에서 같은 스토어 계정의 구매를 되살린다(SPEC-MY-06 복원) */
export async function restoreNoAds(): Promise<boolean | null> {
  if (!ready()) return null;
  try {
    return owns(await Purchases.restorePurchases());
  } catch {
    return null;
  }
}

/** 지금 갖고 있는지 — 스토어에 묻지 못하면 null(그때는 기기 사본을 그대로 둔다) */
export async function ownsNoAds(): Promise<boolean | null> {
  if (!ready()) return null;
  try {
    return owns(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}
