/// <reference types="node" />
/**
 * 반복 할 일 시험 — `node --test src/data/repeat.test.ts`. 기준 날은 2026-10-15(목).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstDate, nextDate, repeatFromText, repeatLabel, repeatToText, suggestRepeat, withTimeOf, type Repeat } from './repeat.ts';

const day = (mo: number, d: number, y = 2026) => new Date(y, mo - 1, d);
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('저장 글과 규칙을 오간다', () => {
  const rules: Repeat[] = [{ kind: 'daily' }, { kind: 'weekly', days: [5, 2] }, { kind: 'monthly', day: 31 }, { kind: 'every', days: 30 }];
  for (const r of rules) assert.deepEqual(repeatFromText(repeatToText(r)), r.kind === 'weekly' ? { kind: 'weekly', days: [2, 5] } : r);
  assert.equal(repeatToText({ kind: 'weekly', days: [5, 2] }), 'weekly:2,5');
  assert.equal(repeatFromText('monthly:40'), null);
  assert.equal(repeatFromText('weekly:'), null);
  assert.equal(repeatFromText(null), null);
});

test('보이는 이름', () => {
  assert.equal(repeatLabel({ kind: 'daily' }), '매일');
  assert.equal(repeatLabel({ kind: 'weekly', days: [0, 2] }), '매주 화, 일요일');
  assert.equal(repeatLabel({ kind: 'monthly', day: 1 }), '매달 1일');
  assert.equal(repeatLabel({ kind: 'every', days: 3 }), '3일마다');
});

test('오늘부터 맞는 첫날', () => {
  assert.equal(ymd(firstDate({ kind: 'daily' }, day(10, 15))), '2026-10-15');
  assert.equal(ymd(firstDate({ kind: 'weekly', days: [1] }, day(10, 15))), '2026-10-19');
  assert.equal(ymd(firstDate({ kind: 'monthly', day: 1 }, day(10, 15))), '2026-11-1');
  assert.equal(ymd(firstDate({ kind: 'monthly', day: 15 }, day(10, 15))), '2026-10-15');
  // 31일은 2월에 말일로
  assert.equal(ymd(firstDate({ kind: 'monthly', day: 31 }, day(2, 1, 2027))), '2027-2-28');
});

test('완료하면 다음 날짜', () => {
  // 매일 — 오늘 한 것은 내일, 밀린 것은 완료한 다음 날
  assert.equal(ymd(nextDate({ kind: 'daily' }, day(10, 15), day(10, 15))), '2026-10-16');
  assert.equal(ymd(nextDate({ kind: 'daily' }, day(10, 10), day(10, 15))), '2026-10-16');
  // 매달 1일 — 미리 했어도 다음 차례는 그다음 달
  assert.equal(ymd(nextDate({ kind: 'monthly', day: 1 }, day(11, 1), day(10, 28))), '2026-12-1');
  assert.equal(ymd(nextDate({ kind: 'monthly', day: 1 }, day(10, 1), day(10, 5))), '2026-11-1');
  // 매주 화 · 금
  assert.equal(ymd(nextDate({ kind: 'weekly', days: [2, 5] }, day(10, 13), day(10, 15))), '2026-10-16');
  // 며칠마다 — 완료한 날부터 센다
  assert.equal(ymd(nextDate({ kind: 'every', days: 30 }, day(10, 1), day(10, 15))), '2026-11-14');
  // 기한 없이 반복만 있던 것
  assert.equal(ymd(nextDate({ kind: 'monthly', day: 20 }, null, day(10, 15))), '2026-10-20');
});

test('시각은 그대로', () => {
  const at = withTimeOf(day(10, 16), new Date(2026, 9, 15, 9, 30));
  assert.equal(at.getHours(), 9);
  assert.equal(at.getMinutes(), 30);
  assert.equal(withTimeOf(day(10, 16), null).getHours(), 0);
});

test('반복 추천', () => {
  assert.equal(suggestRepeat([day(9, 1), day(10, 1)]), null);
  assert.deepEqual(suggestRepeat([day(8, 1), day(9, 2), day(10, 1)]), { kind: 'monthly', day: 1 });
  assert.deepEqual(suggestRepeat([day(10, 13), day(10, 14), day(10, 15)]), { kind: 'daily' });
  // 목요일에 주로
  assert.deepEqual(suggestRepeat([day(10, 1), day(10, 8), day(10, 14), day(10, 22)]), { kind: 'weekly', days: [4] });
  assert.deepEqual(suggestRepeat([day(9, 1), day(9, 13), day(9, 26)]), { kind: 'every', days: 13 });
  // 같은 날 세 번은 추천하지 않는다
  assert.equal(suggestRepeat([day(10, 15), day(10, 15), day(10, 15)]), null);
});
