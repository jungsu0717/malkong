/**
 * 「챙길 것」 한 줄의 완료 알리기 흐름 — 브리핑과 우리 아기 탭이 같이 쓴다 (SPEC-HOME-02 완료 알림 · 저장 표시).
 * 날짜는 묻지 않는다 — 기록의 시점은 알린 날(D+N)이다.
 */

import { useState } from 'react';

import { MarkDoneSheet } from '@/components/mark-done-sheet';
import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';
import { groupLabel, isLifeGroup, type GapGroup, type L1Item } from '@/data/timeline';

export function useMarkDone() {
  const { age } = useBaby();
  const { add, remove } = useRecords();
  /** 완료를 알리려고 연 줄 */
  const [picking, setPicking] = useState<GapGroup | null>(null);
  /** 방금 만든 기록 — 무엇을 기록했는지 보여주고 되돌릴 수 있게 둔다 */
  const [justSaved, setJustSaved] = useState<BabyRecord | null>(null);

  const confirm = async (items: L1Item[]) => {
    if (!age) return;
    const life = picking ? isLifeGroup(picking) : false;
    setPicking(null);
    tap('success');
    const record = await add({
      kind: '기록',
      label: `${groupLabel(items)} ${life ? '확인' : '완료'}`,
      covers: items.map((i) => i.id),
      whenLabel: `D+${age.days}에 알림`,
    });
    setJustSaved(record);
  };

  const undo = async () => {
    if (!justSaved) return;
    await remove(justSaved.id);
    setJustSaved(null);
  };

  const sheet = (
    <MarkDoneSheet
      key={picking?.key ?? 'closed'}
      group={picking}
      onClose={() => setPicking(null)}
      onConfirm={confirm}
    />
  );

  return { pick: setPicking, justSaved, undo, dismissSaved: () => setJustSaved(null), sheet };
}
