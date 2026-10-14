/**
 * 기기 자격을 화면들이 함께 보는 자리.
 * 광고 부품과 한도 안내가 이걸 보고 움직인다 — 구매 한 번으로 모든 화면이 따라 바뀐다.
 *
 * 광고를 보일지는 두 가지가 모두 허락할 때만이다: 서버 자격(운영자 기기면 false)과 광고 제거 구매.
 * 둘을 따로 들고 있어야 구매 상태를 고쳐도 운영자 기기의 면제가 풀리지 않는다.
 *
 * 가족 기기는 마이의 숨은 스위치로 「일반 사용자로 보기」를 켤 수 있다 — 켜고 끄면 자격을 바로 다시 받는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getEntitlements, loadAsUser, saveAsUser } from './api';
import { DEFAULT_ENTITLEMENTS, loadAdsRemoved, setAdsRemoved, type Entitlements } from './entitlements';
import { ownsNoAds } from './purchases';

type EntitlementsContextValue = Entitlements & {
  /** 광고 제거를 샀는지(기기 사본·스토어 확인) */
  adsRemoved: boolean;
  /** 결제·복원이 끝나면 부른다 */
  applyAdsRemoved: (removed: boolean) => Promise<void>;
  /** 답변이 올 때마다 서버가 알려 준 남은 수로 고친다 */
  setRemaining: (remaining: number | null) => void;
  /** 가족 기기의 「일반 사용자로 보기」를 켰는지 */
  asUser: boolean;
  setAsUser: (on: boolean) => Promise<void>;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const [server, setServer] = useState<Entitlements>(DEFAULT_ENTITLEMENTS);
  const [adsRemoved, setRemoved] = useState(false);
  const [asUser, setAsUserState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadAdsRemoved();
      if (!cancelled) setRemoved(stored);
      // 구매의 정본은 스토어 — 물어볼 수 있으면 사본을 맞춘다(환불이면 다시 광고가 나온다)
      const owned = await ownsNoAds();
      if (!cancelled && owned !== null && owned !== stored) {
        setRemoved(owned);
        await setAdsRemoved(owned);
      }
    })();
    (async () => {
      const on = await loadAsUser();
      if (!cancelled) setAsUserState(on);
      // 서버 자격 — 운영자(가족) 기기면 광고·한도가 풀린다. 못 받으면 기본값으로 둔다
      try {
        const loaded = await getEntitlements();
        if (!cancelled) setServer({ ...loaded, operator: loaded.operator === true });
      } catch {
        // 연결이 안 되면 다음 실행 때 다시 받는다
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAdsRemoved = useCallback(async (removed: boolean) => {
    setRemoved(removed);
    await setAdsRemoved(removed);
  }, []);

  const setRemaining = useCallback((remaining: number | null) => {
    setServer((prev) => ({ ...prev, remaining }));
  }, []);

  const setAsUser = useCallback(async (on: boolean) => {
    setAsUserState(on);
    await saveAsUser(on);
    try {
      const loaded = await getEntitlements();
      setServer({ ...loaded, operator: loaded.operator === true });
    } catch {
      // 못 받으면 다음 답변의 남은 수와 다음 실행 때 맞춰진다
    }
  }, []);

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      ...server,
      ads: server.ads && !adsRemoved,
      adsRemoved,
      applyAdsRemoved,
      setRemaining,
      asUser,
      setAsUser,
    }),
    [server, adsRemoved, applyAdsRemoved, setRemaining, asUser, setAsUser],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextValue {
  const value = useContext(EntitlementsContext);
  if (!value) throw new Error('useEntitlements 는 EntitlementsProvider 안에서만 쓸 수 있어요');
  return value;
}
