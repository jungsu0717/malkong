/**
 * 물어보기 채팅의 말 다루기 (SPEC-MAIN-12 · 13, task today/019) — 화면 코드를 가져오지 않는 순수 함수(`node --test`).
 *
 * 적은 말이 건강 질문인지, 묻는 말인지, 기록하는 말인지 가르고, 묻는 말이면 기기 안 기록으로 답 문장과 비출 기록을 만든다.
 * 「그 전 수유는?」, 「어제는?」처럼 앞 질문을 이어받는 말도 여기서 읽는다. 서버 모델이 돌려준 기록은 앱의 기록 입력으로 바꾼다.
 */

import { parseAdd } from './add-parse.ts';
import { durationLabel } from './event-summary.ts';
import { AMOUNT_RANGE, type CareEvent, type EventInput } from './events.ts';
import { findWhen, parseFind, rangeOf, runFind, WHAT_LABEL, type FindQuery, type FindRangeKey, type FindWhat } from './find-parse.ts';

const MIN = 60 * 1000;

/** 건강을 묻는 말 — 답하지 않고 정해 둔 한 줄만(헌장 5) */
export const HEALTH_REPLY = '건강에 관한 질문에는 답하지 않아요. 걱정되면 병원에 물어보세요.';

export function isHealth(text: string): boolean {
  return /열이|열나|열 나|발진|두드러기|토했|토해|구토|설사|해열제|약을|약 먹|병원 가|아파|아픈|괜찮(아|을까|나요)|이상(해|한가|한 거)|위험/.test(text);
}

/** 묻는 말인가 — 물음표, 몇 · 언제 · 얼마 · 마지막, 「~는?」 같은 이어 묻기 */
export function isQuestion(text: string): boolean {
  const s = text.trim();
  return /[?？]$/.test(s) || /몇|언제|얼마|마지막|했나|했니|됐나|있었|어땠/.test(s) || /^(그 ?전|그 ?앞|어제|오늘|이번 주|지난주)[^ ]*(는|은)?$/.test(s);
}

const KIND_WORDS = /분유|모유|젖|수유|기저귀|대소변|소변|대변|응가|똥|오줌|쉬|잠|잤|낮잠|체온|몸무게|키|비타민|유산균|터미타임|목욕|산책|메모/g;

/** 한 문장에 기록이 여럿인가 — 「~고」, 「하고」, 쉼표로 이은 말에 기록 이름이 둘 넘게 */
export function looksMulti(text: string): boolean {
  const kinds = new Set((text.match(KIND_WORDS) ?? []).map((w) => (/소변|대변|대소변|응가|똥|오줌|쉬/.test(w) ? '기저귀' : w)));
  return kinds.size >= 2 && /(고|하고|그리고|이랑|랑)\s|,/.test(text);
}

/** 「이에요」 · 「예요」 — 끝 글자 받침으로. 숫자와 단위는 읽는 소리로 */
export function copula(word: string): string {
  const w = word.trim();
  const last = w[w.length - 1] ?? '';
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? '예요' : '이에요';
  if (/\d/.test(last)) return '013678'.includes(last) ? '이에요' : '예요';
  if (/ml$/i.test(w) || /cm$/i.test(w) || last === '℃') return '예요';
  if (/kg$/i.test(w)) return '이에요';
  return '이에요';
}

/** 답 — 말, 비출 기록, 그 기록을 여는 곳 */
export type Answer = {
  text: string;
  /** 하루 흐름 · 목록에서 비출 기록의 key(수유는 세션 id, 그 밖에는 기록 id) */
  keys: string[];
  /** 비춘 기록 위 짧은 표시 */
  label: string;
  /** 「이 기록 보기」 — 그 기록 하나(마지막을 물었을 때) */
  open: { at: number; key: string; kind: CareEvent['kind'] } | null;
  /** 이어 묻기에 쓰는 것 */
  query: FindQuery | null;
  offset: number;
};

