/// <reference types="node" />
/**
 * 날짜 읽기 시험 — `node --test src/data/due-parse.test.ts` (Node 24 는 타입을 지우고 바로 돌린다).
 * 기준 시각은 2026-10-15(목) 14:00.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueLabel, parseDue } from './due-parse.ts';

const NOW = new Date(2026, 9, 15, 14, 0);
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

function check(input: string, title: string, due: number | null, hasTime: boolean) {
  const r = parseDue(input, NOW);
  assert.equal(r.title, title, `제목: ${input}`);
  assert.equal(r.dueAt ? r.dueAt.getTime() : null, due, `기한: ${input}`);
  assert.equal(r.hasTime, hasTime, `시각 여부: ${input}`);
}

test('상대 날짜와 시각', () => {
  check('내일 오전 10시 분유 주문', '분유 주문', at(2026, 10, 16, 10), true);
  check('모레 기저귀 주문', '기저귀 주문', at(2026, 10, 17), false);
  check('오늘 저녁 8시에 젖병 소독', '젖병 소독', at(2026, 10, 15, 20), true);
});

test('요일', () => {
  check('금요일 물티슈 주문', '물티슈 주문', at(2026, 10, 16), false);
  check('목요일 병원', '병원', at(2026, 10, 15), false);
  check('다음 주 월요일 접종 예약', '접종 예약', at(2026, 10, 19), false);
  check('이번주 토요일까지 장보기', '장보기', at(2026, 10, 17), false);
});

test('날짜 — 지났으면 내년 · 다음 달', () => {
  check('10/20 검진', '검진', at(2026, 10, 20), false);
  check('10월 3일 소풍', '소풍', at(2027, 10, 3), false);
  check('20일 이유식 재료', '이유식 재료', at(2026, 10, 20), false);
  check('5일 장보기', '장보기', at(2026, 11, 5), false);
});

test('시각만 — 지났으면 내일, 오전 · 오후가 없으면 7시 전은 오후', () => {
  check('오후 1시 반 장보기', '장보기', at(2026, 10, 16, 13, 30), true);
  check('3시 낮잠 준비', '낮잠 준비', at(2026, 10, 15, 15), true);
  check('10:30 장보기', '장보기', at(2026, 10, 16, 10, 30), true);
  check('저녁 9시 30분 젖병 씻기', '젖병 씻기', at(2026, 10, 15, 21, 30), true);
});

test('날짜가 아닌 숫자는 그대로', () => {
  check('기저귀 4단계 64개', '기저귀 4단계 64개', null, false);
  check('분유 3일 치 사기', '분유 3일 치 사기', null, false);
  check('젖병 2개 소독', '젖병 2개 소독', null, false);
});

test('다 빼면 처음 글을 제목으로', () => {
  check('내일', '내일', at(2026, 10, 16), false);
});

test('기한 글', () => {
  assert.equal(dueLabel(new Date(at(2026, 10, 15)), false, NOW), '오늘');
  assert.equal(dueLabel(new Date(at(2026, 10, 16, 10)), true, NOW), '내일 10:00');
  assert.equal(dueLabel(new Date(at(2026, 10, 20)), false, NOW), '10월 20일 (화)');
});

test('반복 말', () => {
  const r = (input: string) => parseDue(input, NOW);
  // 매달 1일 — 오늘(15일) 지났으니 다음 달 1일부터
  let p = r('매달 1일 분유 주문');
  assert.equal(p.title, '분유 주문');
  assert.equal(p.dueAt?.getTime(), at(2026, 11, 1));
  assert.deepEqual(p.repeat, { kind: 'monthly', day: 1 });
  // 매일 — 오늘부터
  p = r('매일 젖병 소독');
  assert.equal(p.title, '젖병 소독');
  assert.equal(p.dueAt?.getTime(), at(2026, 10, 15));
  assert.deepEqual(p.repeat, { kind: 'daily' });
  // 매주 화, 금요일 — 다음 맞는 날은 금요일(16일)
  p = r('매주 화, 금요일 분리수거');
  assert.equal(p.title, '분리수거');
  assert.equal(p.dueAt?.getTime(), at(2026, 10, 16));
  assert.deepEqual(p.repeat, { kind: 'weekly', days: [2, 5] });
  // 시각이 이미 지났으면 다음 맞는 날
  p = r('매일 오전 9시 산책');
  assert.equal(p.dueAt?.getTime(), at(2026, 10, 16, 9));
  assert.equal(p.hasTime, true);
  p = r('매달 1일 오전 10시 분유 주문');
  assert.equal(p.title, '분유 주문');
  assert.equal(p.dueAt?.getTime(), at(2026, 11, 1, 10));
  // 며칠마다 — 오늘부터
  p = r('30일마다 젖병 솔 바꾸기');
  assert.equal(p.title, '젖병 솔 바꾸기');
  assert.deepEqual(p.repeat, { kind: 'every', days: 30 });
  assert.equal(p.dueAt?.getTime(), at(2026, 10, 15));
  // 이름 속 「매일」은 반복이 아니다
  p = r('매일유업 분유 주문');
  assert.equal(p.title, '매일유업 분유 주문');
  assert.equal(p.repeat, null);
  assert.equal(p.dueAt, null);
});
