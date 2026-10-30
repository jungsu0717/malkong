/**
 * 빠른 기록 읽기 — 이름 · 시각 · 하루 합계 · 일주일 · 평소 · 다음 수유 · 기저귀 · 잠 알림 (SPEC-LOG-03~05).
 *
 * 모두 기기 안에서 규칙으로 센다(모델을 부르지 않는다). 숫자로 정상 · 이상을 판정하지 않고, 우리 아기의 평소와 나란히 보일 뿐이다(헌장 5).
 */

import { runningOf, type CareEvent, type StoolColor } from './events.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const isFeed = (e: CareEvent) => e.kind === 'breast' || e.kind === 'formula';

/** 변 색 이름 */
export const STOOL_COLOR_LABEL: Record<StoolColor, string> = {
  yellow: '노란색',
  brown: '갈색',
  green: '초록색',
  black: '검은색',
  red: '빨간색',
  white: '흰색 · 회색',
};

/** 모유 쪽을 바꾼 것 — 앞 모유가 끝난 뒤 이 안에 다시 시작하면 같은 수유 한 번으로 센다 */
const SESSION_GAP = 10 * MIN;

/** 이 모유가 바로 앞 모유에 이어지는가(쪽 바꾸기) */
function continuesBreast(prevEnd: number | null, e: CareEvent): boolean {
  return prevEnd !== null && new Date(e.startAt).getTime() - prevEnd <= SESSION_GAP;
}

/** 「오후 3:05」 */
export function clockLabel(at: Date | string): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

