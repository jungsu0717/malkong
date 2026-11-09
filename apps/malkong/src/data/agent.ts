/**
 * 물어보기 에이전트 (SPEC-MAIN-12 · 13, task today/022, decisions/040) — 화면 코드를 가져오지 않는 순수 함수(`node --test`).
 *
 * 보고 있는 날의 기록에 r1, r2 같은 짧은 번호를 붙여 서버에 보낼 줄로 만들고, 서버가 돌려준 바꿀 것(추가, 수정, 삭제, 일정)을
 * 앱이 반영할 변경 목록으로 바꾼다. 서버가 한 번 검사해서 보내지만, 앱도 범위를 벗어난 값과 바뀌지 않는 수정은 버린다.
 */

import { inputsFromServer, type ParsedInput } from './ask.ts';
import { feedSessions, hhmm } from './day-flow.ts';
import { eventTitle, STOOL_COLOR_LABEL } from './event-summary.ts';
import { AMOUNT_RANGE, type CareEvent, type DiaperKind, type Side, type StoolColor } from './events.ts';
import type { RoutineLog } from './routine.ts';
import type { Memo } from './stage.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
/** 한 번에 보내는 기록 수의 상한 — 서버 계약과 같다 */
export const MAX_CONTEXT = 150;

export type CtxKind = 'breast' | 'formula' | 'diaper' | 'sleep' | 'temp' | 'weight' | 'height' | 'routine' | 'memo';

/** 서버에 보내는 기록 한 줄 */
export type CtxRecord = {
  ref: string;
  kind: CtxKind;
  startAt: string;
  endAt: string | null;
  amount: number | null;
  side: Side | null;
  diaper: DiaperKind | null;
  color: StoolColor | null;
  title: string | null;
  note: string | null;
  by: string | null;
};

/** ref 가 가리키는 앱의 것 — key 는 하루 흐름 · 목록에서 비출 때 쓰는 key */
export type CtxSource =
  | { type: 'event'; ref: string; key: string; label: string; event: CareEvent }
  | { type: 'routine'; ref: string; key: string; label: string; log: RoutineLog; title: string }
  | { type: 'memo'; ref: string; key: string; label: string; memo: Memo };

export type DayContext = {
  /** 보는 날 YYYY-MM-DD */
  day: string;
  records: CtxRecord[];
  sources: CtxSource[];
};

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const iso = (at: number) => new Date(at).toISOString();
const memoLine = (text: string) => text.split('\n')[0].trim().slice(0, 40);

/**
 * 보는 날의 기록 — 그날 시작한 기록, 전날 밤에 잠들어 그날 깬 잠, 그날 완료한 루틴(단계 · 건너뛰기 줄은 빼고), 그날 쓴 메모.
 * 시각 순서로 r1 부터 번호를 붙인다. 너무 많으면 늦은 것을 남긴다.
 */
