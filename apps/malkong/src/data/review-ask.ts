/**
 * 스토어 리뷰를 언제 물을지 (SPEC-MY-09, task my/010) — 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/review-ask.test.ts`).
 *
 * 「좋은 순간」(루틴을 그날 모두 완료 · 할 일 완료 · 발달 체크 「했어요」)이 쌓이면 폰의 기본 별점 창을 띄운다.
 * 처음 쓰기 시작한 지 며칠은 지나야 하고, 한 번 띄우면 한동안 쉰다. 실제로 보일지는 운영체제가 한 번 더 정한다(아이폰은 1년에 3번까지).
 */

export type ReviewState = {
  /** 아기 생일을 넣고 처음 연 때(ISO) */
  firstSeen: string | null;
  /** 지난번 물은 뒤 쌓인 좋은 순간 */
  happy: number;
  /** 지난번 별점 창을 띄운 때(ISO) */
  lastAsked: string | null;
};

export const REVIEW_RULES = {
  /** 처음 연 지 이만큼 지나야 — 온보딩 날 묻지 않는다 */
  minDays: 3,
  /** 좋은 순간이 이만큼 쌓여야 */
  minHappy: 5,
  /** 한 번 띄우면 이만큼 쉰다 */
  gapDays: 120,
};

const DAY = 86_400_000;

export function shouldAskReview(state: ReviewState, now = new Date()): boolean {
  if (!state.firstSeen) return false;
  if (now.getTime() - new Date(state.firstSeen).getTime() < REVIEW_RULES.minDays * DAY) return false;
  if (state.happy < REVIEW_RULES.minHappy) return false;
  if (state.lastAsked && now.getTime() - new Date(state.lastAsked).getTime() < REVIEW_RULES.gapDays * DAY) return false;
  return true;
}
