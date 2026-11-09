/// <reference types="node" />
/**
 * 물어보기 말 다루기 시험 — `node --test src/data/ask.test.ts`. 기준 시각은 2026-11-06(금) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { answerFor, copula, followUp, inputsFromServer, isHealth, isQuestion, looksMulti, queryFromServer, splitRecords } from './ask.ts';
import type { CareEvent } from './events.ts';
import { parseFind } from './find-parse.ts';

const NOW = new Date(2026, 10, 6, 14, 20);
const at = (h: number, m = 0) => new Date(2026, 10, 6, h, m).toISOString();
let n = 0;
const ev = (o: Partial<CareEvent> & Pick<CareEvent, 'kind' | 'startAt'>): CareEvent => ({
  id: `e${++n}`,
  endAt: o.startAt,
  amount: null,
  side: null,
  diaper: null,
  color: null,
  note: null,
  by: null,
  createdAt: o.startAt,
  updatedAt: o.startAt,
  ...o,
});
const EVENTS = [
  ev({ kind: 'formula', amount: 140, startAt: at(10, 50) }),
  ev({ kind: 'diaper', diaper: 'both', color: 'brown', startAt: at(13, 40) }),
  ev({ kind: 'formula', amount: 120, startAt: at(13, 50) }),
];

test('말 가르기 — 건강 질문, 묻는 말, 여러 기록', () => {
  assert.equal(isHealth('열이 38도인데 괜찮아?'), true);
  assert.equal(isHealth('체온 37.5'), false);
  assert.equal(isQuestion('이전 수유 언제 했어?'), true);
  assert.equal(isQuestion('오늘 분유 몇 ml 먹었어'), true);
  assert.equal(isQuestion('분유 120 먹였어'), false);
  assert.equal(looksMulti('10분 전에 대소변 기저귀 갈고 분유 120 먹였어'), true);
  assert.equal(looksMulti('분유 120 먹였어'), false);
});

test('이에요 · 예요', () => {
  assert.equal(copula('분유 120ml'), '예요');
  assert.equal(copula('4번'), '이에요');
  assert.equal(copula('대변'), '이에요');
  assert.equal(copula('소변, 대변'), '이에요');
  assert.equal(copula('37.5℃'), '예요');
});

test('마지막을 물으면 그 기록 하나를 비추고, 「그 전 수유는?」은 하나 더 앞', () => {
  const q = parseFind('이전 수유 언제 했어?', NOW)!;
  const a = answerFor(q, EVENTS, NOW);
  assert.equal(a.text, '오늘 13:50, 분유 120ml예요. 30분 전이에요.');
  assert.equal(a.keys.length, 1);
  assert.equal(a.label, '이전 수유');
  const f = followUp('그 전 수유는?', a, NOW)!;
  const b = answerFor(f.query, EVENTS, NOW, f.offset);
  assert.equal(b.text, '오늘 10:50, 분유 140ml예요. 3시간 30분 전이에요.');
  assert.equal(b.label, '그 전 수유');
});

test('몇 ml — 합계 문장과 그 기록들', () => {
  const a = answerFor(parseFind('오늘 분유 몇 ml 먹었어?', NOW)!, EVENTS, NOW);
  assert.match(a.text, /^오늘 분유 260ml예요\./);
  assert.equal(a.keys.length, 2);
  const none = answerFor(parseFind('어제 대변 몇 번?', NOW)!, EVENTS, NOW);
  assert.equal(none.text, '어제에 찾는 기록이 없어요.');
});

test('서버 답 — 찾을 조건과 기록 입력', () => {
  assert.equal(queryFromServer({ what: 'feed', range: 'today', measure: 'last' }, NOW)?.what, 'feed');
  assert.equal(queryFromServer({ what: 'nope', range: 'today', measure: 'last' }, NOW), null);
  const list = inputsFromServer(
    [
      { kind: 'diaper', startAt: at(14, 10), endAt: null, minutes: null, amount: null, side: null, diaper: 'both', color: null, title: null },
      { kind: 'formula', startAt: at(14, 10), endAt: null, minutes: null, amount: 120, side: null, diaper: null, color: null, title: null },
      { kind: 'breast', startAt: null, endAt: null, minutes: 15, amount: null, side: 'left', diaper: null, color: null, title: null },
      { kind: 'routine', startAt: null, endAt: null, minutes: null, amount: null, side: null, diaper: null, color: null, title: '비타민D' },
      { kind: 'formula', startAt: at(18, 0), endAt: null, minutes: null, amount: 900, side: null, diaper: null, color: null, title: null },
    ],
    NOW,
  );
  assert.deepEqual(
    list.map((x) => (x.type === 'event' ? `${x.title}:${x.complete}` : x.type)),
    ['소변, 대변:true', '분유 120ml:true', '모유 왼쪽 15분:true', 'routine', '분유:false'],
  );
});

test('서버가 안 될 때 — 「~고」로 나눠 읽고, 앞쪽의 때를 뒤쪽에도', () => {
  const list = splitRecords('10분 전에 대소변 기저귀 갈고 분유 120 먹였어', NOW);
  assert.deepEqual(
    list.map((x) => (x.type === 'event' ? x.title : x.type)),
    ['소변, 대변', '분유 120ml'],
  );
  const times = list.map((x) => (x.type === 'event' ? new Date(x.input.startAt!).getTime() : 0));
  assert.equal(times[0], NOW.getTime() - 10 * 60 * 1000);
  assert.equal(times[1], times[0]);
  assert.deepEqual(splitRecords('분유 120 먹였어', NOW), []);
});
