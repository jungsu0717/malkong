/**
 * 일정 탭의 셈 (SPEC-GROW-01·02, task growth/002) — 표준 일정(L1)을 날짜에 놓고, 챙길 것 여정의 정류장을 만든다.
 *
 * 표준 일정은 월령 기준이라 날짜는 생일에서 계산한 「무렵」이다(그 월령이 시작하는 날).
 * 했는지는 기록(L2)의 covers 로 센다 — 브리핑 · 우리 아기 탭과 같은 기준. 모두 기기 안에서 센다.
 */

import { monthStart } from './briefing';
import { dayKey } from './chat';
import type { InboxCard } from './inbox';
import { allItems } from './l1';
import type { BabyRecord } from './records';
import { groupLabel, type GapGroup, type GapStatus, type L1Item } from './timeline';

export type JourneyKind = '접종' | '검진' | '발달';
export const JOURNEY_KINDS: JourneyKind[] = ['접종', '검진', '발달'];

/** 여정 · 고리 색 — 우리 아기 탭 지식 지도의 영역 색과 같은 결(건강 분홍 · 성장 초록 · 발달 노랑) */
export const KIND_COLORS: Record<JourneyKind, string> = {
  접종: '#E0607A',
  검진: '#4FB39A',
  발달: '#E9B03C',
};

const startOf = (item: L1Item) => item.months[0];
const endOf = (item: L1Item) => item.months[item.months.length - 1];

/**
 * 여정에 오르는 항목 — 접종 · 검진과 발달 이정표 체크리스트. 「늦으면 상담하세요」처럼 몇 해에 걸친 상시 안내는
 * 정류장이 아니라서 뺀다(이정표는 길어야 몇 달).
 */
export function onJourney(item: L1Item): item is L1Item & { kind: JourneyKind } {
  if (item.kind === '발달') return item.months.length <= 6;
  return item.kind === '접종' || item.kind === '검진';
}

/** 날짜에 찍는 일정 — 병원에 가는 접종 · 검진만. 발달 이정표는 그 달 내내라 날짜가 없다 */
const onCalendar = (item: L1Item) => item.kind === '접종' || item.kind === '검진';

/** 그 항목의 날짜 무렵 — 시작 월령이 되는 날 */
export function dueDate(birthDate: string, item: L1Item): Date {
  return monthStart(birthDate, startOf(item));
}

export function coveredIds(records: BabyRecord[]): Set<string> {
  return new Set(records.flatMap((r) => r.covers));
}

/** 날짜별 일정과 기록 — 달력 점과 고른 날 보기가 쓴다. 열쇠는 `dayKey` */
export type DayIndex = { due: Map<string, L1Item[]>; records: Map<string, BabyRecord[]> };

export function dayIndex(birthDate: string, records: BabyRecord[]): DayIndex {
  const due = new Map<string, L1Item[]>();
  for (const item of allItems().filter(onCalendar)) {
    const key = dayKey(dueDate(birthDate, item).toISOString());
    due.set(key, [...(due.get(key) ?? []), item]);
  }
  const byDay = new Map<string, BabyRecord[]>();
  for (const r of records) {
    const key = dayKey(r.createdAt);
    byDay.set(key, [...(byDay.get(key) ?? []), r]);
  }
  return { due, records: byDay };
}

/** 한 항목의 지금 상태 — 놓침은 단정하지 않고 「물어보기」로 그린다(SPEC-GROW-03) */
export type ItemState = 'done' | 'open' | 'missed' | 'future';

export function itemState(item: L1Item, covered: Set<string>, currentMonth: number): ItemState {
  if (covered.has(item.id)) return 'done';
  if (startOf(item) > currentMonth) return 'future';
  return endOf(item) < currentMonth ? 'missed' : 'open';
}

