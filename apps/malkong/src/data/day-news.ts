/**
 * 오늘 아기 소식 (SPEC-LOG-06, task log/004 · log/009) — 그날 기록을 가족에게 보낼 그림 한 장의 내용으로 묶는다.
 *
 * 하루 24시간 고리에 놓을 잠 구간과 수유 · 기저귀 시각, 수유 · 잠 · 기저귀 합계, 그날 남긴 메모 한 줄(발달 체크 · 오늘의 놀이도 메모다).
 * 밖으로 나가는 그림이라 아기 이름과 체온 · 변 색 같은 건강 신호는 넣지 않는다. 모두 기기 안에서 센다(모델을 부르지 않는다).
 */

import { feedSessions } from './day-flow.ts';
import { startOfDay, statsBetween } from './event-summary.ts';
import type { CareEvent } from './events.ts';
import { dayNumber, type Memo } from './stage.ts';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const HOUR = 60 * 60 * 1000;
/** 카드에 넣는 메모 길이 — 넘으면 줄임표 */
const NOTE_MAX = 40;

export type NewsStats = { feeds: number; formulaMl: number; sleepMin: number; diapers: number };

/** 24시간 고리에 놓을 것 — 모두 그날 0시부터 몇 시(0~24, 소수) */
export type DayRing = {
  /** 잠 구간 — 그날에 걸친 만큼만(자정을 넘긴 잠은 잘라서) */
  sleeps: { from: number; to: number }[];
  /** 수유 한 번(쪽을 바꾼 모유는 하나)의 시작 */
  feeds: number[];
  diapers: number[];
};

export type DayNews = {
  /** 「10월 30일 금요일」 */
  dateText: string;
  /** 「함께한 지 101일」 */
  daysText: string;
  stats: NewsStats;
  ring: DayRing;
  /** 그날 마지막으로 남긴 메모 — 없으면 null */
  note: string | null;
};

/**
 * 그날의 소식 — 수유 · 잠 · 기저귀가 하나도 없고 메모도 없으면 null(보낼 것이 없다).
 * 잠은 그날에 걸친 만큼만 센다(자정을 넘긴 밤잠은 나눠 센다).
 */
export function dayNews(events: CareEvent[], memos: Memo[], birthDate: string, day: Date, now = new Date()): DayNews | null {
  const from = startOfDay(day);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  const a = from.getTime();
  const b = to.getTime();
  const s = statsBetween(events, from, to, now);
  const stats: NewsStats = { feeds: s.feeds, formulaMl: Math.round(s.formulaMl), sleepMin: Math.round(s.sleepMin), diapers: s.diapers };

  const hour = (t: number) => (t - a) / HOUR;
  const ring: DayRing = { sleeps: [], feeds: [], diapers: [] };
  for (const e of events) {
    const start = new Date(e.startAt).getTime();
    if (e.kind === 'sleep') {
      const end = e.endAt ? new Date(e.endAt).getTime() : now.getTime();
      const f = Math.max(start, a);
      const t = Math.min(end, b);
      if (t > f) ring.sleeps.push({ from: hour(f), to: hour(t) });
    } else if (e.kind === 'diaper' && start >= a && start < b) ring.diapers.push(hour(start));
  }
  for (const f of feedSessions(events)) {
    const start = new Date(f.startAt).getTime();
    if (start >= a && start < b) ring.feeds.push(hour(start));
  }
  ring.sleeps.sort((x, y) => x.from - y.from);
  ring.feeds.sort((x, y) => x - y);
  ring.diapers.sort((x, y) => x - y);

  const inDay = memos
    .filter((m) => {
      const t = new Date(m.at).getTime();
      return t >= a && t < b;
    })
    .sort((x, y) => x.at.localeCompare(y.at));
  const last = inDay[inDay.length - 1]?.text.trim() ?? '';
  const note = last ? (last.length > NOTE_MAX ? `${last.slice(0, NOTE_MAX - 1)}…` : last) : null;

  if (stats.feeds === 0 && stats.sleepMin < 1 && stats.diapers === 0 && !note) return null;
  return {
    dateText: `${from.getMonth() + 1}월 ${from.getDate()}일 ${WEEKDAYS[from.getDay()]}요일`,
    daysText: `함께한 지 ${dayNumber(birthDate, from)}일`,
    stats,
    ring,
    note,
  };
}