/** 찾을 조건으로 답 문장을 만든다. offset 은 마지막에서 몇 번째 앞인지(그 전 수유는?) */
export function answerFor(q: FindQuery, events: CareEvent[], now: Date, offset = 0): Answer {
  const a = runFind(q, events, now);
  const what = WHAT_LABEL[q.what];
  if (q.measure === 'last' || offset > 0) {
    // runFind 의 목록은 최근 것이 먼저다
    const row = a.rows[offset];
    if (!row) return { text: '찾는 기록이 없어요.', keys: [], label: '', open: null, query: q, offset };
    const ago = Math.max(1, Math.round((now.getTime() - row.at) / MIN));
    const when = findWhen(row.at, now);
    const agoText = ago < 24 * 60 ? ` ${durationLabel(ago)} 전이에요.` : '';
    return {
      text: `${when}, ${row.title}${copula(row.title)}.${agoText}`,
      keys: [row.key],
      label: offset > 0 ? `그 전 ${what}` : `이전 ${what}`,
      open: { at: row.at, key: row.key, kind: row.kind },
      query: { ...q, measure: 'last' },
      offset,
    };
  }
  if (a.rows.length === 0) return { text: `${q.range.label}에 찾는 기록이 없어요.`, keys: [], label: '', open: null, query: q, offset: 0 };
  const lines = [`${q.range.label} ${what} ${a.big}${copula(a.big)}.`];
  if (a.line) lines.push(`${a.line}${copula(a.line)}.`);
  return { text: lines.join(' '), keys: a.rows.map((r) => r.key), label: what, open: null, query: q, offset: 0 };
}

/**
 * 이어 묻기 — 「그 전 수유는?」은 앞 질문의 마지막에서 하나 더 앞, 「어제는?」처럼 무엇이 빠진 말은 앞 질문의 무엇을 붙여 다시 읽는다.
 * 이어받을 것이 없으면 null.
 */
export function followUp(text: string, last: Answer | null, now: Date): { query: FindQuery; offset: number } | null {
  if (!last?.query) return null;
  const s = text.trim();
  if (/그 ?전|그 ?앞|그거 ?전|전에는/.test(s)) {
    const own = parseFind(s, now);
    const sameWhat = !own || own.what === last.query.what;
    // 그 전 기록은 오늘 첫 기록보다 앞일 수 있어 최근 7일에서 찾는다
    if (sameWhat) return { query: { ...last.query, measure: 'last', range: rangeOf('recent7', now) }, offset: last.offset + 1 };
  }
  if (parseFind(s, now)) return null;
  const again = parseFind(`${WHAT_LABEL[last.query.what]} ${s}`, now);
  return again ? { query: { ...again, measure: last.query.measure }, offset: 0 } : null;
}

/** 서버가 돌려준 찾을 조건을 앱의 조건으로 — 모르는 값이면 null */
export function queryFromServer(x: { what: string; range: string; measure: string } | null, now: Date): FindQuery | null {
  if (!x) return null;
  if (!(x.what in WHAT_LABEL)) return null;
  const measures = ['count', 'amount', 'duration', 'last'];
  if (!measures.includes(x.measure)) return null;
  const ranges: FindRangeKey[] = ['today', 'yesterday', 'lastNight', 'tonight', 'thisWeek', 'lastWeek', 'recent7', 'recent30'];
  const key = ranges.includes(x.range as FindRangeKey) ? (x.range as FindRangeKey) : 'today';
  return { what: x.what as FindWhat, range: rangeOf(key, now), measure: x.measure as FindQuery['measure'] };
}

/** 서버 기록 한 줄 — 앱이 쓸 수 있게 바꾼 것 */
export type ParsedInput =
  | { type: 'event'; input: EventInput; complete: boolean; title: string }
  | { type: 'routine'; title: string; at: string }
  | { type: 'memo'; text: string; at: string };

type ServerRecord = {
  kind: string;
  startAt: string | null;
  endAt: string | null;
  minutes: number | null;
  amount: number | null;
  side: 'left' | 'right' | null;
  diaper: 'pee' | 'poo' | 'both' | null;
  color: 'yellow' | 'brown' | 'green' | 'black' | 'red' | 'white' | null;
  title: string | null;
};

const okTime = (iso: string | null, now: Date) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t) || t > now.getTime() + MIN) return null;
  return t;
};

