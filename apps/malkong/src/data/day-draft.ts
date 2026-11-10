/**
 * 하루 초안 (SPEC-MAIN-16, task today/023, decisions/041) — 「오늘 하루 기록 초안으로 작성해 줘」.
 *
 * 말한 기록은 말한 그대로, 말하지 않은 때는 지난 7일 기록에서 평소 시각을 찾아 채운다(시각에 「쯤」). 모두 기기 안에서 규칙으로 세고 모델을 부르지 않는다.
 * 초안은 아직 저장하지 않은 기록이라 흐름에 점선 노드로 보이고, 「모두 저장」을 눌러야 기록이 된다. 흐름에서 눌러 고치거나 말로 고쳐 달라고 할 수 있다.
 * 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/day-draft.test.ts`).
 */

import type { Change, CtxRecord, CtxSource } from './agent.ts';
import { copula, type ParsedInput } from './ask.ts';
import { feedSessions, hhmm, isNightStart, type DayMemo, type RoutineDone } from './day-flow.ts';
import { durationLabel, minutesOf, startOfDay } from './event-summary.ts';
import { AMOUNT_RANGE, type CareEvent, type DiaperKind } from './events.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
/** 평소 시각을 찾는 지난 날수 */
export const USUAL_DAYS = 7;
/** 같은 평소 시각으로 묶는 폭(분) */
const CLUSTER = 90;
/** 그 때 앞뒤로 이만큼 안에 이미 기록이 있으면 채우지 않는다 */
const NEAR = 60 * MIN;
/** 낮잠 — 이보다 길면 평소 낮잠으로 보지 않는다(분) */
const NAP_MAX = 4 * 60;

export type Draft = {
  id: string;
  input: ParsedInput;
  title: string;
  at: number;
  /** 평소 기록으로 짐작한 것 — 시각에 「쯤」 */
  guessed: boolean;
  /** 사람이 고친 것 — 카드에 「고침」 */
  edited: boolean;
};
/** 한 날의 초안 묶음 — day 는 YYYY-MM-DD */
export type DraftSet = { day: string; items: Draft[] };

let seq = 0;
const draftId = () => `draft-${++seq}`;
const t = (iso: string) => new Date(iso).getTime();
const iso = (at: number) => new Date(at).toISOString();

/** 「오늘 하루 기록 초안으로 작성해 줘」 — 초안을 만들어 달라는 말 */
export const asksDraft = (text: string) =>
  (/초안/.test(text) && /작성|만들|써|적어|채워|잡아|짜/.test(text)) ||
  // 「이전 기록 보고 오늘 기록 채워 줘」, 「평소대로 하루 기록 만들어 줘」 — 「초안」이라는 말이 없어도(빌드 15 피드백)
  (/(평소|이전 ?기록|지난 ?기록|전 ?기록|지난 ?7일|지난 ?일주일)/.test(text) && /(오늘|하루|기록)/.test(text) && /(채워|만들|작성|짜|잡아|써 ?줘)/.test(text));

/** 초안을 부탁한 부분을 빼고 남는 말 — 「10시 반에 분유 140 먹었어」. 없으면 빈 글 */
export function stripDraftAsk(text: string): string {
  return text
    .split(/[.!?。]\s*|(?<=\S)고\s*,?\s+|하고\s+|그리고\s+|,\s*/)
    .map((x) => x.trim())
    // 초안을 부탁한 말(「초안」, 「이전 기록 보고」, 「오늘 기록 채워 줘」)은 기록이 아니다 — 남기면 모델로 한 번 더 간다
    .filter((x) => x && !/초안|평소|이전 ?기록|지난 ?기록|전 ?기록|지난 ?7일|지난 ?일주일|채워|만들어|작성|짜 ?줘/.test(x))
    .join(', ');
}

// ---------- 평소 시각 ----------

export type UsualKind = 'formula' | 'breast' | DiaperKind | 'nap';
/** 지난 7일에 되풀이된 기록 하나 — minute 은 그날 0시부터 분 */
export type Usual = { kind: UsualKind; minute: number; amount: number | null; minutes: number | null; days: number };

type Entry = { day: number; minute: number; value: number | null };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/**
 * 그날 앞 7일에서 평소 시각을 찾는다 — 같은 종류의 기록을 시각순으로 놓고 90분 안에 모인 것(하루에 하나씩)이
 * 기록한 날의 절반 넘게(적어도 사흘) 되풀이되면 평소로 본다. 시각은 가운데 값(5분 단위), 분유 양은 10ml 단위, 걸린 시간은 5분 단위.
 */
