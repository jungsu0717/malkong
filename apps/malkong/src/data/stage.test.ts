/// <reference types="node" />
/**
 * 성장 탭 계산 시험 — `node --test src/data/stage.test.ts`. 생일은 2026-09-20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checklistIds,
  checkpointFor,
  dayNumber,
  daysSince,
  forMonth,
  makeMemo,
  nextCheckpoint,
  poseOf,
  sortMemos,
  splitTitle,
  stageStops,
  stageWindow,
  tipIds,
  weekOf,
} from './stage.ts';

const BIRTH = '2026-09-20';

test('태어난 날은 D+0, 첫 주는 1주차', () => {
  assert.equal(daysSince(BIRTH, new Date(2026, 8, 20, 23, 0)), 0);
  assert.equal(daysSince(BIRTH, new Date(2026, 9, 22, 9, 0)), 32);
  // 화면의 D+ 는 태어난 날이 1 — 100일 되는 날(태어나고 99일 뒤)이 D+100
  assert.equal(dayNumber(BIRTH, new Date(2026, 8, 20, 23, 0)), 1);
  assert.equal(dayNumber(BIRTH, new Date(2026, 8, 20 + 99)), 100);
  assert.equal(weekOf(0), 1);
  assert.equal(weekOf(32), 5);
});

test('자세는 개월로 — 누워서(0~5) · 기기(6~11) · 걷기(12~)', () => {
  assert.equal(poseOf(0), 'lie');
  assert.equal(poseOf(5), 'lie');
  assert.equal(poseOf(6), 'crawl');
  assert.equal(poseOf(11), 'crawl');
  assert.equal(poseOf(12), 'walk');
});

test('막대 칸 — 달마다 · 50일 · 100일 · 돌, 발달 단계는 그 달에 붙는다', () => {
  const stops = stageStops(BIRTH);
  assert.deepEqual(
    stops.slice(0, 8).map((s) => s.label),
    ['태어남', '1개월', '50일', '2개월', '3개월', '100일', '4개월', '5개월'],
  );
  const two = stops.find((s) => s.label === '2개월');
  assert.equal(two?.sub, '미소');
  assert.equal(two?.milestone?.l1Id, 'k-dev-0201');
  assert.equal(stops.find((s) => s.label === '50일')?.sub, '11월 8일');
  assert.equal(stops.find((s) => s.label === '100일')?.sub, '12월 28일');
  assert.equal(stops.find((s) => s.key === 'm12')?.label, '돌');
});

test('막대 — D+32 는 1개월 · 50일 · 2개월 · 3개월, 다음은 50일', () => {
  const w = stageWindow(BIRTH, new Date(2026, 9, 22));
  assert.deepEqual(w.stops.map((s) => s.label), ['1개월', '50일', '2개월', '3개월']);
  assert.equal(w.passed, 1);
  assert.equal(w.next?.label, '50일');
  assert.ok(w.progress > 0.02 && w.progress < 0.05, String(w.progress));
});

test('막대 — 두 돌을 지나면 끝까지 차고 다음은 없다', () => {
  const w = stageWindow(BIRTH, new Date(2028, 10, 1));
  assert.equal(w.progress, 1);
  assert.equal(w.next, null);
  assert.equal(w.stops[w.stops.length - 1].label, '두 돌');
});

test('발달 체크 단계와 항목 id', () => {
  assert.equal(checkpointFor(0), 2);
  assert.equal(checkpointFor(1), 2);
  assert.equal(checkpointFor(2), 4);
  assert.equal(checkpointFor(8), 9);
  assert.equal(checkpointFor(15), 12);
  assert.equal(nextCheckpoint(2), 4);
  assert.equal(nextCheckpoint(12), null);
  assert.equal(checklistIds(2).length, 11);
  assert.equal(checklistIds(2)[0], 'k-dev-0211');
  assert.deepEqual(tipIds(4).slice(0, 2), ['k-life-0001', 'k-life-0411']);
});

test('L1 제목 나누기와 개월 고르기', () => {
  assert.deepEqual(splitTitle('깨어 있을 때 터미타임 — 지켜보는 가운데 엎드려 놀기'), { head: '깨어 있을 때 터미타임', tail: '지켜보는 가운데 엎드려 놀기' });
  assert.deepEqual(splitTitle('말 걸고, 읽어 주고, 노래해 주기'), { head: '말 걸고, 읽어 주고, 노래해 주기', tail: null });
  assert.deepEqual(
    forMonth([{ id: 'a', months: [0, 1] }, { id: 'b', months: [4] }], 1).map((i) => i.id),
    ['a'],
  );
});

test('메모 — 앞뒤 빈칸을 빼고, 최근 것이 위로, 체크로 남긴 것은 ref', () => {
  const a = makeMemo('  처음으로 웃었어요 ', new Date(2026, 9, 20));
  const b = makeMemo('4시간 잤어요', new Date(2026, 9, 22), 'k-dev-0214');
  assert.equal(a.text, '처음으로 웃었어요');
  assert.equal(a.ref, null);
  assert.equal(b.ref, 'k-dev-0214');
  assert.ok(a.id.startsWith('mm-'));
  assert.deepEqual(sortMemos([a, b]).map((m) => m.text), ['4시간 잤어요', '처음으로 웃었어요']);
});
