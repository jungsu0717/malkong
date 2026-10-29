/// <reference types="node" />
/**
 * 첫 실행 「앞으로 1년」 셈 시험 — `node --test src/data/first-year.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayLabel, firstYearPlan } from './first-year.ts';

const DAY = 86_400_000;
const now = new Date(2026, 9, 29, 10);
const today = new Date(2026, 9, 29).getTime();

test('오늘부터 1년 안의 접종 · 검진과 기념일 · 사이즈를 날짜순으로 센다', () => {
  const checkups = [
    { key: 'open', title: 'BCG · B형간염 1차', at: today - 1, tag: '접종', open: true },
    { key: 'soon', title: 'DTaP 1차', at: today + 40 * DAY, tag: '접종', open: false },
    { key: 'far', title: '일본뇌염', at: today + 400 * DAY, tag: '접종', open: false },
  ];
  // 어제 태어난 아기 — 50일 · 100일 · 돌 준비와 사이즈 확인이 모두 1년 안에 온다
  const { total, items } = firstYearPlan('2026-10-28', checkups, now);
  assert.equal(items[0].title, 'BCG · B형간염 1차');
  assert.equal(items[0].at, today);
  assert.ok(items.some((i) => i.title === '50일 촬영 예약' && i.tag === '기념일'));
  assert.ok(items.some((i) => i.title === '기저귀 사이즈 확인' && i.tag === '사이즈'));
  assert.ok(!items.some((i) => i.title === '일본뇌염'));
  assert.equal(total, items.length);
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].at <= items[i].at);
});

test('지난 규칙은 세지 않는다 — 생후 11개월이면 50일 · 100일은 빠지고 돌 준비는 남는다', () => {
  const { items } = firstYearPlan('2025-11-29', [], now);
  assert.ok(!items.some((i) => i.title === '50일 촬영 예약'));
  assert.ok(items.some((i) => i.title === '돌 촬영 예약' || i.title === '돌상 · 돌잡이 준비'));
});

test('날짜 글', () => {
  assert.equal(dayLabel(new Date(2026, 10, 12).getTime()), '11월 12일');
});
