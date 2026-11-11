/**
 * 하루 초안 (SPEC-MAIN-16, task today/029, decisions/046) — 「오늘 하루 기록 초안 작성해 줘」.
 *
 * 지난 7일 가운데 기록이 가장 많았던 날(같으면 가장 최근 날)을 복사해서, 시간을 비운 빈칸으로 둔다. 빈칸은 기록이 아니다.
 * 빈칸을 눌러 시각을 고르거나 물어보기로 말하면 그때 기록이 된다. 위쪽 단추나 물어보기로 같은 종류를 기록하면 시각이 가장 가까운 빈칸이 함께 채워진다.
 * 그래서 사람은 평소와 다른 것만 적으면 된다(Julian, 2026-11-11).
 * 어느 빈칸이 채워졌는지는 저장하지 않고 그날 기록과 맞춰 볼 때마다 센다(헌장 3) — 기록을 지우면 빈칸이 다시 보인다.
 * 모두 기기 안에서 규칙으로 세고 모델을 부르지 않는다. 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/day-draft.test.ts`).
 */

import { feedSessions, hhmm, isNightStart, type RoutineDone } from './day-flow.ts';
import { durationLabel, minutesOf, startOfDay } from './event-summary.ts';
import { intakeTitle, isIntake, type CareEvent, type DiaperKind, type EventInput, type IntakeKind, type Side } from './events.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
/** 복사할 날을 찾는 지난 날수 */
export const SOURCE_DAYS = 7;
/** 새 기록이 채우는 빈칸 — 시각이 이만큼 안에서 가장 가까운 것 */
const FILL_WINDOW = 2 * 60 * MIN;
/** 낮잠과 밤잠을 함께 복사하되, 이보다 길게 이어진 잠(재다가 잊은 것)은 뺀다(분) */
const SLEEP_MAX = 16 * 60;

export type ShellKind = 'formula' | 'breast' | 'diaper' | 'sleep' | 'routine' | IntakeKind;

/** 시간을 비운 빈칸 하나 */
export type Shell = {
  id: string;
  kind: ShellKind;
  /** 복사한 날의 시각 — 그날 0시부터 분. 빈칸의 순서와 「어제 10:30」에 쓴다 */
  minute: number;
  /** 분유 · 이유식 · 유축 · 우유 · 물 ml */
  amount: number | null;
  /** 모유 · 잠의 걸린 시간(분) */
  minutes: number | null;
  side: Side | null;
  diaper: DiaperKind | null;
  /** 루틴이면 그 루틴 — 이름은 그 루틴을 지웠다가 다시 만들어도 맞추려고 함께 둔다 */
  routineId: string | null;
  title: string;
};

/** 한 날의 초안 — 날짜는 모두 YYYY-MM-DD */
export type ShellSet = {
  /** 초안을 놓은 날 */
  day: string;
  /** 복사한 날 */
  source: string;
  /** 만든 날 — 이 날이 지나면 채우지 않은 빈칸은 버린다 */
  made: string;
  items: Shell[];
  /** 「초안에서 빼기」로 뺀 빈칸 */
  removed: string[];
  /** 눌러서 채운 빈칸 → 그때 만든 기록 id(수유는 첫 줄, 루틴은 완료 줄) */
  filled: Record<string, string>;
};

export const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dateOfYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const t = (iso: string) => new Date(iso).getTime();
const intakeShell = (k: ShellKind): k is IntakeKind => k !== 'routine' && isIntake(k);

