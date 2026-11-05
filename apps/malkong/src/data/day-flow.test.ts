/// <reference types="node" />
/**
 * 하루 흐름 셈 시험 — `node --test src/data/day-flow.test.ts`. 기준 시각은 2026-11-02(월) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  awakeMinutes,
  dayMarks,
  feedNeighbors,
  feedSessions,
  feedTitle,
  nextFeedGuess,
  periodClock,
  sidesLine,
  usualFeedGap,
  weekDays,
  weekLines,
} from './day-flow.ts';
import { makeEvent, type CareEvent, type EventInput } from './events.ts';

const NOW = new Date(2026, 10, 2, 14, 20);
const at = (h: number, m = 0, day = 2) => new Date(2026, 10, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));

/** 월요일 하루 — 시안의 기록 */
const today = (): CareEvent[] => [
  ev({ kind: 'sleep', startAt: at(21, 10, 1), endAt: at(0, 30) }),
  ev({ kind: 'formula', startAt: at(0, 40), amount: 120 }),
  ev({ kind: 'sleep', startAt: at(1, 10), endAt: at(4, 30) }),
  ev({ kind: 'diaper', diaper: 'pee', startAt: at(4, 40) }),
  ev({ kind: 'breast', side: 'left', startAt: at(4, 50), endAt: at(5, 5) }),
  ev({ kind: 'sleep', startAt: at(5, 30), endAt: at(8, 10) }),
  ev({ kind: 'formula', startAt: at(8, 20), amount: 140 }),
  ev({ kind: 'diaper', diaper: 'poo', startAt: at(8, 25) }),
  ev({ kind: 'sleep', startAt: at(9, 40), endAt: at(11, 10) }),
  ev({ kind: 'breast', side: 'left', startAt: at(11, 30), endAt: at(11, 40), by: '엄마' }),
  ev({ kind: 'breast', side: 'right', startAt: at(11, 40), endAt: at(11, 48) }),
  ev({ kind: 'diaper', diaper: 'pee', startAt: at(12, 5), by: '할머니' }),
  ev({ kind: 'sleep', startAt: at(12, 50), endAt: at(13, 40), by: '아빠' }),
];

test('쪽을 바꾼 모유는 수유 한 번 — 이름은 합친 시간, 쪽마다 걸린 시간', () => {
  const sessions = feedSessions(today());
  assert.equal(sessions.length, 4);
  const last = sessions[3];
  assert.equal(last.parts.length, 2);
  assert.equal(last.by, '엄마');
  assert.equal(feedTitle(last, NOW), '모유 18분');
  assert.equal(sidesLine(last, NOW), '왼쪽 10분, 오른쪽 8분');
  assert.equal(feedTitle(sessions[1], NOW), '모유 15분');
  assert.equal(feedTitle(sessions[2], NOW), '분유 140ml');
});

test('깨어 있는 시간 — 마지막 잠이 끝난 뒤, 자는 중이면 없다', () => {
  assert.equal(awakeMinutes(today(), NOW), 40);
  const sleeping = [...today(), ev({ kind: 'sleep', startAt: at(14), endAt: null })];
  assert.equal(awakeMinutes(sleeping, NOW), null);
});

test('다음 수유 예상 — 최근 사흘 간격의 가운데 값, 간격이 셋보다 적으면 없다', () => {
  // 0:40 → 4:50 → 8:20 → 11:30 : 250, 210, 190 분 → 가운데 210
  assert.equal(usualFeedGap(today(), NOW), 210);
  const guess = nextFeedGuess(today(), NOW);
  assert.equal(guess?.gap, 210);
  assert.equal(guess?.at.getHours(), 15);
  assert.equal(guess?.at.getMinutes(), 0);
  assert.equal(usualFeedGap(today().slice(0, 5), NOW), null);
});

test('펼친 수유의 앞뒤 — 마지막 수유면 다음은 예상', () => {
  const events = today();
  const sessions = feedSessions(events);
  const n = feedNeighbors(sessions[3], events, NOW);
  assert.equal(n.prev?.id, sessions[2].id);
  assert.equal(n.next, null);
  assert.ok(n.guess);
  assert.equal(n.gapBefore, 190);
  const m = feedNeighbors(sessions[1], events, NOW);
  assert.equal(m.next?.id, sessions[2].id);
  assert.equal(m.guess, null);
});

test('하루 시계 — 잠은 그날에 걸친 만큼, 지금은 오늘만', () => {
  const marks = dayMarks(today(), NOW, NOW);
  assert.equal(marks.sleeps[0].from, 0);
  assert.equal(marks.sleeps[0].to, 0.5);
  assert.equal(marks.feeds.length, 4);
  assert.equal(marks.diapers.length, 3);
  assert.ok(marks.now !== null && Math.abs(marks.now - (14 + 1 / 3)) < 0.01);
  const yesterday = dayMarks(today(), new Date(2026, 10, 1), NOW);
  assert.equal(yesterday.now, null);
  assert.equal(yesterday.sleeps.length, 1);
  assert.ok(Math.abs(yesterday.sleeps[0].from - (21 + 1 / 6)) < 0.01);
  assert.equal(yesterday.sleeps[0].to, 24);
});

