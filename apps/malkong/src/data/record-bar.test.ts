/// <reference types="node" />
/**
 * 기록 단추 줄 시험 — `node --test src/data/record-bar.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrangeBar, barAfterEdit, barFromText, barToText, DEFAULT_BAR, moveKey, startersFor } from './record-bar.ts';

test('처음에는 수유 · 기저귀 · 잠 넷과 루틴, 체온은 추가할 수 있는 단추', () => {
  const { shown, more } = arrangeBar(DEFAULT_BAR, ['rt-a', 'rt-b']);
  assert.deepEqual(shown, ['breast', 'formula', 'diaper', 'sleep', 'routine:rt-a', 'routine:rt-b']);
  assert.deepEqual(more, ['temp', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack']);
});

test('편집한 순서와 뺀 단추 — 새로 만든 루틴은 줄 끝에, 지운 루틴은 빠진다', () => {
  const saved = barAfterEdit(['routine:rt-b', 'formula', 'sleep', 'temp'], ['rt-a', 'rt-b']);
  assert.deepEqual(saved.hidden, ['breast', 'diaper', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack', 'routine:rt-a']);
  const s = barFromText(barToText(saved));
  assert.deepEqual(arrangeBar(s, ['rt-a', 'rt-b', 'rt-c']).shown, ['routine:rt-b', 'formula', 'sleep', 'temp', 'routine:rt-c']);
  assert.deepEqual(arrangeBar(s, ['rt-a']).shown, ['formula', 'sleep', 'temp']);
  assert.deepEqual(arrangeBar(s, ['rt-a']).more, ['breast', 'diaper', 'solid', 'pumped', 'pump', 'milk', 'water', 'snack', 'routine:rt-a']);
  // 옛 설정에 없던 기록 종류는 저절로 보이지 않는다 — 처음 넷과 루틴만 줄 끝에 붙는다
  assert.deepEqual(arrangeBar({ order: ['formula'], hidden: [] }, ['rt-a']).shown, ['formula', 'breast', 'diaper', 'sleep', 'routine:rt-a']);
  assert.deepEqual(barFromText('{깨짐'), DEFAULT_BAR);
  assert.deepEqual(barFromText(null), DEFAULT_BAR);
});

test('끌어서 옮기기와 아직 루틴이 아닌 단추', () => {
  assert.deepEqual(moveKey(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveKey(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveKey(['a', 'b'], 1, 9), ['a', 'b']);
  assert.deepEqual(
    startersFor(['목 욕', '밤잠 준비']).map((s) => s.title),
    ['터미타임', '놀이', '병원', '투약', '기타'],
  );
});
