/**
 * 기록 그래프의 셈 (SPEC-LOG-04, task log/006) — 분유 · 모유 · 기저귀 · 잠을 하루 · 일주일 · 한 달로.
 *
 * 날마다 합계, 평균(오늘은 지금까지라 뺀다, 기록이 없는 날도 뺀다 — 적지 않은 날일 수 있다), 견주는 한 줄.
 * 정상 · 이상을 판정하지 않는다(헌장 5). 달라진 사실만 말하고, 차이가 평균의 5% 보다 작으면 「비슷해요」.
 * 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/graph-series.test.ts`).
 */

import { dayTotals, feedSessions, type DayTotals } from './day-flow.ts';
import { durationLabel, minutesOf, startOfDay } from './event-summary.ts';
import type { CareEvent } from './events.ts';

export type Metric = 'formula' | 'breast' | 'diaper' | 'sleep';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const t = (iso: string) => new Date(iso).getTime();

export const METRIC_LABEL: Record<Metric, string> = { formula: '분유', breast: '모유', diaper: '기저귀', sleep: '잠' };

export function metricValue(m: Metric, s: DayTotals): number {
  return m === 'formula' ? s.formulaMl : m === 'breast' ? s.breastMin : m === 'diaper' ? s.diapers : s.sleepMin;
}

/** 「180ml」 「55분」 「7번」 「8시간 20분」 */
export function formatValue(m: Metric, v: number): string {
  if (m === 'formula') return `${Math.round(v)}ml`;
  if (m === 'diaper') return `${Math.round(v)}번`;
  return durationLabel(Math.round(v));
}

/** 막대 위 짧은 값 — 「520」 「7」 「13.5」(시간) 「55」(분) */
export function shortValue(m: Metric, v: number): string {
  if (m === 'sleep') return String(Math.round((v / 60) * 10) / 10);
  return String(Math.round(v));
}

export type DayValue = { date: Date; value: number; pee: number; poo: number; isToday: boolean };

