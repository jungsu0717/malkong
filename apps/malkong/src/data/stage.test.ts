/// <reference types="node" />
/**
 * 성장 탭 계산 시험 — `node --test src/data/stage.test.ts`. 생일은 2026-09-20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysSince, makeMemo, nowItems, poseOf, sortMemos, splitTitle, stageWindow, weekOf } from './stage.ts';

const BIRTH = '2026-09-20';

test('태어난 날은 D+0, 첫 주는 1주차', () => {
  assert.equal(daysSince(BIRTH, new Date(2026, 8, 20, 23, 0)), 0);
  assert.equal(daysSince(BIRTH, new Date(2026, 9, 22, 9, 0)), 32);
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

test('막대 — D+32 는 태어남 · 미소 · 옹알이 · 뒤집기, 태어남과 미소 사이 절반쯤', () => {
  const w = stageWindow(BIRTH, new Date(2026, 9, 22));
  assert.deepEqual(w.stops.map((s) => s.short), ['태어남', '미소', '옹알이', '뒤집기']);
  assert.equal(w.passed, 1);
  assert.equal(w.next?.name, '사회적 미소');
  assert.ok(w.progress > 0.15 && w.progress < 0.2, String(w.progress));
});

test('막대 — 7개월이면 칸이 넘어가 옹알이 · 뒤집기 · 혼자 앉기 · 잡고 서기', () => {
  const w = stageWindow(BIRTH, new Date(2027, 3, 20));
  assert.deepEqual(w.stops.map((s) => s.short), ['옹알이', '뒤집기', '혼자 앉기', '잡고 서기']);
  assert.equal(w.passed, 2);
  assert.equal(w.next?.short, '혼자 앉기');
  assert.ok(w.progress > 0.4 && w.progress < 0.5, String(w.progress));
});

test('막대 — 다 지나면 끝까지 차고 다음은 없다', () => {
  const w = stageWindow(BIRTH, new Date(2027, 10, 1));
  assert.equal(w.progress, 1);
  assert.equal(w.passed, 4);
  assert.equal(w.next, null);
});

test('L1 제목 나누기와 이맘때 고르기', () => {
  assert.deepEqual(splitTitle('깨어 있을 때 터미타임 — 지켜보는 가운데 엎드려 놀기'), { head: '깨어 있을 때 터미타임', tail: '지켜보는 가운데 엎드려 놀기' });
  assert.deepEqual(splitTitle('말 걸고, 읽어 주고, 노래해 주기'), { head: '말 걸고, 읽어 주고, 노래해 주기', tail: null });
  const picked = nowItems([
    { kind: '안전', id: 'a' },
    { kind: '수면', id: 's' },
    { kind: '생활', id: 'l1' },
    { kind: '생활', id: 'l2' },
    { kind: '수유', id: 'f' },
  ]);
  assert.deepEqual(picked.map((p) => `${p.id}:${p.label}`), ['l1:해 주면 좋아요', 'l2:해 주면 좋아요', 's:잠']);
});

test('메모 — 앞뒤 빈칸을 빼고, 최근 것이 위로', () => {
  const a = makeMemo('  처음으로 웃었어요 ', new Date(2026, 9, 20));
  const b = makeMemo('4시간 잤어요', new Date(2026, 9, 22));
  assert.equal(a.text, '처음으로 웃었어요');
  assert.ok(a.id.startsWith('mm-'));
  assert.deepEqual(sortMemos([a, b]).map((m) => m.text), ['4시간 잤어요', '처음으로 웃었어요']);
});