/**
 * 완료를 알릴 수 있게 같은 분류끼리 묶은 줄 — mark-done 시트가 받는 모양(SPEC-HOME-02 묶음).
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

export type StationState = 'done' | 'partial' | 'open' | 'missed' | 'future' | 'now';

export type Station = {
  month: number;
  /** 그 월령이 시작하는 날 */
  date: Date;
  items: (L1Item & { kind: JourneyKind })[];
  doneCount: number;
  state: StationState;
  isNow: boolean;
};

/**
 * 챙길 것 여정의 정류장 — 그 달에 시작하는 항목이 있는 월령마다 하나, 그리고 지금 월령.
 * 지나온 정류장: 다 했으면 done, 일부면 partial, 기간이 다 지났는데 남았으면 missed(물어보기), 아직 기간 안이면 open.
 */
export function buildJourney(birthDate: string, records: BabyRecord[], currentMonth: number): Station[] {
  const covered = coveredIds(records);
  const byMonth = new Map<number, (L1Item & { kind: JourneyKind })[]>();
  for (const item of allItems().filter(onJourney)) {
    byMonth.set(startOf(item), [...(byMonth.get(startOf(item)) ?? []), item]);
  }
  if (!byMonth.has(currentMonth)) byMonth.set(currentMonth, []);

  return [...byMonth.keys()]
    .sort((a, b) => a - b)
    .map((month) => {
      const items = byMonth.get(month)!;
      const left = items.filter((i) => !covered.has(i.id));
      const doneCount = items.length - left.length;
      const isNow = month === currentMonth;
      let state: StationState;
      if (month > currentMonth) state = 'future';
      else if (items.length > 0 && left.length === 0) state = 'done';
      else if (isNow && items.length === 0) state = 'now';
      else if (left.every((i) => endOf(i) < currentMonth)) state = 'missed';
      else state = doneCount > 0 ? 'partial' : 'open';
      return { month, date: monthStart(birthDate, month), items, doneCount, state, isNow };
    });
}

export type JourneyRing = { kind: JourneyKind; done: number; total: number };

/** 지금까지 할 것 가운데 한 것 — 지금 월령까지 시작한 항목 기준(SPEC-GROW-02 요약) */
export function journeyRings(records: BabyRecord[], currentMonth: number): JourneyRing[] {
  const covered = coveredIds(records);
  const due = allItems().filter((i) => onJourney(i) && startOf(i) <= currentMonth);
  return JOURNEY_KINDS.map((kind) => {
    const items = due.filter((i) => i.kind === kind);
    return { kind, done: items.filter((i) => covered.has(i.id)).length, total: items.length };
  });
}

/** 그 주의 일요일 0시 — 달력은 일요일부터 */
export function weekStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `dayKey` 를 날짜로 — 「2026-10-4」 */
export function fromDayKey(key: string): Date | null {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

let openSeq = 0;

/**
 * 일정 탭의 그날로 가는 길 — 알림함 · 대화의 「확인하러 가기」가 쓴다. t 는 같은 날을 다시 열어도 다시 고르게 하는 구분값
 */
export function scheduleDayHref(day: string) {
  openSeq += 1;
  return { pathname: '/schedule' as const, params: { day, t: String(openSeq) } };
}

export type BriefingKind = 'daily' | 'weekly' | 'monthly';

/** 브리핑 상세 화면(`/briefing`) — 홈 · 알림함 · 일정 탭 고른 날이 모두 같은 곳으로 간다(task growth/003) */
export function briefingHref(day: string, kind: BriefingKind = 'daily', month?: number) {
  return {
    pathname: '/briefing' as const,
    params: { day, kind, ...(month !== undefined ? { month: String(month) } : {}) },
  };
}

/** 알림함의 브리핑 줄이 갈 곳 — 기록 요청(nudge) 줄은 카드라 여기 없다 */
export function inboxCardHref(card: InboxCard) {
  if (!card.day) return null;
  if (card.kind === 'monthly') return briefingHref(card.day, 'monthly', Number(card.id.replace('monthly-', '')));
  if (card.kind === 'weekly') return briefingHref(card.day, 'weekly');
  if (card.kind === 'daily') return briefingHref(card.day, 'daily');
  return null;
}
