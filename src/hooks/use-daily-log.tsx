/**
 * 하루 기록 적기 흐름 — 대화의 브리핑과 브리핑함이 같이 쓴다 (SPEC-HOME-06 ② 하루 기록, task home/005).
 * 새로 적으면 기록 한 줄을 더하고, 이미 적은 줄이면 그 기록의 문구를 고친다. 모델을 부르지 않는다.
 */

import { useState } from 'react';

import { LogSheet } from '@/components/log-sheet';
import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import { valueOf, type LogEntry } from '@/data/daily-log';
import { useRecords } from '@/data/records-context';

export function useDailyLog() {
  const { age } = useBaby();
  const { add, update } = useRecords();
  const [open, setOpen] = useState<LogEntry | null>(null);

  const save = async (value: string) => {
    if (!open) return;
    const { def, record } = open;
    setOpen(null);
    tap('success');
    const label = def.label(value, new Date());
    if (record) {
      await update(record.id, label);
      return;
    }
    await add({ kind: '기록', label, covers: [], whenLabel: age ? `D+${age.days}에 알림` : null });
  };

  const sheet = (
    <LogSheet
      key={open ? `log-${open.def.key}` : 'log-closed'}
      def={open?.def ?? null}
      editing={open?.record ? valueOf(open.def, open.record) : null}
      onClose={() => setOpen(null)}
      onSave={save}
    />
  );

  return { openLog: setOpen, sheet };
}
