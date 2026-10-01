/**
 * 저장된 아기 정보를 화면들이 함께 보는 자리.
 *
 * 월령은 보관하지 않고 생일에서 매번 계산하므로, 생일을 고치면 모든 화면이 바로 따라 바뀐다
 * (SPEC-MY-01 둘째 줄 · SPEC-MY-02 정정).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ageFrom, loadBaby, saveBaby, type Baby, type BabyAge } from './baby';

type BabyContextValue = {
  baby: Baby | null;
  /** 저장된 생일이 없으면 null */
  age: BabyAge | null;
  /** 기기에서 읽어오는 중 */
  loading: boolean;
  save: (input: { name: string | null; birthDate: string }) => Promise<void>;
};

const BabyContext = createContext<BabyContextValue | null>(null);

export function BabyProvider({ children }: { children: React.ReactNode }) {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadBaby()
      .then((stored) => {
        if (!cancelled) setBaby(stored);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (input: { name: string | null; birthDate: string }) => {
    const saved = await saveBaby(input);
    setBaby(saved);
  }, []);

  const value = useMemo<BabyContextValue>(
    () => ({
      baby,
      age: baby ? ageFrom(baby.birthDate) : null,
      loading,
      save,
    }),
    [baby, loading, save],
  );

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
}

export function useBaby(): BabyContextValue {
  const value = useContext(BabyContext);
  if (!value) throw new Error('useBaby 는 BabyProvider 안에서만 쓸 수 있어요');
  return value;
}
