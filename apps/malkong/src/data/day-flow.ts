/**
 * 하루 흐름의 셈 (SPEC-MAIN-08 · 10, task today/012 · 013 · 014, decisions/037 · 038) — 기록을 잠과 잠 사이로 나눈 줄 · 합계 · 일주일 막대로 바꾼다.
 *
 * 모두 기기 안에서 규칙으로 센다(모델을 부르지 않는다). 다음 수유 예상과 밤잠 드는 시간은 우리 아기의 지난 기록에서 나온 값일 뿐이고,
 * 정상 · 이상을 판정하지 않는다(헌장 5). 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/day-flow.test.ts`).
 */

import { durationLabel, minutesOf, startOfDay } from './event-summary.ts';
import type { CareEvent } from './events.ts';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 쪽을 바꾼 모유 — 앞 모유가 끝난 뒤 이 안에 다시 시작하면 같은 수유 한 번(event-summary 와 같은 규칙) */
const SESSION_GAP = 10 * MIN;
/** 잠 앞의 「깨어 있음」과 지금 노드의 「깨어 있어요」 — 이보다 길면 잠 기록이 빠진 것으로 보고 쓰지 않는다 */
const AWAKE_LIMIT = 12 * HOUR;
/** 다음 수유 예상에 쓰는 수유 간격 — 최근 사흘, 이 범위 밖(쪽 바꾸기 · 기록이 빠진 밤)은 뺀다 */
const FEED_GAP_MIN = 30 * MIN;
const FEED_GAP_MAX = 8 * HOUR;
/** 밤잠 — 저녁 6시 뒤에 시작해 3시간 넘게 잔 잠 */
const NIGHT_FROM_HOUR = 18;
const NIGHT_MIN = 3 * 60;

const t = (iso: string) => new Date(iso).getTime();
const endOf = (e: CareEvent, now: Date) => (e.endAt ? t(e.endAt) : now.getTime());

