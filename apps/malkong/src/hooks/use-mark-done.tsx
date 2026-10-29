/**
 * 접종 · 검진 줄의 완료 알리기 흐름 — 할 일 탭과 주제 화면이 같이 쓴다.
 * 날짜는 묻지 않는다 — 기록의 시점은 알린 날이다.
 */

import { useState } from 'react';

import { MarkDoneSheet } from '@/components/mark-done-sheet';
import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';
import { groupLabel, isLifeGroup, type GapGroup, type L1Item } from '@/data/timeline';

/** 「10월 19일」 */
const monthDay = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

/** `onConfirmed` — 완료를 알린 묶음을 받는다(아기 일정은 그 묶음의 병원 예약을 완료로, task topic/010) */
export function useMarkDone(onConfirmed?: (group: GapGroup) => void) {
  const { age } = useBaby();
  const { add, remove } = useRecords();
  /** 완료를 알리려고 연 줄 */
  const [picking, setPicking] = useState<GapGroup | null>(null);
  /** 방금 만든 기록 — 무엇을 기록했는지 보여주고 되돌릴 수 있게 둔다 */
  const [justSaved, setJustSaved] = useState<BabyRecord | null>(null);

  const confirm = async (items: L1Item[]) => {
    if (!age) return;
    const group = picking;
    const life = group ? isLifeGroup(group) : false;
    setPicking(null);
    tap('success');
    const record = await add({
      kind: '기록',
      label: `${groupLabel(items)} ${life ? '확인' : '완료'}`,
      covers: items.map((i) => i.id),
      whenLabel: `${monthDay(new Date())} 알림에서`,
    });
    setJustSaved(record);
    if (group) onConfirmed?.(group);
  };

  const undo = async () => {
    if (!justSaved) return;
    await remove(justSaved.id);
    setJustSaved(null);
  };

  const sheet = (
    <MarkDoneSheet
      key={`mark-done-${picking?.key ?? 'closed'}`}
      group={picking}
      onClose={() => setPicking(null)}
      onConfirm={confirm}
    />
  );

  return { pick: setPicking, justSaved, undo, dismissSaved: () => setJustSaved(null), sheet };
}
