/// <reference types="node" />
/**
 * 하루 흐름 자리 시험 — `node --test src/data/flow-layout.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flowLayout } from './flow-layout.ts';

test('한 줄 — 잠 네모 오른쪽에 넓은 노드, 그 아래로 기록이 갈라진다', () => {
  const g = flowLayout({ width: 390, chip: true, rows: [{ sleep: 'past', wake: 'past', groups: [2, 2, 1] }, { sleep: 'past', wake: 'now', groups: [] }], future: 4 });
  const [a, b] = g.rows;
  assert.deepEqual(a.sleep, { x: 28, y: 64, w: 56, h: 56 });
  assert.equal(a.wake?.x, 124);
  assert.equal(a.wake?.w, 222);
  assert.equal(a.subs.length, 5);
  assert.equal(a.ports.length, 3);
  // 동그라미가 화면 밖으로 나가지 않는다
  for (const s of a.subs) assert.ok(s.cx + 20 <= 390 - 16);
  // 지금 노드는 더 높고, 앞 줄 아래에 온다
  assert.equal(b.wake?.h, 64);
  assert.ok(b.wake!.y > a.subs[0].cy + 40);
  assert.ok(g.edges.now.length > 0);
  // 앞으로 올 것 넷 — 한 줄에 셋, 넷째는 다음 줄
  assert.equal(g.future.length, 4);
  assert.equal(g.future[3].x, 28);
  assert.ok(g.future[3].y > g.future[0].y);
  assert.ok(g.height > g.future[3].y + 56);
});

test('잠을 안 적은 날 — 넓은 노드가 왼쪽부터, 기록이 많으면 여러 줄', () => {
  const g = flowLayout({ width: 390, chip: false, rows: [{ sleep: null, wake: 'now', groups: [8, 6] }], future: 0 });
  const row = g.rows[0];
  assert.equal(row.wake?.x, 28);
  assert.equal(row.subs.length, 14);
  const lines = new Set(row.subs.map((s) => s.cy));
  assert.ok(lines.size >= 3);
});

test('자는 중 — 지금 잠 노드가 넓게, 앞 줄에서 코랄 선으로 들어온다', () => {
  const g = flowLayout({ width: 390, chip: false, rows: [{ sleep: 'past', wake: 'past', groups: [1] }, { sleep: 'now', wake: null, groups: [] }], future: 0 });
  assert.equal(g.rows[1].sleep?.w, 390 - 28 - 44);
  assert.ok(g.edges.now.startsWith('M'));
});
