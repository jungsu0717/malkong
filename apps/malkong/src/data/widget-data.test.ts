/// <reference types="node" />
/**
 * 위젯에 보일 것 시험 — `node --test src/data/widget-data.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeRoutine, makeRoutineLog, todayState, type Routine } from './routine.ts';
import { DAY } from './upcoming.ts';
import { emptyWidgetProps, nextLine, pickEntry, toggleInWidget, widgetDays, widgetProps, widgetRoutines } from './widget-data.ts';

const now = new Date(2026, 9, 29, 9, 30);
const today = new Date(2026, 9, 29).getTime();
const urls = { home: 'yugabuddy:///', routinesUrl: 'yugabuddy:///routines', face: '' };

const routine = (title: string, extra: Partial<Routine> = {}, sort = 0): Routine => ({
  ...makeRoutine({ title, kind: 'check', everyDays: 1, weekdays: null, time: null, items: null }, sort, now),
  ...extra,
});
const planOf = (routines: Routine[], doneIds: string[] = []) => {
  const logs = doneIds.map((routineId) => makeRoutineLog(routineId, now));
  const today = routines.map((r) => ({ r, s: todayState(r, logs, now) }));
  const counted = today.filter((x) => !(x.s.skipped && !x.s.done));
  return { today, done: counted.filter((x) => x.s.done).length, total: counted.length };
};

test('머리 — 이번 주 수, 없으면 빈 주 글', () => {
  const rows = [
    { title: 'BCG 접종', at: today + 3 * DAY, right: 'D-3' },
    { title: '50일 촬영 예약', at: today + 20 * DAY, right: 'D-20' },
  ];
  const p = widgetProps({ birthDate: '2026-09-01', rows, plan: planOf([]), ...urls }, now);
  assert.equal(p.headline, '이번 주 챙길 일 1개');
  assert.equal(p.days, '함께한 지 59일');
  assert.equal(p.dayCount, 59);
  assert.equal(p.next, 'D-3 · BCG 접종');
  assert.equal(p.nextWhen, 'D-3');
  assert.equal(p.nextTitle, 'BCG 접종');
  assert.equal(p.date, '2026-10-29');
  const empty = widgetProps({ birthDate: '2026-09-01', rows: [rows[1]], plan: planOf([]), ...urls }, now);
  assert.equal(empty.headline, '이번 주는 챙길 일이 없어요');
  // 위젯 이름표는 아기 일정 줄과 같은 말 — 기한이 지난 것만 「지남」
  const late = widgetProps({ birthDate: '2026-09-01', rows: [{ title: '기저귀 사이즈 확인', at: today - DAY, right: null }], plan: planOf([]), ...urls }, now);
  assert.equal(late.nextWhen, '지남');
  const none = widgetProps({ birthDate: '2026-09-01', rows: [], plan: planOf([]), ...urls }, now);
  assert.deepEqual([none.next, none.nextWhen, none.nextTitle], ['', '', '']);
});

test('다음 한 줄 — 지금은 「이번 달」, 기한 지남은 「지남」, 없으면 빈 글', () => {
  assert.equal(nextLine({ title: '영유아 검진', at: today - 1, right: '지금' }), '이번 달 · 영유아 검진');
  assert.equal(nextLine({ title: '기저귀 사이즈 확인', at: today - DAY, right: null }), '지남 · 기저귀 사이즈 확인');
  assert.equal(nextLine({ title: 'DTaP 1차', at: today, right: '오늘' }), '오늘 · DTaP 1차');
  assert.equal(nextLine(undefined), '');
});

test('루틴 — 안 한 것 먼저 셋까지, 단계 · 재고 확인은 위젯에서 못 누른다', () => {
  const bath = routine('목욕', { items: ['씻기', '보습'] }, 0);
  const vit = routine('비타민D', {}, 1);
  const stock = routine('재고 확인', { kind: 'stock', items: ['분유'] }, 2);
  const nails = routine('손발톱', {}, 3);
  const p = widgetProps({ birthDate: '2026-09-01', rows: [], plan: planOf([bath, vit, stock, nails], [bath.id]), ...urls }, now);
  assert.deepEqual(
    p.routines.map((r) => [r.title, r.done, r.tap]),
    [
      ['비타민D', false, true],
      ['재고 확인', false, false],
      ['손발톱', false, true],
    ],
  );
  assert.equal(p.left, 3);
  assert.equal(p.more, 1);
  assert.equal(widgetRoutines(planOf([vit], [vit.id]))[0].done, true);
});

test('위젯에서 누르면 토글되고 pending 에 남는다 — 두 번 누르면 빠진다', () => {
  const vit = routine('비타민D');
  const p = widgetProps({ birthDate: '2026-09-01', rows: [], plan: planOf([vit]), ...urls }, now);
  const once = toggleInWidget(p, vit.id);
  assert.equal(once.routines[0].done, true);
  assert.equal(once.left, 0);
  assert.deepEqual(once.pending, [vit.id]);
  const twice = toggleInWidget(once, vit.id);
  assert.equal(twice.routines[0].done, false);
  assert.deepEqual(twice.pending, []);
  assert.equal(toggleInWidget(p, 'none'), p);
});

test('타임라인 — 오늘은 지금, 다음 날들은 자정. 지금 보일 벌은 지나지 않은 마지막 것', () => {
  const days = widgetDays(now);
  assert.equal(days.length, 7);
  assert.equal(days[0].getTime(), now.getTime());
  assert.equal(days[1].getTime(), new Date(2026, 9, 30).getTime());
  const entries = days.map((d, i) => ({ date: d.getTime(), props: { ...emptyWidgetProps('x', ''), headline: `day ${i}` } }));
  assert.equal(pickEntry(entries, new Date(2026, 9, 31, 8))?.headline, 'day 2');
  assert.equal(pickEntry(entries, new Date(2026, 9, 28))?.headline, 'day 0');
  assert.equal(pickEntry([], now), null);
});
