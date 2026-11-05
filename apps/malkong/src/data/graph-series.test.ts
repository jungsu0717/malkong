/// <reference types="node" />
/**
 * 기록 그래프 셈 시험 — `node --test src/data/graph-series.test.ts`. 기준 시각은 2026-11-02(월) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeEvent, type CareEvent, type EventInput } from './events.ts';
import { daySummary, monthSummary, weekSummary } from './graph-series.ts';

const NOW = new Date(2026, 10, 2, 14, 20);
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));
const on = (daysAgo: number, h: number, m = 0) => new Date(2026, 10, 2 - daysAgo, h, m).toISOString();

/** 날마다 분유 — 지난주는 하루 480, 이번 주는 520, 오늘은 지금까지 180 */
function formulaDays(): CareEvent[] {
  const out: CareEvent[] = [];
  for (let d = 13; d >= 1; d--) {
    const per = d >= 7 ? 120 : 130;
    for (const h of [2, 8, 14, 20]) out.push(ev({ kind: 'formula', startAt: on(d, h), amount: per }));
  }
  out.push(ev({ kind: 'formula', startAt: on(0, 8, 30), amount: 120 }));
  out.push(ev({ kind: 'formula', startAt: on(0, 11, 50), amount: 60 }));
  return out;
}

test('일주일 — 오늘을 뺀 평균, 지난주와 견주기', () => {
  const s = weekSummary(formulaDays(), 'formula', NOW);
  assert.equal(s.days.length, 7);
  assert.equal(s.days[6].value, 180);
  assert.equal(Math.round(s.avg), 520);
  assert.equal(s.line, '지난주보다 하루 40ml 더 먹었어요');
});

test('하루 — 먹인 때마다 양, 어제 이 시간까지와 견주기', () => {
  const s = daySummary(formulaDays(), 'formula', NOW, NOW);
  assert.equal(s.total, 180);
  assert.equal(s.count, 2);
  assert.deepEqual(
    s.marks.map((x) => x.value),
    [120, 60],
  );
  // 어제 14:20 까지 — 2시 · 8시 · 14시 세 번
  assert.equal(s.line, '어제 이 시간까지는 390ml 먹었어요');
});

test('한 달 — 기록한 날만으로 첫 주와 마지막 주를 견준다', () => {
  const s = monthSummary(formulaDays(), 'formula', NOW);
  assert.equal(s.days.length, 30);
  // 30일 가운데 기록이 있는 13일만 평균에 든다. 첫 7일에는 기록이 없어 견주지 않는다
  assert.equal(s.line, null);
});

test('기저귀 — 소변과 대변을 나눠 센다', async () => {
  const { dailyValues } = await import('./graph-series.ts');
  const events = [
    ev({ kind: 'diaper', diaper: 'pee', startAt: on(1, 9) }),
    ev({ kind: 'diaper', diaper: 'both', startAt: on(1, 12) }),
    ev({ kind: 'diaper', diaper: 'poo', startAt: on(1, 15) }),
  ];
  const d = dailyValues(events, 'diaper', 2, NOW)[0];
  assert.equal(d.value, 3);
  assert.equal(d.pee, 2);
  assert.equal(d.poo, 2);
});