test('일주일 — 밤잠 드는 시간과 문장 둘', () => {
  const events: CareEvent[] = [];
  // 화 27 ~ 일 1: 밤잠이 22:10 → 20:55 로 당겨진다. 금 밤 21:10 ~ 토 02:20 이 가장 길다
  const beds: [number, number, number, number][] = [
    [27, 22, 10, 300],
    [28, 21, 50, 280],
    [29, 21, 30, 290],
    [30, 21, 10, 310],
    [31, 21, 0, 280],
  ];
  for (const [d, h, m, len] of beds) {
    const start = new Date(2026, 9, d, h, m);
    events.push(ev({ kind: 'sleep', startAt: start.toISOString(), endAt: new Date(start.getTime() + len * 60_000).toISOString() }));
  }
  const sun = new Date(2026, 10, 1, 20, 55);
  events.push(ev({ kind: 'sleep', startAt: sun.toISOString(), endAt: new Date(sun.getTime() + 200 * 60_000).toISOString() }));
  const days = weekDays(events, NOW);
  assert.equal(days.length, 7);
  assert.equal(days[0].weekday, '화');
  assert.ok(days[6].isToday);
  assert.ok(days[0].bedtime !== null && Math.abs(days[0].bedtime - (22 + 1 / 6)) < 0.01);
  assert.equal(days[6].bedtime, null);
  const lines = weekLines(days, events, NOW);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '밤잠 드는 시간이 밤 9시 50분에서 9시로 당겨졌어요');
  assert.equal(lines[1], '가장 길게 잔 잠은 금요일 밤 9시 10분부터 5시간 10분이에요');
});

test('「밤 9시 10분」 「새벽 2시」 「밤 12시」', () => {
  assert.deepEqual(periodClock(21 + 1 / 6), { period: '밤', clock: '9시 10분' });
  assert.deepEqual(periodClock(2), { period: '새벽', clock: '2시' });
  assert.deepEqual(periodClock(0), { period: '밤', clock: '12시' });
  assert.deepEqual(periodClock(13.5), { period: '오후', clock: '1시 30분' });
});

test('3판 줄 — 잠 하나와 그 뒤 시간 하나, 잠 사이 기록은 그 시간 아래', async () => {
  const { dayRows, dayTotals, sleepTitle, spanRange } = await import('./day-flow.ts');
  const rows = dayRows(today(), [{ routineId: 'r1', logId: 'l1', title: '산책', at: at(11, 20), by: '할머니' }], [], NOW, NOW);
  // 어젯밤 잠부터 — 잠 다섯, 마지막 줄은 지금(깨어 있는 중)
  assert.equal(rows.length, 5);
  assert.equal(rows[0].sleep?.night, true);
  assert.equal(spanRange(rows[0].sleep!.from, rows[0].sleep!.to, new Date(2026, 10, 2).getTime()), '어제 21:10~00:30');
  const last = rows[4];
  assert.equal(last.wake?.to, null);
  assert.equal(sleepTitle(last.sleep!, NOW), '낮잠 50분');
  // 11:10~12:50 사이 — 산책, 모유(쪽 바꿈 한 번), 소변
  const mid = rows[3].wake!;
  assert.deepEqual(
    mid.items.map((i) => i.type),
    ['routine', 'feed', 'side'],
  );
  const t = dayTotals(today(), NOW, NOW);
  assert.equal(t.formulaMl, 260);
  assert.equal(t.formulaCount, 2);
  assert.equal(t.breastCount, 2);
  assert.equal(t.breastMin, 33);
  assert.equal(t.diapers, 3);
  assert.equal(t.poo, 1);
  // 새벽 5시 반 잠은 밤잠 — 낮잠은 09:40 · 12:50 둘
  assert.equal(t.naps, 2);
});

test('3판 줄 — 자는 중이면 마지막 잠이 열려 있고, 잠을 안 적은 날은 넓은 노드 하나', async () => {
  const { dayRows, sleepTitle } = await import('./day-flow.ts');
  const sleeping = [...today(), ev({ kind: 'sleep', startAt: at(13, 50), endAt: null })];
  const rows = dayRows(sleeping, [], [], NOW, NOW);
  const last = rows[rows.length - 1];
  assert.equal(last.sleep?.to, null);
  assert.equal(last.wake, null);
  assert.equal(sleepTitle(last.sleep!, NOW), '잠든 지 30분');
  const noSleep = today().filter((e) => e.kind !== 'sleep');
  const one = dayRows(noSleep, [], [], NOW, NOW);
  assert.equal(one.length, 1);
  assert.equal(one[0].sleep, null);
  assert.equal(one[0].wake?.items.length, 7);
});
