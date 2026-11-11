/// <reference types="node" />
/**
 * 위쪽 기록 줄 시험 — `node --test src/data/record-bar.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrangeBar, barAfterEdit, barFromText, barToText, DEFAULT_BAR, moveKey, startersFor } from './record-bar.ts';

test('처음에는 기록 11가지가 모두 보이고, 루틴은 아랫줄에 루틴 화면 순서대로', () => {
  const l = arrangeBar(DEFAULT_BAR, ['rt-a', 'rt-b']);
  assert.deepEqual(l.kinds, ['breast', 'formula', 'diaper', 'sleep', 'temp', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack']);
  assert.deepEqual(l.routines, ['rt-a', 'rt-b']);
  assert.deepEqual(l.hiddenKinds, []);
  assert.deepEqual(l.hiddenRoutines, []);
});

test('편집한 순서와 뺀 것 — 새로 만든 루틴은 루틴 줄 끝에, 지운 루틴은 빠진다', () => {
  const saved = barAfterEdit(['formula', 'sleep', 'temp'], ['rt-b'], ['rt-a', 'rt-b']);
  assert.deepEqual(saved.hidden, ['breast', 'diaper', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack', 'routine:rt-a']);
  const s = barFromText(barToText(saved));
  assert.deepEqual(arrangeBar(s, ['rt-a', 'rt-b', 'rt-c']).kinds, ['formula', 'sleep', 'temp']);
  assert.deepEqual(arrangeBar(s, ['rt-a', 'rt-b', 'rt-c']).routines, ['rt-b', 'rt-c']);
  assert.deepEqual(arrangeBar(s, ['rt-a']).routines, []);
  assert.deepEqual(arrangeBar(s, ['rt-a']).hiddenRoutines, ['rt-a']);
  assert.deepEqual(barFromText('{깨짐'), DEFAULT_BAR);
  assert.deepEqual(barFromText(null), DEFAULT_BAR);
});

test('12판에서 저장한 설정 — 넣지 않아 뺀 것이 된 기록 종류는 다시 보이고, 처음 넷과 루틴을 뺀 것은 그대로', () => {
  // 12판은 루틴과 기록이 한 줄이었고, 넣지 않은 기록 종류를 모두 hidden 에 적었다
  const old = JSON.stringify({ order: ['routine:rt-b', 'formula', 'sleep'], hidden: ['breast', 'diaper', 'temp', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack', 'routine:rt-a'] });
  const l = arrangeBar(barFromText(old), ['rt-a', 'rt-b']);
  assert.deepEqual(l.kinds, ['formula', 'sleep', 'temp', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack']);
  assert.deepEqual(l.hiddenKinds, ['breast', 'diaper']);
  assert.deepEqual(l.routines, ['rt-b']);
  assert.deepEqual(l.hiddenRoutines, ['rt-a']);
});

test('끌어서 옮기기와 「루틴 추가」 목록', () => {
  assert.deepEqual(moveKey(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveKey(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveKey(['a', 'b'], 1, 9), ['a', 'b']);
  assert.deepEqual(
    startersFor(['목 욕', '밤잠 준비']).map((s) => s.title),
    ['터미타임', '놀이', '병원', '투약', '기타'],
  );
});
