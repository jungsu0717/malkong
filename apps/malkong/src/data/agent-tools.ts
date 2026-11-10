/**
 * 물어보기 에이전트의 앱 기능 실행 (decisions/043, task today/026).
 *
 * 기능 목록은 서버의 `server/app/domain/agent/tools.json` 하나다. 서버는 그 목록으로 모델 지시문과 답 모양을 만들고,
 * 모델은 한 번 호출에서 쓸 기능과 값만 고른다(type tools). 앱은 여기서 같은 이름의 기능을 기기 안의 모든 기록으로 실행하고
 * 숫자와 답 문장을 쓴다 — 모델이 쓴 글은 보이지 않는다(헌장 13). 보는 날 밖의 기록은 밖으로 나가지 않는다.
 * 두 쪽이 맞는지는 `agent-tools.test.ts` 가 tools.json 을 읽어 본다.
 */

import { compareAnswer, daySummaryAnswer, findTerms, wakeFor, whoFor, type LocalAnswer, type LocalData } from './ask-local.ts';
import { answerFor, copula, valueText } from './ask.ts';
import { feedSessions, hhmm, nextFeedGuess, usualFeedGap } from './day-flow.ts';
import { durationLabel, startOfDay } from './event-summary.ts';
import type { CareEvent } from './events.ts';
import { rangeOf, readWhat, runFind, WHAT_LABEL, type FindMeasure, type FindRange, type FindRangeKey, type FindWhat } from './find-parse.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** 서버가 돌려주는 기능 한 줄 — 칸은 tools.json 의 args */
export type ToolCall = {
  tool: string;
  what?: string | null;
  range?: string | null;
  rangeB?: string | null;
  measure?: string | null;
  sleep?: string | null;
  day?: string | null;
  when?: string | null;
  name?: string | null;
};

/** 앱이 실행하는 기능 이름 — tools.json 과 같아야 한다(시험) */
export const TOOL_NAMES = [
  'total',
  'average',
  'last',
  'compare_ranges',
  'compare_previous',
  'feed_gap',
  'wake',
  'who',
  'find_name',
  'day_summary',
  'day_draft',
  'write_diary',
  'show_week',
] as const;

/** 앱이 받는 값 — tools.json 의 args values 와 같아야 한다(시험) */
export const TOOL_VALUES: Record<string, readonly string[]> = {
  what: ['feed', 'formula', 'breast', 'diaper', 'pee', 'poo', 'sleep', 'nap', 'night', 'temp', 'weight', 'height'],
  range: ['today', 'yesterday', 'lastNight', 'tonight', 'thisWeek', 'lastWeek', 'recent7', 'recent30'],
  rangeB: ['today', 'yesterday', 'lastNight', 'tonight', 'thisWeek', 'lastWeek', 'recent7', 'recent30'],
  measure: ['count', 'amount', 'duration'],
  sleep: ['any', 'nap', 'night'],
  day: ['today', 'yesterday', 'viewing'],
  when: ['today', 'yesterday', 'viewing', 'last'],
};

export type ToolEnv = { data: LocalData; viewDay: Date; now: Date; selected: CareEvent | null };
export type ToolResult = { kind: 'answer'; answer: LocalAnswer } | { kind: 'action'; action: 'draft' | 'diary' | 'week' };

const ok = (v: string | null | undefined, arg: string): v is string => !!v && (TOOL_VALUES[arg]?.includes(v) ?? false);
const was = (w: string) => (copula(w) === '이에요' ? '이었어요' : '였어요');
const topic = (w: string) => `${w}${copula(w) === '이에요' ? '은' : '는'}`;

