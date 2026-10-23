/// <reference types="node" />
/**
 * 장보기 묶음 시험 — `node --test src/data/shop-lists.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ONLINE, buyAgain, isOnlineShop, lastTrips, placeOf, shopPlaces, toBuyGroups } from './shop-lists.ts';
import type { Todo, Topic } from './todos.ts';

const T = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();
const shop: Topic = { id: 'tp-shop', kind: 'shopping', title: '장보기', hidden: false, sort: 0, icon: null, createdAt: T(1), updatedAt: T(1) };
const item = (id: string, o: Partial<Todo> = {}): Todo => ({
  id,
  topicId: shop.id,
  title: id,
  note: null,
  dueAt: null,
  hasTime: false,
  buy: true,
  source: 'manual',
  doneAt: null,
  repeat: null,
  ref: null,
  orderedAt: null,
  arriveAt: null,
  store: null,
  doneBy: null,
  createdAt: T(1),
  updatedAt: T(1),
  ...o,
});

test('쿠팡 · 컬리 같은 온라인 쇼핑몰은 온라인 묶음으로 — 이름은 그대로 남는다(task common/026)', () => {
  assert.equal(isOnlineShop('쿠팡'), true);
  assert.equal(isOnlineShop(' 마켓 컬리 '), true);
  assert.equal(isOnlineShop('ssg'), true);
  assert.equal(isOnlineShop('다이소'), false);
  const wipes = item('물티슈', { store: '쿠팡' });
  const box = item('수납함', { store: '다이소' });
  assert.equal(placeOf(wipes), ONLINE);
  assert.equal(placeOf(box), '다이소');
  assert.equal(wipes.store, '쿠팡');
  // 살 곳 칩에 「쿠팡」이 따로 생기지 않고, 묶음은 매장 → 온라인
  const todos = [wipes, box];
  const places = shopPlaces(shop, todos);
  assert.equal(places.includes('쿠팡'), false);
  assert.deepEqual(
    toBuyGroups(todos, places).map((g) => [g.place, g.items.map((t) => t.id)]),
    [
      ['다이소', ['수납함']],
      [ONLINE, ['물티슈']],
    ],
  );
});

test('다시 담기 — 오늘 산 것은 「완료」에만, 지난 날 산 것은 다시 담기에', () => {
  const today = new Date(2026, 9, 22, 15);
  const todos = [
    item('분유', { doneAt: T(22, 11), store: '마트' }),
    item('기저귀', { doneAt: T(18), store: '마트' }),
    item('물티슈'),
  ];
  assert.deepEqual(
    buyAgain(shop, todos, 10, today).map((x) => x.title),
    ['기저귀'],
  );
});

test('지난번 목록 — 온라인 쇼핑몰에서 산 것은 매장 장보기로 묶지 않는다', () => {
  const todos = [
    item('a', { doneAt: T(20, 11), store: '쿠팡' }),
    item('b', { doneAt: T(20, 12), store: '쿠팡' }),
    item('c', { doneAt: T(20, 11), store: '다이소' }),
    item('d', { doneAt: T(20, 12), store: '다이소' }),
  ];
  assert.deepEqual(
    lastTrips(shop, todos).map((x) => x.place),
    ['다이소'],
  );
});
