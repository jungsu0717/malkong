/**
 * 우리 아기 메모 (SPEC-STAGE-03, task growth/004) — 그 시기 우리 아기가 어땠는지 적어 둔다.
 * 발달 체크에서 「했어요」를 누르면 그 항목이 오늘 날짜의 메모로 남는다(`ref` = L1 id, task growth/005).
 * 지금은 이 폰에만 저장한다. 가족 공유는 서버가 메모를 받게 된 뒤에 싣는다(배포는 Julian 승인).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { deleteMemoRow, readMemoRows, upsertMemoRow } from './db';
import { makeMemo, sortMemos, type Memo } from './stage';

type MemosValue = {
  memos: Memo[];
  loading: boolean;
  addMemo: (text: string) => Promise<void>;
  /** 발달 체크 — 그 항목의 메모가 있으면 지우고, 없으면 오늘 날짜로 남긴다 */
  toggleCheck: (ref: string, text: string) => Promise<void>;
  updateMemo: (id: string, text: string) => Promise<void>;
  removeMemo: (id: string) => Promise<void>;
};

const MemosContext = createContext<MemosValue | null>(null);

export function MemosProvider({ children }: { children: ReactNode }) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void readMemoRows()
      .then((rows) => {
        if (!cancelled) setMemos(sortMemos(rows));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addMemo = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const memo = makeMemo(text);
    await upsertMemoRow(memo);
    setMemos((prev) => sortMemos([memo, ...prev]));
  }, []);

  const toggleCheck = useCallback(
    async (ref: string, text: string) => {
      const have = memos.find((m) => m.ref === ref);
      if (have) {
        await deleteMemoRow(have.id);
        setMemos((prev) => prev.filter((m) => m.id !== have.id));
        return;
      }
      const memo = makeMemo(text, new Date(), ref);
      await upsertMemoRow(memo);
      setMemos((prev) => sortMemos([memo, ...prev]));
    },
    [memos],
  );

  const updateMemo = useCallback(
    async (id: string, text: string) => {
      const before = memos.find((m) => m.id === id);
      if (!before || !text.trim()) return;
      const next = { ...before, text: text.trim(), updatedAt: new Date().toISOString() };
      await upsertMemoRow(next);
      setMemos((prev) => prev.map((m) => (m.id === id ? next : m)));
    },
    [memos],
  );

  const removeMemo = useCallback(async (id: string) => {
    await deleteMemoRow(id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const value = useMemo(
    () => ({ memos, loading, addMemo, toggleCheck, updateMemo, removeMemo }),
    [memos, loading, addMemo, toggleCheck, updateMemo, removeMemo],
  );
  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosValue {
  const value = useContext(MemosContext);
  if (!value) throw new Error('useMemos 는 MemosProvider 안에서 써야 해요');
  return value;
}