export function usualTimes(events: CareEvent[], day: Date, now = new Date(), days = USUAL_DAYS): Usual[] {
  const D0 = startOfDay(day).getTime();
  const from = D0 - days * DAY;
  const entries = new Map<UsualKind, Entry[]>();
  const put = (kind: UsualKind, at: number, value: number | null) => {
    if (at < from || at >= D0) return;
    const dayStart = startOfDay(new Date(at)).getTime();
    const list = entries.get(kind) ?? [];
    list.push({ day: Math.round((dayStart - from) / DAY), minute: Math.round((at - dayStart) / MIN), value });
    entries.set(kind, list);
  };
  for (const s of feedSessions(events)) {
    if (s.endAt === null) continue;
    if (s.kind === 'formula') put('formula', t(s.startAt), s.parts[0].amount);
    else put('breast', t(s.startAt), s.parts.reduce((sum, p) => sum + minutesOf(p, now), 0));
  }
  for (const e of events) {
    if (e.kind === 'diaper' && e.diaper) put(e.diaper, t(e.startAt), null);
    if (e.kind === 'sleep' && e.endAt && !isNightStart(t(e.startAt))) {
      const min = minutesOf(e, now);
      if (min > 0 && min <= NAP_MAX) put('nap', t(e.startAt), min);
    }
  }
  const out: Usual[] = [];
  for (const [kind, list] of entries) {
    const kindDays = new Set(list.map((x) => x.day)).size;
    const need = Math.max(3, Math.ceil(kindDays / 2));
    const sorted = [...list].sort((a, b) => a.minute - b.minute);
    let group: Entry[] = [];
    const flush = () => {
      if (group.length >= need) {
        const values = group.flatMap((g) => (g.value !== null ? [g.value] : []));
        out.push({
          kind,
          minute: roundTo(median(group.map((g) => g.minute)), 5),
          amount: kind === 'formula' && values.length ? roundTo(median(values), 10) : null,
          minutes: (kind === 'breast' || kind === 'nap') && values.length ? Math.max(5, roundTo(median(values), 5)) : null,
          days: group.length,
        });
      }
      group = [];
    };
    for (const en of sorted) {
      const first = group[0];
      if (first && (en.minute - first.minute > CLUSTER || group.some((g) => g.day === en.day))) flush();
      group.push(en);
    }
    flush();
  }
  return out.sort((a, b) => a.minute - b.minute);
}

// ---------- 초안 만들기 ----------

const DIAPER_TITLE: Record<DiaperKind, string> = { pee: '소변', poo: '대변', both: '소변, 대변' };

/** 초안의 이름 — 「분유 140ml」 「모유 왼쪽 15분」 「낮잠 50분」 「소변」 */
export function draftTitle(p: ParsedInput): string {
  if (p.type === 'routine') return p.title;
  if (p.type === 'memo') return `메모 ${p.text.split('\n')[0].trim().slice(0, 40)}`;
  const e = p.input;
  const span = e.startAt && e.endAt ? Math.max(0, (t(e.endAt) - t(e.startAt)) / MIN) : null;
  if (e.kind === 'formula') return e.amount != null ? `분유 ${Math.round(e.amount)}ml` : '분유';
  if (e.kind === 'breast') return `모유${e.side === 'left' ? ' 왼쪽' : e.side === 'right' ? ' 오른쪽' : ''}${span ? ` ${durationLabel(span)}` : ''}`;
  if (e.kind === 'sleep') return `${e.startAt && isNightStart(t(e.startAt)) ? '밤잠' : '낮잠'}${span ? ` ${durationLabel(span)}` : ''}`;
  if (e.kind === 'diaper') return e.diaper ? DIAPER_TITLE[e.diaper] : '기저귀';
  const unit = AMOUNT_RANGE[e.kind]?.unit ?? '';
  const name = e.kind === 'temp' ? '체온' : e.kind === 'weight' ? '몸무게' : '키';
  return e.amount != null ? `${e.kind === 'temp' ? '' : `${name} `}${e.amount}${unit}` : name;
}

const atOf = (p: ParsedInput, now: Date): number => (p.type === 'event' ? (p.input.startAt ? t(p.input.startAt) : now.getTime()) : t(p.at));
const endOfInput = (p: ParsedInput): number | null => (p.type === 'event' && p.input.endAt ? t(p.input.endAt) : null);
const kindOf = (p: ParsedInput): string => (p.type === 'event' ? p.input.kind : p.type);
const isFeedKind = (k: string) => k === 'formula' || k === 'breast';