export function dayContext(
  date: Date,
  events: CareEvent[],
  routineLogs: { log: RoutineLog; title: string }[],
  memos: Memo[],
  now: Date,
): DayContext {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const to = from + DAY;
  const inDay = (at: number) => at >= from && at < to;
  // 수유는 흐름에서 한 번(세션)씩 묶여 첫 줄의 id 가 key 다
  const sessionOf = new Map<string, string>();
  for (const s of feedSessions(events)) for (const p of s.parts) sessionOf.set(p.id, s.id);

  type Draft = { at: number; record: Omit<CtxRecord, 'ref'>; source: DistributiveOmit<CtxSource, 'ref'> };
  const drafts: Draft[] = [];
  for (const e of events) {
    const start = new Date(e.startAt).getTime();
    const end = e.endAt ? new Date(e.endAt).getTime() : null;
    const sleepInto = e.kind === 'sleep' && start < from && (end === null ? now.getTime() >= from : inDay(end));
    if (!inDay(start) && !sleepInto) continue;
    const key = e.kind === 'breast' || e.kind === 'formula' ? (sessionOf.get(e.id) ?? e.id) : e.id;
    drafts.push({
      at: start,
      record: {
        kind: e.kind,
        startAt: e.startAt,
        endAt: e.endAt,
        amount: e.amount,
        side: e.side,
        diaper: e.diaper,
        color: e.color,
        title: null,
        note: e.note ? e.note.slice(0, 300) : null,
        by: e.by ? e.by.slice(0, 20) : null,
      },
      source: { type: 'event', key, label: eventTitle(e, now), event: e },
    });
  }
  for (const { log, title } of routineLogs) {
    const at = new Date(log.at).getTime();
    if (log.step != null || log.skip || !inDay(at)) continue;
    drafts.push({
      at,
      record: { kind: 'routine', startAt: log.at, endAt: log.endAt ?? null, amount: null, side: null, diaper: null, color: null, title: title.slice(0, 300), note: null, by: log.by ? log.by.slice(0, 20) : null },
      source: { type: 'routine', key: `routine-${log.id}`, label: title, log, title },
    });
  }
  for (const m of memos) {
    const at = new Date(m.at).getTime();
    if (m.ref !== null || !inDay(at)) continue;
    drafts.push({
      at,
      record: { kind: 'memo', startAt: m.at, endAt: null, amount: null, side: null, diaper: null, color: null, title: m.text.slice(0, 300), note: null, by: null },
      source: { type: 'memo', key: `memo-${m.id}`, label: `메모 ${memoLine(m.text)}`, memo: m },
    });
  }
  drafts.sort((a, b) => a.at - b.at);
  const kept = drafts.slice(-MAX_CONTEXT);
  const records: CtxRecord[] = [];
  const sources: CtxSource[] = [];
  kept.forEach((d, i) => {
    const ref = `r${i + 1}`;
    records.push({ ref, ...d.record });
    sources.push({ ref, ...d.source } as CtxSource);
  });
  return { day: ymd(date), records, sources };
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** 흐름에서 누른 key 의 기록 — 수유 세션은 첫 줄 */
export function sourceOfKey(ctx: DayContext, key: string | null): CtxSource | null {
  if (!key) return null;
  return ctx.sources.find((s) => s.key === key) ?? null;
}

/** 「선택 · 13:50 분유 120ml」 */
export function selectedLabel(s: CtxSource): string {
  const at = s.type === 'event' ? s.event.startAt : s.type === 'routine' ? s.log.at : s.memo.at;
  return `${hhmm(at)} ${s.label}`;
}

/** 화면을 가리키거나 이미 적은 기록을 고치는 말 — 규칙으로 읽지 않고 바로 에이전트에게 */
export function pointsOrEdits(text: string): boolean {
  return (
    /이거|그거|저거|이건|그건|이걸|그걸|이 기록|그 기록|방금 (거|것|기록|적은)|아까 (거|그|적은)/.test(text) ||
    /옮겨|옮기|바꿔|바꾸|고쳐|고치|수정|지워|지우|삭제|빼 ?줘|늦춰|당겨|잘못/.test(text) ||
    /\d+\s*(분|시간)\s*(앞|뒤|전|후)으?로/.test(text)
  );
}

// --- 서버가 돌려준 바꿀 것 ---

export type AgentAction = {
  op: 'add' | 'update' | 'delete' | 'plan';
  ref?: string | null;
  kind?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  minutes?: number | null;
  amount?: number | null;
  side?: Side | null;
  diaper?: DiaperKind | null;
  color?: StoolColor | null;
  title?: string | null;
  note?: string | null;
  hasTime?: boolean | null;
};

/** 기록 고치기 — CareEvent 에 그대로 넣는 칸들 */
export type EventPatch = Partial<Pick<CareEvent, 'startAt' | 'endAt' | 'amount' | 'side' | 'diaper' | 'color' | 'note'>>;

export type Change =
  | { op: 'add'; input: ParsedInput; title: string; at: number }
  | { op: 'update'; src: CtxSource; title: string; from: string; to: string; patch: EventPatch | { at: string; endAt: string | null } | { text: string } }
  | { op: 'delete'; src: CtxSource; title: string; from: string }
  | { op: 'plan'; title: string; at: Date; hasTime: boolean; when: string };

const time = (v: string | null | undefined, ceil: number | null): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return null;
  if (ceil !== null && t > ceil) return null;
  return t;
};

const SIDE_LABEL: Record<Side, string> = { left: '왼쪽', right: '오른쪽' };
const DIAPER_LABEL: Record<DiaperKind, string> = { pee: '소변', poo: '대변', both: '소변, 대변' };

