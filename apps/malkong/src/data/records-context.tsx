/**
 * 우리 아기 기록(L2)을 화면들이 함께 보는 자리.
 *
 * 홈에서 완료를 알리면 성장 타임라인도 바로 따라 바뀌어야 하므로 한곳에서 들고 있는다
 * (knowledge-layers 정정 규칙 — 기록이 바뀌면 그것을 근거로 한 추천도 따라 바뀐다).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { noteDeleted } from './family';
import {
  addRecord,
  loadRecords,
  removeRecord,
  updateRecordLabel,
  type BabyRecord,
} from './records';
import { requestSync } from './sync-events';

type RecordsContextValue = {
  records: BabyRecord[];
  /** 기기에서 읽어오는 중 — 다 읽기 전에 브리핑을 만들면 이미 한 일이 다시 올라온다 */
  loading: boolean;
  add: (
    input: Pick<BabyRecord, 'kind' | 'label' | 'covers' | 'whenLabel'> &
      Partial<Pick<BabyRecord, 'sourceMessageId'>>,
  ) => Promise<BabyRecord>;
  remove: (id: string) => Promise<void>;
  /** 문구 고치기(SPEC-MY-02) — 홈 추천과 답변에 보내는 기록이 바로 따라 바뀐다 */
  update: (id: string, label: string) => Promise<void>;
  /** 가족에게서 받은 기록이 폰에 적용된 뒤 다시 읽는다(task my/007) */
  reload: () => Promise<void>;
};

const RecordsContext = createContext<RecordsContextValue | null>(null);

export function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<BabyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadRecords()
      .then((stored) => {
        if (!cancelled) setRecords(stored);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback<RecordsContextValue['add']>(async (input) => {
    const record = await addRecord(input);
    setRecords((prev) => [...prev, record]);
    requestSync();
    return record;
  }, []);

  const remove = useCallback(async (id: string) => {
    await noteDeleted(id);
    await removeRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    requestSync();
  }, []);

  const update = useCallback(async (id: string, label: string) => {
    await updateRecordLabel(id, label);
    const updatedAt = new Date().toISOString();
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, label, stale: false, updatedAt } : r)));
    requestSync();
  }, []);

  const reload = useCallback(async () => {
    setRecords(await loadRecords());
  }, []);

  const value = useMemo(
    () => ({ records, loading, add, remove, update, reload }),
    [records, loading, add, remove, update, reload],
  );

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsContextValue {
  const value = useContext(RecordsContext);
  if (!value) throw new Error('useRecords 는 RecordsProvider 안에서만 쓸 수 있어요');
  return value;
}