function inputOf(u: Usual, at: number): ParsedInput {
  const startAt = iso(at);
  if (u.kind === 'formula') return { type: 'event', input: { kind: 'formula', amount: u.amount, startAt }, complete: true, title: '' };
  if (u.kind === 'breast') return { type: 'event', input: { kind: 'breast', startAt, endAt: iso(at + (u.minutes ?? 10) * MIN) }, complete: true, title: '' };
  if (u.kind === 'nap') return { type: 'event', input: { kind: 'sleep', startAt, endAt: iso(at + (u.minutes ?? 30) * MIN) }, complete: true, title: '' };
  return { type: 'event', input: { kind: 'diaper', diaper: u.kind, startAt }, complete: true, title: '' };
}

const make = (input: ParsedInput, at: number, guessed: boolean): Draft => {
  const title = draftTitle(input);
  return { id: draftId(), input: input.type === 'event' ? { ...input, title } : input, title, at, guessed, edited: false };
};

export type DraftOpts = {
  events: CareEvent[];
  day: Date;
  now: Date;
  /** 말한 기록 — 규칙이나 에이전트가 읽은 것 */
  said: ParsedInput[];
  /** 말하지 않은 때를 평소 기록으로 채울지(decisions/041) */
  fill: boolean;
};

/**
 * 그날의 초안 — 말한 기록(그날 것만, 다 적힌 것만)과, 채우기로 했으면 평소 시각 가운데 아직 기록이 없는 때.
 * 오늘이면 지금까지만 채운다(기록은 지나간 일이다). 그 때 앞뒤 1시간 안에 같은 종류의 기록이나 말한 기록이 있으면 채우지 않는다.
 */
export function dayDrafts({ events, day, now, said, fill }: DraftOpts): Draft[] {
  const D0 = startOfDay(day).getTime();
  const isToday = now.getTime() >= D0 && now.getTime() < D0 + DAY;
  const limit = isToday ? now.getTime() : D0 + DAY;
  const items: Draft[] = [];
  for (const p of said) {
    if (p.type === 'event' && !p.complete) continue;
    const at = atOf(p, now);
    if (at < D0 || at >= D0 + DAY || at > limit) continue;
    items.push(make(p, at, false));
  }
  if (fill) {
    const near = (a: number, b: number) => Math.abs(a - b) <= NEAR;
    const taken = (u: Usual, at: number, end: number | null) => {
      const group = u.kind === 'nap' ? 'sleep' : isFeedKind(u.kind) ? 'feed' : 'diaper';
      const sameGroup = (k: string) => (group === 'feed' ? isFeedKind(k) : k === group);
      for (const e of events) {
        if (!sameGroup(e.kind)) continue;
        const s = t(e.startAt);
        if (near(s, at)) return true;
        if (group === 'sleep' && end !== null && e.endAt && s < end && t(e.endAt) > at) return true;
      }
      for (const d of items) {
        const k = kindOf(d.input);
        if (!d.guessed && sameGroup(k) && near(d.at, at)) return true;
        if (d.guessed && k === (u.kind === 'nap' ? 'sleep' : isFeedKind(u.kind) ? u.kind : 'diaper') && Math.abs(d.at - at) <= 30 * MIN) return true;
        if (group === 'sleep' && k === 'sleep' && end !== null) {
          const de = endOfInput(d.input);
          if (de !== null && d.at < end && de > at) return true;
        }
      }
      return false;
    };
    for (const u of usualTimes(events, day, now)) {
      const at = D0 + u.minute * MIN;
      const end = u.minutes !== null ? at + u.minutes * MIN : null;
      if (at > limit || (end !== null && end > limit)) continue;
      if (taken(u, at, end)) continue;
      items.push(make(inputOf(u, at), at, true));
    }
  }
  return items.sort((a, b) => a.at - b.at);
}

/** 「07:35쯤」 「10:30」 */
export const draftWhen = (d: Draft) => `${hhmm(d.at)}${d.guessed ? '쯤' : ''}`;

/** 흐름 · 목록의 key 가 초안이면 그 id — 수유 · 기저귀 · 잠은 id 그대로, 루틴은 `routine-<id>`, 메모는 `memo-<id>` */
export function draftIdOfKey(key: string | null): string | null {
  if (!key) return null;
  const m = /^(?:routine-|memo-)?(draft-\d+)$/.exec(key);
  return m ? m[1] : null;
}

