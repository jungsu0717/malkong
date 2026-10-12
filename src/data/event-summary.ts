/**
 * 빠른 기록 읽기 — 이름 · 시각 · 하루 합계 · 일주일 · 평소 · 질문 맥락 줄 · 다음 수유 알림 (SPEC-LOG-03~06).
 *
 * 모두 기기 안에서 규칙으로 센다(모델을 부르지 않는다). 숫자로 정상 · 이상을 판정하지 않고, 우리 아기의 평소와 나란히 보일 뿐이다(헌장 2).
 */

import { runningOf, type CareEvent } from './events';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const isFeed = (e: CareEvent) => e.kind === 'breast' || e.kind === 'formula';

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

/** 「방금」 · 「25분 전」 · 「2시간 10분 전」 · 「어제」 · 「3일 전」 */
export function agoLabel(at: string, now = new Date()): string {
  const min = (now.getTime() - new Date(at).getTime()) / MIN;
  if (min < 1) return '방금';
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
    case 'diaper':
      return e.diaper === 'poo' ? '기저귀 대변' : e.diaper === 'both' ? '기저귀 소변 · 대변' : '기저귀 소변';
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

const dateWord = (iso: string, now: Date) => {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / DAY);
  return days === 0 ? '오늘' : days === 1 ? '어제' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/**
 * 질문에 함께 보낼 기록 요약 줄(SPEC-LOG-06) — 주제 낱말이 들어 있어 ask-context 가 주제로 고를 수 있다.
 * 최근 24시간의 수유 · 잠 · 기저귀, 48시간 안의 체온, 마지막 몸무게 · 키. 아기 이름은 넣지 않는다.
 */
export function contextLines(events: CareEvent[], now = new Date()): string[] {
  const lines: string[] = [];
  const s = statsBetween(events, new Date(now.getTime() - DAY), now, now);
  const last = lastFeedStart(events);
  if (s.feeds > 0 && last) {
    const parts = [];
    const formula = events.filter((e) => e.kind === 'formula' && now.getTime() - new Date(e.startAt).getTime() < DAY).length;
    if (formula > 0) parts.push(`분유 ${formula}번 합계 ${Math.round(s.formulaMl)}ml`);
    if (s.feeds - formula > 0) parts.push(`모유 ${s.feeds - formula}번 ${durationLabel(s.breastMin)}`);
    lines.push(`최근 24시간 수유 ${s.feeds}번(${parts.join(', ')}) · 마지막 수유 ${agoLabel(last, now)}`);
    const week = usual(lastDays(events, 8, now));
    if (week) lines.push(`평소 하루 수유 ${Math.round(week.feeds)}번 · 분유 ${Math.round(week.formulaMl)}ml`);
  }
  if (s.sleepMin > 0) lines.push(`최근 24시간 잠 합계 ${durationLabel(s.sleepMin)}`);
  if (s.diapers > 0) lines.push(`최근 24시간 기저귀 소변 ${s.pee}번 · 대변 ${s.poo}번`);
  const temps = events.filter((e) => e.kind === 'temp' && e.amount !== null && now.getTime() - new Date(e.startAt).getTime() < 2 * DAY);
  for (const t of temps.slice(-2)) lines.push(`체온 ${trim(t.amount!, 1)}℃(${dateWord(t.startAt, now)} ${clockLabel(t.startAt)})`);
  const weight = latestOf(events, 'weight');
  if (weight?.amount) lines.push(`몸무게 ${trim(weight.amount, 2)}kg(${dateWord(weight.startAt, now)} 기록)`);
  const height = latestOf(events, 'height');
  if (height?.amount) lines.push(`키 ${trim(height.amount, 1)}cm(${dateWord(height.startAt, now)} 기록)`);
  return lines;
}
