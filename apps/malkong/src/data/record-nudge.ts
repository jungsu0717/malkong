/**
 * 기록 요청 (SPEC-BABY-07, task baby/003) — 하루 기록이 며칠 비었을 때만 묻는다.
 *
 * 날은 「마지막 하루 기록」과 「마지막으로 물은 때(건너뛰기 · 적기 · 처음 연 날)」 가운데 늦은 날부터 센다.
 * 하나도 없이 이틀이 지나면 사흘째에 묻는다 — 앱을 열면 카드, 알림은 그날 저녁 한 번.
 * 기록 하나하나가 아니라 넷 가운데 아무것이나 적었는지를 본다(decisions/016) — 손을 놓은 사람에게만 묻는다.
 * 모두 기기 안에서 센다. 서버로 보내는 것은 없다.
 */

import { lastLogAt } from './daily-log';
import type { BabyRecord } from './records';

/** 마지막 기록 뒤로 며칠째에 묻나 — 이틀 비우면 사흘째 */
export const NUDGE_AFTER_DAYS = 3;
/** 알림 시각 — 아침 브리핑 알림(오전 7~10시)과 겹치지 않게 저녁 */
export const NUDGE_HOUR = 20;

function dayAfter(from: Date, days: number, hour = 0): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, hour);
}

/** 날을 세기 시작하는 때 */
function countFrom(records: BabyRecord[], since: Date): Date {
  const last = lastLogAt(records);
  return last && last > since ? last : since;
}

/** 물을 날 0시 — 센 날부터 사흘째. 적거나 건너뛰기 전까지는 같은 날이라 알림함 줄의 열쇠로도 쓴다 */
export function nudgeDay(records: BabyRecord[], since: Date): Date {
  return dayAfter(countFrom(records, since), NUDGE_AFTER_DAYS);
}

/** 지금 물을 때인가 — 물을 날 0시가 지났으면 */
export function nudgeDue(records: BabyRecord[], since: Date, now = new Date()): boolean {
  return now >= nudgeDay(records, since);
}

/**
 * 다음 알림 시각 — 물을 날 저녁 8시. 이미 지났으면 사흘 뒤 같은 시각.
 * 한 번에 하나만 건다 — 앱을 열 때마다 다시 거니, 앱을 오래 열지 않아도 알림이 쌓이지 않는다.
 */
export function nextNudgeAt(records: BabyRecord[], since: Date, now = new Date()): Date {
  const from = countFrom(records, since);
  let days = NUDGE_AFTER_DAYS;
  let at = dayAfter(from, days, NUDGE_HOUR);
  while (at <= now) {
    days += NUDGE_AFTER_DAYS;
    at = dayAfter(from, days, NUDGE_HOUR);
  }
  return at;
}