/** 서버 기록을 앱의 기록 입력으로 — 앞으로의 때나 범위 밖 숫자는 버리고, 모자라면 complete 가 false(그 입력 시트에서 마저 적는다) */
export function inputsFromServer(records: ServerRecord[], now: Date): ParsedInput[] {
  const out: ParsedInput[] = [];
  for (const r of records) {
    const start = okTime(r.startAt, now);
    const end = okTime(r.endAt, now);
    const mins = r.minutes !== null && r.minutes > 0 && r.minutes <= 16 * 60 ? Math.round(r.minutes) : null;
    if (r.kind === 'routine' && r.title) {
      out.push({ type: 'routine', title: r.title.trim().slice(0, 40), at: new Date(start ?? now.getTime()).toISOString() });
      continue;
    }
    if (r.kind === 'memo' && r.title) {
      out.push({ type: 'memo', text: r.title.trim().slice(0, 500), at: new Date(start ?? now.getTime()).toISOString() });
      continue;
    }
    if (r.kind === 'breast' || r.kind === 'sleep') {
      // 끝이나 걸린 시간이 있어야 지난 기록이 된다. 시작이 없으면 걸린 시간만큼 앞에서 시작해 지금 끝난 것
      const s = start ?? (mins !== null ? now.getTime() - mins * MIN : null);
      const e = end ?? (s !== null && mins !== null ? s + mins * MIN : null);
      const complete = s !== null && e !== null && e > s && e <= now.getTime() + MIN;
      const title = r.kind === 'breast' ? `모유${r.side === 'left' ? ' 왼쪽' : r.side === 'right' ? ' 오른쪽' : ''}${complete ? ` ${durationLabel((e! - s!) / MIN)}` : ''}` : `잠${complete ? ` ${durationLabel((e! - s!) / MIN)}` : ''}`;
      out.push({
        type: 'event',
        input: { kind: r.kind, side: r.kind === 'breast' ? r.side : null, startAt: new Date(s ?? now.getTime()).toISOString(), endAt: complete ? new Date(e!).toISOString() : null },
        complete,
        title,
      });
      continue;
    }
    if (r.kind === 'formula') {
      const ok = r.amount !== null && r.amount >= 1 && r.amount <= 400;
      out.push({ type: 'event', input: { kind: 'formula', amount: ok ? Math.round(r.amount!) : null, startAt: new Date(start ?? now.getTime()).toISOString() }, complete: ok, title: ok ? `분유 ${Math.round(r.amount!)}ml` : '분유' });
      continue;
    }
    if (r.kind === 'diaper') {
      const title = r.diaper === 'both' ? '소변, 대변' : r.diaper === 'poo' ? '대변' : r.diaper === 'pee' ? '소변' : '기저귀';
      out.push({
        type: 'event',
        input: { kind: 'diaper', diaper: r.diaper, color: r.diaper && r.diaper !== 'pee' ? r.color : null, startAt: new Date(start ?? now.getTime()).toISOString() },
        complete: r.diaper !== null,
        title,
      });
      continue;
    }
    if (r.kind === 'temp' || r.kind === 'weight' || r.kind === 'height') {
      const range = AMOUNT_RANGE[r.kind]!;
      const ok = r.amount !== null && r.amount >= range.min && r.amount <= range.max;
      const unit = range.unit;
      const name = r.kind === 'temp' ? '체온' : r.kind === 'weight' ? '몸무게' : '키';
      out.push({ type: 'event', input: { kind: r.kind, amount: ok ? r.amount : null, startAt: new Date(start ?? now.getTime()).toISOString() }, complete: ok, title: ok ? `${name} ${r.amount}${unit}` : name });
    }
  }
  return out;
}

/**
 * 서버가 안 될 때 — 「~고」, 「하고」, 쉼표로 나눠 규칙으로 하나씩 읽는다. 앞쪽에만 때가 있으면(「10분 전에 …갈고 …먹였어」) 뒤쪽도 그 때로 본다.
 * 다 읽은 기록만 돌려준다.
 */
export function splitRecords(text: string, now: Date): ParsedInput[] {
  const parts = text
    .split(/(?<=\S)고\s+|하고\s+|그리고\s+|,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  const out: ParsedInput[] = [];
  let firstAt: string | null = null;
  parts.forEach((p, i) => {
    const r = parseAdd(p, now);
    if (r?.type !== 'record' || !r.complete) return;
    const own = r.input.startAt && Math.abs(new Date(r.input.startAt).getTime() - now.getTime()) > MIN;
    if (i === 0 && own) firstAt = r.input.startAt ?? null;
    const input = !own && firstAt && r.kind !== 'breast' && r.kind !== 'sleep' ? { ...r.input, startAt: firstAt } : r.input;
    out.push({ type: 'event', input, complete: true, title: r.title });
  });
  return out;
}
