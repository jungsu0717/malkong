/// <reference types="node" />
/**
 * 시기별 · 있는 곳별 추천 시험 — `node --test src/data/recommend.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gridSuggestions, homeTemplates, placeFrom, routineRecommend, stepsDiffer, todoRecommend } from './recommend.ts';

const titles = (month: number) => homeTemplates(month).map((t) => t.title);
const sleepSteps = (month: number) => homeTemplates(month).find((t) => t.title === '밤잠 준비')?.items ?? [];

test('집 — 시기마다 추천, 다음 시기에 새로 들어오는 것', () => {
  const now = routineRecommend(0, 'home');
  assert.equal(now.label, '생후 0~2개월 추천');
  assert.ok(now.templates.some((t) => t.title === '밤잠 준비'));
  assert.equal(now.next?.label, '2개월부터');
  assert.deepEqual(
    now.next?.templates.map((t) => t.title).slice(0, 3),
    ['아기체육관 놀이', '책 읽어 주기', '뒤집기 연습'],
  );
  const six = routineRecommend(4, 'home');
  assert.equal(six.label, '2개월부터 추천');
  assert.deepEqual(
    six.next?.templates.map((t) => t.title),
    ['이유식', '낮잠'],
  );
  assert.equal(routineRecommend(18, 'home').label, '12개월부터 추천');
  assert.equal(routineRecommend(18, 'home').next, null);
  assert.equal(homeTemplates(0).length, 8);
});

test('개월 수에 맞는 루틴 — 속싸개는 2개월 전까지, 이유식 6개월 · 컵 9개월 · 양치 12개월부터', () => {
  assert.ok(sleepSteps(1).includes('스와들 입히기'));
  for (const m of [2, 4, 6, 9, 12, 18]) assert.ok(!sleepSteps(m).includes('스와들 입히기'), `${m}개월`);
  assert.ok(titles(1).includes('터미타임') && !titles(1).includes('이유식'));
  assert.ok(titles(4).includes('뒤집기 연습') && !titles(4).includes('이유식'));
  assert.ok(titles(6).includes('이유식') && titles(6).includes('낮잠'));
  assert.ok(!titles(6).includes('뒤집기 연습') && !titles(6).includes('터미타임'));
  assert.ok(titles(9).includes('컵으로 마시기 연습') && titles(9).includes('걸음마 연습'));
  assert.deepEqual(homeTemplates(9).find((t) => t.title === '이유식')?.items, ['아침', '점심', '저녁']);
  assert.ok(titles(12).includes('양치') && titles(12).includes('유아식') && !titles(12).includes('이유식'));
  assert.ok(!titles(12).includes('젖병 소독'));
  assert.deepEqual(titles(18), titles(12));
});

test('루틴 탭 추천 버튼 — 적을 때는 전부, 세 개부터는 이 시기에 새로 들어온 것 두 개까지, 숨긴 것은 빼고', () => {
  assert.equal(gridSuggestions(0, []).length, 8);
  assert.equal(gridSuggestions(0, ['목욕']).length, 7);
  // 6개월 — 신생아 때 넣은 루틴만 있으면 이유식 · 낮잠이 나타난다
  const six = gridSuggestions(6, ['목욕', '밤잠 준비', '터미타임', '젖병 소독']);
  assert.deepEqual(
    six.map((t) => t.title),
    ['이유식', '낮잠'],
  );
  assert.deepEqual(
    gridSuggestions(6, ['목욕', '밤잠 준비', '이유식'], ['낮잠']).map((t) => t.title),
    [],
  );
  assert.deepEqual(
    gridSuggestions(12, ['목욕', '밤잠 준비', '산책']).map((t) => t.title),
    ['양치', '유아식'],
  );
});

test('단계가 바뀐 루틴 — 신생아 때 넣은 밤잠 준비', () => {
  const vest = homeTemplates(4).find((t) => t.title === '밤잠 준비')!;
  assert.equal(stepsDiffer(vest, ['스와들 입히기', '수유', '트림', '자장가 부르며 재우기']), true);
  assert.equal(stepsDiffer(vest, vest.items ?? null), false);
  assert.equal(stepsDiffer(vest, null), false);
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

test('할 일 추천 — 개월 수에 맞는 묶음, 신청 · 서류와 보행기는 없다', () => {
  assert.equal(todoRecommend('carecenter').groups[0].title, '퇴소 전에 챙길 일');
  assert.deepEqual(
    todoRecommend('home', 1).groups.map((g) => g.title),
    ['집에 온 뒤 챙길 일'],
  );
  assert.equal(todoRecommend('home', 1).next?.label, '4개월부터');
  assert.deepEqual(
    todoRecommend('home', 6).groups.map((g) => g.title),
    ['이유식 준비', '집 안 안전'],
  );
  assert.deepEqual(
    todoRecommend('home', 10).groups.map((g) => g.title),
    ['걸음마 준비', '돌 준비'],
  );
  assert.deepEqual(
    todoRecommend('home', 15).groups.map((g) => g.title),
    ['유아 식기 · 컵', '어린이집 준비물'],
  );
  assert.equal(todoRecommend('home', 15).next, null);
  for (const p of ['hospital', 'carecenter', 'home'] as const) {
    for (const m of [0, 4, 9, 12]) {
      for (const g of todoRecommend(p, m).groups) {
        for (const item of g.items) assert.doesNotMatch(item, /신고|등록|통장|보험|신청|수당|급여|보행기/);
      }
    }
  }
  // 아기 일정이 저절로 만드는 돌 할 일과 겹치지 않는다
  const dol = todoRecommend('home', 10).groups.flatMap((g) => g.items);
  for (const item of ['돌잔치 장소 예약', '돌 촬영 예약', '돌상 · 돌잡이 준비']) assert.ok(!dol.includes(item));
  assert.equal(placeFrom(null), 'home');
  assert.equal(placeFrom('carecenter'), 'carecenter');
});

test('추천에 영양제 · 약은 없다', () => {
  for (const m of [0, 2, 6, 9, 12]) for (const t of homeTemplates(m)) assert.doesNotMatch(t.title, /영양제|비타민|유산균|약/);
});