/** 「1시간 5분」 · 「45분」 · 「2시간」 */
export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}분`;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}

/** 「방금 전」 · 「25분 전」 · 「2시간 10분 전」 · 「어제」 · 「3일 전」 */
export function agoLabel(at: string, now = new Date()): string {
  const min = (now.getTime() - new Date(at).getTime()) / MIN;
  if (min < 1) return '방금 전';
  if (min < 24 * 60) return `${durationLabel(min)} 전`;
  const days = Math.floor(min / (24 * 60));
  return days === 1 ? '어제' : `${days}일 전`;
}

/** 그 날의 0시 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 재는 중이면 지금까지 */
export function minutesOf(e: CareEvent, now = new Date()): number {
  const end = e.endAt ? new Date(e.endAt).getTime() : now.getTime();
  return Math.max(0, (end - new Date(e.startAt).getTime()) / MIN);
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** 기록 한 줄의 이름 — 「분유 120ml」 · 「모유 왼쪽 15분」 · 「잠 1시간 20분」 */
export function eventTitle(e: CareEvent, now = new Date()): string {
  switch (e.kind) {
    case 'breast': {
      const side = e.side === 'left' ? '왼쪽' : e.side === 'right' ? '오른쪽' : '';
      return ['모유', side, timedLabel(e, now)].filter(Boolean).join(' ');
    }
    case 'formula':
      return `분유 ${e.amount !== null ? `${trim(e.amount, 0)}ml` : ''}`.trim();
    case 'diaper': {
      const base = e.diaper === 'poo' ? '기저귀 대변' : e.diaper === 'both' ? '기저귀 소변 · 대변' : '기저귀 소변';
      return e.color && e.diaper !== 'pee' ? `${base} · ${STOOL_COLOR_LABEL[e.color]}` : base;
    }
    case 'sleep':
      return `잠 ${timedLabel(e, now)}`;
    case 'temp':
      return `체온 ${e.amount !== null ? `${trim(e.amount, 1)}℃` : ''}`.trim();
    case 'weight':
      return `몸무게 ${e.amount !== null ? `${trim(e.amount, 2)}kg` : ''}`.trim();
    case 'height':
      return `키 ${e.amount !== null ? `${trim(e.amount, 1)}cm` : ''}`.trim();
  }
}

/** 잰 시간 — 끝났으면 「15분」(1분이 안 되면 「1분 미만」), 재는 중이면 「12분째」(막 시작했으면 「방금 시작」) */
function timedLabel(e: CareEvent, now: Date): string {
  const m = minutesOf(e, now);
  if (e.endAt) return m < 1 ? '1분 미만' : durationLabel(m);
  return m < 1 ? '방금 시작' : `${durationLabel(m)}째`;
}

/** 시각 — 「오후 3:10」 · 「오후 3:10 ~ 4:20」 · 「오후 3:10부터」 */
export function eventTime(e: CareEvent): string {
  if (e.kind !== 'breast' && e.kind !== 'sleep') return clockLabel(e.startAt);
  if (!e.endAt) return `${clockLabel(e.startAt)}부터`;
  return `${clockLabel(e.startAt)} ~ ${clockLabel(e.endAt)}`;
}

export type DayStats = {
  feeds: number;
  formulaMl: number;
  breastMin: number;
  pee: number;
  poo: number;
  diapers: number;
  sleepMin: number;
};

const EMPTY: DayStats = { feeds: 0, formulaMl: 0, breastMin: 0, pee: 0, poo: 0, diapers: 0, sleepMin: 0 };

/** [from, to) 사이의 합계 — 잠은 그 사이에 걸친 만큼만(자정을 넘긴 잠은 나눠 센다) */
export function statsBetween(events: CareEvent[], from: Date, to: Date, now = new Date()): DayStats {
  const s = { ...EMPTY };
  const a = from.getTime();
  const b = to.getTime();
  let breastEnd: number | null = null;
  for (const e of events) {
    const start = new Date(e.startAt).getTime();
    // 쪽을 바꾼 모유는 앞 모유와 같은 수유 — 날 밖의 모유도 따라가며 센다
    const sameFeed = e.kind === 'breast' && continuesBreast(breastEnd, e);
    if (e.kind === 'breast') breastEnd = e.endAt ? new Date(e.endAt).getTime() : now.getTime();
    if (e.kind === 'sleep') {
      const end = e.endAt ? new Date(e.endAt).getTime() : now.getTime();
      const overlap = Math.min(end, b) - Math.max(start, a);
      if (overlap > 0) s.sleepMin += overlap / MIN;
      continue;
    }
    if (start < a || start >= b) continue;
    if (isFeed(e)) {
      if (!sameFeed) s.feeds += 1;
      if (e.kind === 'formula') s.formulaMl += e.amount ?? 0;
      else s.breastMin += minutesOf(e, now);
    } else if (e.kind === 'diaper') {
      s.diapers += 1;
      if (e.diaper === 'pee' || e.diaper === 'both') s.pee += 1;
      if (e.diaper === 'poo' || e.diaper === 'both') s.poo += 1;
    }
  }
  return s;
}

export function todayStats(events: CareEvent[], now = new Date()): DayStats {
  const start = startOfDay(now);
  return statsBetween(events, start, new Date(start.getTime() + DAY), now);
}

export type DayRow = { date: Date; weekday: string; isToday: boolean; stats: DayStats; recorded: boolean };

/** 오늘까지 `days` 날 — 오래된 날부터. recorded 는 그날 아무 기록이 있었는지 */
export function lastDays(events: CareEvent[], days = 7, now = new Date()): DayRow[] {
  const today = startOfDay(now);
  const rows: DayRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const recorded = events.some((e) => {
      const t = new Date(e.startAt).getTime();
      return t >= date.getTime() && t < next.getTime();
    });
    rows.push({ date, weekday: WEEKDAYS[date.getDay()], isToday: i === 0, stats: statsBetween(events, date, next, now), recorded });
  }
  return rows;
}

/**
 * 평소 — 오늘을 뺀 지난날 가운데 기록이 있던 날의 평균. 기록한 날이 이틀이 안 되면 null(평소라 부르기 이르다)
 */
export function usual(rows: DayRow[]): DayStats | null {
  const past = rows.filter((r) => !r.isToday && r.recorded);
  if (past.length < 2) return null;
  const sum = past.reduce<DayStats>(
    (acc, r) => ({
      feeds: acc.feeds + r.stats.feeds,
      formulaMl: acc.formulaMl + r.stats.formulaMl,
      breastMin: acc.breastMin + r.stats.breastMin,
      pee: acc.pee + r.stats.pee,
      poo: acc.poo + r.stats.poo,
      diapers: acc.diapers + r.stats.diapers,
      sleepMin: acc.sleepMin + r.stats.sleepMin,
    }),
    { ...EMPTY },
  );
  const n = past.length;
  return {
    feeds: sum.feeds / n,
    formulaMl: sum.formulaMl / n,
    breastMin: sum.breastMin / n,
    pee: sum.pee / n,
    poo: sum.poo / n,
    diapers: sum.diapers / n,
    sleepMin: sum.sleepMin / n,
  };
}

/** 마지막 수유 — 재는 중인 모유도 */
export function lastFeed(events: CareEvent[]): CareEvent | null {
  for (let i = events.length - 1; i >= 0; i--) if (isFeed(events[i])) return events[i];
  return null;
}

/**
 * 마지막 수유를 시작한 때 — 쪽을 바꾼 모유는 첫 쪽의 시작. 「수유 텀」과 「마지막 수유 몇 분 전」은 여기서 센다
 */
export function lastFeedStart(events: CareEvent[]): string | null {
  const last = lastFeed(events);
  if (!last) return null;
  if (last.kind !== 'breast') return last.startAt;
  let start = last.startAt;
  const breasts = events.filter((e) => e.kind === 'breast' && e.startAt <= last.startAt);
  for (let i = breasts.length - 1; i > 0; i--) {
    const prev = breasts[i - 1];
    if (!prev.endAt || !continuesBreast(new Date(prev.endAt).getTime(), breasts[i])) break;
    start = prev.startAt;
  }
  return start;
}

export function latestOf(events: CareEvent[], kind: CareEvent['kind']): CareEvent | null {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].kind === kind) return events[i];
  return null;
}

/**
 * 다음 수유 알림 — 마지막 수유 시작 + 정한 시간. 모유를 재는 중이거나 이미 지났으면 null(SPEC-LOG-05).
 * 시작 기준인 까닭: 「수유 텀」은 시작에서 시작까지로 센다.
 */
export function feedReminderAt(events: CareEvent[], minutes: number | null, now = new Date()): Date | null {
  if (!minutes) return null;
  if (runningOf(events, 'breast')) return null;
  const start = lastFeedStart(events);
  if (!start) return null;
  const at = new Date(new Date(start).getTime() + minutes * MIN);
  return at > now ? at : null;
}

/** 다음 기저귀 알림 — 마지막 기저귀 + 정한 시간. 지났으면 null(SPEC-LOG-05) */
export function diaperReminderAt(events: CareEvent[], minutes: number | null, now = new Date()): Date | null {
  if (!minutes) return null;
  const last = latestOf(events, 'diaper');
  if (!last) return null;
  const at = new Date(new Date(last.startAt).getTime() + minutes * MIN);
  return at > now ? at : null;
}

/**
 * 깨어 있는 시간의 기본값(분) — 월령이 오를수록 길다. 잠 알림이 우리 아기의 평소를 아직 모를 때만 쓴다.
 * 기준으로 보여 주지 않는다 — 알림을 언제 걸지 정하는 앱의 기본값이고, 기록이 쌓이면 우리 아기의 평소로 바뀐다
 */
export function defaultAwakeMinutes(month: number): number {
  if (month < 1) return 60;
  if (month < 2) return 75;
  if (month < 4) return 90;
  if (month < 6) return 120;
  if (month < 9) return 150;
  if (month < 12) return 180;
  return 240;
}

/**
 * 우리 아기의 평소 깨어 있던 시간(분) — 최근 7일, 잠이 끝난 뒤 다음 잠이 시작하기까지. 밤에 깬 짧은 틈(30분 미만)과
 * 하루를 넘긴 틈은 뺀다. 셋이 안 되면 null
 */
export function usualAwakeMinutes(events: CareEvent[], now = new Date()): number | null {
  const sleeps = events.filter((e) => e.kind === 'sleep' && e.endAt && now.getTime() - new Date(e.startAt).getTime() < 7 * DAY);
  const gaps: number[] = [];
  for (let i = 1; i < sleeps.length; i++) {
    const gap = (new Date(sleeps[i].startAt).getTime() - new Date(sleeps[i - 1].endAt!).getTime()) / MIN;
    if (gap >= 30 && gap <= 12 * 60) gaps.push(gap);
  }
  if (gaps.length < 3) return null;
  gaps.sort((a, b) => a - b);
  return Math.round(gaps[Math.floor(gaps.length / 2)]);
}

/**
 * 잠 알림(SPEC-LOG-05) — 마지막 잠에서 깬 뒤 평소 깨어 있던 시간(없으면 월령 기본값)이 지나도록 새 잠이 없으면.
 * 재는 중인 잠이 있거나, 잠 기록이 하나도 없거나, 이미 지났으면 null
 */
export function sleepReminderAt(events: CareEvent[], month: number, on: boolean, now = new Date()): { at: Date; minutes: number } | null {
  if (!on || runningOf(events, 'sleep')) return null;
  const last = latestOf(events, 'sleep');
  if (!last?.endAt) return null;
  const minutes = usualAwakeMinutes(events, now) ?? defaultAwakeMinutes(month);
  const at = new Date(new Date(last.endAt).getTime() + minutes * MIN);
  return at > now ? { at, minutes } : null;
}
