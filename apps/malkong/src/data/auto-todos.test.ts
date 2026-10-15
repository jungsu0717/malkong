/// <reference types="node" />
/**
 * 앱이 채워 주는 할 일 시험 — `node --test src/data/auto-todos.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMonths, autoRulesToAdd, birthOf, milestoneDays, upcomingAuto } from './auto-todos.ts';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const refs = (birth: string, now: Date, have: string[] = []) =>
  autoRulesToAdd(birthOf(birth), now, new Set(have))
    .map((r) => r.ref)
    .sort();

test('갓 태어난 아기 — 50일 촬영 예약은 50일 3주 전의 14일 전부터', () => {
  // 9/20 생: 50일은 11/8, 촬영 예약 기한 10/18, 10/4 부터 보인다
  assert.deepEqual(refs('2026-09-20', new Date(2026, 9, 15)), ['day:50-photo']);
  assert.deepEqual(refs('2026-10-10', new Date(2026, 9, 15)), []);
});

test('이미 있거나 지운 것은 다시 만들지 않는다', () => {
  assert.deepEqual(refs('2026-09-20', new Date(2026, 9, 15), ['day:50-photo']), []);
});

test('기한이 한참 지난 것은 만들지 않는다 — 4개월에 설치', () => {
  // 6/10 생: 50일 · 100일 준비는 모두 지났고, 다음은 5개월(11/10)부터
  assert.deepEqual(refs('2026-06-10', new Date(2026, 9, 15)), []);
  assert.deepEqual(refs('2026-06-10', new Date(2026, 10, 4)), ['size:clothes-5', 'size:diaper-5']);
});

test('기념일 — 100일은 태어난 날을 1일로', () => {
  const days = milestoneDays(birthOf('2026-06-10'));
  assert.equal(ymd(days[0].date), '2026-7-29');
  assert.equal(ymd(days[1].date), '2026-9-17');
  assert.equal(ymd(days[2].date), '2027-6-10');
  // 100일 촬영 예약은 100일 30일 전(8/18), 14일 전부터 보인다
  assert.deepEqual(refs('2026-06-10', new Date(2026, 7, 4)).includes('day:100-photo'), true);
  assert.deepEqual(refs('2026-06-10', new Date(2026, 7, 3)).includes('day:100-photo'), false);
});

test('다가오는 할 일은 가까운 순', () => {
  const next = upcomingAuto('size', birthOf('2026-06-10'), new Date(2026, 9, 15), new Set());
  assert.equal(next[0].rule.title, '기저귀 사이즈 확인');
  assert.equal(ymd(next[0].due), '2026-11-10');
});

test('달 더하기 — 없는 날은 말일', () => {
  assert.equal(ymd(addMonths(new Date(2026, 0, 31), 1)), '2026-2-28');
});
