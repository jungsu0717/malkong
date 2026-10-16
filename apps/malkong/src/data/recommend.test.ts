/// <reference types="node" />
/**
 * 시기별 · 있는 곳별 추천 시험 — `node --test src/data/recommend.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { homeTemplates, placeFrom, routineRecommend, todoRecommend } from './recommend.ts';

test('집 — 개월 범위마다, 다음 범위 미리 보기', () => {
  const now = routineRecommend(0, 'home');
  assert.equal(now.label, '생후 0~2개월 추천');
  assert.ok(now.templates.some((t) => t.title === '밤잠 준비'));
  assert.equal(now.next?.label, '2개월부터');
  assert.deepEqual(
    now.next?.templates.map((t) => t.title).slice(0, 3),
    ['아기체육관 놀이', '책 읽어 주기', '뒤집기 연습'],
  );
  const later = routineRecommend(3, 'home');
  assert.equal(later.label, '2개월부터 추천');
  assert.equal(later.next, null);
  assert.ok(later.templates.some((t) => t.title === '목욕') && later.templates.some((t) => t.title === '책 읽어 주기'));
  assert.equal(homeTemplates(0).length, 8);
});

test('병원 · 산후조리원 — 안내와 그곳에서 쓸 만한 것만', () => {
  const care = routineRecommend(0, 'carecenter');
  assert.equal(care.note, '산후조리원에서는 대부분 챙겨 줘요. 집에 오면 추천이 바뀌어요');
  assert.deepEqual(
    care.templates.map((t) => t.title),
    ['모자동실', '손발톱 확인'],
  );
  assert.equal(routineRecommend(0, 'hospital').templates.length, 0);
});

test('할 일 추천 — 신청 · 서류는 없다', () => {
  assert.equal(todoRecommend('carecenter').title, '퇴소 전에 챙길 일');
  for (const p of ['hospital', 'carecenter', 'home'] as const) {
    for (const item of todoRecommend(p).items) assert.doesNotMatch(item, /신고|등록|통장|보험|신청|수당|급여/);
  }
  assert.equal(placeFrom(null), 'home');
  assert.equal(placeFrom('carecenter'), 'carecenter');
});

test('추천에 영양제 · 약은 없다', () => {
  for (const t of homeTemplates(12)) assert.doesNotMatch(t.title, /영양제|비타민|유산균|약/);
});
