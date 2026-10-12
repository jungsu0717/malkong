/**
 * 기록 알림의 때 — 아기 월령의 공공 기준에 맞춰 앱이 정한다(SPEC-LOG-05, Julian 2026-10-12: 「큰 묶음만 켜고 끄고,
 * 시간은 월령 기준으로 자동」). 부모가 시간을 고르지 않는다. 알림 화면에는 어떤 기준으로 보내는지만 작게 적는다.
 *
 * - 수유: 그 월령의 수유 간격 기준을 넘으면. 기준 문장은 승인된 L1 이 있을 때만 출처와 함께 말하고, 없으면 「월령에 맞춘 기본값」
 * - 기저귀: 공공 기준이 없어 월령에 맞춘 기본값
 * - 잠: 우리 아기가 평소 깨어 있던 시간(기록이 셋 이상), 아니면 월령 기본값(event-summary)
 * - 체온: 매일 아침 · 저녁
 */

import { defaultAwakeMinutes, durationLabel, usualAwakeMinutes } from './event-summary';
import type { CareEvent } from './events';
import { itemById } from './l1';

export type ReminderRule = { minutes: number; basis: string };

export type ReminderPlan = {
  feed: ReminderRule;
  diaper: ReminderRule;
  sleep: ReminderRule;
  /** 매일 알리는 시 — 아침 · 저녁 */
  tempHours: number[];
};

export const TEMP_HOURS = [8, 20];

/** 월령 띠마다의 수유 알림 — 기준 간격의 위쪽 끝에서 알린다. L1 id 는 기준 문장을 말할 근거 */
const FEED_BANDS: { upTo: number; minutes: number; l1: string | null; words: string }[] = [
  { upTo: 1, minutes: 180, l1: 'k-feed-0001', words: '하루 8~12번 먹는 시기' },
  { upTo: 5, minutes: 240, l1: 'k-feed-0201', words: '보통 3~4시간마다 먹는 시기' },
  { upTo: 11, minutes: 240, l1: 'k-feed-0604', words: '하루 5~6번 먹는 시기' },
  { upTo: Infinity, minutes: 240, l1: null, words: '' },
];

const DEFAULT_BASIS = '월령에 맞춘 기본값';

export function reminderPlan(month: number, events: CareEvent[], now = new Date()): ReminderPlan {
  const band = FEED_BANDS.find((b) => month <= b.upTo)!;
  const source = band.l1 ? itemById(band.l1) : undefined;
  const usualAwake = usualAwakeMinutes(events, now);
  return {
    feed: { minutes: band.minutes, basis: source ? `${band.words}, ${source.source.name}` : DEFAULT_BASIS },
    diaper: { minutes: month < 6 ? 180 : 240, basis: DEFAULT_BASIS },
    sleep: {
      minutes: usualAwake ?? defaultAwakeMinutes(month),
      basis: usualAwake ? '우리 아기가 평소 깨어 있던 시간' : DEFAULT_BASIS,
    },
    tempHours: TEMP_HOURS,
  };
}

const hourLabel = (h: number) => (h < 12 ? `오전 ${h === 0 ? 12 : h}시` : `오후 ${h === 12 ? 12 : h - 12}시`);

/** 알림 화면의 작은 글 — 무엇을 어떤 기준으로 보내는지 */
export function planLines(plan: ReminderPlan): string[] {
  return [
    `수유: 마지막 수유 뒤 ${durationLabel(plan.feed.minutes)} (${plan.feed.basis})`,
    `기저귀: 마지막 기저귀 뒤 ${durationLabel(plan.diaper.minutes)} (${plan.diaper.basis})`,
    `잠: 깬 뒤 ${durationLabel(plan.sleep.minutes)} 동안 잠 기록이 없으면 (${plan.sleep.basis})`,
    `체온: 매일 ${plan.tempHours.map(hourLabel).join(', ')}`,
    '기록이 사흘 비면: 그날 저녁 8시에 한 번',
  ];
}
