/// <reference types="node" />
/**
 * 기록 찾기 시험 — `node --test src/data/find-parse.test.ts`. 기준 시각은 2026-11-02(월) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeEvent, type CareEvent, type EventInput } from './events.ts';
import { parseFind, runFind } from './find-parse.ts';

const NOW = new Date(2026, 10, 2, 14, 20);
const at = (h: number, m = 0, day = 2) => new Date(2026, 10, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));

const events = (): CareEvent[] => [
  ev({ kind: 'breast', side: 'left', startAt: at(18, 20, 1), endAt: at(18, 40, 1), by: '엄마' }),
  ev({ kind: 'formula', startAt: at(21, 0, 1), amount: 100, by: '아빠' }),
  ev({ kind: 'sleep', startAt: at(21, 10, 1), endAt: at(2, 0) }),
  ev({ kind: 'breast', side: 'left', startAt: at(2, 5), endAt: at(2, 20) }),
  ev({ kind: 'breast', side: 'right', startAt: at(5, 50), endAt: at(6, 12) }),
  ev({ kind: 'diaper', diaper: 'poo', startAt: at(6, 20) }),
  ev({ kind: 'formula', startAt: at(8, 30), amount: 120 }),
  ev({ kind: 'diaper', diaper: 'pee', startAt: at(8, 40) }),
  ev({ kind: 'sleep', startAt: at(12, 50), endAt: at(13, 40) }),
];

test('어젯밤에 몇 번 먹었어 — 어제 18시부터 오늘 6시, 수유 횟수와 나눠 본 줄', () => {
  const q = parseFind('어젯밤에 몇 번 먹었어?', NOW);
  assert.equal(q?.what, 'feed');
  assert.equal(q?.range.key, 'lastNight');
  assert.equal(q?.range.label, '어제 18:00 ~ 오늘 06:00');
  const a = runFind(q!, events(), NOW);
  assert.equal(a.big, '4번');
  assert.equal(a.line, '모유 3번, 분유 1번');
  assert.equal(a.rows.length, 4);
  assert.equal(a.rows[0].title, '모유 22분');
});

test('오늘 분유 얼마나 — 양 합계', () => {
  const a = runFind(parseFind('오늘 분유 얼마나 먹었어', NOW)!, events(), NOW);
  assert.equal(a.big, '120ml');
});

test('마지막 대변 언제야 — 최근 30일의 마지막 때', () => {
  const q = parseFind('마지막 대변 언제야?', NOW)!;
  assert.equal(q.measure, 'last');
  assert.equal(runFind(q, events(), NOW).big, '오늘 06:20');
});

test('오늘 몇 시간 잤어 — 오늘에 걸친 잠만', () => {
  const a = runFind(parseFind('오늘 몇 시간 잤어?', NOW)!, events(), NOW);
  assert.equal(a.big, '2시간 50분');
});

test('기록 이름이 없으면 못 읽는다', () => {
  assert.equal(parseFind('오늘 날씨 어때', NOW), null);
});