/** 기능 하나 실행 — 모르는 기능이나 맞지 않는 값이면 null */
export function runTool(call: ToolCall, env: ToolEnv): ToolResult | null {
  const { data, viewDay, now, selected } = env;
  const events = data.events;
  const answer = (a: LocalAnswer | { text: string; keys: string[]; label: string } | null): ToolResult | null => (a ? { kind: 'answer', answer: { text: a.text, keys: a.keys, label: a.label } } : null);
  const what = call.what as FindWhat;
  switch (call.tool) {
    case 'total':
    case 'average': {
      if (!ok(call.what, 'what') || !ok(call.range, 'range') || !ok(call.measure, 'measure')) return null;
      return answer(answerFor({ what, range: rangeOf(call.range as FindRangeKey, now), measure: call.measure as FindMeasure }, events, now, 0, call.tool === 'average'));
    }
    case 'last':
      if (!ok(call.what, 'what')) return null;
      return answer(answerFor({ what, range: rangeOf('recent30', now), measure: 'last' }, events, now));
    case 'compare_ranges':
      if (!ok(call.what, 'what') || !ok(call.range, 'range') || !ok(call.rangeB, 'rangeB') || !ok(call.measure, 'measure')) return null;
      return answer(compareRanges(what, call.measure as FindMeasure, call.range as FindRangeKey, call.rangeB as FindRangeKey, events, now));
    case 'compare_previous':
      if (!ok(call.what, 'what')) return null;
      return answer(compareAnswer('', events, selected, now, what) ?? { text: '견줄 앞 기록이 없어요.', keys: [], label: '' });
    case 'feed_gap':
      return answer(feedGapAnswer(events, now));
    case 'wake':
      if (!ok(call.sleep, 'sleep')) return null;
      return answer(wakeFor(call.sleep as 'any' | 'nap' | 'night', events, now));
    case 'who':
      if (!ok(call.what, 'what')) return null;
      return answer(whoFor(what, rangeOf('recent7', now), events, now));
    case 'find_name': {
      const name = (call.name ?? '').trim().toLowerCase();
      if (!name || name.length > 20 || !ok(call.when, 'when')) return null;
      return answer(findTerms([name], call.when === 'last' ? null : dayOf(call.when as string, viewDay, now), data, now));
    }
    case 'day_summary':
      if (!ok(call.day, 'day')) return null;
      return answer(daySummaryAnswer(call.day === 'today' ? '오늘' : call.day === 'yesterday' ? '어제' : '', data, viewDay, now));
    case 'day_draft':
      return { kind: 'action', action: 'draft' };
    case 'write_diary':
      return { kind: 'action', action: 'diary' };
    case 'show_week':
      return { kind: 'action', action: 'week' };
    default:
      return null;
  }
}

function dayOf(when: string, viewDay: Date, now: Date): Date {
  const today = startOfDay(now);
  if (when === 'today') return today;
  if (when === 'yesterday') return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return startOfDay(viewDay);
}

/** 범위 안에서 지금까지 지난 날 수 */
const daysIn = (r: FindRange, now: Date) => Math.max(1, Math.ceil((Math.min(r.to, now.getTime()) - r.from) / DAY));

/**
 * 두 기간 견주기 — 여러 날이면 하루 평균끼리, 오늘과 지난 하루면 같은 시각까지.
 * 「이번 주 낮잠은 하루 평균 2시간 10분, 지난주는 2시간 40분이에요. 지난주보다 30분 줄었어요.」
 */