/** 「11:30」 — 흐름에서는 24시간으로 쓴다(시안 · 루틴 상태 줄과 같다) */
export function hhmm(at: Date | string | number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 그날 0시부터 몇 시간(소수) */
export function hourOfDay(at: number, dayStart: number): number {
  return (at - dayStart) / HOUR;
}

/** 수유 한 번 — 분유 한 줄이거나, 쪽을 바꾼 모유 여러 줄 */
export type FeedSession = {
  /** 첫 줄의 id */
  id: string;
  kind: 'breast' | 'formula';
  parts: CareEvent[];
  startAt: string;
  /** 마지막 줄의 끝 — 재는 중이면 null */
  endAt: string | null;
  by: string | null;
};

/** 수유를 한 번씩 묶는다 — 시작 순서 */
export function feedSessions(events: CareEvent[]): FeedSession[] {
  const out: FeedSession[] = [];
  let open: FeedSession | null = null;
  for (const e of events) {
    if (e.kind === 'formula') {
      out.push({ id: e.id, kind: 'formula', parts: [e], startAt: e.startAt, endAt: e.endAt ?? e.startAt, by: e.by });
      open = null;
      continue;
    }
    if (e.kind !== 'breast') continue;
    const prevEnd = open?.endAt ? t(open.endAt) : null;
    if (open && prevEnd !== null && t(e.startAt) - prevEnd <= SESSION_GAP) {
      open.parts.push(e);
      open.endAt = e.endAt;
      open.by = open.by ?? e.by;
      continue;
    }
    open = { id: e.id, kind: 'breast', parts: [e], startAt: e.startAt, endAt: e.endAt, by: e.by };
    out.push(open);
  }
  return out;
}

/** 수유 한 번의 이름 — 「모유 18분」 「분유 140ml」 「모유 12분째」 */
export function feedTitle(s: FeedSession, now = new Date()): string {
  if (s.kind === 'formula') {
    const ml = s.parts[0].amount;
    return ml !== null ? `분유 ${Math.round(ml)}ml` : '분유';
  }
  const min = s.parts.reduce((sum, p) => sum + minutesOf(p, now), 0);
  if (s.endAt === null) return min < 1 ? '모유 방금 시작' : `모유 ${durationLabel(min)}째`;
  return min < 1 ? '모유 1분 미만' : `모유 ${durationLabel(min)}`;
}

/** 모유 쪽마다 걸린 시간 — 「왼쪽 10분, 오른쪽 8분」. 쪽을 적지 않았으면 null */
export function sidesLine(s: FeedSession, now = new Date()): string | null {
  if (s.kind !== 'breast') return null;
  const parts = s.parts
    .filter((p) => p.side)
    .map((p) => `${p.side === 'left' ? '왼쪽' : '오른쪽'} ${durationLabel(minutesOf(p, now))}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

export type RoutineDone = { routineId: string; title: string; at: string; by: string | null; logId?: string | null };

/** 지금 깨어 있는 분 — 마지막 잠이 끝난 뒤. 자는 중이거나 잠 기록이 없거나 너무 오래됐으면 null */
export function awakeMinutes(events: CareEvent[], now = new Date()): number | null {
  let last: CareEvent | null = null;
  for (const e of events) {
    if (e.kind !== 'sleep') continue;
    if (e.endAt === null) return null;
    if (!last || t(e.endAt) > t(last.endAt!)) last = e;
  }
  if (!last?.endAt) return null;
  const gap = now.getTime() - t(last.endAt);
  return gap >= 0 && gap <= AWAKE_LIMIT ? gap / MIN : null;
}

/** 최근 사흘 수유 간격의 가운데 값(분) — 시작에서 시작까지. 간격이 셋보다 적으면 null */
export function usualFeedGap(events: CareEvent[], now = new Date()): number | null {
  const since = now.getTime() - 3 * DAY;
  const starts = feedSessions(events)
    .map((s) => t(s.startAt))
    .filter((at) => at >= since && at <= now.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const g = starts[i] - starts[i - 1];
    if (g >= FEED_GAP_MIN && g <= FEED_GAP_MAX) gaps.push(g / MIN);
  }
  if (gaps.length < 3) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.round(median / 10) * 10;
}

/** 다음 수유 예상 — 마지막 수유 시작 + 평소 간격(10분 단위). 모유를 재는 중이거나 평소 간격을 모르면 null */
export function nextFeedGuess(events: CareEvent[], now = new Date()): { at: Date; gap: number } | null {
  const sessions = feedSessions(events);
  const last = sessions[sessions.length - 1];
  if (!last || last.endAt === null) return null;
  const gap = usualFeedGap(events, now);
  if (gap === null) return null;
  const at = Math.round((t(last.startAt) + gap * MIN) / (10 * MIN)) * 10 * MIN;
  return { at: new Date(at), gap };
}

/** 펼친 수유의 앞뒤 — 앞 수유와, 뒤 수유(없고 이것이 마지막이면 예상) */
export function feedNeighbors(
  session: FeedSession,
  events: CareEvent[],
  now = new Date(),
): { prev: FeedSession | null; next: FeedSession | null; guess: Date | null; gapBefore: number | null } {
  const sessions = feedSessions(events);
  const i = sessions.findIndex((s) => s.id === session.id);
  const prev = i > 0 ? sessions[i - 1] : null;
  const next = i >= 0 && i < sessions.length - 1 ? sessions[i + 1] : null;
  const guess = !next ? (nextFeedGuess(events, now)?.at ?? null) : null;
  const gapBefore = prev ? (t(session.startAt) - t(prev.startAt)) / MIN : null;
  return { prev, next, guess, gapBefore };
}

/** 하루 시계 · 일주일 막대에 그릴 것 — 그날 0시부터 몇 시간 */
export type DayMarks = {
  sleeps: { id: string; from: number; to: number }[];
  feeds: { id: string; at: number }[];
  diapers: { id: string; at: number }[];
  /** 오늘이면 지금, 지난날이면 null */
  now: number | null;
};

export function dayMarks(events: CareEvent[], day: Date, now = new Date()): DayMarks {
  const from = startOfDay(day).getTime();
  const to = from + DAY;
  const isToday = now.getTime() >= from && now.getTime() < to;
  const h = (at: number) => hourOfDay(at, from);
  const sleeps = events
    .filter((e) => e.kind === 'sleep')
    .map((e) => ({ id: e.id, a: Math.max(t(e.startAt), from), b: Math.min(endOf(e, now), to) }))
    .filter((s) => s.b > s.a)
    .map((s) => ({ id: s.id, from: h(s.a), to: h(s.b) }));
  const feeds = feedSessions(events)
    .map((s) => ({ id: s.id, at: t(s.startAt) }))
    .filter((f) => f.at >= from && f.at < to)
    .map((f) => ({ id: f.id, at: h(f.at) }));
  const diapers = events
    .filter((e) => e.kind === 'diaper' && t(e.startAt) >= from && t(e.startAt) < to)
    .map((e) => ({ id: e.id, at: h(t(e.startAt)) }));
  return { sleeps, feeds, diapers, now: isToday ? h(now.getTime()) : null };
}

export type WeekDay = {
  date: Date;
  /** 「화」 */
  weekday: string;
  isToday: boolean;
  marks: DayMarks;
  /** 그날에 걸친 잠(분) */
  sleepMin: number;
  /** 밤잠 드는 시간 — 그날 0시부터 몇 시간(저녁 6시 뒤), 없으면 null */
  bedtime: number | null;
};

/** 오늘까지 7일 — 오래된 날부터 */
export function weekDays(events: CareEvent[], now = new Date()): WeekDay[] {
  const today = startOfDay(now);
  const out: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const from = date.getTime();
    const marks = dayMarks(events, date, now);
    const sleepMin = marks.sleeps.reduce((sum, s) => sum + (s.to - s.from) * 60, 0);
    const night = events.find(
      (e) =>
        e.kind === 'sleep' &&
        e.endAt !== null &&
        t(e.startAt) >= from + NIGHT_FROM_HOUR * HOUR &&
        t(e.startAt) < from + DAY &&
        minutesOf(e, now) >= NIGHT_MIN,
    );
    out.push({
      date,
      weekday: WEEKDAYS[date.getDay()],
      isToday: i === 0,
      marks,
      sleepMin,
      bedtime: night ? hourOfDay(t(night.startAt), from) : null,
    });
  }
  return out;
}

/** 이레 가운데 가장 길게 잔 잠(끝난 잠만) */
export function longestSleep(events: CareEvent[], now = new Date()): CareEvent | null {
  const since = startOfDay(now).getTime() - 6 * DAY;
  let best: CareEvent | null = null;
  for (const e of events) {
    if (e.kind !== 'sleep' || e.endAt === null || t(e.endAt) <= since) continue;
    if (!best || minutesOf(e, now) > minutesOf(best, now)) best = e;
  }
  return best;
}

/** 「밤 9시 10분」 「새벽 2시」 — 10분 단위. 0시는 「밤 12시」 */
export function periodClock(hours: number): { period: string; clock: string } {
  const total = Math.round((hours * 60) / 10) * 10;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const period = hh === 0 ? '밤' : hh < 6 ? '새벽' : hh < 12 ? '오전' : hh < 18 ? '오후' : '밤';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return { period, clock: `${h12}시${mm ? ` ${mm}분` : ''}` };
}

/** 받침이 있으면 「으로」, 없거나 ㄹ 받침이면 「로」 */
function ro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '로';
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

/** 일주일 보기의 문장 둘까지 — 밤잠 드는 시간의 변화(30분 넘게), 가장 길게 잔 잠 */
export function weekLines(days: WeekDay[], events: CareEvent[], now = new Date()): string[] {
  const lines: string[] = [];
  const beds = days.map((d) => d.bedtime).filter((b): b is number => b !== null);
  if (beds.length >= 4) {
    const half = Math.floor(beds.length / 2);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const early = avg(beds.slice(0, Math.min(3, half)));
    const late = avg(beds.slice(beds.length - Math.min(3, half)));
    if (Math.abs(late - early) >= 0.5) {
      const a = periodClock(early);
      const b = periodClock(late);
      const second = a.period === b.period ? b.clock : `${b.period} ${b.clock}`;
      lines.push(`밤잠 드는 시간이 ${a.period} ${a.clock}에서 ${second}${ro(second)} ${late < early ? '당겨졌어요' : '늦어졌어요'}`);
    }
  }
  const longest = longestSleep(events, now);
  if (longest) {
    const start = new Date(longest.startAt);
    const day = startOfDay(start);
    const p = periodClock(hourOfDay(start.getTime(), day.getTime()));
    const when = day.getTime() === startOfDay(now).getTime() ? '오늘' : `${WEEKDAYS[start.getDay()]}요일`;
    lines.push(`가장 길게 잔 잠은 ${when} ${p.period} ${p.clock}부터 ${durationLabel(minutesOf(longest, now))}이에요`);
  }
  return lines;
}

// ---------- 3판 — 잠과 잠 사이로 나눈 줄 (SPEC-MAIN-08, task today/014) ----------

/** 흐름에서 넓은 노드 아래로 갈라지는 기록 하나(잠 말고) */
export type SubItem =
  | { type: 'feed'; key: string; at: number; session: FeedSession }
  /** 기저귀 · 체온 · 키 · 몸무게 */
  | { type: 'side'; key: string; at: number; event: CareEvent }
  | { type: 'routine'; key: string; at: number; routineId: string; logId: string | null; title: string; by: string | null }
  | { type: 'todo'; key: string; at: number; todoId: string; title: string; by: string | null };

/** 그날 완료한 할 일(내 할 일) */
export type TodoDone = { todoId: string; title: string; at: string; by: string | null };

/** 잠 — from 은 시작(어제 시작했으면 어제 시각), to 는 끝(재는 중이면 null) */
export type SleepSpan = { event: CareEvent; from: number; to: number | null; night: boolean };
/** 잠과 잠 사이 — to 가 null 이면 지금까지 이어지는 중 */
export type WakeSpan = { from: number; to: number | null; items: SubItem[] };
/** 흐름의 한 줄 — 잠 하나와 그 뒤 시간 하나(어느 한쪽이 없을 수 있다) */
export type DayRow = { key: string; sleep: SleepSpan | null; wake: WakeSpan | null };

/** 밤잠 — 저녁 6시부터 새벽 6시 사이에 시작한 잠 */
export function isNightStart(at: number): boolean {
  const h = new Date(at).getHours();
  return h >= NIGHT_FROM_HOUR || h < 6;
}

/** [from, to) 의 기록(잠 말고) — 재는 중인 모유는 지금 노드가 보여 주므로 뺀다. 그 시간의 기록 화면도 쓴다 */
export function itemsBetween(events: CareEvent[], routines: RoutineDone[], todos: TodoDone[], from: number, to: number): SubItem[] {
  const inDay = (at: number) => at >= from && at < to;
  const items: SubItem[] = [];
  for (const s of feedSessions(events)) {
    if (s.endAt === null) continue;
    const at = t(s.startAt);
    if (inDay(at)) items.push({ type: 'feed', key: s.id, at, session: s });
  }
  for (const e of events) {
    if (e.kind === 'diaper' || e.kind === 'temp' || e.kind === 'weight' || e.kind === 'height') {
      const at = t(e.startAt);
      if (inDay(at)) items.push({ type: 'side', key: e.id, at, event: e });
    }
  }
  for (const r of routines) {
    const at = t(r.at);
    if (inDay(at)) items.push({ type: 'routine', key: `routine-${r.logId ?? r.routineId}`, at, routineId: r.routineId, logId: r.logId ?? null, title: r.title, by: r.by });
  }
  for (const d of todos) {
    const at = t(d.at);
    if (inDay(at)) items.push({ type: 'todo', key: `todo-${d.todoId}`, at, todoId: d.todoId, title: d.title, by: d.by });
  }
  return items.sort((a, b) => a.at - b.at);
}

/**
 * 그날을 잠과 잠 사이로 나눈 줄 — 시간 순서. 잠 중간에 남긴 기록은 앞뒤 시간 가운데 가까운 쪽에 붙인다.
 * 오늘이면 마지막 줄이 지금이다(자는 중이면 그 잠의 to 가 null, 깨어 있으면 마지막 시간의 to 가 null).
 */
export function dayRows(events: CareEvent[], routines: RoutineDone[], todos: TodoDone[], day: Date, now = new Date()): DayRow[] {
  const D0 = startOfDay(day).getTime();
  const D1 = D0 + DAY;
  const isToday = now.getTime() >= D0 && now.getTime() < D1;
  const until = isToday ? now.getTime() : D1;
  const allSleeps = events.filter((e) => e.kind === 'sleep').sort((a, b) => t(a.startAt) - t(b.startAt));
  const sleeps = allSleeps.filter((e) => t(e.startAt) < until && endOf(e, now) > D0);
  const items = itemsBetween(events, routines, todos, D0, until);

  type Seg = { sleep: SleepSpan } | { wake: WakeSpan };
  const segs: Seg[] = [];
  let cursor = D0;
  // 하루를 깨어 있는 채로 시작했으면 — 그 전에 끝난 잠부터(12시간 안)
  const before = allSleeps.filter((e) => e.endAt !== null && t(e.endAt) <= D0).pop();
  const firstFrom = before?.endAt && D0 - t(before.endAt) <= AWAKE_LIMIT ? t(before.endAt) : D0;
  for (const e of sleeps) {
    const a = t(e.startAt);
    const b = e.endAt ? t(e.endAt) : null;
    if (a > cursor) segs.push({ wake: { from: cursor === D0 ? firstFrom : cursor, to: a, items: [] } });
    segs.push({ sleep: { event: e, from: a, to: b, night: isNightStart(a) } });
    cursor = b === null ? Number.POSITIVE_INFINITY : Math.max(cursor, b);
  }
  if (cursor < until) {
    // 지난날의 마지막 시간은 다음 잠이 시작한 때까지(다음 날이어도)
    const next = allSleeps.find((e) => t(e.startAt) >= until);
    segs.push({ wake: { from: cursor === D0 ? firstFrom : cursor, to: isToday ? null : next ? t(next.startAt) : D1, items: [] } });
  }

  const wakes = segs.filter((s): s is { wake: WakeSpan } => 'wake' in s).map((s) => s.wake);
  for (const it of items) {
    // 잠 중간에 남긴 기록은 앞뒤 시간 가운데 가까운 쪽에(잠들기 바로 전에 한 루틴을 늦게 누른 것 같은)
    const inside = wakes.find((w) => it.at >= w.from && it.at < (w.to ?? Number.POSITIVE_INFINITY));
    const before = [...wakes].reverse().find((w) => w.to !== null && w.to <= it.at);
    const after = wakes.find((w) => w.from > it.at);
    const nearer = before && after ? (it.at - before.to! <= after.from - it.at ? before : after) : (after ?? before);
    const home = inside ?? nearer ?? wakes[wakes.length - 1];
    if (home) home.items.push(it);
    else {
      const w: WakeSpan = { from: it.at, to: isToday ? null : D1, items: [it] };
      wakes.push(w);
      segs.push({ wake: w });
    }
  }

  const rows: DayRow[] = [];
  for (const s of segs) {
    if ('sleep' in s) rows.push({ key: s.sleep.event.id, sleep: s.sleep, wake: null });
    else {
      const last = rows[rows.length - 1];
      if (last && last.sleep && last.wake === null) last.wake = s.wake;
      else rows.push({ key: `wake-${s.wake.from}`, sleep: null, wake: s.wake });
    }
  }
  // 오늘인데 아무 기록이 없으면 — 지금 노드 하나
  if (isToday && rows.length === 0) rows.push({ key: 'wake-now', sleep: null, wake: { from: firstFrom, to: null, items: [] } });
  return rows;
}

/** 잠 노드의 이름 — 「낮잠 1시간 10분」 「밤잠 4시간 50분」, 재는 중이면 「잠든 지 30분」 */
export function sleepTitle(s: SleepSpan, now = new Date()): string {
  const min = ((s.to ?? now.getTime()) - s.from) / MIN;
  if (s.to === null) return `잠든 지 ${durationLabel(Math.max(1, min))}`;
  return `${s.night ? '밤잠' : '낮잠'} ${durationLabel(min)}`;
}

/** 「09:50~11:00」 · 어제 시작했으면 「어제 21:10~02:00」 · 재는 중이면 「13:40부터」 */
export function spanRange(from: number, to: number | null, dayStart: number): string {
  const head = from < dayStart ? `어제 ${hhmm(from)}` : hhmm(from);
  if (to === null) return `${head}부터`;
  const tail = to >= dayStart + DAY ? `다음 날 ${hhmm(to)}` : hhmm(to);
  return `${head}~${tail}`;
}

/** 그날 합계 칸 넷 (SPEC-MAIN-08) */
export type DayTotals = {
  formulaMl: number;
  formulaCount: number;
  breastMin: number;
  breastCount: number;
  diapers: number;
  poo: number;
  sleepMin: number;
  naps: number;
};

export function dayTotals(events: CareEvent[], day: Date, now = new Date()): DayTotals {
  const D0 = startOfDay(day).getTime();
  const D1 = D0 + DAY;
  const inDay = (iso: string) => t(iso) >= D0 && t(iso) < D1;
  const out: DayTotals = { formulaMl: 0, formulaCount: 0, breastMin: 0, breastCount: 0, diapers: 0, poo: 0, sleepMin: 0, naps: 0 };
  for (const s of feedSessions(events)) {
    if (!inDay(s.startAt)) continue;
    if (s.kind === 'formula') {
      out.formulaCount += 1;
      out.formulaMl += s.parts[0].amount ?? 0;
    } else {
      out.breastCount += 1;
      out.breastMin += s.parts.reduce((sum, p) => sum + minutesOf(p, now), 0);
    }
  }
  for (const e of events) {
    if (e.kind === 'diaper' && inDay(e.startAt)) {
      out.diapers += 1;
      if (e.diaper === 'poo' || e.diaper === 'both') out.poo += 1;
    }
    if (e.kind === 'sleep') {
      const a = Math.max(t(e.startAt), D0);
      const b = Math.min(endOf(e, now), D1);
      if (b > a) out.sleepMin += (b - a) / MIN;
      if (inDay(e.startAt) && !isNightStart(t(e.startAt))) out.naps += 1;
    }
  }
  out.breastMin = Math.round(out.breastMin);
  out.sleepMin = Math.round(out.sleepMin);
  return out;
}
