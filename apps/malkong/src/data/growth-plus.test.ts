/// <reference types="node" />
/**
 * 성장 탭 고도화 시험 — `node --test src/data/growth-plus.test.ts`. 아기 생일은 2026-09-20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  diaryMonths,
  growthNotices,
  monthIndexAt,
  objectParticle,
  playItemOf,
  playRef,
  playedToday,
  todayPlayIndex,
  weekPlayCount,
} from './growth-plus.ts';
import type { Memo } from './stage.ts';

const BIRTH = '2026-09-20';
const memo = (id: string, at: Date, text: string, ref: string | null = null): Memo => ({
  id,
  at: at.toISOString(),
  text,
  ref,
  createdAt: at.toISOString(),
  updatedAt: at.toISOString(),
});

test('오늘의 놀이 — 날마다 바뀌고 「다른 놀이」로 다음 것, 그날 했는지', () => {
  assert.equal(todayPlayIndex(5, 31), 1);
  assert.equal(todayPlayIndex(5, 32), 2);
  assert.equal(todayPlayIndex(5, 32, 1), 3);
  assert.equal(todayPlayIndex(0, 32), -1);
  const day = new Date(2026, 9, 23, 10);
  const ref = playRef('k-life-0211', day);
  assert.equal(ref, 'play:k-life-0211:2026-10-23');
  assert.equal(playItemOf(ref), 'k-life-0211');
  const memos = [memo('a', day, '소리 주고받기', ref)];
  assert.equal(playedToday(memos, 'k-life-0211', day), true);
  assert.equal(playedToday(memos, 'k-life-0212', day), false);
});

test('이번 주 놀이 수는 월요일부터 센다', () => {
  // 2026-10-23 은 금요일 — 월요일 10-19 부터
  const now = new Date(2026, 9, 23, 20);
  const memos = [
    memo('a', new Date(2026, 9, 18, 9), '지난주', 'play:k-life-0211:2026-10-18'),
    memo('b', new Date(2026, 9, 19, 9), '월', 'play:k-life-0211:2026-10-19'),
    memo('c', new Date(2026, 9, 22, 9), '목', 'play:k-life-0212:2026-10-22'),
    memo('d', new Date(2026, 9, 22, 9), '메모', null),
  ];
  assert.equal(weekPlayCount(memos, now), 2);
});

test('성장 일기 — 개월별로 메모 · 발달 체크 · 놀이 · 막대 칸 · 아기 일정을 한 줄씩', () => {
  const now = new Date(2026, 10, 12, 12);
  const months = diaryMonths({
    birthDate: BIRTH,
    now,
    memos: [
      memo('m1', new Date(2026, 9, 19, 9), '처음으로 눈 맞추고 웃었어요'),
      memo('c1', new Date(2026, 10, 4, 9), '엎드려서 고개를 들어요', 'k-dev-0219'),
      memo('p1', new Date(2026, 10, 5, 9), '소리', 'play:k-life-0211:2026-11-05'),
      memo('p2', new Date(2026, 10, 6, 9), '소리', 'play:k-life-0211:2026-11-06'),
      memo('p3', new Date(2026, 10, 7, 9), '거울', 'play:k-life-0213:2026-11-07'),
    ],
    records: [{ id: 'r1', label: 'B형간염 2차 완료', createdAt: new Date(2026, 9, 17, 11).toISOString() }],
    playName: (id) => (id === 'k-life-0211' ? '소리 주고받기' : '거울 보기'),
  });
  assert.deepEqual(
    months.map((m) => m.title),
    ['1개월 · 10월', '0개월 · 9월'],
  );
  const one = months[0].entries.map((e) => [e.kind, e.title, e.day]);
  assert.deepEqual(one, [
    ['stop', '50일이 됐어요', 'D+50'],
    ['play', '놀이 3번', '이번 달'],
    ['check', '엎드려서 고개를 들어요', 'D+46'],
    ['stop', '1개월이 됐어요', 'D+31'],
  ]);
  assert.equal(months[0].entries[1].sub, '소리 주고받기 2번 · 거울 보기 1번');
  assert.deepEqual(
    months[1].entries.map((e) => [e.kind, e.title]),
    [
      ['memo', '처음으로 눈 맞추고 웃었어요'],
      ['schedule', 'B형간염 2차 완료'],
    ],
  );
  assert.equal(monthIndexAt(BIRTH, new Date(2026, 9, 20)), 1);
  assert.equal(monthIndexAt(BIRTH, new Date(2026, 9, 19)), 0);
});

test('주차 · 달 알림 — 주차가 바뀌는 날과 달 · 50일 · 100일, 같은 날이면 달이 이긴다', () => {
  const now = new Date(2026, 9, 23, 12);
  const notices = growthNotices({
    birthDate: BIRTH,
    now,
    days: 30,
    hour: 9,
    minute: 0,
    playFor: () => '아기 소리를 따라 하며 주고받기',
    checkpointOpens: (m) => (m === 2 ? 4 : null),
  });
  assert.deepEqual(
    notices.map((n) => [`${n.at.getMonth() + 1}/${n.at.getDate()}`, n.title]),
    [
      ['10/25', '아기가 6주차가 됐어요'],
      ['11/1', '아기가 7주차가 됐어요'],
      ['11/8', '오늘은 아기가 태어난 지 50일이에요'],
      ['11/15', '아기가 9주차가 됐어요'],
      ['11/20', '아기가 2개월이 됐어요'],
      ['11/22', '아기가 10주차가 됐어요'],
    ],
  );
  assert.equal(notices[0].body, '이번 주에는 「아기 소리를 따라 하며 주고받기」를 해 볼까요?');
  assert.equal(notices[4].body, '4개월까지 대부분 하는 것이 새로 열렸어요.');
  assert.equal(notices[2].body, '다음은 2개월이에요(11월 20일).');
  assert.equal(objectParticle('터미타임'), '을');
  assert.equal(objectParticle('놀기'), '를');
});
