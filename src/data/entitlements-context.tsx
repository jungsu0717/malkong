/**
 * 기기 자격을 화면들이 함께 보는 자리.
 * 광고 부품과 한도 안내가 이걸 보고 움직인다 — 구매 한 번으로 모든 화면이 따라 바뀐다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getEntitlements } from './api';
import {
  cacheAdsEnabled,
  DEFAULT_ENTITLEMENTS,
  loadEntitlements,
  setAdsRemoved,
  type Entitlements,
} from './entitlements';

type EntitlementsContextValue = Entitlements & {
  /** 결제·복원이 끝나면 부른다 */
  applyAdsRemoved: (removed: boolean) => Promise<void>;
  /** 답변이 올 때마다 서버가 알려 준 남은 수로 고친다 */
  setRemaining: (remaining: number | null) => void;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const [entitlements, setEntitlements] = useState<Entitlements>(DEFAULT_ENTITLEMENTS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadEntitlements();
      if (!cancelled) setEntitlements(local);
      // 서버 자격 — 운영자(가족) 기기면 광고·한도가 풀린다. 못 받으면 기본값으로 둔다
      try {
        const server = await getEntitlements();
        if (cancelled) return;
        const ads = local.ads && server.ads;
        cacheAdsEnabled(ads);
        setEntitlements({ ...server, ads });
      } catch {
        // 연결이 안 되면 다음 실행 때 다시 받는다
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAdsRemoved = useCallback(async (removed: boolean) => {
    await setAdsRemoved(removed);
    setEntitlements((prev) => ({ ...prev, ads: !removed }));
  }, []);

  const setRemaining = useCallback((remaining: number | null) => {
    setEntitlements((prev) => ({ ...prev, remaining }));
  }, []);

  const value = useMemo<EntitlementsContextValue>(
    () => ({ ...entitlements, applyAdsRemoved, setRemaining }),
    [entitlements, applyAdsRemoved, setRemaining],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextValue {
  const value = useContext(EntitlementsContext);
  if (!value) throw new Error('useEntitlements 는 EntitlementsProvider 안에서만 쓸 수 있어요');
  return value;
}