function amountOk(kind: CareEvent['kind'], v: number | null | undefined): v is number {
  const r = AMOUNT_RANGE[kind];
  return !!r && typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;
}

const unitOf = (kind: CareEvent['kind']) => AMOUNT_RANGE[kind]?.unit ?? '';
const num = (v: number) => String(Number(v.toFixed(2)));

/** 기록 한 줄 고치기 — 바뀌는 칸과 「13:50 → 13:40」 */
function eventUpdate(src: Extract<CtxSource, { type: 'event' }>, a: AgentAction, now: Date): Change | null {
  const e = src.event;
  const ceil = now.getTime() + MIN;
  const patch: EventPatch = {};
  const from: string[] = [];
  const to: string[] = [];
  const start0 = new Date(e.startAt).getTime();
  const end0 = e.endAt ? new Date(e.endAt).getTime() : null;
  let start = start0;
  let end = end0;
  const s = time(a.startAt, ceil);
  if (s !== null && s !== start0) {
    start = s;
    // 끝을 따로 말하지 않았으면 걸린 시간을 그대로 두고 함께 옮긴다
    if (end0 !== null) end = end0 + (s - start0);
  }
  const timed = e.kind === 'breast' || e.kind === 'sleep';
  if (timed) {
    const en = time(a.endAt, ceil);
    if (en !== null) end = en;
    else if (a.minutes && a.minutes > 0 && a.minutes <= 16 * 60) end = start + Math.round(a.minutes) * MIN;
    if (end !== null && (end <= start || end > ceil)) return null;
  }
  if (start !== start0) {
    patch.startAt = iso(start);
    from.push(hhmm(start0));
    to.push(hhmm(start));
  }
  if (timed && end !== end0 && end !== null) {
    patch.endAt = iso(end);
    // 시작만 옮긴 것이면 끝은 따로 적지 않는다
    if (!(start !== start0 && end0 !== null && end - start === end0 - start0)) {
      from.push(end0 !== null ? `${hhmm(end0)} 끝` : '재는 중');
      to.push(`${hhmm(end)} 끝`);
    }
  }
  if (amountOk(e.kind, a.amount)) {
    const v = e.kind === 'formula' ? Math.round(a.amount) : a.amount;
    if (v !== e.amount) {
      patch.amount = v;
      from.push(e.amount !== null ? `${num(e.amount)}${unitOf(e.kind)}` : '없음');
      to.push(`${num(v)}${unitOf(e.kind)}`);
    }
  }
  if (e.kind === 'breast' && a.side && a.side !== e.side) {
    patch.side = a.side;
    from.push(e.side ? SIDE_LABEL[e.side] : '양쪽');
    to.push(SIDE_LABEL[a.side]);
  }
  if (e.kind === 'diaper') {
    if (a.diaper && a.diaper !== e.diaper) {
      patch.diaper = a.diaper;
      if (a.diaper === 'pee') patch.color = null;
      from.push(e.diaper ? DIAPER_LABEL[e.diaper] : '기저귀');
      to.push(DIAPER_LABEL[a.diaper]);
    }
    const kind = patch.diaper ?? e.diaper;
    if (a.color && kind !== 'pee' && a.color !== e.color) {
      patch.color = a.color;
      from.push(e.color ? STOOL_COLOR_LABEL[e.color] : '색 없음');
      to.push(STOOL_COLOR_LABEL[a.color]);
    }
  }
  if (typeof a.note === 'string') {
    const note = a.note.trim().slice(0, 300) || null;
    if (note !== (e.note ?? null)) {
      patch.note = note;
      from.push(e.note ? e.note : '메모 없음');
      to.push(note ?? '메모 지움');
    }
  }
  if (!Object.keys(patch).length) return null;
  return { op: 'update', src, title: src.label, from: from.join(', '), to: to.join(', '), patch };
}

/** 「내일(11월 7일) 09:00」 · 「11월 20일」 */
export function whenLabel(at: Date, hasTime: boolean, now: Date): string {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - d0) / DAY);
  const md = `${at.getMonth() + 1}월 ${at.getDate()}일`;
  const rel = days === 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : days === -1 ? '어제' : null;
  return `${rel ? `${rel}(${md})` : md}${hasTime ? ` ${hhmm(at)}` : ''}`;
}

