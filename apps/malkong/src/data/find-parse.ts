/**
 * 기록 찾기 (SPEC-MAIN-13, task today/016, 헌장 13) — 「어젯밤에 몇 번 먹었어?」를 무엇 · 언제 · 어떻게로 읽고, 답은 기기 안 기록에서 직접 센다.
 *
 * 모델 없이 규칙으로 읽는다. 답의 숫자는 늘 이 파일이 기록에서 센 값이다 — 지어낸 문장을 내보내지 않는다.
 * 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/find-parse.test.ts`).
 */

import { feedSessions, isNightStart, type FeedSession } from './day-flow.ts';
import { durationLabel, minutesOf } from './event-summary.ts';
import type { CareEvent } from './events.ts';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const t = (iso: string) => new Date(iso).getTime();

export type FindWhat = 'feed' | 'formula' | 'breast' | 'diaper' | 'pee' | 'poo' | 'sleep' | 'nap' | 'night' | 'temp' | 'weight' | 'height';
export type FindRangeKey = 'today' | 'yesterday' | 'lastNight' | 'tonight' | 'thisWeek' | 'lastWeek' | 'recent7' | 'recent30' | 'recentN' | 'date';
export type FindRange = { key: FindRangeKey; from: number; to: number; label: string };
export type FindMeasure = 'count' | 'amount' | 'duration' | 'last';
export type FindQuery = { what: FindWhat; range: FindRange; measure: FindMeasure };

export const WHAT_LABEL: Record<FindWhat, string> = {
  feed: '수유',
  formula: '분유',
  breast: '모유',
  diaper: '기저귀',
  pee: '소변',
  poo: '대변',
  sleep: '잠',
  nap: '낮잠',
  night: '밤잠',
  temp: '체온',
  weight: '몸무게',
  height: '키',
};
export const WHAT_CHOICES: FindWhat[] = ['feed', 'formula', 'breast', 'diaper', 'poo', 'sleep', 'nap', 'temp', 'weight', 'height'];
export const RANGE_CHOICES: FindRangeKey[] = ['today', 'yesterday', 'lastNight', 'recent7', 'recent30'];

const dateLabel = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 언제 — 이름과 [from, to) */
export function rangeOf(key: FindRangeKey, now = new Date(), n = 7, date: number | null = null): FindRange {
  const D0 = startOfDay(now);
  const nowMs = now.getTime();
  switch (key) {
    case 'today':
      return { key, from: D0, to: nowMs, label: '오늘' };
    case 'yesterday':
      return { key, from: D0 - DAY, to: D0, label: '어제' };
    case 'lastNight':
      return { key, from: D0 - 6 * HOUR, to: Math.min(nowMs, D0 + 6 * HOUR), label: '어제 18:00 ~ 오늘 06:00' };
    case 'tonight':
      return { key, from: D0 + 18 * HOUR, to: nowMs, label: '오늘 18:00부터' };
    case 'thisWeek': {
      const monday = D0 - ((new Date(D0).getDay() + 6) % 7) * DAY;
      return { key, from: monday, to: nowMs, label: '이번 주' };
    }
    case 'lastWeek':
      return { key, from: D0 - 7 * DAY, to: D0, label: `${dateLabel(D0 - 7 * DAY)} ~ ${dateLabel(D0 - DAY)}` };
    case 'recent7':
      return { key, from: D0 - 6 * DAY, to: nowMs, label: '최근 7일' };
    case 'recent30':
      return { key, from: D0 - 29 * DAY, to: nowMs, label: '최근 30일' };
    case 'recentN':
      return { key, from: D0 - (n - 1) * DAY, to: nowMs, label: `최근 ${n}일` };
    case 'date': {
      const from = date ?? D0;
      return { key, from, to: Math.min(from + DAY, nowMs), label: dateLabel(from) };
    }
  }
}

function readWhat(text: string): FindWhat | null {
  if (/분유/.test(text)) return 'formula';
  if (/모유|젖/.test(text)) return 'breast';
  if (/수유|먹었|먹였|먹은/.test(text)) return 'feed';
  if (/대변|응가|똥/.test(text)) return 'poo';
  if (/소변|쉬/.test(text)) return 'pee';
  if (/기저귀/.test(text)) return 'diaper';
  if (/낮잠/.test(text)) return 'nap';
  if (/밤잠/.test(text)) return 'night';
  if (/잠|잤|재웠/.test(text)) return 'sleep';
  if (/체온|열/.test(text)) return 'temp';
  if (/몸무게|체중/.test(text)) return 'weight';
  if (/키|신장/.test(text)) return 'height';
  return null;
}

