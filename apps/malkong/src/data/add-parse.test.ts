/// <reference types="node" />
/**
 * 「추가」 한 줄 읽기 시험 — `node --test src/data/add-parse.test.ts`. 기준 시각은 2026-11-02(월) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAdd } from './add-parse.ts';

const NOW = new Date(2026, 10, 2, 14, 20);

test('기록 — 분유 양과 지나간 시각', () => {
  const r = parseAdd('아까 12시 반에 분유 100 먹였어', NOW);
  assert.equal(r?.type, 'record');
  if (r?.type !== 'record') return;
  assert.equal(r.kind, 'formula');
  assert.equal(r.input.amount, 100);
  assert.equal(r.when, '오늘 12:30');
  assert.equal(r.complete, true);
  assert.equal(r.title, '분유 100ml');
});

test('기록 — 모유 쪽과 시간, 시각이 없으면 방금 끝난 것', () => {
  const r = parseAdd('왼쪽 모유 15분', NOW);
  if (r?.type !== 'record') throw new Error('기록이 아님');
  assert.equal(r.input.side, 'left');
  assert.equal(new Date(r.input.endAt as string).getTime(), NOW.getTime());
  assert.equal(r.when, '오늘 14:05');
});

test('기록 — 어제 밤 대변, 종류를 모르는 기저귀는 마저 적기', () => {
  const r = parseAdd('어제 밤 11시 대변', NOW);
  if (r?.type !== 'record') throw new Error('기록이 아님');
  assert.equal(r.input.diaper, 'poo');
  assert.equal(r.when, '어제 23:00');
  const d = parseAdd('기저귀 갈았어', NOW);
  assert.equal(d?.type === 'record' && d.complete, false);
});

test('기록 — 「대소변」은 소변과 대변 둘 다(「대변」 글자를 품지 않는다)', () => {
  for (const text of ['대소변', '방금 대소변 봤어', '똥오줌 쌌어']) {
    const r = parseAdd(text, NOW);
    if (r?.type !== 'record') throw new Error(`기록이 아님: ${text}`);
    assert.equal(r.input.diaper, 'both', text);
    assert.equal(r.title, '소변, 대변');
  }
  const pee = parseAdd('소변', NOW);
  assert.equal(pee?.type === 'record' && pee.input.diaper, 'pee');
});

test('기록 — 낮잠 1시간 10분은 시각이 아니라 걸린 시간', () => {
  const r = parseAdd('낮잠 1시간 10분 잤어', NOW);
  if (r?.type !== 'record') throw new Error('기록이 아님');
  assert.equal(r.kind, 'sleep');
  assert.equal(r.title, '잠 1시간 10분');
  assert.equal(r.when, '오늘 13:10');
});

test('기록 — 체온', () => {
  const r = parseAdd('체온 37.8', NOW);
  assert.equal(r?.type === 'record' && r.input.amount, 37.8);
});

test('이름만 · 할 일 · 루틴', () => {
  assert.deepEqual(parseAdd('산책', NOW), { type: 'plain', title: '산책' });
  const todo = parseAdd('오후 3시 산책', NOW);
  assert.equal(todo?.type, 'todo');
  if (todo?.type === 'todo') {
    assert.equal(todo.title, '산책');
    assert.equal(todo.when, '오늘 15:00');
  }
  const routine = parseAdd('매일 저녁 8시 목욕', NOW);
  assert.equal(routine?.type, 'routine');
  if (routine?.type === 'routine') {
    assert.equal(routine.routine.time, '20:00');
    assert.equal(routine.routine.everyDays, 1);
    assert.equal(routine.when, '매일 20:00');
  }
  // 살 것은 기록이 아니라 할 일
  const buy = parseAdd('내일 분유 주문', NOW);
  assert.equal(buy?.type, 'todo');
  // 매달은 루틴이 없어서 반복 할 일
  const monthly = parseAdd('매달 1일 손톱 깎기', NOW);
  assert.equal(monthly?.type, 'todo');
});

test('할 일 이름에서 부탁하는 말과 끝의 「일정」을 뺀다', () => {
  const a = parseAdd('내일 아침 9시에 2개월 접종 일정 넣어 줘', NOW);
  assert.equal(a?.type, 'todo');
  assert.equal(a?.title, '2개월 접종');
  assert.equal(parseAdd('다음 주 화요일 병원 예약 일정 추가해 줘', NOW)?.title, '병원 예약');
  assert.equal(parseAdd('11월 20일 BCG 접종', NOW)?.title, 'BCG 접종');
});

test('기록 — 이유식 · 유축 · 우유 · 물 · 간식(task today/029)', () => {
  const read = (s: string) => {
    const r = parseAdd(s, NOW);
    return r?.type === 'record' ? { kind: r.kind, amount: r.input.amount ?? null, title: r.title, complete: r.complete } : null;
  };
  assert.deepEqual(read('11시에 이유식 80 먹었어'), { kind: 'solid', amount: 80, title: '이유식 80ml', complete: true });
  assert.deepEqual(read('유축한 모유 100 먹였어'), { kind: 'pumped', amount: 100, title: '유축 수유 100ml', complete: true });
  assert.deepEqual(read('유축 수유 90'), { kind: 'pumped', amount: 90, title: '유축 수유 90ml', complete: true });
  assert.deepEqual(read('유축 120 했어'), { kind: 'pump', amount: 120, title: '유축 120ml', complete: true });
  assert.deepEqual(read('우유 150 마셨어'), { kind: 'milk', amount: 150, title: '우유 150ml', complete: true });
  assert.deepEqual(read('물 50 마셨어'), { kind: 'water', amount: 50, title: '물 50ml', complete: true });
  assert.deepEqual(read('간식 먹었어'), { kind: 'snack', amount: null, title: '간식', complete: true });
  // 양이 없으면 입력 창에서 마저 적는다. 물티슈는 물이 아니다
  assert.deepEqual(read('이유식 먹었어'), { kind: 'solid', amount: null, title: '이유식', complete: false });
  assert.notEqual(read('물티슈 갈았어')?.kind, 'water');
  // 모유와 분유는 그대로
  assert.equal(read('모유 15분 먹였어')?.kind, 'breast');
  assert.equal(read('분유 120 먹였어')?.kind, 'formula');
});
