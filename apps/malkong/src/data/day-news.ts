/**
 * 오늘 아기 소식 (SPEC-LOG-06, task log/004) — 그날 기록을 가족에게 보낼 카드 한 장의 내용으로 묶는다.
 *
 * 수유 · 잠 · 기저귀 합계와 그날 남긴 메모 한 줄(발달 체크 · 오늘의 놀이도 메모다). 밖으로 나가는 그림이라
 * 아기 이름과 체온 · 변 색 같은 건강 신호는 넣지 않는다. 모두 기기 안에서 센다(모델을 부르지 않는다).
 */

import { durationLabel, startOfDay, statsBetween } from './event-summary.ts';
import type { CareEvent } from './events.ts';
import { dayNumber, type Memo } from './stage.ts';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 카드에 넣는 메모 길이 — 넘으면 줄임표 */
const NOTE_MAX = 40;

export type NewsStat = { label: string; value: string; sub: string | null };

export type DayNews = {
  /** 「10월 30일 금요일」 */
  dateText: string;
  /** 「함께한 지 101일」 */
  daysText: string;
  /** 수유 · 잠 · 기저귀 가운데 그날 있었던 것만, 이 순서로 */
  stats: NewsStat[];
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
  const s = statsBetween(events, from, to, now);
  const stats: NewsStat[] = [];
  if (s.feeds > 0) stats.push({ label: '수유', value: `${s.feeds}번`, sub: s.formulaMl > 0 ? `분유 ${Math.round(s.formulaMl)}ml` : null });
  if (s.sleepMin >= 1) stats.push({ label: '잠', value: durationLabel(s.sleepMin), sub: null });
  if (s.diapers > 0) stats.push({ label: '기저귀', value: `${s.diapers}번`, sub: null });

  const inDay = memos
    .filter((m) => {
      const t = new Date(m.at).getTime();
      return t >= from.getTime() && t < to.getTime();
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  const last = inDay[inDay.length - 1]?.text.trim() ?? '';
  const note = last ? (last.length > NOTE_MAX ? `${last.slice(0, NOTE_MAX - 1)}…` : last) : null;

  if (stats.length === 0 && !note) return null;
  return {
    dateText: `${from.getMonth() + 1}월 ${from.getDate()}일 ${WEEKDAYS[from.getDay()]}요일`,
    daysText: `함께한 지 ${dayNumber(birthDate, from)}일`,
    stats,
    note,
  };
}