/** 「오늘 하루 기록 초안으로 작성해 줘」 — 초안을 만들어 달라는 말 */
export const asksDraft = (text: string) =>
  (/초안/.test(text) && /작성|만들|써|적어|채워|잡아|짜/.test(text)) ||
  // 「이전 기록 보고 오늘 기록 채워 줘」, 「평소대로 하루 기록 만들어 줘」 — 「초안」이라는 말이 없어도(빌드 15 피드백)
  (/(평소|이전 ?기록|지난 ?기록|전 ?기록|지난 ?7일|지난 ?일주일)/.test(text) && /(오늘|하루|기록)/.test(text) && /(채워|만들|작성|짜|잡아|써 ?줘)/.test(text)) ||
  // 「전체 기록 작성해줘」 · 「오늘 기록 다 채워 줘」 — 하루 기록을 통째로 만들어 달라는 말(빌드 17 피드백). 「써 줘」는 메모일 수도 있어서 넣지 않는다
  (/(전체|모든|하루|오늘) ?기록/.test(text) && /(작성|채워|만들어|짜 ?줘)/.test(text) && !/할 ?일/.test(text));

/** 초안을 부탁한 부분을 빼고 남는 말 — 「10시 반에 분유 140 먹었어」. 없으면 빈 글 */
export function stripDraftAsk(text: string): string {
  return text
    .split(/[.!?。]\s*|(?<=\S)고\s*,?\s+|하고\s+|그리고\s+|,\s*/)
    .map((x) => x.trim())
    // 초안을 부탁한 말(「초안」, 「이전 기록 보고」, 「오늘 기록 채워 줘」)은 기록이 아니다 — 남기면 모델로 한 번 더 간다
    .filter((x) => x && !/초안|평소|이전 ?기록|지난 ?기록|전 ?기록|지난 ?7일|지난 ?일주일|채워|만들어|작성|짜 ?줘/.test(x))
    .join(', ');
}

// ---------- 복사할 날 ----------

const inDay = (at: number, d0: number) => at >= d0 && at < d0 + DAY;

/** 빈칸으로 옮길 기록 — 수유(한 번씩), 기저귀, 잠, 이유식 · 유축 · 우유 · 물 · 간식, 루틴 완료. 체온 · 키 · 몸무게와 메모는 날마다 되풀이되는 일이 아니라 뺀다 */
function sourceShells(events: CareEvent[], dones: RoutineDone[], d0: number, now: Date): Omit<Shell, 'id'>[] {
  const out: Omit<Shell, 'id'>[] = [];
  const minuteOf = (at: number) => Math.round((at - d0) / MIN);
  for (const s of feedSessions(events)) {
    const at = t(s.startAt);
    if (!inDay(at, d0) || s.endAt === null) continue;
    if (s.kind === 'formula') {
      const ml = s.parts[0].amount;
      out.push({ kind: 'formula', minute: minuteOf(at), amount: ml, minutes: null, side: null, diaper: null, routineId: null, title: ml != null ? `분유 ${Math.round(ml)}ml` : '분유' });
    } else {
      const min = Math.max(1, Math.round(s.parts.reduce((sum, p) => sum + minutesOf(p, now), 0)));
      out.push({ kind: 'breast', minute: minuteOf(at), amount: null, minutes: min, side: s.parts[0].side, diaper: null, routineId: null, title: `모유 ${durationLabel(min)}` });
    }
  }
  for (const e of events) {
    const at = t(e.startAt);
    if (!inDay(at, d0)) continue;
    if (e.kind === 'diaper' && e.diaper) {
      out.push({ kind: 'diaper', minute: minuteOf(at), amount: null, minutes: null, side: null, diaper: e.diaper, routineId: null, title: DIAPER_TITLE[e.diaper] });
    }
    if (isIntake(e.kind)) {
      const amount = e.kind === 'snack' ? null : e.amount;
      out.push({ kind: e.kind, minute: minuteOf(at), amount, minutes: null, side: null, diaper: null, routineId: null, title: intakeTitle({ kind: e.kind, amount }) });
    }
    if (e.kind === 'sleep' && e.endAt) {
      const min = Math.round(minutesOf(e, now));
      if (min < 1 || min > SLEEP_MAX) continue;
      out.push({ kind: 'sleep', minute: minuteOf(at), amount: null, minutes: min, side: null, diaper: null, routineId: null, title: `${isNightStart(at) ? '밤잠' : '낮잠'} ${durationLabel(min)}` });
    }
  }
  for (const r of dones) {
    const at = t(r.at);
    if (!inDay(at, d0)) continue;
    out.push({ kind: 'routine', minute: minuteOf(at), amount: null, minutes: r.endAt ? Math.max(1, Math.round((t(r.endAt) - at) / MIN)) : null, side: null, diaper: null, routineId: r.routineId, title: r.title });
  }
  return out.sort((a, b) => a.minute - b.minute);
}