export function compareRanges(what: FindWhat, measure: FindMeasure, a: FindRangeKey, b: FindRangeKey, events: CareEvent[], now: Date): LocalAnswer {
  // 이번 주와 견주는 「지난주」는 달력의 지난주(월요일부터 일요일) — 찾기 규칙의 lastWeek(오늘 앞 7일)는 이번 주와 겹친다
  const today = startOfDay(now).getTime();
  const monday = today - ((new Date(today).getDay() + 6) % 7) * DAY;
  const range = (k: FindRangeKey): FindRange => (k === 'lastWeek' ? { key: 'lastWeek', from: monday - 7 * DAY, to: monday, label: '지난주' } : rangeOf(k, now));
  const ra = range(a);
  let rb = range(b);
  const single = (r: FindRange) => r.to - r.from <= DAY + 60 * MIN;
  const sameTime = a === 'today' && single(rb) && b !== 'today';
  if (sameTime) rb = { ...rb, to: rb.from + (now.getTime() - startOfDay(now).getTime()) };
  const fa = runFind({ what, range: ra, measure }, events, now);
  const fb = runFind({ what, range: rb, measure }, events, now);
  const va = fa.rows.length ? fa.value : null;
  const vb = fb.rows.length ? fb.value : null;
  const unit = va?.unit ?? vb?.unit;
  const label = WHAT_LABEL[what];
  const both = `${ra.label}${copula(ra.label) === '이에요' ? '과' : '와'} ${rb.label}`;
  if (!unit) return { text: `${both} 모두 ${label} 기록이 없어요.`, keys: [], label: '' };
  const multi = !single(ra) || !single(rb);
  const per = (n: number, r: FindRange) => (multi ? n / daysIn(r, now) : n);
  // 한쪽에만 기록이 있으면 견주지 않고 있는 쪽만 — 「하루 평균 0분」처럼 보이지 않게
  if (!va || !vb) {
    const [has, r, none] = va ? [va, ra, rb] : [vb as NonNullable<typeof vb>, rb, ra];
    const v = valueText(per(has.n, r), unit);
    return { text: `${topic(none.label)} ${label} 기록이 없어요. ${topic(r.label)} ${multi ? '하루 평균 ' : ''}${v}${r === ra ? copula(v) : was(v)}.`, keys: [], label: '' };
  }
  const x = per(va?.n ?? 0, ra);
  const y = per(vb?.n ?? 0, rb);
  const fx = valueText(x, unit);
  const fy = valueText(y, unit);
  const head = multi
    ? `${ra.label} ${topic(label)} 하루 평균 ${fx}, ${topic(rb.label)} ${fy}${copula(fy)}.`
    : sameTime
      ? `${ra.label} ${topic(label)} 지금까지 ${fx}, ${rb.label} 이 시각까지는 ${fy}${was(fy)}.`
      : `${ra.label} ${topic(label)} ${fx}, ${topic(rb.label)} ${fy}${copula(fy)}.`;
  const d = x - y;
  const fd = valueText(Math.abs(d), unit);
  const same = fd === valueText(0, unit);
  const tail = same ? '거의 같아요.' : `${rb.label}보다 ${fd} ${d > 0 ? '늘었어요' : '줄었어요'}.`;
  return { text: `${head} ${tail}`, keys: [], label: '' };
}

/** 수유 간격 — 「최근 사흘 수유 간격은 3시간쯤이에요. 마지막 수유(13:30 분유 140ml)에서 50분 지났어요. 다음은 16:30쯤이에요.」 */
export function feedGapAnswer(events: CareEvent[], now: Date): LocalAnswer {
  const last = feedSessions(events).filter((s) => new Date(s.startAt).getTime() <= now.getTime()).pop();
  if (!last) return { text: '수유 기록이 없어요.', keys: [], label: '' };
  const gap = usualFeedGap(events, now);
  const ago = Math.max(1, Math.round((now.getTime() - new Date(last.startAt).getTime()) / MIN));
  const title = last.kind === 'formula' ? `분유 ${Math.round(last.parts[0].amount ?? 0)}ml` : '모유';
  const lines: string[] = [];
  if (gap !== null) {
    const g = durationLabel(gap);
    lines.push(`최근 사흘 수유 간격은 ${g}쯤이에요.`);
  } else lines.push('최근 사흘 기록으로는 수유 간격을 셀 수 없어요.');
  if (ago < 24 * 60) lines.push(`마지막 수유(${hhmm(last.startAt)} ${title})에서 ${durationLabel(ago)} 지났어요.`);
  const guess = nextFeedGuess(events, now);
  if (guess && guess.at.getTime() > now.getTime()) lines.push(`다음은 ${hhmm(guess.at.getTime())}쯤이에요.`);
  return { text: lines.join(' '), keys: [last.id], label: '마지막 수유' };
}

// --- 모델 없이 고르는 기능과 카드(decisions/044) ---
// 질문은 모델로 보내지 않는다. 앱 규칙이 기능을 고르고, 뜻이 여럿이면 「어떤 걸 알려 드릴까요?」 카드로 묻는다.

/** 문장의 기간 낱말 — 앞에 있는 것부터. 서버의 ranges_in(service.py)과 같은 규칙 */
const RANGE_WORDS: [FindRangeKey, RegExp][] = [
  ['lastNight', /어젯밤|어제\s*밤|지난\s*밤/g],
  ['tonight', /오늘\s*밤/g],
  ['thisWeek', /이번\s*주/g],
  ['lastWeek', /지난\s*주|저번\s*주/g],
  ['recent7', /최근\s*(일주일|7일)|요즘\s*일주일/g],
  ['recent30', /한\s*달|30일/g],
  ['yesterday', /어제/g],
  ['today', /오늘/g],
];

