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
import { rangeOf, runFind, WHAT_LABEL, type FindMeasure, type FindRange, type FindRangeKey, type FindWhat } from './find-parse.ts';

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
  const va = runFind({ what, range: ra, measure }, events, now).value;
  const vb = runFind({ what, range: rb, measure }, events, now).value;
  const unit = va?.unit ?? vb?.unit;
  const label = WHAT_LABEL[what];
  if (!unit) return { text: `${ra.label}와 ${rb.label} 모두 ${label} 기록이 없어요.`, keys: [], label: '' };
  const multi = !single(ra) || !single(rb);
  const per = (n: number, r: FindRange) => (multi ? n / daysIn(r, now) : n);
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
