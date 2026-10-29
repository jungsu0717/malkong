/// <reference types="node" />
/**
 * 접종 · 검진 예약일 시험 — `node --test src/data/appointment.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { apptFor, apptLine, apptRef, isApptRef } from './appointment.ts';
import type { Todo } from './todos.ts';

const now = new Date(2026, 9, 29, 9, 30);
const today = new Date(2026, 9, 29).getTime();

const todo = (patch: Partial<Todo>): Todo => ({
  id: 't1',
  topicId: 'checkup',
  title: 'B형간염 2차 예약',
  note: null,
  dueAt: null,
  hasTime: false,
  buy: false,
  source: 'manual',
  doneAt: null,
  repeat: null,
  ref: null,
  orderedAt: null,
  arriveAt: null,
  store: null,
  doneBy: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...patch,
});

test('예약 열쇠는 개월과 종류 — 묶음의 지금 · 지남과 상관없다', () => {
  assert.equal(apptRef(1, '접종'), 'appt:1-접종');
  assert.ok(isApptRef('appt:1-접종'));
  assert.ok(!isApptRef('day:100-photo'));
  assert.ok(!isApptRef(null));
});

test('그 묶음의 안 끝낸 예약만 고른다', () => {
  const appt = todo({ ref: 'appt:1-접종', dueAt: new Date(2026, 10, 3, 10).toISOString(), hasTime: true });
  const done = todo({ id: 't2', ref: 'appt:2-접종', dueAt: new Date(2026, 10, 3).toISOString(), doneAt: now.toISOString() });
  assert.equal(apptFor([appt, done], 1, '접종')?.id, 't1');
  assert.equal(apptFor([appt, done], 2, '접종'), null);
  assert.equal(apptFor([appt], 1, '검진'), null);
});

test('예약 줄 — 예약 날로 D-day, 시각까지, 지났으면 「지남」', () => {
  const appt = todo({ ref: 'appt:1-접종', dueAt: new Date(2026, 10, 3, 10).toISOString(), hasTime: true });
  assert.deepEqual(apptLine(appt, today, now), { at: new Date(2026, 10, 3).getTime(), meta: '예약 11월 3일 (화) 10:00', right: 'D-5' });
  const past = todo({ dueAt: new Date(2026, 9, 27).toISOString() });
  assert.equal(apptLine(past, today, now).right, '지남');
  const todayAppt = todo({ dueAt: new Date(2026, 9, 29, 15).toISOString(), hasTime: true });
  assert.deepEqual(apptLine(todayAppt, today, now), { at: today, meta: '예약 오늘 15:00', right: '오늘' });
});