export function rangesIn(text: string): FindRangeKey[] {
  const taken: [number, number][] = [];
  const found: [number, FindRangeKey][] = [];
  for (const [key, re] of RANGE_WORDS) {
    for (const m of text.matchAll(re)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      if (taken.some(([x, y]) => a < y && x < b)) continue;
      taken.push([a, b]);
      found.push([a, key]);
    }
  }
  return [...new Set(found.sort((x, y) => x[0] - y[0]).map(([, k]) => k))];
}

/** 견줄 기간을 말하지 않았을 때 — 서버의 _RANGE_B 와 같다 */
const RANGE_B: Partial<Record<FindRangeKey, FindRangeKey>> = { today: 'yesterday', thisWeek: 'lastWeek', recent7: 'lastWeek', tonight: 'lastNight' };
const COMPARE_WORDS = /줄었|늘었|많이|적게|덜 |더 |길어|짧아|많아|적어|길었|짧았|비교|차이/;

function measureOf(text: string, what: FindWhat): FindMeasure {
  if (/몇\s*번|자주|횟수/.test(text)) return 'count';
  if (/ml|미리|양|얼마나\s*먹/.test(text) || what === 'formula') return 'amount';
  if (what === 'sleep' || what === 'nap' || what === 'night' || what === 'breast') return 'duration';
  return 'count';
}

export type LocalIntent = { kind: 'run'; call: ToolCall } | { kind: 'choose'; calls: ToolCall[] };

/**
 * 질문에서 기능 고르기 — 두 기간 견주기, 기간 없는 견주기(카드로 묻는다), 수유 간격. 해당하지 않으면 null.
 * 「이번 주 낮잠이 지난주보다 줄었어?」 → compare_ranges, 「낮잠 줄었어?」 → 카드 셋, 「요즘 몇 시간마다 먹어?」 → feed_gap
 */
export function localIntent(text: string): LocalIntent | null {
  if (/몇\s*시간\s*마다|간격|텀이/.test(text) && !/낮잠|밤잠|잠|기저귀|대변|소변/.test(text)) return { kind: 'run', call: { tool: 'feed_gap' } };
  if (!COMPARE_WORDS.test(text)) return null;
  const what = readWhat(text) ?? (/먹|맘마/.test(text) ? 'feed' : null);
  if (!what) return null;
  const measure = measureOf(text, what);
  const ranges = rangesIn(text);
  if (ranges.length >= 2) return { kind: 'run', call: { tool: 'compare_ranges', what, measure, range: ranges[0], rangeB: ranges[1] } };
  if (ranges.length === 1 && RANGE_B[ranges[0]]) return { kind: 'run', call: { tool: 'compare_ranges', what, measure, range: ranges[0], rangeB: RANGE_B[ranges[0]] } };
  if (ranges.length) return null;
  // 기간이 없으면 뜻이 여럿이다 — 이번 주와 지난주, 오늘과 어제, 방금 것과 그 앞 것
  const calls: ToolCall[] = [
    { tool: 'compare_ranges', what, measure, range: 'thisWeek', rangeB: 'lastWeek' },
    { tool: 'compare_ranges', what, measure, range: 'today', rangeB: 'yesterday' },
  ];
  if (['feed', 'formula', 'breast', 'sleep', 'nap', 'night'].includes(what)) calls.push({ tool: 'compare_previous', what });
  return { kind: 'choose', calls };
}

/** 못 알아들은 질문에 보일 것 셋 — 문장에 나온 기록 종류에 맞춰 */
export function suggestFor(text: string): ToolCall[] {
  const what = readWhat(text);
  if (what === 'sleep' || what === 'nap' || what === 'night') {
    return [
      { tool: 'wake', sleep: what === 'nap' ? 'nap' : what === 'night' ? 'night' : 'any' },
      { tool: 'total', what, range: 'today', measure: 'duration' },
      { tool: 'compare_ranges', what, measure: 'duration', range: 'thisWeek', rangeB: 'lastWeek' },
    ];
  }
  if (what === 'feed' || what === 'formula' || what === 'breast') {
    return [{ tool: 'last', what }, { tool: 'feed_gap' }, { tool: 'compare_ranges', what, measure: measureOf(text, what), range: 'today', rangeB: 'yesterday' }];
  }
  if (what === 'diaper' || what === 'pee' || what === 'poo') {
    return [{ tool: 'last', what }, { tool: 'total', what, range: 'today', measure: 'count' }, { tool: 'who', what }];
  }
  if (what) return [{ tool: 'last', what }, { tool: 'day_summary', day: 'today' }, { tool: 'show_week' }];
  return [
    { tool: 'day_summary', day: 'today' },
    { tool: 'compare_ranges', what: 'sleep', measure: 'duration', range: 'thisWeek', rangeB: 'lastWeek' },
    { tool: 'feed_gap' },
  ];
}

