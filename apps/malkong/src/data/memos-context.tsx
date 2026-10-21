/**
 * 우리 아기 메모 (SPEC-STAGE-03, task growth/004) — 그 시기 우리 아기가 어땠는지 적어 둔다.
 * 지금은 이 폰에만 저장한다. 가족 공유는 서버가 메모를 받게 된 뒤에 싣는다(배포는 Julian 승인).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { deleteMemoRow, readMemoRows, upsertMemoRow } from './db';
import { makeMemo, sortMemos, type Memo } from './stage';

type MemosValue = {
  memos: Memo[];
  loading: boolean;
  addMemo: (text: string) => Promise<void>;
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

  const value = useMemo(() => ({ memos, loading, addMemo, updateMemo, removeMemo }), [memos, loading, addMemo, updateMemo, removeMemo]);
  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosValue {
  const value = useContext(MemosContext);
  if (!value) throw new Error('useMemos 는 MemosProvider 안에서 써야 해요');
  return value;
}