/** 오늘까지 n 날 — 오래된 날부터 */
export function dailyValues(events: CareEvent[], m: Metric, n: number, now = new Date()): DayValue[] {
  const today = startOfDay(now);
  const out: DayValue[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const s = dayTotals(events, date, now);
    const from = date.getTime();
    let pee = 0;
    if (m === 'diaper') {
      for (const e of events) {
        if (e.kind === 'diaper' && t(e.startAt) >= from && t(e.startAt) < from + DAY && (e.diaper === 'pee' || e.diaper === 'both')) pee += 1;
      }
    }
    out.push({ date, value: metricValue(m, s), pee, poo: s.poo, isToday: i === 0 });
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** 기록한 날만 — 0 인 날은 적지 않은 날일 수 있다 */
const recorded = (vs: DayValue[]) => vs.filter((v) => !v.isToday && v.value > 0).map((v) => v.value);

const VERB: Record<Metric, string> = { formula: '먹었어요', breast: '먹었어요', diaper: '갈았어요', sleep: '잤어요' };

/** 두 평균을 견주는 한 줄 — 「지난주보다 하루 40ml 더 먹었어요」 · 「첫 주보다 하루 70ml 늘었어요」 */
function compareLine(m: Metric, now: number, before: number, head: string, style: 'more' | 'grow'): string | null {
  if (before <= 0 || now <= 0) return null;
  const diff = now - before;
  const step = m === 'formula' ? 10 : m === 'diaper' ? 1 : 10;
  const rounded = Math.round(Math.abs(diff) / step) * step;
  if (Math.abs(diff) < before * 0.05 || rounded === 0) return `${head}와 비슷해요`;
  const amount = m === 'formula' ? `${rounded}ml` : m === 'diaper' ? `${rounded}번` : durationLabel(rounded);
  if (style === 'grow') return `${head}보다 하루 ${amount} ${diff > 0 ? '늘었어요' : '줄었어요'}`;
  return `${head}보다 하루 ${amount} ${diff > 0 ? '더' : '덜'} ${VERB[m]}`;
}

export type PeriodSummary = { avg: number; days: DayValue[]; line: string | null };

/** 일주일 — 오늘까지 7일, 평균은 그 앞 6일(기록한 날), 견주는 것은 그 앞 7일 */
export function weekSummary(events: CareEvent[], m: Metric, now = new Date()): PeriodSummary {
  const all = dailyValues(events, m, 14, now);
  const days = all.slice(7);
  const mine = avg(recorded(days));
  const before = avg(recorded(all.slice(0, 7)));
  return { avg: mine, days, line: compareLine(m, mine, before, '지난주', 'more') };
}

/** 한 달 — 오늘까지 30일, 첫 7일과 마지막 7일(오늘 뺌)을 견준다 */
export function monthSummary(events: CareEvent[], m: Metric, now = new Date()): PeriodSummary {
  const days = dailyValues(events, m, 30, now);
  const mine = avg(recorded(days));
  const first = avg(recorded(days.slice(0, 7)));
  const last = avg(recorded(days.slice(-8, -1)));
  return { avg: mine, days, line: compareLine(m, last, first, '첫 주', 'grow') };
}

/** 하루 그래프에 그릴 것 — 그날 0시부터 몇 시간 */
export type DayMark = { from: number; to: number | null; value: number; poo?: boolean };
export type DaySummary = { total: number; count: number; last: number | null; marks: DayMark[]; line: string | null };

function totalUntil(events: CareEvent[], m: Metric, day: Date, until: number, now: Date): number {
  const capped = events
    .filter((e) => t(e.startAt) < until)
    .map((e) => (e.endAt && t(e.endAt) > until ? { ...e, endAt: new Date(until).toISOString() } : e));
  return metricValue(m, dayTotals(capped, day, new Date(Math.min(until, now.getTime()))));
}

export function daySummary(events: CareEvent[], m: Metric, day: Date, now = new Date()): DaySummary {
  const D0 = startOfDay(day).getTime();
  const D1 = D0 + DAY;
  const isToday = now.getTime() >= D0 && now.getTime() < D1;
  const h = (at: number) => (at - D0) / (60 * MIN);
  const s = dayTotals(events, day, now);
  const marks: DayMark[] = [];
  let count = 0;
  let last: number | null = null;
  if (m === 'formula' || m === 'breast') {
    for (const f of feedSessions(events)) {
      const at = t(f.startAt);
      if (f.kind !== m || at < D0 || at >= D1) continue;
      const value = m === 'formula' ? (f.parts[0].amount ?? 0) : f.parts.reduce((sum, p) => sum + minutesOf(p, now), 0);
      marks.push({ from: h(at), to: null, value: Math.round(value) });
      count += 1;
      last = at;
    }
  } else if (m === 'diaper') {
    for (const e of events) {
      const at = t(e.startAt);
      if (e.kind !== 'diaper' || at < D0 || at >= D1) continue;
      marks.push({ from: h(at), to: null, value: 1, poo: e.diaper !== 'pee' });
      count += 1;
      last = at;
    }
  } else {
    for (const e of events) {
      if (e.kind !== 'sleep') continue;
      const a = Math.max(t(e.startAt), D0);
      const b = Math.min(e.endAt ? t(e.endAt) : now.getTime(), D1);
      if (b <= a) continue;
      marks.push({ from: h(a), to: h(b), value: (b - a) / MIN });
      count += 1;
      last = e.endAt ? t(e.endAt) : null;
    }
  }
  const total = metricValue(m, s);
  // 견주기 — 오늘이면 어제 이 시간까지, 지난날이면 그 전날
  const prevDay = new Date(D0 - DAY);
  const prev = isToday ? totalUntil(events, m, prevDay, now.getTime() - DAY, now) : metricValue(m, dayTotals(events, prevDay, now));
  const value = m === 'formula' ? `${Math.round(prev)}ml` : m === 'diaper' ? `${prev}번` : durationLabel(Math.round(prev));
  const line = prev > 0 ? `${isToday ? '어제 이 시간까지는' : '전날은'} ${value} ${VERB[m]}` : null;
  return { total, count, last, marks, line };
}
