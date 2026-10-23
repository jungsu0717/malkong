/**
 * 장보기 묶음 계산 (SPEC-SHOP-01~03) — 살 것 · 배송 중 · 완료, 살 곳, 다시 담기.
 * db 를 가져오지 않는 순수 함수만 둔다(`node --test src/data/shop-lists.test.ts`). todos.ts 가 다시 내보낸다.
 */

import type { Todo, Topic } from './todos.ts';

/** 같은 할 일인지 볼 때 — 띄어쓰기를 뺀 제목 */
export const titleKey = (title: string) => title.replace(/\s+/g, '');

/** 끝낸 것 — 최근에 끝낸 순 */
export function sortDone(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
}

/** 장보기 탭의 세 묶음(SPEC-SHOP-01~03) — 살 것(주문 전) · 배송 중(주문했고 아직 안 받음) · 완료(최근 순) */
export function shopLists(shop: Topic | undefined, todos: Todo[]): { toBuy: Todo[]; shipping: Todo[]; done: Todo[] } {
  const list = shop ? todos.filter((t) => t.topicId === shop.id) : [];
  return {
    toBuy: list.filter((t) => !t.doneAt && !t.orderedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    shipping: list
      .filter((t) => !t.doneAt && t.orderedAt)
      .sort((a, b) => (a.arriveAt ?? '9').localeCompare(b.arriveAt ?? '9') || (a.orderedAt ?? '').localeCompare(b.orderedAt ?? '')),
    done: sortDone(list.filter((t) => t.doneAt)),
  };
}

/** 살 곳 — 「온라인」 묶음에만 「주문 완료」가 있다(SPEC-SHOP-01 · 02) */
export const ONLINE = '온라인';
/** 처음부터 있는 살 곳 — 상호는 넣지 않는다. 다이소 같은 곳은 사용자가 한 번 적으면 칩으로 남는다 */
const DEFAULT_PLACES = ['마트', ONLINE];

/**
 * 잘 알려진 온라인 쇼핑몰 — 「쿠팡에서 물티슈」처럼 적으면 매장이 아니라 온라인 묶음에 넣어 「주문 완료 → 배송 중」을 쓰게 한다(task common/026).
 * 쇼핑몰 이름은 store 에 그대로 남아 「쿠팡 · 내일 도착 예정」으로 보인다. 짧고 흔한 이름만 둔다
 */
const ONLINE_SHOPS = new Set(
  ['쿠팡', '네이버', '네이버쇼핑', '스마트스토어', '컬리', '마켓컬리', '11번가', 'G마켓', '지마켓', '옥션', 'SSG', '쓱', '쓱닷컴', '오아시스', '위메프', '티몬', '알리', '알리익스프레스', '테무'].map(
    (n) => n.toLowerCase(),
  ),
);

export function isOnlineShop(name: string | null | undefined): boolean {
  return !!name && ONLINE_SHOPS.has(name.replace(/\s+/g, '').toLowerCase());
}

/** 살 것의 살 곳 — 주문한 것과 온라인 쇼핑몰에서 살 것은 「온라인」(store 에는 쇼핑몰 이름이 들어 있을 수 있다) */
export const placeOf = (t: Todo): string | null => {
  const store = t.store?.trim() || null;
  return t.orderedAt || isOnlineShop(store) ? ONLINE : store;
};

/** 살 곳 칩 — 사용자가 쓴 곳(최근 순)과 기본(마트 · 온라인) */
export function shopPlaces(shop: Topic | undefined, todos: Todo[], limit = 8): string[] {
  const list = shop ? todos.filter((t) => t.topicId === shop.id) : [];
  const used = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(placeOf);
  const places: string[] = [];
  for (const p of [...used, ...DEFAULT_PLACES]) if (p && !places.includes(p)) places.push(p);
  return places.slice(0, limit);
}

/** 살 것을 살 곳별로 — 매장(칩 순서) → 온라인 → 살 곳을 안 정한 것 */
export function toBuyGroups(toBuy: Todo[], places: string[]): { place: string | null; items: Todo[] }[] {
  const order = [...places.filter((p) => p !== ONLINE), ONLINE];
  for (const t of toBuy) {
    const p = placeOf(t);
    if (p && !order.includes(p)) order.splice(order.length - 1, 0, p);
  }
  const groups = order.map((place) => ({ place: place as string | null, items: toBuy.filter((t) => placeOf(t) === place) }));
  groups.push({ place: null, items: toBuy.filter((t) => !placeOf(t)) });
  return groups.filter((g) => g.items.length > 0);
}

/**
 * 다시 담기 — 지난번 산 것 중 지금 살 것 · 배송 중에 없는 것, 최근 순으로 `limit` 개. 살 곳도 함께.
 * 오늘 산 것은 뺀다 — 방금 산 물건이 「완료」와 「다시 담기」에 함께 보이지 않게(task common/026)
 */
export function buyAgain(shop: Topic | undefined, todos: Todo[], limit = 10, today = new Date()): { title: string; place: string | null }[] {
  const { toBuy, shipping, done } = shopLists(shop, todos);
  const now = new Set([...toBuy, ...shipping].map((t) => titleKey(t.title)));
  const boughtToday = new Set(done.filter((t) => new Date(t.doneAt as string).toDateString() === today.toDateString()).map((t) => titleKey(t.title)));
  const seen = new Set<string>();
  const items: { title: string; place: string | null }[] = [];
  for (const t of done) {
    const key = titleKey(t.title);
    if (now.has(key) || boughtToday.has(key) || seen.has(key)) continue;
    seen.add(key);
    items.push({ title: t.title, place: placeOf(t) });
    if (items.length >= limit) break;
  }
  return items;
}

/**
 * 지난번 목록 다시 담기(SPEC-SHOP-03) — 매장마다 마지막으로 장 본 날 함께 산 것(둘 이상) 중 지금 목록에 없는 것.
 * 이유식 재료처럼 늘 같이 사는 묶음을 한 번에 담는다. 온라인 주문은 뺀다
 */
export function lastTrips(shop: Topic | undefined, todos: Todo[]): { place: string; titles: string[] }[] {
  const { toBuy, shipping, done } = shopLists(shop, todos);
  const now = new Set([...toBuy, ...shipping].map((t) => titleKey(t.title)));
  const day = (iso: string) => iso.slice(0, 10);
  const trips: { place: string; titles: string[] }[] = [];
  const offline = done.filter((t) => placeOf(t) !== ONLINE && t.store?.trim());
  for (const place of [...new Set(offline.map((t) => (t.store as string).trim()))]) {
    const atPlace = offline.filter((t) => (t.store as string).trim() === place);
    const lastDay = day(atPlace[0].doneAt as string);
    const titles = [...new Set(atPlace.filter((t) => day(t.doneAt as string) === lastDay).map((t) => t.title))].filter(
      (title) => !now.has(titleKey(title)),
    );
    if (titles.length >= 2) trips.push({ place, titles });
  }
  return trips;
}

/** 주문할 때 「주문한 곳」 칩 — 사용자가 전에 적은 쇼핑몰 이름, 최근 순. 앱이 쇼핑몰 이름을 미리 넣지 않는다 */
export function recentStores(todos: Todo[], limit = 6): string[] {
  const seen = new Set<string>();
  return [...todos]
    .filter((t) => t.store && t.orderedAt && t.store.trim() !== ONLINE)
    .sort((a, b) => (b.orderedAt ?? '').localeCompare(a.orderedAt ?? ''))
    .map((t) => (t.store as string).trim())
    .filter((s) => s && !seen.has(s) && seen.add(s))
    .slice(0, limit);
}