function readRange(text: string, now: Date, what: FindWhat): FindRange {
  if (/어젯밤|어제\s*밤|지난밤/.test(text)) return rangeOf('lastNight', now);
  if (/오늘\s*밤|오늘밤/.test(text)) return rangeOf('tonight', now);
  if (/어제/.test(text)) return rangeOf('yesterday', now);
  if (/지난\s*주/.test(text)) return rangeOf('lastWeek', now);
  if (/이번\s*주/.test(text)) return rangeOf('thisWeek', now);
  const recent = /(?:최근|지난)\s*(\d{1,2})\s*일/.exec(text);
  if (recent) return rangeOf('recentN', now, Math.min(60, Math.max(1, Number(recent[1]))));
  if (/한\s*달|30일/.test(text)) return rangeOf('recent30', now);
  const md = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text);
  if (md) {
    let d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2])).getTime();
    if (d > now.getTime()) d = new Date(now.getFullYear() - 1, Number(md[1]) - 1, Number(md[2])).getTime();
    return rangeOf('date', now, 7, d);
  }
  if (/오늘/.test(text)) return rangeOf('today', now);
  // 마지막을 묻거나 키 · 몸무게는 최근 30일, 그 밖에는 오늘
  return /언제|마지막/.test(text) || what === 'weight' || what === 'height' ? rangeOf('recent30', now) : rangeOf('today', now);
}

function readMeasure(text: string, what: FindWhat): FindMeasure {
  if (/언제|마지막|몇\s*시에/.test(text)) return 'last';
  if (/몇\s*번|횟수|몇\s*회/.test(text)) return 'count';
  if (/몇\s*(ml|미리|cc)|얼마나\s*먹|양/.test(text) && (what === 'formula' || what === 'feed')) return 'amount';
  if (/몇\s*시간|얼마나|몇\s*분/.test(text)) return what === 'formula' ? 'amount' : 'duration';
  if (what === 'temp' || what === 'weight' || what === 'height') return 'last';
  if (what === 'sleep' || what === 'nap' || what === 'night') return 'duration';
  if (what === 'formula') return 'amount';
  return 'count';
}

export function parseFind(raw: string, now = new Date()): FindQuery | null {
  const text = raw.trim();
  if (!text) return null;
  const what = readWhat(text);
  if (!what) return null;
  return { what, range: readRange(text, now, what), measure: readMeasure(text, what) };
}

/** 찾은 기록 한 줄 */
export type FindRow = { key: string; at: number; kind: CareEvent['kind']; title: string; by: string | null };
export type FindAnswer = { big: string; line: string | null; rows: FindRow[] };

const whenOf = (at: number, now: Date) => {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(at))) / DAY);
  return days === 0 ? `오늘 ${hm(new Date(at))}` : days === 1 ? `어제 ${hm(new Date(at))}` : `${dateLabel(at)} ${hm(new Date(at))}`;
};

function feedRow(s: FeedSession, now: Date): FindRow {
  const min = s.parts.reduce((sum, p) => sum + minutesOf(p, now), 0);
  const title = s.kind === 'formula' ? `분유 ${Math.round(s.parts[0].amount ?? 0)}ml` : `모유 ${durationLabel(min)}`;
  return { key: s.id, at: t(s.startAt), kind: s.kind, title, by: s.by };
}

