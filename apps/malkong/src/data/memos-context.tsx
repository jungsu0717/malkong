/**
 * 우리 아기 메모 (SPEC-STAGE-03, task growth/004) — 그 시기 우리 아기가 어땠는지 적어 둔다.
 * 발달 체크에서 「했어요」를 누르면 그 항목이 오늘 날짜의 메모로 남는다(`ref` = L1 id, task growth/005).
 * 가족과 함께 보기를 켜면 가족 폰과 맞춘다(task common/024) — 바꾸면 맞추기를 부르고, 가족 폰에서 온 메모는 다시 읽는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { deleteMemoRow, readMemoRows, upsertMemoRow } from './db';
import { noteDeleted } from './family';
import { playRef } from './growth-plus';
import { makeMemo, sortMemos, type Memo } from './stage';
import { onRemoteChange, requestSync } from './sync-events';

type MemosValue = {
  memos: Memo[];
  loading: boolean;
  addMemo: (text: string) => Promise<void>;
  /** 발달 체크 — 그 항목의 메모가 있으면 지우고, 없으면 오늘 날짜로 남긴다 */
  toggleCheck: (ref: string, text: string) => Promise<void>;
  /** 오늘의 놀이 「했어요」 — 오늘 그 놀이의 메모가 있으면 지우고, 없으면 남긴다(SPEC-STAGE-04) */
  togglePlay: (itemId: string, name: string) => Promise<boolean>;
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

  // 가족 폰에서 온 메모를 다시 읽는다
  useEffect(
    () =>
      onRemoteChange((kinds) => {
        if (!kinds.includes('memos')) return;
        void readMemoRows()
          .then((rows) => setMemos(sortMemos(rows)))
          .catch(() => undefined);
      }),
    [],
  );

  const drop = useCallback(async (id: string) => {
    await deleteMemoRow(id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
    await noteDeleted(id);
    requestSync();
  }, []);

  const addMemo = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const memo = makeMemo(text);
    await upsertMemoRow(memo);
    setMemos((prev) => sortMemos([memo, ...prev]));
    requestSync();
  }, []);

  const toggleCheck = useCallback(
    async (ref: string, text: string) => {
      const have = memos.find((m) => m.ref === ref);
      if (have) return drop(have.id);
      const memo = makeMemo(text, new Date(), ref);
      await upsertMemoRow(memo);
      setMemos((prev) => sortMemos([memo, ...prev]));
      requestSync();
    },
    [memos, drop],
  );

  const togglePlay = useCallback(
    async (itemId: string, name: string) => {
      const ref = playRef(itemId, new Date());
      const have = memos.find((m) => m.ref === ref);
      if (have) {
        await drop(have.id);
        return false;
      }
      const memo = makeMemo(name, new Date(), ref);
      await upsertMemoRow(memo);
      setMemos((prev) => sortMemos([memo, ...prev]));
      requestSync();
      return true;
    },
    [memos, drop],
  );

  const updateMemo = useCallback(
    async (id: string, text: string) => {
      const before = memos.find((m) => m.id === id);
      if (!before || !text.trim()) return;
      const next = { ...before, text: text.trim(), updatedAt: new Date().toISOString() };
      await upsertMemoRow(next);
      setMemos((prev) => prev.map((m) => (m.id === id ? next : m)));
      requestSync();
    },
    [memos],
  );

  const removeMemo = drop;

  const value = useMemo(
    () => ({ memos, loading, addMemo, toggleCheck, togglePlay, updateMemo, removeMemo }),
    [memos, loading, addMemo, toggleCheck, togglePlay, updateMemo, removeMemo],
  );
  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosValue {
  const value = useContext(MemosContext);
  if (!value) throw new Error('useMemos 는 MemosProvider 안에서 써야 해요');
  return value;
}
