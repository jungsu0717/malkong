/**
 * 다가오는 일(앱이 채운 아기 일정)을 날짜로 나누는 셈 (SPEC-MAIN-08 · SPEC-TOPIC-02, task today/007).
 *
 * 줄을 만드는 일은 기기 DB · 공공 일정을 읽어야 해서 baby-schedule.tsx 의 `useBabyRows` 에 있고,
 * 여기에는 시험할 수 있는 셈만 둔다 — D-day 글, 홈 머리의 「이번 주 챙길 일」, 홈 카드에 보일 줄.
 */

export const DAY = 86_400_000;
/** 「이번 주」는 달력의 주가 아니라 오늘부터 7일 안 */
const WEEK_DAYS = 7;
/** 홈 카드는 이번 주 것이 적어도 이만큼 보이고 */
const HOME_MIN = 3;
/** 많아도 이만큼까지 */
const HOME_MAX = 6;

/** 「오늘」 「D-3」 — 지난 날이면 null */
export function ddayText(at: number, today: number): string | null {
  const days = Math.round((at - today) / DAY);
  if (days < 0) return null;
  return days === 0 ? '오늘' : `D-${days}`;
}

/** 이번 주 챙길 일 — 지금 기간인 것, 기한이 7일 안인 것, 기한이 지났는데 아직 안 한 것. 줄은 날짜순으로 받는다 */
export function thisWeek<T extends { at: number }>(rows: T[], today: number): T[] {
  return rows.filter((r) => r.at < today + WEEK_DAYS * DAY);
}

/** 홈 「다가오는 일」 카드에 보일 줄 — 이번 주 것은 모두, 적어도 세 줄, 많아도 여섯 줄 */
export function homeRows<T extends { at: number }>(rows: T[], today: number): T[] {
  const week = thisWeek(rows, today).length;
  return rows.slice(0, Math.min(HOME_MAX, Math.max(HOME_MIN, week)));
}
