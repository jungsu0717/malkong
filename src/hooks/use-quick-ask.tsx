/**
 * 버디가 묻는 짧은 질문의 흐름 — 브리핑의 하루 기록과 우리 아기 탭의 「알려 주기」가 같이 쓴다
 * (SPEC-HOME-06 ② 하루 기록 · SPEC-BABY-04, task home/005 · baby/002).
 * 새로 답하면 기록 한 줄을 더하고, 이미 아는 것이면 그 기록의 문구를 고친다. 모델을 부르지 않는다.
 */

import { useState } from 'react';

import { AskSheet } from '@/components/ask-sheet';
import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import type { QuickAsk } from '@/data/quick-ask';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';

type Open = {
  ask: QuickAsk;
  /** 이미 아는 것이면 그 기록 — 고친다 */
  record: BabyRecord | null;
  /** 고칠 때 시트에 보일 지금 값 */
  current: string | null;
};

export function useQuickAsk() {
  const { age } = useBaby();
  const { add, update } = useRecords();
  const [open, setOpen] = useState<Open | null>(null);

  const save = async (value: string) => {
    if (!open) return;
    const { ask, record } = open;
    setOpen(null);
    tap('success');
    const label = ask.label(value, new Date());
    if (record) {
      await update(record.id, label);
      return;
    }
    await add({ kind: '기록', label, covers: [], whenLabel: age ? `D+${age.days}에 알림` : null });
  };

  const sheet = (
    <AskSheet
      key={open ? `ask-${open.ask.title}` : 'ask-closed'}
      ask={open?.ask ?? null}
      editing={open?.current ?? null}
      onClose={() => setOpen(null)}
      onSave={save}
    />
  );

  return {
    ask: (ask: QuickAsk, record: BabyRecord | null = null, current: string | null = null) =>
      setOpen({ ask, record, current }),
    sheet,
  };
}
