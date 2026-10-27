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
  assert.deepEqual(
    now.templates.map((t) => t.title),
    ['목욕', '밤잠 준비', '손발톱 깎기', '터미타임', '재고 확인', '아기 침구 빨래', '분유포트 세척', '가습기 청소'],
  );
  assert.equal(now.next?.label, '2개월부터');
  assert.deepEqual(
    now.next?.templates.map((t) => t.title),
    ['산책', '장난감 소독', '쪽쪽이 바꾸기'],
  );
  assert.deepEqual(
    routineRecommend(4, 'home').next?.templates.map((t) => t.title),
    ['이유식'],
  );
  // 9개월은 이유식 단계만 바뀌어 미리 볼 것이 없다 — 12개월을 미리 보인다
  const six = routineRecommend(6, 'home');
  assert.equal(six.next?.label, '12개월부터');
  assert.deepEqual(
    six.next?.templates.map((t) => t.title),
    ['양치', '유아식', '간식'],
  );
  assert.equal(routineRecommend(18, 'home').label, '12개월부터 추천');
  assert.equal(routineRecommend(18, 'home').next, null);
});

test('개월 수에 맞는 루틴 — 속싸개는 2개월 전까지, 이유식 6개월 · 양치 12개월부터, 놀이는 없다(task today/006)', () => {
  assert.ok(sleepSteps(1).includes('스와들 입히기'));
  for (const m of [2, 4, 6, 9, 12, 18]) assert.ok(!sleepSteps(m).includes('스와들 입히기'), `${m}개월`);
  assert.ok(titles(1).includes('터미타임') && !titles(1).includes('이유식'));
  assert.ok(titles(4).includes('터미타임') && titles(4).includes('산책') && !titles(4).includes('이유식'));
  assert.ok(titles(6).includes('이유식') && !titles(6).includes('터미타임'));
  assert.deepEqual(homeTemplates(9).find((t) => t.title === '이유식')?.items, ['아침', '점심', '저녁']);
  assert.ok(titles(12).includes('양치') && titles(12).includes('유아식') && !titles(12).includes('이유식'));
  for (const gone of ['분유포트 세척', '쪽쪽이 바꾸기']) assert.ok(!titles(12).includes(gone), gone);
  assert.deepEqual(titles(18), titles(12));
  // 놀이는 성장 탭 「오늘의 놀이」에 맡긴다. 루틴은 모두 한 번 누르는 체크이거나 재고 확인
  for (const m of [0, 2, 6, 9, 12]) {
    for (const t of homeTemplates(m)) {
      assert.doesNotMatch(t.title, /체육관|뒤집기|걸음마|책 읽어|컵으로|낮잠/, `${m}개월 ${t.title}`);
      // 쌓이면 눈에 띄어서 하게 되는 일은 추천하지 않는다
      assert.doesNotMatch(t.title, /휴지통|아기 빨래|가제수건|젖병/, `${m}개월 ${t.title}`);
      assert.ok(t.kind === 'check' || t.kind === 'stock', t.title);
    }
  }
});

test('루틴 탭 추천 버튼 — 지금 시기 추천 중 안 넣고 숨기지 않은 것 전부, 루틴 수로 개수가 바뀌지 않는다', () => {
  const all = titles(0);
  assert.deepEqual(gridSuggestions(0, []).map((t) => t.title), all);
  // 하나씩 넣어도 그 버튼만 빠진다 — 세 개째에 나머지가 한꺼번에 사라지지 않는다
  for (let n = 1; n <= all.length; n++) {
    assert.deepEqual(gridSuggestions(0, all.slice(0, n)).map((t) => t.title), all.slice(n), `${n}개 넣은 뒤`);
  }
  // 이름은 띄어쓰기를 빼고 본다
  assert.ok(!gridSuggestions(0, ['손발톱깎기']).some((t) => t.title === '손발톱 깎기'));
  // 6개월 — 신생아 때 넣은 루틴만 있으면 이유식이 나타난다
  assert.ok(gridSuggestions(6, ['목욕', '밤잠 준비', '터미타임']).some((t) => t.title === '이유식'));
  assert.ok(!gridSuggestions(6, ['목욕'], ['이유식']).some((t) => t.title === '이유식'));
  assert.deepEqual(
    gridSuggestions(12, ['목욕', '밤잠 준비', '산책']).slice(0, 3).map((t) => t.title),
    ['양치', '유아식', '간식'],
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
    ['모자동실', '손발톱 깎기'],
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