/** 초안을 흐름에 놓을 모양 — 기록 · 루틴 완료 · 메모로 */
export function draftFlow(items: Draft[]): { events: CareEvent[]; routines: RoutineDone[]; memos: DayMemo[] } {
  const events: CareEvent[] = [];
  const routines: RoutineDone[] = [];
  const memos: DayMemo[] = [];
  for (const d of items) {
    const p = d.input;
    if (p.type === 'event') events.push(draftEvent(d.id, p));
    else if (p.type === 'routine') routines.push({ routineId: d.id, logId: d.id, title: p.title, at: p.at, by: null, endAt: null });
    else memos.push({ memoId: d.id, text: p.text, at: p.at });
  }
  return { events, routines, memos };
}

function draftEvent(id: string, p: Extract<ParsedInput, { type: 'event' }>): CareEvent {
  const e = p.input;
  const start = e.startAt ?? iso(Date.now());
  return { id, kind: e.kind, startAt: start, endAt: e.endAt ?? null, amount: e.amount ?? null, side: e.side ?? null, diaper: e.diaper ?? null, color: e.color ?? null, note: e.note ?? null, by: null, createdAt: start, updatedAt: start };
}

// ---------- 고치기 ----------

export type DraftPatch = { at?: number; amount?: number; minutes?: number };

/** 흐름의 작은 창에서 고친 것 — 시각(끝도 함께 옮긴다), 분유 양, 모유 · 잠의 걸린 시간 */
export function editDraft(d: Draft, patch: DraftPatch): Draft {
  let input = d.input;
  let at = d.at;
  if (patch.at !== undefined && patch.at !== d.at) {
    const delta = patch.at - d.at;
    at = patch.at;
    if (input.type === 'event') input = { ...input, input: { ...input.input, startAt: iso(at), endAt: input.input.endAt ? iso(t(input.input.endAt) + delta) : input.input.endAt } };
    else input = { ...input, at: iso(at) };
  }
  if (input.type === 'event') {
    const e = input.input;
    const range = AMOUNT_RANGE[e.kind];
    if (patch.amount !== undefined && range) input = { ...input, input: { ...e, amount: Math.min(range.max, Math.max(range.min, Math.round(patch.amount))) } };
    if (patch.minutes !== undefined && (e.kind === 'breast' || e.kind === 'sleep')) {
      const min = Math.min(16 * 60, Math.max(1, Math.round(patch.minutes)));
      input = { ...input, input: { ...input.input, endAt: iso(at + min * MIN) } };
    }
  }
  const title = draftTitle(input);
  return { ...d, input: input.type === 'event' ? { ...input, title } : input, title, at, edited: true };
}

/** 초안의 걸린 시간(분) — 모유 · 잠만 */
export function draftMinutes(d: Draft): number | null {
  const end = endOfInput(d.input);
  return end !== null ? Math.round((end - d.at) / MIN) : null;
}

const objectOf = (w: string) => (copula(w) === '이에요' ? '을' : '를');
const towardOf = (w: string) => {
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '로';
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
};

/**
 * 에이전트가 돌려준 바꿀 것 가운데 초안을 가리키는 것 — 카드 없이 초안에 바로 반영하고 한 줄로 알린다.
 * 「✓ 초안에서 15:30쯤 낮잠을 뺐어요」, 「✓ 초안의 분유 140ml를 160ml로 고쳤어요」. 초안이 아니면 null
 */