const DIAPER_TITLE: Record<DiaperKind, string> = { pee: '소변', poo: '대변', both: '소변, 대변' };

/**
 * 복사할 날 — 그날 앞 7일 가운데 빈칸으로 옮길 기록이 가장 많았던 날. 같으면 가장 최근 날. 기록이 없으면 null.
 * 어제가 바빴으면 어제를, 어제 기록을 깜빡했으면 그 전의 바빴던 날을 고른다
 */
export function busiestDay(events: CareEvent[], dones: RoutineDone[], day: Date, now = new Date(), days = SOURCE_DAYS): { day: Date; count: number } | null {
  const D0 = startOfDay(day);
  let best: { day: Date; count: number } | null = null;
  for (let i = 1; i <= days; i++) {
    const d = new Date(D0.getFullYear(), D0.getMonth(), D0.getDate() - i);
    const count = sourceShells(events, dones, d.getTime(), now).length;
    if (count > 0 && (!best || count > best.count)) best = { day: d, count };
  }
  return best;
}

let seq = 0;
const shellId = () => `shell-${Date.now().toString(36)}-${++seq}`;

/** 초안 — 그날 앞 7일 가운데 가장 바빴던 날을 복사한 빈칸. 복사할 날이 없으면 null */
export function makeShellSet(events: CareEvent[], dones: RoutineDone[], day: Date, now = new Date()): ShellSet | null {
  const src = busiestDay(events, dones, day, now);
  if (!src) return null;
  const items = sourceShells(events, dones, src.day.getTime(), now).map((s) => ({ ...s, id: shellId() }));
  return { day: ymdOf(day), source: ymdOf(src.day), made: ymdOf(now), items, removed: [], filled: {} };
}

/** 그날 끝나기 전까지만 — 만든 날이 지나면 null */
export function liveShellSet(set: ShellSet | null, now: Date): ShellSet | null {
  return set && set.made === ymdOf(now) ? set : null;
}

// ---------- 그날 기록과 맞추기 ----------

/** 빈칸을 채우는 기록 하나 — group 이 같으면 같은 종류다 */
export type DayRecord = { id: string; ids: string[]; group: string; at: number };

const routineGroup = (title: string) => `routine:${title.replace(/\s+/g, '').toLowerCase()}`;
/** 수유는 모유, 분유, 유축 수유를 같은 종류로 본다 — 어제 분유 먹던 때에 오늘 모유를 먹였어도 그 빈칸이 채워진다 */
const groupOf = (s: Shell) => (s.kind === 'formula' || s.kind === 'breast' || s.kind === 'pumped' ? 'feed' : s.kind === 'routine' ? routineGroup(s.title) : s.kind);

/** 그날 기록을 빈칸과 맞출 모양으로 — 수유는 한 번씩(쪽을 바꾼 모유는 한 번), 기저귀, 잠, 루틴 완료 */
export function dayRecords(events: CareEvent[], dones: RoutineDone[], day: Date): DayRecord[] {
  const d0 = startOfDay(day).getTime();
  const out: DayRecord[] = [];
  for (const s of feedSessions(events)) {
    const at = t(s.startAt);
    if (inDay(at, d0)) out.push({ id: s.id, ids: s.parts.map((p) => p.id), group: 'feed', at });
  }
  for (const e of events) {
    const at = t(e.startAt);
    if (!inDay(at, d0)) continue;
    if (e.kind === 'diaper' || e.kind === 'sleep') out.push({ id: e.id, ids: [e.id], group: e.kind, at });
    if (isIntake(e.kind)) out.push({ id: e.id, ids: [e.id], group: e.kind === 'pumped' ? 'feed' : e.kind, at });
  }
  for (const r of dones) {
    const at = t(r.at);
    const id = r.logId ?? `${r.routineId}-${r.at}`;
    if (inDay(at, d0)) out.push({ id, ids: [id], group: routineGroup(r.title), at });
  }
  return out.sort((a, b) => a.at - b.at);
}

