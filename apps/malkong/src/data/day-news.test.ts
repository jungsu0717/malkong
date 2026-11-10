/// <reference types="node" />
/**
 * 오늘 아기 소식 시험 — `node --test src/data/day-news.test.ts`. 기준 시각은 2026-10-30(금) 21:00, 생일 2026-07-22(오늘 101일째).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayNews } from './day-news.ts';
import { makeEvent, type CareEvent, type EventInput } from './events.ts';
import { makeMemo } from './stage.ts';

const BIRTH = '2026-07-22';
const NOW = new Date(2026, 9, 30, 21, 0);
const at = (h: number, m = 0, day = 30) => new Date(2026, 9, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));

test('그날 수유 · 잠 · 기저귀 합계와 고리, 마지막 메모를 묶는다', () => {
  const events = [
    ev({ kind: 'sleep', startAt: at(22, 0, 29), endAt: at(6) }),
    ev({ kind: 'formula', startAt: at(7), amount: 160 }),
    ev({ kind: 'breast', side: 'left', startAt: at(11), endAt: at(11, 15) }),
    ev({ kind: 'diaper', startAt: at(8), diaper: 'poo', color: 'green' }),
    ev({ kind: 'temp', startAt: at(9), amount: 37.9 }),
    // 어제 것은 세지 않는다
    ev({ kind: 'formula', startAt: at(20, 0, 29), amount: 100 }),
  ];
  const memos = [makeMemo('까르르 웃었어요', new Date(2026, 9, 30, 10)), makeMemo('처음으로 뒤집었어요', new Date(2026, 9, 30, 15))];
  const news = dayNews(events, memos, BIRTH, NOW, NOW);
  assert.ok(news);
  assert.equal(news.dateText, '10월 30일 금요일');
  assert.equal(news.daysText, '함께한 지 101일');
  assert.deepEqual(news.stats, { feeds: 2, formulaMl: 160, sleepMin: 360, diapers: 1 });
  // 고리 — 어제 밤잠은 0시부터 6시까지만, 수유는 7시와 11시, 기저귀는 8시
  assert.deepEqual(news.ring, { sleeps: [{ from: 0, to: 6 }], feeds: [7, 11], diapers: [8] });
  assert.equal(news.note, '처음으로 뒤집었어요');
  // 체온 · 변 색은 카드에 들어가지 않는다
  assert.ok(!JSON.stringify(news).includes('37.9'));
  assert.ok(!JSON.stringify(news).includes('초록'));
});

test('보낼 것이 없으면 null, 메모만 있으면 메모 한 줄', () => {
  assert.equal(dayNews([ev({ kind: 'weight', startAt: at(9), amount: 6.2 })], [], BIRTH, NOW, NOW), null);
  const onlyNote = dayNews([], [makeMemo('병원 다녀왔어요', new Date(2026, 9, 30, 12))], BIRTH, NOW, NOW);
  assert.deepEqual(onlyNote?.stats, { feeds: 0, formulaMl: 0, sleepMin: 0, diapers: 0 });
  assert.deepEqual(onlyNote?.ring, { sleeps: [], feeds: [], diapers: [] });
  assert.equal(onlyNote?.note, '병원 다녀왔어요');
});

test('긴 메모는 줄인다', () => {
  const long = '가'.repeat(60);
  const news = dayNews([], [makeMemo(long, new Date(2026, 9, 30, 12))], BIRTH, NOW, NOW);
  assert.equal(news?.note?.length, 40);
  assert.ok(news?.note?.endsWith('…'));
});
