/**
 * 앱이 거는 알림의 내용과 때 (SPEC-TOPIC-09 · SPEC-SHOP-04, task topic/006) — 무엇을 언제 알릴지만 계산한다. 거는 것은 notifications.ts.
 *
 * - 아침 알림: 날짜마다 그날 할 일 제목 + 그날 도착 예정인 살 것 + 지금 기간인 접종 · 검진. 반복 할 일은 「손톱 깎기(마지막 7일 전)」
 * - 전날 저녁: 기한이 내일인 할 일(매일 · 매주 반복과 장보기는 빼고) — 저녁 8시
 * - 받으셨나요: 도착 예정일 저녁 7시에 아직 배송 중인 살 것
 * 앱이 스스로 거는 알림은 낮 시간에만 둔다(사용자가 시각을 정한 할 일 알림은 정한 시각 그대로, 헌장 6).
 *
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/alert-plan.test.ts`).
 */

import type { Todo } from './todos.ts';

const DAY_MS = 86_400_000;
export const EVENING_HOUR = 20;
export const DELIVERY_CHECK_HOUR = 19;

const key = (title: string) => title.replace(/\s+/g, '');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 기한 가까운 순, 기한 없는 것은 뒤에 */
function byDue(a: Todo, b: Todo): number {
  if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/** 같은 주제 · 같은 제목을 마지막으로 완료한 지 며칠 — 반복 할 일에만 쓴다. 한 적이 없으면 null */
export function daysSinceDone(todo: Todo, todos: Todo[], now = new Date()): number | null {
  const k = key(todo.title);
  const last = todos
    .filter((t) => t.doneAt && t.topicId === todo.topicId && key(t.title) === k)
    .map((t) => t.doneAt as string)
    .sort()
    .pop();
  if (!last) return null;
  return Math.round((startOfDay(now).getTime() - startOfDay(new Date(last)).getTime()) / DAY_MS);
}

/** 알림 목록의 한 줄 — 반복 할 일은 「손톱 깎기(마지막 7일 전)」 */
export function listTitle(todo: Todo, todos: Todo[], now = new Date()): string {
  const days = todo.repeat ? daysSinceDone(todo, todos, now) : null;
  return days && days > 0 ? `${todo.title}(마지막 ${days}일 전)` : todo.title;
}

/** 시각을 정한 할 일 알림의 본문 — 반복 할 일은 「마지막으로 한 지 7일 지났어요」, 그 밖에는 null */
export function reminderBody(todo: Todo, todos: Todo[], now = new Date()): string | null {
  const days = todo.repeat ? daysSinceDone(todo, todos, now) : null;
  return days && days > 0 ? `마지막으로 한 지 ${days}일 지났어요` : null;
}

export type DayPlan = { day: Date; titles: string[] };

/**
 * 아침 알림 — 오늘부터 `count` 일. 그날 할 일 = 안 끝낸 것 중 기한이 그날까지인 것(지난 것 포함, 배송 중인 살 것은 빼고)
 * + 그날 도착 예정인 살 것 + `checkups`(지금 기간인 접종 · 검진 이름, 날마다 같이).
 */
export function morningPlan(todos: Todo[], checkups: string[], now = new Date(), count = 7): DayPlan[] {
  const open = todos.filter((t) => !t.doneAt && t.dueAt && !t.orderedAt).sort(byDue);
  const shipping = todos.filter((t) => !t.doneAt && t.orderedAt && t.arriveAt);
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(now, i);
    const end = addDays(now, i + 1).toISOString();
    const start = day.toISOString();
    const titles = open.filter((t) => (t.dueAt as string) < end).map((t) => listTitle(t, todos, day));
    const arriving = shipping.filter((t) => (t.arriveAt as string) >= start && (t.arriveAt as string) < end).map((t) => `${t.title} 도착 예정`);
    return { day, titles: [...new Set([...titles, ...arriving, ...checkups])] };
  });
}

/**
 * 전날 저녁 미리 — 오늘 저녁부터 `count` 번. 그 저녁의 다음 날이 기한인 안 끝낸 할 일.
 * 매일 · 매주 반복(늘 하는 일)과 `skipTopicIds`(장보기)는 뺀다.
 */
export function eveningPlan(todos: Todo[], skipTopicIds: Set<string>, now = new Date(), count = 7): DayPlan[] {
  const list = todos
    .filter((t) => !t.doneAt && t.dueAt && !skipTopicIds.has(t.topicId))
    .filter((t) => !t.repeat || (t.repeat.kind !== 'daily' && t.repeat.kind !== 'weekly'))
    .filter((t) => !(t.repeat?.kind === 'every' && t.repeat.days <= 7))
    .sort(byDue);
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(now, i);
    const from = addDays(now, i + 1).toISOString();
    const to = addDays(now, i + 2).toISOString();
    return { day, titles: [...new Set(list.filter((t) => (t.dueAt as string) >= from && (t.dueAt as string) < to).map((t) => t.title))] };
  });
}

/** 받으셨나요 — 도착 예정일 저녁 7시에 아직 배송 중인 살 것. 이미 지난 때는 뺀다 */
export function deliveryChecks(todos: Todo[], now = new Date()): { id: string; title: string; at: Date }[] {
  return todos
    .filter((t) => !t.doneAt && t.orderedAt && t.arriveAt)
    .map((t) => {
      const d = new Date(t.arriveAt as string);
      return { id: t.id, title: t.title, at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), DELIVERY_CHECK_HOUR) };
    })
    .filter((x) => x.at.getTime() > now.getTime());
}