/** 답 — 큰 숫자, 나눠 본 한 줄, 그 기록 목록(최근 것부터) */
export function runFind(q: FindQuery, events: CareEvent[], now = new Date()): FindAnswer {
  const { from, to } = q.range;
  const inRange = (at: number) => at >= from && at < to;
  const rows: FindRow[] = [];
  let big = '';
  let line: string | null = null;

  if (q.what === 'feed' || q.what === 'formula' || q.what === 'breast') {
    const sessions = feedSessions(events).filter((s) => inRange(t(s.startAt)) && (q.what === 'feed' || s.kind === q.what));
    rows.push(...sessions.map((s) => feedRow(s, now)));
    const formula = sessions.filter((s) => s.kind === 'formula');
    const breast = sessions.filter((s) => s.kind === 'breast');
    const ml = formula.reduce((sum, s) => sum + (s.parts[0].amount ?? 0), 0);
    const min = breast.reduce((sum, s) => sum + s.parts.reduce((a, p) => a + minutesOf(p, now), 0), 0);
    if (q.measure === 'last') {
      big = sessions.length ? whenOf(t(sessions[sessions.length - 1].startAt), now) : '없어요';
      line = sessions.length ? rows[rows.length - 1].title : null;
    } else if (q.measure === 'amount' && q.what !== 'breast') {
      big = `${Math.round(ml)}ml`;
      line = `분유 ${formula.length}번`;
    } else if (q.measure === 'duration' && q.what !== 'formula') {
      big = durationLabel(min);
      line = `모유 ${breast.length}번`;
    } else {
      big = `${sessions.length}번`;
      line = q.what === 'feed' ? `모유 ${breast.length}번, 분유 ${formula.length}번` : q.what === 'formula' ? `${Math.round(ml)}ml` : durationLabel(min);
    }
  } else if (q.what === 'diaper' || q.what === 'pee' || q.what === 'poo') {
    const list = events.filter(
      (e) =>
        e.kind === 'diaper' &&
        inRange(t(e.startAt)) &&
        (q.what === 'diaper' || (q.what === 'pee' ? e.diaper === 'pee' || e.diaper === 'both' : e.diaper === 'poo' || e.diaper === 'both')),
    );
    rows.push(...list.map((e) => ({ key: e.id, at: t(e.startAt), kind: e.kind, title: e.diaper === 'pee' ? '소변' : e.diaper === 'poo' ? '대변' : '소변, 대변', by: e.by })));
    const pee = list.filter((e) => e.diaper === 'pee' || e.diaper === 'both').length;
    const poo = list.filter((e) => e.diaper === 'poo' || e.diaper === 'both').length;
    if (q.measure === 'last') {
      big = list.length ? whenOf(t(list[list.length - 1].startAt), now) : '없어요';
      line = null;
    } else {
      big = `${list.length}번`;
      line = q.what === 'diaper' ? `소변 ${pee}번, 대변 ${poo}번` : null;
    }
  } else if (q.what === 'sleep' || q.what === 'nap' || q.what === 'night') {
    const list = events.filter((e) => {
      if (e.kind !== 'sleep') return false;
      const a = t(e.startAt);
      const b = e.endAt ? t(e.endAt) : now.getTime();
      if (b <= from || a >= to) return false;
      return q.what === 'sleep' || (q.what === 'night' ? isNightStart(a) : !isNightStart(a));
    });
    const minutes = list.reduce((sum, e) => {
      const a = Math.max(t(e.startAt), from);
      const b = Math.min(e.endAt ? t(e.endAt) : now.getTime(), to);
      return sum + Math.max(0, (b - a) / MIN);
    }, 0);
    rows.push(...list.map((e) => ({ key: e.id, at: t(e.startAt), kind: e.kind, title: `${isNightStart(t(e.startAt)) ? '밤잠' : '낮잠'} ${durationLabel(minutesOf(e, now))}`, by: e.by })));
    if (q.measure === 'last') {
      big = list.length ? whenOf(t(list[list.length - 1].startAt), now) : '없어요';
      line = list.length ? rows[rows.length - 1].title : null;
    } else if (q.measure === 'count') {
      big = `${list.length}번`;
      line = durationLabel(minutes);
    } else {
      big = durationLabel(minutes);
      line = `${list.length}번`;
    }
  } else {
    const kind = q.what;
    const unit = kind === 'temp' ? '℃' : kind === 'weight' ? 'kg' : 'cm';
    const list = events.filter((e) => e.kind === kind && inRange(t(e.startAt)) && e.amount !== null);
    rows.push(...list.map((e) => ({ key: e.id, at: t(e.startAt), kind: e.kind, title: `${e.amount}${unit}`, by: e.by })));
    const last = list[list.length - 1];
    if (q.measure === 'count') {
      big = `${list.length}번`;
      line = last ? `마지막 ${last.amount}${unit}` : null;
    } else {
      big = last ? `${last.amount}${unit}` : '없어요';
      line = last ? whenOf(t(last.startAt), now) : null;
    }
  }
  return { big, line, rows: rows.sort((a, b) => b.at - a.at) };
}

/** 목록 줄의 때 — 「어제 21:00」 「오늘 02:05」 */
export const findWhen = whenOf;