export function applyChangeToDrafts(items: Draft[], ch: Change): { items: Draft[]; line: string } | null {
  if (ch.op !== 'update' && ch.op !== 'delete') return null;
  const id = draftIdOfKey(ch.src.key);
  const d = id ? items.find((x) => x.id === id) : undefined;
  if (!d) return null;
  if (ch.op === 'delete') return { items: items.filter((x) => x.id !== d.id), line: `초안에서 ${draftWhen(d)} ${d.title}${objectOf(d.title)} 뺐어요` };
  let next = d;
  const p = ch.patch;
  if (d.input.type === 'event' && !('at' in p) && !('text' in p)) {
    const e = { ...d.input.input, ...p };
    const at = e.startAt ? t(e.startAt) : d.at;
    const input = { ...d.input, input: e };
    next = { ...d, input: { ...input, title: draftTitle(input) }, title: draftTitle(input), at, edited: true };
  } else if (d.input.type === 'routine' && 'at' in p) {
    next = editDraft(d, { at: t(p.at) });
  } else if (d.input.type === 'memo' && 'text' in p) {
    const input = { ...d.input, text: p.text };
    next = { ...d, input, title: draftTitle(input), edited: true };
  } else return null;
  return { items: items.map((x) => (x.id === d.id ? next : x)).sort((a, b) => a.at - b.at), line: `초안의 ${d.title}${objectOf(d.title)} ${ch.to}${towardOf(ch.to)} 고쳤어요` };
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
 * 「오후 낮잠은 안 잤어」, 「10시 분유는 안 먹였어」 — 규칙으로 초안에서 뺄 것을 고른다(decisions/040 「규칙이 먼저다」).
 * 종류와 때로 하나가 정해지면 그것, 「다」 「전부」 「모두」면 맞는 것 모두, 정하지 못하면 빈 목록(에이전트에게 보낸다)
 */
export function negatedDrafts(text: string, items: Draft[]): Draft[] {
  if (!/안 |않았|없었|없어/.test(text)) return [];
  const kind = /낮잠|밤잠|잠|잤/.test(text)
    ? 'sleep'
    : /분유/.test(text)
      ? 'formula'
      : /모유/.test(text)
        ? 'breast'
        : /소변|쉬|오줌|대변|응가|똥|기저귀/.test(text)
          ? 'diaper'
          : null;
  if (!kind) return [];
  const dayStart = items.length ? startOfDay(new Date(items[0].at)).getTime() : 0;
  let list = items.filter((d) => kindOf(d.input) === kind);
  if (kind === 'diaper') {
    const which: DiaperKind | null = /대소변|둘 다/.test(text) ? 'both' : /소변|쉬|오줌/.test(text) ? 'pee' : /대변|응가|똥/.test(text) ? 'poo' : null;
    if (which) list = list.filter((d) => d.input.type === 'event' && (d.input.input.diaper === which || d.input.input.diaper === 'both'));
  }
  const hour = /(\d{1,2})\s*시/.exec(text);
  if (hour) {
    let h = Number(hour[1]);
    if (/오후|저녁|밤/.test(text) && h < 12) h += 12;
    const half = /반/.test(text) ? 30 : 0;
    const at = dayStart + (h * 60 + half) * MIN;
    list = list.filter((d) => Math.abs(d.at - at) <= 90 * MIN);
  } else {
    const period = PERIODS.find(([re]) => re.test(text));
    if (period) list = list.filter((d) => {
      const h = (d.at - dayStart) / (60 * MIN);
      return h >= period[1] && h < period[2];
    });
  }
  if (list.length === 1 || (list.length > 1 && /\b다\b|전부|모두|다 안/.test(text))) return list;
  return [];
}

// ---------- 에이전트에 보내기 ----------

/** 초안을 보는 날의 기록 뒤에 이어 번호를 붙여 보낸다 — 모델이 「그 낮잠」을 가리켜 고치거나 뺄 수 있게 */
export function draftContext(items: Draft[], from: number): { records: CtxRecord[]; sources: CtxSource[] } {
  const records: CtxRecord[] = [];
  const sources: CtxSource[] = [];
  items.forEach((d, i) => {
    const ref = `r${from + i}`;
    const p = d.input;
    if (p.type === 'event') {
      const e = draftEvent(d.id, p);
      records.push({ ref, kind: e.kind, startAt: e.startAt, endAt: e.endAt, amount: e.amount, side: e.side, diaper: e.diaper, color: e.color, title: null, note: null, by: null });
      sources.push({ type: 'event', ref, key: d.id, label: d.title, event: e });
    } else if (p.type === 'routine') {
      records.push({ ref, kind: 'routine', startAt: p.at, endAt: null, amount: null, side: null, diaper: null, color: null, title: p.title.slice(0, 300), note: null, by: null });
      sources.push({ type: 'routine', ref, key: `routine-${d.id}`, label: d.title, log: { id: d.id, routineId: d.id, at: p.at, by: null, step: null, skip: false, createdAt: p.at, endAt: null }, title: p.title });
    } else {
      records.push({ ref, kind: 'memo', startAt: p.at, endAt: null, amount: null, side: null, diaper: null, color: null, title: p.text.slice(0, 300), note: null, by: null });
      sources.push({ type: 'memo', ref, key: `memo-${d.id}`, label: d.title, memo: { id: d.id, at: p.at, text: p.text, ref: null, createdAt: p.at, updatedAt: p.at } });
    }
  });
  return { records, sources };
}

/** 앞 대화에 남기는 한 줄 — 「초안 8개: 07:35쯤 소변, 10:30 분유 140ml …」 */
export function draftSummary(items: Draft[]): string {
  const head = items.slice(0, 6).map((d) => `${draftWhen(d)} ${d.title}`);
  return `초안 ${items.length}개: ${head.join(', ')}${items.length > 6 ? ' …' : ''}`;
}