export const shellAt = (set: Pick<ShellSet, 'day'>, s: Shell) => dateOfYmd(set.day).getTime() + s.minute * MIN;

/**
 * 아직 채우지 않은 빈칸 — 뺀 것과 눌러서 채운 것을 빼고, 남은 기록은 시각순으로 같은 종류의 가장 가까운 빈칸(2시간 안)을 하나씩 채운다.
 * 눌러서 채운 기록을 지우면 그 빈칸이 다시 보인다
 */
export function openShells(set: ShellSet, records: DayRecord[]): Shell[] {
  const live = new Set(records.flatMap((r) => r.ids));
  const used = new Set(Object.values(set.filled).filter((id) => live.has(id)));
  let open = set.items.filter((s) => !set.removed.includes(s.id) && !(set.filled[s.id] && live.has(set.filled[s.id])));
  for (const r of records) {
    if (r.ids.some((id) => used.has(id))) continue;
    let best: Shell | null = null;
    let bestGap = Infinity;
    for (const s of open) {
      if (groupOf(s) !== r.group) continue;
      const gap = Math.abs(shellAt(set, s) - r.at);
      if (gap <= FILL_WINDOW && gap < bestGap) {
        best = s;
        bestGap = gap;
      }
    }
    if (best) open = open.filter((s) => s !== best);
  }
  return open.sort((a, b) => a.minute - b.minute);
}

// ---------- 빈칸 채우기 ----------

/** 빈칸을 채울 기록 — 시각을 고르고 양이나 걸린 시간을 고친 값으로. 모유 · 잠이 지금보다 늦게 끝나면 재는 중으로 둔다. 루틴은 null */
export function shellInput(s: Shell, at: number, patch: { amount?: number | null; minutes?: number | null }, now: number): EventInput | null {
  const startAt = new Date(at).toISOString();
  if (s.kind === 'formula') return { kind: 'formula', startAt, amount: patch.amount ?? s.amount };
  if (s.kind === 'diaper') return { kind: 'diaper', startAt, diaper: s.diaper };
  if (intakeShell(s.kind)) return { kind: s.kind, startAt, amount: s.kind === 'snack' ? null : (patch.amount ?? s.amount) };
  if (s.kind === 'breast' || s.kind === 'sleep') {
    const min = patch.minutes ?? s.minutes ?? 10;
    const end = at + min * MIN;
    return { kind: s.kind, startAt, endAt: end > now ? null : new Date(end).toISOString(), side: s.kind === 'breast' ? (s.side ?? 'left') : null };
  }
  return null;
}

/** 빈칸의 이름 — 양이나 걸린 시간을 고치면 따라 바뀐다 */
export function shellTitle(s: Shell, patch: { amount?: number | null; minutes?: number | null } = {}): string {
  if (intakeShell(s.kind)) return intakeTitle({ kind: s.kind, amount: patch.amount ?? s.amount });
  if (s.kind === 'formula') {
    const ml = patch.amount ?? s.amount;
    return ml != null ? `분유 ${Math.round(ml)}ml` : '분유';
  }
  if (s.kind === 'breast' || s.kind === 'sleep') {
    const min = patch.minutes ?? s.minutes;
    const name = s.kind === 'breast' ? '모유' : s.title.startsWith('밤잠') ? '밤잠' : '낮잠';
    return min ? `${name} ${durationLabel(min)}` : name;
  }
  return s.title;
}

