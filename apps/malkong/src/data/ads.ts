/**
 * 광고(AdMob) — 시작·배너 단위·보상형 광고 (task common/006, decisions/002).
 *
 * 네이티브 모듈이라 Expo Go 와 웹에서는 없다. 그때는 아무 광고도 부르지 않고 화면은 자리 표시만 한다
 * (웹은 ads.web.ts). 실제 광고는 EAS 개발 빌드부터 나온다.
 *
 * 광고 단위 id 는 빌드 때 박히는 `EXPO_PUBLIC_ADMOB_*` 이다. 개발 빌드(__DEV__)는 Google 시험 단위를 쓰고,
 * 출시 빌드에 id 가 없으면 광고를 내지 않는다 — 시험 광고가 출시판에 나가지 않게.
 * 개발·가족 기기에서 실광고를 누르면 AdMob 계정 정지 사유다(backend 「운영자 기기」).
 */

import { isRunningInExpoGo } from 'expo';
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type Gma = typeof import('react-native-google-mobile-ads');

let gma: Gma | null | undefined;

/** 광고 모듈 — 없으면(Expo Go · 네이티브 코드가 빠진 빌드) null */
export function adsModule(): Gma | null {
  if (gma !== undefined) return gma;
  if (isRunningInExpoGo()) return (gma = null);
  try {
    // 모듈을 읽는 순간 네이티브 쪽을 찾으므로, 없을 때 앱이 죽지 않게 늦게 읽는다
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gma = require('react-native-google-mobile-ads') as Gma;
  } catch {
    gma = null;
  }
  return gma;
}

const UNITS = {
  banner: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  }),
  rewarded: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
  }),
};

export function adUnit(kind: 'banner' | 'rewarded'): string | null {
  const module = adsModule();
  if (!module) return null;
  if (__DEV__) return kind === 'banner' ? module.TestIds.ADAPTIVE_BANNER : module.TestIds.REWARDED;
  return UNITS[kind] || null;
}

let starting: Promise<boolean> | null = null;

/**
 * 광고를 시작한다 — 동의(유럽 UMP) → iPhone 추적 허용 묻기 → SDK 시작. 한 번만 돈다.
 * 동의 절차가 설정돼 있지 않아 실패해도(국내 사용자) 그대로 시작한다.
 */
export function startAds(): Promise<boolean> {
  const module = adsModule();
  if (!module) return Promise.resolve(false);
  starting ??= (async () => {
    let canRequestAds = true;
    try {
      ({ canRequestAds } = await module.AdsConsent.gatherConsent());
    } catch {
      // 유럽 동의 메시지를 AdMob 에 만들지 않았으면 여기로 온다
    }
    if (Platform.OS === 'ios') {
      try {
        const { status } = await getTrackingPermissionsAsync();
        if (status === PermissionStatus.UNDETERMINED) await requestTrackingPermissionsAsync();
      } catch {
        // 묻지 못해도 광고는 맞춤형이 아닌 것으로 나간다
      }
    }
    if (!canRequestAds) return false;
    try {
      // 육아 앱이라 광고 등급을 PG 로 묶는다
      await module.default().setRequestConfiguration({
        maxAdContentRating: module.MaxAdContentRating.PG,
      });
      await module.default().initialize();
      return true;
    } catch {
      return false;
    }
  })();
  return starting;
}

/** 광고를 띄워도 되는지 — 처음 부르면 시작 절차를 돈다 */
export function useAdsReady(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    startAds().then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return enabled && ready;
}

/** 한도 말풍선에 「광고 보고 정밀 답변」을 둘 수 있는지 */
export function canOfferRewardedAd(): boolean {
  return adUnit('rewarded') !== null;
}

/**
 * 보상형 광고 1편 — 불러와서 보여 주고, 끝까지 봤으면 true.
 * 적립은 AdMob 이 서버로 직접 알린다(SSV). `userId` 는 기기 키의 해시라 서버가 그 기기를 알아본다.
 */
export async function watchRewardedAd(userId: string): Promise<boolean> {
  const module = adsModule();
  const unit = adUnit('rewarded');
  if (!module || !unit || !(await startAds())) return false;

  const ad = module.RewardedAd.createForAdRequest(unit, {
    serverSideVerificationOptions: { userId },
  });
  return new Promise((resolve) => {
    let earned = false;
    // 불러오기가 너무 오래 걸리면 그만둔다(보는 중에는 재지 않는다)
    const loadTimer = setTimeout(() => finish(), 20_000);
    const unsubscribe = [
      ad.addAdEventListener(module.RewardedAdEventType.LOADED, () => {
        clearTimeout(loadTimer);
        ad.show().catch(() => finish());
      }),
      ad.addAdEventListener(module.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(module.AdEventType.CLOSED, () => finish()),
      ad.addAdEventListener(module.AdEventType.ERROR, () => finish()),
    ];
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(loadTimer);
      unsubscribe.forEach((off) => off());
      resolve(earned);
    }
    ad.load();
  });
}