const RANGE_WORD: Record<string, string> = {
  today: '오늘',
  yesterday: '어제',
  lastNight: '어젯밤',
  tonight: '오늘 밤',
  thisWeek: '이번 주',
  lastWeek: '지난주',
  recent7: '최근 일주일',
  recent30: '최근 한 달',
};
const and = (w: string) => `${w}${copula(w) === '이에요' ? '과' : '와'}`;

export type ToolTile = 'sleep' | 'feed' | 'diaper' | 'doc';
export type ToolLabel = { title: string; sub: string; tile: ToolTile };

/** 카드 한 줄의 글 — 앱이 쓴다(모델이 쓴 글은 보이지 않는다, 헌장 13) */
export function toolLabel(call: ToolCall): ToolLabel {
  const what = (call.what ?? 'feed') as FindWhat;
  const name = WHAT_LABEL[what];
  const tile: ToolTile = ['sleep', 'nap', 'night'].includes(what) ? 'sleep' : ['diaper', 'pee', 'poo'].includes(what) ? 'diaper' : ['feed', 'formula', 'breast'].includes(what) ? 'feed' : 'doc';
  const a = RANGE_WORD[call.range ?? ''] ?? '';
  const b = RANGE_WORD[call.rangeB ?? ''] ?? '';
  switch (call.tool) {
    case 'compare_ranges': {
      const multi = !['today', 'yesterday', 'lastNight', 'tonight'].includes(call.range ?? '') || !['today', 'yesterday', 'lastNight', 'tonight'].includes(call.rangeB ?? '');
      const sub = multi ? '하루 평균으로 비교해요' : call.range === 'today' ? '지금 시각까지 비교해요' : '하루 합계로 비교해요';
      return { title: `${and(a)} ${b} ${name}`, sub, tile };
    }
    case 'compare_previous':
      return { title: `방금 ${and(name)} 그 앞 ${name}`, sub: what === 'formula' ? '먹은 양으로 비교해요' : tile === 'sleep' ? '잔 시간으로 비교해요' : '한 번씩 비교해요', tile };
    case 'total':
      return { title: `${a} ${name}`, sub: call.measure === 'duration' ? '모두 몇 시간인지와 평소' : call.measure === 'amount' ? '모두 얼마나 먹었는지와 평소' : '몇 번인지와 평소', tile };
    case 'average':
      return { title: `${a} ${name} 하루 평균`, sub: '여러 날의 하루 평균', tile };
    case 'last':
      return { title: `마지막 ${name}`, sub: '언제였는지와 지난 시간', tile };
    case 'feed_gap':
      return { title: '요즘 수유 간격', sub: '최근 사흘 간격과 다음 수유 예상', tile: 'feed' };
    case 'wake':
      return { title: call.sleep === 'nap' ? '낮잠에서 깬 시각' : call.sleep === 'night' ? '아침에 깬 시각' : '마지막으로 깬 시각', sub: '깬 시각과 잔 시간', tile: 'sleep' };
    case 'who':
      return { title: `마지막 ${name}${copula(name) === '이에요' ? '을' : '를'} 남긴 사람`, sub: '가족과 함께 쓸 때 적혀요', tile };
    case 'find_name':
      return { title: `「${call.name ?? ''}」 기록`, sub: '했는지와 마지막 때', tile: 'doc' };
    case 'day_summary':
      return { title: `${RANGE_WORD[call.day ?? ''] ?? '그날'} 하루 요약`, sub: '수유, 기저귀, 잠과 루틴', tile: 'doc' };
    case 'day_draft':
      return { title: '오늘 하루 기록 초안', sub: '평소 시각으로 채워요', tile: 'doc' };
    case 'write_diary':
      return { title: '메모 쓰기', sub: '그날 기록을 보며 써요', tile: 'doc' };
    case 'show_week':
      return { title: '일주일 보기', sub: '7일을 한눈에', tile: 'doc' };
    default:
      return { title: call.tool, sub: '', tile: 'doc' };
  }
}