/** 복사한 날을 초안을 놓은 날에서 부르는 말 — 「어제」, 「11월 8일」 */
export function sourceWord(set: Pick<ShellSet, 'day' | 'source'>): string {
  const gap = Math.round((dateOfYmd(set.day).getTime() - dateOfYmd(set.source).getTime()) / DAY);
  if (gap === 1) return '어제';
  const d = dateOfYmd(set.source);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 빈칸 아래 작은 글 — 「어제 10:30」 */
export function shellHint(set: Pick<ShellSet, 'day' | 'source'>, s: Shell): string {
  return `${sourceWord(set)} ${hhmm(dateOfYmd(set.source).getTime() + s.minute * MIN)}`;
}

/** 앞 대화에 남기는 한 줄 — 「초안 빈칸 9개: 어제 06:40 분유 160ml …」 */
export function shellSummary(set: ShellSet, items: Shell[]): string {
  const head = items.slice(0, 6).map((s) => `${shellHint(set, s)} ${s.title}`);
  return `초안 빈칸 ${items.length}개: ${head.join(', ')}${items.length > 6 ? ' …' : ''}`;
}

const PERIODS: [RegExp, number, number][] = [
  [/새벽/, 0, 6],
  [/아침/, 5, 11],
  [/오전/, 0, 12],
  [/점심/, 11, 14],
  [/오후/, 13, 18],
  [/저녁/, 17, 21],
  [/밤/, 20, 24],
];

/**
 * 「오후 낮잠은 안 잤어」, 「10시 분유는 안 먹였어」 — 규칙으로 초안에서 뺄 빈칸을 고른다(decisions/040 「규칙이 먼저다」).
 * 종류와 때로 하나가 정해지면 그것, 「다」 「전부」 「모두」면 맞는 것 모두, 정하지 못하면 빈 목록
 */
export function negatedShells(text: string, items: Shell[]): Shell[] {
  if (!/안 |않았|없었|없어/.test(text)) return [];
  const kind: ShellKind | null = /낮잠|밤잠|잠|잤/.test(text)
    ? 'sleep'
    : /분유/.test(text)
      ? 'formula'
      : /모유/.test(text)
        ? 'breast'
        : /소변|쉬|오줌|대변|응가|똥|기저귀/.test(text)
          ? 'diaper'
          : null;
  if (!kind) return [];
  let list = items.filter((s) => s.kind === kind);
  if (kind === 'sleep' && /낮잠/.test(text)) list = list.filter((s) => s.title.startsWith('낮잠'));
  if (kind === 'sleep' && /밤잠/.test(text)) list = list.filter((s) => s.title.startsWith('밤잠'));
  if (kind === 'diaper') {
    const which: DiaperKind | null = /대소변|둘 다/.test(text) ? 'both' : /소변|쉬|오줌/.test(text) ? 'pee' : /대변|응가|똥/.test(text) ? 'poo' : null;
    if (which) list = list.filter((s) => s.diaper === which || s.diaper === 'both');
  }
  const hour = /(\d{1,2})\s*시/.exec(text);
  if (hour) {
    let h = Number(hour[1]);
    if (/오후|저녁|밤/.test(text) && h < 12) h += 12;
    const at = h * 60 + (/반/.test(text) ? 30 : 0);
    list = list.filter((s) => Math.abs(s.minute - at) <= 90);
  } else {
    const period = PERIODS.find(([re]) => re.test(text));
    if (period) list = list.filter((s) => s.minute / 60 >= period[1] && s.minute / 60 < period[2]);
  }
  if (list.length === 1 || (list.length > 1 && /\b다\b|전부|모두|다 안/.test(text))) return list;
  return [];
}

/** 저장된 글 → 초안. 깨졌으면 null */
export function shellSetFromText(text: string | null): ShellSet | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Partial<ShellSet>;
    if (typeof v.day !== 'string' || typeof v.source !== 'string' || typeof v.made !== 'string' || !Array.isArray(v.items)) return null;
    return { day: v.day, source: v.source, made: v.made, items: v.items as Shell[], removed: Array.isArray(v.removed) ? v.removed : [], filled: v.filled && typeof v.filled === 'object' ? v.filled : {} };
  } catch {
    return null;
  }
}
