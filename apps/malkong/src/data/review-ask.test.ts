/// <reference types="node" />
/**
 * 스토어 리뷰를 언제 물을지 시험 — `node --test src/data/review-ask.test.ts`. 기준 시각은 2026-10-22 10:00.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shouldAskReview } from './review-ask.ts';

const NOW = new Date(2026, 9, 22, 10, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

test('처음 연 지 3일이 지나고 좋은 순간이 5번 쌓이면 묻는다', () => {
  assert.equal(shouldAskReview({ firstSeen: daysAgo(4), happy: 5, lastAsked: null }, NOW), true);
  // 첫날 · 사흘이 안 됐을 때는 묻지 않는다
  assert.equal(shouldAskReview({ firstSeen: daysAgo(2), happy: 9, lastAsked: null }, NOW), false);
  assert.equal(shouldAskReview({ firstSeen: null, happy: 9, lastAsked: null }, NOW), false);
  // 좋은 순간이 모자라면
  assert.equal(shouldAskReview({ firstSeen: daysAgo(10), happy: 4, lastAsked: null }, NOW), false);
});

test('한 번 띄우면 120일은 쉰다', () => {
  assert.equal(shouldAskReview({ firstSeen: daysAgo(200), happy: 8, lastAsked: daysAgo(30) }, NOW), false);
  assert.equal(shouldAskReview({ firstSeen: daysAgo(200), happy: 8, lastAsked: daysAgo(121) }, NOW), true);
});
