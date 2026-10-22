/**
 * 광고(AdMob) — 시작 · 배너 단위 (task common/006, decisions/002). 보상형 광고는 질문 답변과 함께 뺐다(2026-10-22).
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
};

export function adUnit(kind: 'banner'): string | null {
  const module = adsModule();
  if (!module) return null;
  if (__DEV__) return module.TestIds.ADAPTIVE_BANNER;
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