/**
 * 서버의 바꿀 것을 앱의 변경 목록으로. 모르는 ref, 바뀌지 않는 수정, 앞으로의 기록, 범위를 벗어난 값은 버린다.
 * 새 기록은 inputsFromServer 로 읽고, 더 적을 것이 남은 기록은 뺀다(카드로는 마저 적을 수 없다).
 */
export function changesFrom(actions: AgentAction[], ctx: DayContext | null, now: Date, text = ''): Change[] {
  const out: Change[] = [];
  const ceil = now.getTime() + MIN;
  const byRef = new Map((ctx?.sources ?? []).map((s) => [s.ref, s]));
  const adds = actions.filter((a) => a.op === 'add');
  const addInputs = inputsFromServer(
    adds.map((a) => ({
      kind: a.kind ?? '',
      startAt: a.startAt ?? null,
      endAt: a.endAt ?? null,
      minutes: a.minutes ?? null,
      amount: a.amount ?? null,
      side: a.side ?? null,
      diaper: a.diaper ?? null,
      color: a.color ?? null,
      title: a.title ?? null,
    })),
    now,
    adds.length === 1 ? text : '',
  );
  let addIndex = 0;
  for (const a of actions) {
    if (a.op === 'add') {
      const input = addInputs[addIndex++];
      if (!input) continue;
      if (input.type === 'event') {
        if (input.complete) out.push({ op: 'add', input, title: input.title, at: new Date(input.input.startAt ?? now).getTime() });
      } else if (input.type === 'routine') out.push({ op: 'add', input, title: input.title, at: new Date(input.at).getTime() });
      else out.push({ op: 'add', input, title: `메모 ${memoLine(input.text)}`, at: new Date(input.at).getTime() });
      continue;
    }
    if (a.op === 'plan') {
      const title = (a.title ?? '').trim().slice(0, 60);
      const at = time(a.startAt, null);
      if (!title || at === null || Math.abs(at - now.getTime()) > 400 * DAY) continue;
      const hasTime = a.hasTime !== false;
      const d = new Date(at);
      // 날만 말한 일정은 그날 0시로 — 할 일의 dueAt 과 같은 모양
      const when = hasTime ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate());
      out.push({ op: 'plan', title, at: when, hasTime, when: whenLabel(when, hasTime, now) });
      continue;
    }
    const src = a.ref ? byRef.get(a.ref) : undefined;
    if (!src) continue;
    if (out.some((c) => (c.op === 'update' || c.op === 'delete') && c.src.ref === src.ref)) continue;
    if (a.op === 'delete') {
      const at = src.type === 'event' ? src.event.startAt : src.type === 'routine' ? src.log.at : src.memo.at;
      out.push({ op: 'delete', src, title: src.label, from: hhmm(at) });
      continue;
    }
    if (src.type === 'event') {
      const c = eventUpdate(src, a, now);
      if (c) out.push(c);
    } else if (src.type === 'routine') {
      const s = time(a.startAt, ceil);
      const at0 = new Date(src.log.at).getTime();
      if (s === null || s === at0) continue;
      const end0 = src.log.endAt ? new Date(src.log.endAt).getTime() : null;
      out.push({ op: 'update', src, title: src.label, from: hhmm(at0), to: hhmm(s), patch: { at: iso(s), endAt: end0 !== null ? iso(end0 + (s - at0)) : null } });
    } else {
      const t = (a.title ?? '').trim().slice(0, 2000);
      if (!t || t === src.memo.text) continue;
      out.push({ op: 'update', src, title: '메모', from: memoLine(src.memo.text), to: memoLine(t), patch: { text: t } });
    }
  }
  return out.slice(0, 10);
}

/** 새 기록만이면 039 처럼 바로 저장 — 고치기 · 지우기 · 일정이 섞이면 변경 카드 */
export const onlyAdds = (changes: Change[]) => changes.length > 0 && changes.every((c) => c.op === 'add');

/** 앞 대화 — 서버에 보내는 마지막 몇 줄 */
export type Turn = { role: 'user' | 'app'; text: string };
export function lastTurns(turns: Turn[], n = 6): Turn[] {
  return turns
    .filter((t) => t.text.trim())
    .slice(-n)
    .map((t) => ({ role: t.role, text: t.text.trim().slice(0, 600) }));
}
