/**
 * 기기 자격을 화면들이 함께 보는 자리.
 * 광고 부품과 한도 안내가 이걸 보고 움직인다 — 구매 한 번으로 모든 화면이 따라 바뀐다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_ENTITLEMENTS,
  loadEntitlements,
  setAdsRemoved,
  type Entitlements,
} from './entitlements';

type EntitlementsContextValue = Entitlements & {
  /** 결제·복원이 끝나면 부른다 */
  applyAdsRemoved: (removed: boolean) => Promise<void>;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const [entitlements, setEntitlements] = useState<Entitlements>(DEFAULT_ENTITLEMENTS);

  useEffect(() => {
    let cancelled = false;
    loadEntitlements().then((loaded) => {
      if (!cancelled) setEntitlements(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAdsRemoved = useCallback(async (removed: boolean) => {
    await setAdsRemoved(removed);
    setEntitlements((prev) => ({ ...prev, ads: !removed }));
  }, []);

  const value = useMemo<EntitlementsContextValue>(
    () => ({ ...entitlements, applyAdsRemoved }),
    [entitlements, applyAdsRemoved],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextValue {
  const value = useContext(EntitlementsContext);
  if (!value) throw new Error('useEntitlements 는 EntitlementsProvider 안에서만 쓸 수 있어요');
  return value;
}
