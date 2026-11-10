/**
 * 물어보기 에이전트 (SPEC-MAIN-12 · 13, task today/022, decisions/040) — 화면 코드를 가져오지 않는 순수 함수(`node --test`).
 *
 * 보고 있는 날의 기록에 r1, r2 같은 짧은 번호를 붙여 서버에 보낼 줄로 만들고, 서버가 돌려준 바꿀 것(추가, 수정, 삭제, 일정)을
 * 앱이 반영할 변경 목록으로 바꾼다. 서버가 한 번 검사해서 보내지만, 앱도 범위를 벗어난 값과 바뀌지 않는 수정은 버린다.
 */

import { parseAdd } from './add-parse.ts';
import { copula, inputsFromServer, type ParsedInput } from './ask.ts';
import { feedSessions, hhmm } from './day-flow.ts';
import { durationLabel, eventTitle, minutesOf, STOOL_COLOR_LABEL } from './event-summary.ts';
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

// --- 답 문장 — 모델은 기록만 고르고 문장은 앱이 쓴다(헌장 13) ---

/** 받침이 있으면 앞 말, 없으면 뒤 말 — 「120ml는」, 「15분은」 */
const josa = (word: string, withBatchim: string, without: string) => (copula(word) === '이에요' ? withBatchim : without);

/** 기록 한 줄 — 「12:00~13:10 잠 1시간 10분」, 「13:50 분유 120ml」, 「11:05 메모 「처음으로 뒤집기를 했어요」」 */
function lineOf(s: CtxSource): string {
  if (s.type === 'event') {
    const e = s.event;
    const range = (e.kind === 'breast' || e.kind === 'sleep') && e.endAt ? `${hhmm(e.startAt)}~${hhmm(e.endAt)}` : hhmm(e.startAt);
    return `${range} ${s.label}`;
  }
  if (s.type === 'routine') return `${s.log.endAt ? `${hhmm(s.log.at)}~${hhmm(s.log.endAt)}` : hhmm(s.log.at)} ${s.title}`;
  return `${hhmm(s.memo.at)} 메모 「${memoLine(s.memo.text)}」`;
}

/** 두 기록 비교 — 같은 종류의 분유 양이나 모유 · 잠의 걸린 시간만. 앞이 물은 기록, 뒤가 비교할 기록 */
export function compare(a: CtxSource, b: CtxSource, now: Date): string | null {
  if (a.type !== 'event' || b.type !== 'event') return null;
  const x = a.event;
  const y = b.event;
  const feed = (k: string) => k === 'breast' || k === 'formula';
  if (!(x.kind === y.kind || (feed(x.kind) && feed(y.kind)))) return null;
  const word = new Date(y.startAt).getTime() < new Date(x.startAt).getTime() ? '앞' : '뒤';
  const what = feed(y.kind) ? '수유' : y.kind === 'sleep' ? '잠' : KIND_WORD[y.kind];
  const other = `${word} ${what}(${hhmm(y.startAt)}, ${b.label.replace(/^(분유|모유|잠|체온|몸무게|키) ?/, '') || b.label})`;
  let diff: string | null = null;
  let sign = 0;
  if (x.kind === 'formula' && y.kind === 'formula' && x.amount !== null && y.amount !== null) {
    sign = Math.sign(x.amount - y.amount);
    diff = `${Math.round(Math.abs(x.amount - y.amount))}ml`;
  } else if ((x.kind === 'breast' || x.kind === 'sleep') && x.kind === y.kind && x.endAt && y.endAt) {
    const d = Math.round(minutesOf(x, now)) - Math.round(minutesOf(y, now));
    sign = Math.sign(d);
    diff = durationLabel(Math.abs(d));
  } else if ((x.kind === 'temp' || x.kind === 'weight' || x.kind === 'height') && x.kind === y.kind && x.amount !== null && y.amount !== null) {
    const unit = AMOUNT_RANGE[x.kind]?.unit ?? '';
    sign = Math.sign(x.amount - y.amount);
    diff = `${Number(Math.abs(x.amount - y.amount).toFixed(2))}${unit}`;
  }
  if (diff === null) return null;
  const head = `${a.label}${josa(a.label, '은', '는')} ${other}`;
  if (sign === 0) return `${head}${josa(other.replace(/\)$/, ''), '과', '와')} 같아요.`;
  const more = x.kind === 'formula' ? (sign > 0 ? '많아요' : '적어요') : x.kind === 'temp' ? (sign > 0 ? '높아요' : '낮아요') : sign > 0 ? '길어요' : '짧아요';
  const verb = x.kind === 'weight' ? (sign > 0 ? '무거워요' : '가벼워요') : x.kind === 'height' ? (sign > 0 ? '커요' : '작아요') : more;
  return `${head}보다 ${diff} ${verb}.`;
}

const KIND_WORD: Record<CareEvent['kind'], string> = { breast: '수유', formula: '수유', diaper: '기저귀', sleep: '잠', temp: '체온', weight: '몸무게', height: '키' };

/**
 * 에이전트가 고른 기록으로 답 문장 — 비교를 물었고 두 기록이 같은 종류면 차이를, 아니면 그 기록들을 시각과 함께.
 * 고른 기록이 없으면 「11월 6일 기록에서 찾지 못했어요.」
 */
export function answerText(refs: string[], ctx: DayContext, question: string, dayLabel: string, now: Date): { text: string; keys: string[] } {
  const list: CtxSource[] = [];
  for (const ref of refs) {
    const s = ctx.sources.find((x) => x.ref === ref);
    if (s && !list.includes(s)) list.push(s);
  }
  if (!list.length) return { text: `${dayLabel} 기록에서 찾지 못했어요.`, keys: [] };
  const keys = [...new Set(list.map((s) => s.key))];
  if (list.length === 2 && /보다|비교|많이|적게|덜|더 /.test(question)) {
    const c = compare(list[0], list[1], now);
    if (c) return { text: c, keys };
  }
  const sorted = [...list].sort((a, b) => timeOf(a) - timeOf(b));
  const lines = sorted.slice(0, 3).map(lineOf);
  const body = lines.join(', ');
  // 끝이 「」」나 「)」면 그 앞 글자로 「이에요 · 예요」를 고른다
  const text = sorted.length > 3 ? `${body} 등 ${sorted.length}개예요.` : `${body}${copula(body.replace(/[」)]+$/, ''))}.`;
  return { text, keys };
}

const timeOf = (s: CtxSource) => new Date(s.type === 'event' ? s.event.startAt : s.type === 'routine' ? s.log.at : s.memo.at).getTime();

/** 일정을 넣어 달라는 말인가 */
export const asksPlan = (text: string) => /일정|예약|할 ?일/.test(text);

/**
 * 에이전트가 일정을 빠뜨렸을 때 — 문장을 「~고」, 쉼표로 나눠 앱 규칙으로 날짜와 이름을 읽는다.
 * 실제 호출에서 모델이 일정의 때를 빠뜨린 일이 있었다(2026-11-09).
 */
export function planFromText(text: string, now: Date): Change | null {
  const parts = text
    .split(/(?<=\S)고\s*,?\s+|하고\s+|그리고\s+|,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const p of parts.reverse()) {
    if (!asksPlan(p) || pointsOrEdits(p)) continue;
    const r = parseAdd(p, now);
    if (r?.type !== 'todo' || !r.title) continue;
    return { op: 'plan', title: r.title.slice(0, 60), at: r.dueAt, hasTime: r.hasTime, when: whenLabel(r.dueAt, r.hasTime, now) };
  }
  return null;
}

