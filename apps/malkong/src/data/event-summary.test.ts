/// <reference types="node" />
/**
 * 빠른 기록 요약 시험 — `node --test src/data/event-summary.test.ts`. 기준 시각은 2026-10-30(금) 15:00.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { agoLabel, eventTitle, feedReminderAt, lastFeedStart, sleepReminderAt, todayStats } from './event-summary.ts';
import { cleanNumber, makeEvent, runningOf, type CareEvent, type EventInput } from './events.ts';

const NOW = new Date(2026, 9, 30, 15, 0);
const at = (h: number, m = 0, day = 30) => new Date(2026, 9, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));

test('쪽을 바꾼 모유는 수유 한 번으로 세고, 마지막 수유는 첫 쪽을 시작한 때', () => {
  const events = [
    ev({ kind: 'formula', startAt: at(9), amount: 120 }),
    ev({ kind: 'breast', side: 'left', startAt: at(13), endAt: at(13, 15) }),
    ev({ kind: 'breast', side: 'right', startAt: at(13, 18), endAt: at(13, 30) }),
  ];
  const s = todayStats(events, NOW);
  assert.equal(s.feeds, 2);
  assert.equal(s.formulaMl, 120);
  assert.equal(lastFeedStart(events), at(13));
  assert.equal(agoLabel(at(13), NOW), '2시간 전');
});

test('자정을 넘긴 잠은 오늘 걸친 만큼만 센다', () => {
  const events = [ev({ kind: 'sleep', startAt: at(22, 0, 29), endAt: at(6) })];
  assert.equal(todayStats(events, NOW).sleepMin, 6 * 60);
});

test('수유 알림은 마지막 수유 시작부터 세고, 모유를 재는 중이면 걸지 않는다', () => {
  const fed = [ev({ kind: 'formula', startAt: at(13), amount: 100 })];
  assert.equal(feedReminderAt(fed, 180, NOW)?.getTime(), new Date(2026, 9, 30, 16, 0).getTime());
  assert.equal(feedReminderAt(fed, null, NOW), null);
  const nursing = [...fed, ev({ kind: 'breast', side: 'left', startAt: at(14, 50), endAt: null })];
  assert.ok(runningOf(nursing, 'breast'));
  assert.equal(feedReminderAt(nursing, 180, NOW), null);
});

test('잠 알림은 깬 뒤 정한 시간, 자는 중이면 없다', () => {
  const woke = [ev({ kind: 'sleep', startAt: at(12), endAt: at(14) })];
  const r = sleepReminderAt(woke, 3, true, NOW);
  assert.equal(r?.minutes, 90);
  assert.equal(sleepReminderAt(woke, 3, false, NOW), null);
  assert.equal(sleepReminderAt([...woke, ev({ kind: 'sleep', startAt: at(14, 40), endAt: null })], 3, true, NOW), null);
});

test('기록 이름과 숫자 칸 입력', () => {
  assert.equal(eventTitle(ev({ kind: 'formula', startAt: at(9), amount: 120 }), NOW), '분유 120ml');
  assert.equal(eventTitle(ev({ kind: 'diaper', startAt: at(9), diaper: 'poo', color: 'yellow' }), NOW), '기저귀 대변 · 노란색');
  assert.equal(cleanNumber('36,8도'), '36.8');
});

test('누가 남겼는지는 기록에 그대로 담긴다', () => {
  assert.equal(ev({ kind: 'diaper', startAt: at(9), diaper: 'pee', by: '할머니' }).by, '할머니');
  assert.equal(ev({ kind: 'diaper', startAt: at(9), diaper: 'pee' }).by, null);
});
