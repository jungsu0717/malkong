/**
 * 접종 · 검진 일정의 셈 (SPEC-TOPIC-01 · 02) — 표준 일정(L1)의 항목마다 지금 상태를 보고, 완료를 알릴 수 있게 묶는다.
 *
 * 표준 일정은 월령 기준이라 날짜는 생일에서 계산한 「무렵」이다(그 월령이 시작하는 날, briefing.ts monthStart).
 * 했는지는 기록(L2)의 covers 로 센다. 모두 기기 안에서 센다. 예전 일정 탭 · 달력 · 대화 셈은 뺐다(decisions/030).
 */

import type { BabyRecord } from './records';
import { groupLabel, type GapGroup, type GapStatus, type L1Item } from './timeline';

export type JourneyKind = '접종' | '검진' | '발달';

/** 줄 아이콘 색 — 건강 분홍 · 성장 초록 · 발달 노랑 */
export const KIND_COLORS: Record<JourneyKind, string> = {
  접종: '#E0607A',
  검진: '#4FB39A',
  발달: '#E9B03C',
};

const startOf = (item: L1Item) => item.months[0];
const endOf = (item: L1Item) => item.months[item.months.length - 1];

export function coveredIds(records: BabyRecord[]): Set<string> {
  return new Set(records.flatMap((r) => r.covers));
}

/** 한 항목의 지금 상태 — 놓침은 단정하지 않고 「물어보기」로 그린다 */
type ItemState = 'done' | 'open' | 'missed' | 'future';

function itemState(item: L1Item, covered: Set<string>, currentMonth: number): ItemState {
  if (covered.has(item.id)) return 'done';
  if (startOf(item) > currentMonth) return 'future';
  return endOf(item) < currentMonth ? 'missed' : 'open';
}

/**
 * 완료를 알릴 수 있게 같은 분류끼리 묶은 줄 — 완료 확인 시트가 받는 모양.
 * 다가오는 것은 「soon」으로 둬서 D-day 가 보이게 한다.
 */
export function groupsToMark(items: L1Item[], covered: Set<string>, currentMonth: number): GapGroup[] {
  const groups = new Map<string, GapGroup>();
  for (const item of items) {
    const state = itemState(item, covered, currentMonth);
    if (state === 'done') continue;
    const status: GapStatus = state === 'future' ? 'soon' : state;
    const key = `${status}-${startOf(item)}-${item.kind}`;
    const group = groups.get(key) ?? { key, status, month: startOf(item), label: '', items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({ ...g, label: groupLabel(g.items) }));
}
