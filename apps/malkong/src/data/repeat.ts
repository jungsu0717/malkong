/**
 * 반복 할 일 (SPEC-TOPIC-06, task topic/002) — 반복 규칙과 다음 날짜 계산, 반복 추천.
 *
 * 규칙은 할 일의 `repeat` 칸 하나에 짧은 글로 저장한다(`daily` · `weekly:2,5` · `monthly:1` · `every:3`).
 * 반복 할 일을 완료하면 다음 날짜로 새 줄을 만든다 — 그날이 되면 오늘 할 일에 보인다.
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/repeat.test.ts`).
 */

export type Repeat =
  | { kind: 'daily' }
  /** 요일 — 0 일요일 … 6 토요일(Date.getDay) */
  | { kind: 'weekly'; days: number[] }
  /** 그달의 날짜 — 그 달에 없는 날(31일 등)은 말일 */
  | { kind: 'monthly'; day: number }
  /** 완료한 날부터 N일 뒤 */
  | { kind: 'every'; days: number };

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function repeatToText(rule: Repeat | null): string | null {
  if (!rule) return null;
  switch (rule.kind) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return `weekly:${[...rule.days].sort((a, b) => a - b).join(',')}`;
    case 'monthly':
      return `monthly:${rule.day}`;
    case 'every':
      return `every:${rule.days}`;
  }
}

/** 저장된 글 → 규칙. 읽지 못하면 null(반복 없음) */
export function repeatFromText(text: string | null | undefined): Repeat | null {
  if (!text) return null;
  const [kind, value = ''] = text.split(':');
  if (kind === 'daily') return { kind: 'daily' };
  if (kind === 'weekly') {
    const days = value
      .split(',')
      .filter((v) => v.trim() !== '')
      .map(Number)
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    return days.length > 0 ? { kind: 'weekly', days } : null;
  }
  const n = Number(value);
  if (kind === 'monthly' && Number.isInteger(n) && n >= 1 && n <= 31) return { kind: 'monthly', day: n };
  if (kind === 'every' && Number.isInteger(n) && n >= 1 && n <= 365) return { kind: 'every', days: n };
  return null;
}

/** 화면에 보이는 이름 — 「매일」 「매주 화요일」 「매주 화, 금요일」 「매달 1일」 「3일마다」 */
export function repeatLabel(rule: Repeat): string {
  switch (rule.kind) {
    case 'daily':
      return '매일';
    case 'weekly':
      return `매주 ${[...rule.days]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_NAMES[d])
        .join(', ')}요일`;
    case 'monthly':
      return `매달 ${rule.day}일`;
    case 'every':
      return rule.days === 1 ? '매일' : `${rule.days}일마다`;
  }
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** 그날이 규칙에 맞는 날인가(every 는 날짜로 정해지지 않아 늘 맞다) */
function matches(rule: Repeat, day: Date): boolean {
  switch (rule.kind) {
    case 'daily':
    case 'every':
      return true;
    case 'weekly':
      return rule.days.includes(day.getDay());
    case 'monthly':
      return day.getDate() === Math.min(rule.day, daysInMonth(day));
  }
}

/** `from` 날부터(그날 포함) 규칙에 맞는 첫날 0시 */
export function firstDate(rule: Repeat, from: Date): Date {
  const start = startOfDay(from);
  for (let i = 0; i < 400; i++) {
    const day = addDays(start, i);
    if (matches(rule, day)) return day;
  }
  return start;
}

/**
 * 반복 할 일을 완료했을 때 다음 날짜 0시.
 * 매일 · 매주 · 매달은 기한과 완료한 날 중 늦은 날의 다음 맞는 날 — 미리 했으면 다음 차례로, 늦게 했으면 밀린 날을 건너뛴다.
 * 며칠마다는 완료한 날 + N일.
 */
export function nextDate(rule: Repeat, due: Date | null, doneAt: Date): Date {
  const done = startOfDay(doneAt);
  if (rule.kind === 'every') return addDays(done, rule.days);
  const base = due && startOfDay(due) > done ? startOfDay(due) : done;
  return firstDate(rule, addDays(base, 1));
}

/** 시각을 정한 할 일이면 새 날짜에 같은 시각을 붙인다 */
export function withTimeOf(day: Date, time: Date | null): Date {
  if (!time) return day;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 반복을 추천하려면 이만큼 완료해야 한다 */
export const SUGGEST_AFTER = 3;

/**
 * 같은 할 일을 완료한 때들로 반복을 고른다(SPEC-TOPIC-06). 세 번이 안 되거나 같은 날에 몰려 있으면 null.
 * 간격 가운데 값이 1.5일 이하면 매일, 6~8일이면 매주(가장 많이 한 요일), 27~33일이면 매달(완료한 날짜의 가운데 값), 그 밖은 며칠마다.
 */
export function suggestRepeat(doneTimes: Date[]): Repeat | null {
  if (doneTimes.length < SUGGEST_AFTER) return null;
  const days = doneTimes.map(startOfDay).sort((a, b) => a.getTime() - b.getTime());
  const gaps = days.slice(1).map((d, i) => Math.round((d.getTime() - days[i].getTime()) / DAY_MS));
  const gap = median(gaps);
  if (gap < 1) return null;
  if (gap <= 1.5) return { kind: 'daily' };
  if (gap >= 6 && gap <= 8) {
    const counts = new Map<number, number>();
    for (const d of days) counts.set(d.getDay(), (counts.get(d.getDay()) ?? 0) + 1);
    // 가장 많이 한 요일, 같으면 최근 것
    let best = days[days.length - 1].getDay();
    for (const [day, n] of counts) if (n > (counts.get(best) ?? 0)) best = day;
    return { kind: 'weekly', days: [best] };
  }
  if (gap >= 27 && gap <= 33) return { kind: 'monthly', day: Math.round(median(days.map((d) => d.getDate()))) };
  return { kind: 'every', days: Math.round(gap) };
}
