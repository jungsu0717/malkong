/**
 * 주간 · 월간 브리핑 (SPEC-HOME-08, task home/009) — 데일리가 그날의 것이라면 여기는 일정의 것.
 *
 * 주간: 월요일, 그 주(월~일)에 무렵인 접종 · 검진과 아직 안 한 것. 월간: 월령이 바뀌는 날, 이번 달 챙길 것 · 발달 포인트 ·
 * 다음 달 미리 보기. 그날 앱을 열지 않았으면 다음에 열 때 가장 최근 것 하나만 온다(지난 것을 몰아 보내지 않는다).
 * 내용은 저장하지 않고 볼 때마다 기록으로 다시 센다 — 저장하는 것은 알림함 줄(요약)뿐이다.
 */

import { monthStart } from './briefing';
import { dayKey } from './chat';
import { allItems, itemsOfKind } from './l1';
import type { BabyRecord } from './records';
import { getGaps, groupGaps, headlineOf, isLifeKind, labelByKind, type GapGroup, type L1Item } from './timeline';

const onCalendar = (item: L1Item) => item.kind === '접종' || item.kind === '검진';

/** 그 주의 월요일 0시 */
export function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

export const weeklyId = (monday: Date) => `weekly-${dayKey(monday.toISOString())}`;
export const monthlyId = (month: number) => `monthly-${month}`;

export type Weekly = {
  monday: Date;
  /** 그 주(월~일)에 무렵인 접종 · 검진 */
  due: L1Item[];
  /** 그 주 전부터 기간 안인데 안 한 것 · 기간이 지난 것(물어보기) — 접종 · 검진만 */
  left: GapGroup[];
};

export function weeklyBriefing(monday: Date, birthDate: string, records: BabyRecord[], currentMonth: number): Weekly {
  const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const due = allItems().filter((i) => {
    if (!onCalendar(i)) return false;
    const at = monthStart(birthDate, i.months[0]);
    return at >= monday && at < end;
  });
  const dueIds = new Set(due.map((i) => i.id));
  const left = groupGaps(
    getGaps(currentMonth, records, { scheduleOnly: true }).filter((g) => g.status !== 'soon' && !dueIds.has(g.item.id)),
  );
  return { monday, due, left };
}

export function weeklySummary(w: Weekly, records: BabyRecord[]): string {
  const covered = new Set(records.flatMap((r) => r.covers));
  const dueLeft = w.due.filter((i) => !covered.has(i.id));
  const parts = [
    dueLeft.length > 0 ? `${labelByKind(dueLeft)} 무렵` : '이번 주 잡힌 접종 · 검진 없음',
    w.left.length > 0 ? `아직 안 한 것 ${w.left.length}` : null,
  ].filter((p): p is string => !!p);
  return parts.join(' · ');
}

export type Monthly = {
  month: number;
  start: Date;
  headline: string | undefined;
  /** 이 달에 시작하는 챙길 것 — 접종 · 검진(생활 항목은 「접종·검진만 보기」가 아니면). 상태는 그릴 때 기록으로 센다 */
  items: L1Item[];
  /** 이 달의 발달 이정표 요약과 상담 안내(SPEC-HOME-03) */
  points: L1Item[];
  /** 첫 이정표보다 어리면 그게 언제인지 */
  pointsNote: string | null;
  /** 다음 달에 시작하는 접종 · 검진 */
  next: L1Item[];
};

export function monthlyBriefing(
  month: number,
  birthDate: string,
  records: BabyRecord[],
  { scheduleOnly = false }: { scheduleOnly?: boolean } = {},
): Monthly {
  const covered = new Set(records.flatMap((r) => r.covers));
  // 병원에 가는 일정이 먼저, 생활 항목은 뒤에
  const items = allItems()
    .filter((i) => i.months[0] === month && (onCalendar(i) || (!scheduleOnly && isLifeKind(i.kind))))
    .sort((a, b) => Number(isLifeKind(a.kind)) - Number(isLifeKind(b.kind)));
  const points = allItems().filter((i) => i.kind === '발달' && i.months.includes(month));
  const firsts = itemsOfKind('발달').map((i) => i.months[0]);
  const first = firsts.length > 0 ? Math.min(...firsts) : null;
  return {
    month,
    start: monthStart(birthDate, month),
    headline: headlineOf(month),
    items,
    points,
    pointsNote: points.length === 0 && first !== null && month < first ? `첫 발달 이정표는 ${first}개월이에요` : null,
    next: allItems().filter((i) => onCalendar(i) && i.months[0] === month + 1 && !covered.has(i.id)),
  };
}

export function monthlySummary(m: Monthly): string {
  const vacc = m.items.filter((i) => i.kind === '접종').length;
  const check = m.items.filter((i) => i.kind === '검진').length;
  const parts = [
    m.headline ?? null,
    vacc > 0 ? `접종 ${vacc}` : null,
    check > 0 ? `검진 ${check}` : null,
    m.points.length > 0 ? '발달 포인트' : null,
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' · ') : '이번 달 챙길 것과 발달 포인트';
}
