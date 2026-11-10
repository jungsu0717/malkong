/// <reference types="node" />
/**
 * 일기 쓰기 도우미 시험 — `node --test src/data/day-facts.test.ts`. 기준 시각은 2026-11-06(금) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appendFact, asksDiary, dayFacts, factSummary } from './day-facts.ts';
import type { RoutineDone } from './day-flow.ts';
import { makeEvent, type CareEvent, type EventInput } from './events.ts';
import { makeMemo } from './stage.ts';

const NOW = new Date(2026, 10, 6, 14, 20);
const at = (h: number, m = 0, day = 6) => new Date(2026, 10, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));

const events = [
  ev({ kind: 'sleep', startAt: at(21, 10, 5), endAt: at(6, 30) }),
  ev({ kind: 'diaper', startAt: at(7, 35), diaper: 'pee' }),
  ev({ kind: 'breast', side: 'left', startAt: at(7, 45), endAt: at(8, 0) }),
  ev({ kind: 'temp', startAt: at(9), amount: 37.2 }),
  ev({ kind: 'formula', startAt: at(10, 30), amount: 140 }),
  ev({ kind: 'diaper', startAt: at(10, 40), diaper: 'poo', color: 'yellow' }),
  ev({ kind: 'sleep', startAt: at(12), endAt: at(13, 10) }),
  ev({ kind: 'formula', startAt: at(13, 30), amount: 140 }),
  // 어제 것은 들어가지 않는다
  ev({ kind: 'formula', startAt: at(19, 0, 5), amount: 120 }),
];
const routines: RoutineDone[] = [
  { routineId: 'r1', logId: 'l1', title: '목욕', at: at(8, 30), by: null, endAt: null },
  { routineId: 'r2', logId: 'l2', title: '터미타임', at: at(9, 30), by: null, endAt: at(9, 40) },
];
const memos = [makeMemo('뒤집기', new Date(2026, 10, 6, 11), 'cdc-roll'), makeMemo('오늘 많이 웃었다', new Date(2026, 10, 6, 11, 30))];

test('그날 기록이 시간순 칩이 되고 발달 체크가 맨 앞에 온다', () => {
  const facts = dayFacts(events, routines, [], memos, NOW, NOW);
  assert.deepEqual(
    facts.map((f) => f.insert),
    [
      '뒤집기',
      '어제 21:10 밤잠 9시간 20분',
      '07:35 소변',
      '07:45 모유 15분',
      '08:30 목욕',
      '09:00 체온 37.2℃',
      '09:30 터미타임 10분',
      '10:30 분유 140ml',
      '10:40 대변',
      '12:00 낮잠 1시간 10분',
      '13:30 분유 140ml',
    ],
  );
  assert.equal(facts[0].kind, 'check');
  assert.equal(facts[0].time, null);
  assert.equal(facts[2].kind, 'pee');
  assert.equal(facts[8].kind, 'poo');
  // 사람이 쓴 메모는 칩이 아니다 — 글에 넣을 사실이 아니라 글 자체다
  assert.ok(!facts.some((f) => f.text.includes('웃었다')));
});

test('하루 합계 한 줄 — 수유 횟수와 분유 양, 그날에 걸친 잠', () => {
  assert.equal(factSummary(events, NOW, NOW), '수유 3번 280ml, 잠 7시간 40분');
  assert.equal(factSummary([], NOW, NOW), null);
});

test('칩 글자는 글 끝에 한 칸 띄워 붙는다', () => {
  assert.equal(appendFact('', '07:45 모유 15분'), '07:45 모유 15분');
  assert.equal(appendFact('아침에', '07:45 모유 15분'), '아침에 07:45 모유 15분');
  assert.equal(appendFact('아침에 ', '07:45 모유 15분'), '아침에 07:45 모유 15분');
  assert.equal(appendFact('첫 줄\n', '뒤집기'), '첫 줄\n뒤집기');
});

test('「일기 써 줘」는 메모 창을 열고, 내용이 있는 메모는 아니다', () => {
  assert.ok(asksDiary('오늘 일기 써 줘'));
  assert.ok(asksDiary('일기 작성해줘'));
  assert.ok(asksDiary('메모 써 줘'));
  assert.ok(!asksDiary('메모 적어 줘: 오늘 많이 웃었어'));
  assert.ok(!asksDiary('분유 120 먹였어'));
  assert.ok(!asksDiary('오늘 하루 기록 초안으로 작성해 줘'));
});
