/// <reference types="node" />
/**
 * 알림 내용과 때 시험 — `node --test src/data/alert-plan.test.ts`. 기준 시각은 2026-10-15(목) 14:00.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysSinceDone, deliveryChecks, eveningPlan, listTitle, morningPlan, reminderBody } from './alert-plan.ts';
import type { Todo } from './todos.ts';

const NOW = new Date(2026, 9, 15, 14, 0);
const iso = (mo: number, d: number, h = 0) => new Date(2026, mo - 1, d, h).toISOString();
let n = 0;
function todo(title: string, o: Partial<Todo> = {}): Todo {
  n += 1;
  return {
    id: `t${n}`,
    topicId: 'mine',
    title,
    note: null,
    dueAt: null,
    hasTime: false,
    buy: false,
    source: 'manual',
    doneAt: null,
    repeat: null,
    ref: null,
    orderedAt: null,
    arriveAt: null,
    store: null,
    createdAt: iso(10, 1),
    updatedAt: iso(10, 1),
    ...o,
  };
}

test('반복 할 일은 지난번부터 며칠 만인지', () => {
  const nails = todo('손톱 깎기', { dueAt: iso(10, 15), repeat: { kind: 'every', days: 7 } });
  const todos = [todo('손톱 깎기', { doneAt: iso(10, 8, 21) }), nails];
  assert.equal(daysSinceDone(nails, todos, NOW), 7);
  assert.equal(listTitle(nails, todos, NOW), '손톱 깎기(7일 만)');
  assert.equal(reminderBody(nails, todos, NOW), '7일 만이에요');
  // 반복이 아니거나 한 적이 없으면 그대로
  const once = todo('택배 반품', { dueAt: iso(10, 15) });
  assert.equal(listTitle(once, [once], NOW), '택배 반품');
  assert.equal(reminderBody(nails, [nails], NOW), null);
});

test('아침 알림 — 그날 할 일, 도착 예정, 접종 · 검진', () => {
  const todos = [
    todo('분유 주문', { dueAt: iso(10, 15) }),
    todo('택배 반품', { dueAt: iso(10, 16) }),
    todo('기저귀 4단계', { topicId: 'shop', orderedAt: iso(10, 14), arriveAt: iso(10, 16) }),
    todo('끝낸 것', { dueAt: iso(10, 15), doneAt: iso(10, 15, 9) }),
  ];
  const plan = morningPlan(todos, ['4개월 접종'], NOW, 3);
  assert.deepEqual(plan[0].titles, ['분유 주문', '4개월 접종']);
  // 다음 날 — 어제 것이 안 끝났으면 그대로 남고, 도착 예정이 붙는다
  assert.deepEqual(plan[1].titles, ['분유 주문', '택배 반품', '기저귀 4단계 도착 예정', '4개월 접종']);
  assert.deepEqual(plan[2].titles, ['분유 주문', '택배 반품', '4개월 접종']);
});

test('전날 저녁 — 내일 기한, 늘 하는 반복과 장보기는 빼고', () => {
  const todos = [
    todo('100일 촬영 예약', { dueAt: iso(10, 16) }),
    todo('젖병 소독', { dueAt: iso(10, 16), repeat: { kind: 'daily' } }),
    todo('손톱 깎기', { dueAt: iso(10, 16), repeat: { kind: 'every', days: 7 } }),
    todo('분유 주문', { dueAt: iso(10, 16), repeat: { kind: 'monthly', day: 16 } }),
    todo('세제', { topicId: 'shop', dueAt: iso(10, 16) }),
    todo('택배 반품', { dueAt: iso(10, 17) }),
  ];
  const plan = eveningPlan(todos, new Set(['shop']), NOW, 2);
  assert.deepEqual(plan[0].titles, ['100일 촬영 예약', '분유 주문']);
  assert.deepEqual(plan[1].titles, ['택배 반품']);
});

test('받으셨나요 — 도착 예정일 저녁 7시, 지난 때는 빼고', () => {
  const todos = [
    todo('기저귀', { orderedAt: iso(10, 14), arriveAt: iso(10, 15) }),
    todo('물티슈', { orderedAt: iso(10, 14), arriveAt: iso(10, 14) }),
    todo('세제', { orderedAt: iso(10, 14) }),
    todo('받은 것', { orderedAt: iso(10, 14), arriveAt: iso(10, 16), doneAt: iso(10, 15) }),
  ];
  const checks = deliveryChecks(todos, NOW);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].title, '기저귀');
  assert.equal(checks[0].at.getHours(), 19);
});
