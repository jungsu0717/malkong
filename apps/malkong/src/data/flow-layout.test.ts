/// <reference types="node" />
/**
 * 하루 흐름 자리 시험 — `node --test src/data/flow-layout.test.ts`. 시안(390 너비)의 숫자와 맞춘다.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flowLayout } from './flow-layout.ts';

test('묶음 틀 — 틀 위 44, 노드는 52 부터 70 간격, 이름 세 줄이라 틀 높이 158', () => {
  const g = flowLayout({
    width: 390,
    chip: true,
    parts: [
      { type: 'box', shapes: ['square', 'circle', 'square', 'square'] },
      { type: 'box', shapes: ['circle', 'square', 'square'] },
      { type: 'box', shapes: ['circle', 'square', 'dot'], now: true },
    ],
    links: ['pill', 'sleep'],
    future: 3,
  });
  assert.deepEqual(g.chip, { x: 30, y: 12, w: 132, h: 32 });
  assert.deepEqual(g.parts[0].frame, { x: 16, y: 64, w: 358, h: 158 });
  assert.deepEqual(
    g.parts[0].nodes.map((n) => n.cx),
    [52, 122, 192, 262],
  );
  assert.equal(g.parts[0].nodes[0].cy, 64 + 44 + 22);
  // 알약 56, 잠 136(이름 세 줄) — 가운데 가로선 높이에 놓인다
  assert.deepEqual(g.links[0], { kind: 'pill', cx: 195, cy: 64 + 158 + 28 });
  assert.equal(g.parts[1].frame.y, 64 + 158 + 56);
  assert.equal(g.links[1].cy, g.parts[1].frame.y + 158 + 68);
  assert.equal(g.parts[2].frame.y, g.parts[1].frame.y + 158 + 136);
  // 지금 묶음 안 선은 코랄, 앞으로 올 것은 점선
  assert.ok(g.edges.now.length > 0);
  assert.ok(g.edges.future.length > 0);
  assert.equal(g.future.length, 3);
  assert.equal(g.future[0].cy, g.parts[2].frame.y + 158 + 34 + 22);
  assert.ok(g.height > g.future[0].cy);
});

test('한 줄에 다 안 들어가면 틀 안에서 다음 줄로', () => {
  const g = flowLayout({ width: 390, chip: false, parts: [{ type: 'box', shapes: Array(7).fill('square') }], links: [], future: 0 });
  const nodes = g.parts[0].nodes;
  assert.equal(nodes[4].cx, 332);
  assert.equal(nodes[5].cx, 52);
  assert.equal(nodes[5].cy - nodes[0].cy, 114);
  assert.equal(g.parts[0].frame.h, 158 + 114);
  // 좁은 화면은 한 줄에 넷
  const narrow = flowLayout({ width: 375, chip: false, parts: [{ type: 'box', shapes: Array(5).fill('square') }], links: [], future: 0 });
  assert.equal(narrow.parts[0].nodes[4].cx, 52);
});

test('첫머리 잠 줄, 자는 중인 지금 노드, 모유 재는 중 단추 줄', () => {
  const g = flowLayout({
    width: 390,
    chip: false,
    parts: [{ type: 'sleeps', count: 1 }, { type: 'box', shapes: ['circle'], buttons: true, now: true }, { type: 'sleepNow' }],
    links: ['plain', 'plain'],
    future: 0,
  });
  assert.deepEqual(g.parts[0].nodes, [{ cx: 76, cy: 56 + 22 }]);
  assert.equal(g.parts[0].frame.h, 100);
  assert.equal(g.parts[1].frame.h, 158 + 52);
  assert.equal(g.parts[2].frame.h, 64);
  assert.equal(g.parts[2].nodes.length, 0);
  // 잠 줄에서 내려와 동그라미(왼쪽 끝 31)로 들어가고, 자는 중 노드는 틀 왼쪽 끝(16)으로
  assert.ok(g.edges.past.includes('H31M'));
  assert.ok(g.edges.past.endsWith('H16'));
});
