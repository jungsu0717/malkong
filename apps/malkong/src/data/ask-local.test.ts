/// <reference types="node" />
/**
 * 물어보기 — 기기 안에서 바로 답하는 물음 시험 — `node --test src/data/ask-local.test.ts`. 기준 시각은 2026-11-10(화) 15:00.
 * 빌드 15 피드백: 「오늘 손톱 잘랐나?」에 기저귀 답, 「ㅋㅋ 나 오늘 전체 뭐했어?」에 「할 일로 추가」 카드.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asksDaySummary, daySummaryAnswer, findAnswer, knowsTerm, questionFits, searchTerms, type LocalData } from './ask-local.ts';
import { isQuestion } from './ask.ts';
import { makeEvent, type CareEvent, type EventInput } from './events.ts';
import type { Routine, RoutineLog } from './routine.ts';
import { makeMemo } from './stage.ts';

const NOW = new Date(2026, 10, 10, 15, 0);
const at = (h: number, m = 0, day = 10) => new Date(2026, 10, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));
const routine = (id: string, title: string): Routine => ({ id, title, kind: 'check', everyDays: 1, weekdays: null, time: null, items: null, deletedAt: null, sort: 0, createdAt: at(0), updatedAt: at(0) }) as unknown as Routine;
const log = (id: string, routineId: string, when: string): RoutineLog => ({ id, routineId, at: when, by: null, step: null, skip: false, createdAt: when }) as RoutineLog;

const data: LocalData = {
  events: [
    ev({ kind: 'diaper', startAt: at(7, 35), diaper: 'pee' }),
    ev({ kind: 'formula', startAt: at(10, 30), amount: 140, note: '트림을 두 번 했어요' }),
    ev({ kind: 'diaper', startAt: at(10, 40), diaper: 'poo' }),
    ev({ kind: 'sleep', startAt: at(12), endAt: at(13, 10) }),
    ev({ kind: 'formula', startAt: at(13, 30), amount: 140 }),
  ],
  routines: [routine('r1', '손톱 깎기'), routine('r2', '비타민D'), routine('r3', '목욕')],
  logs: [log('l1', 'r1', at(20, 10, 3)), log('l2', 'r2', at(8, 0)), log('l3', 'r3', at(19, 30, 9))],
  todos: [],
  generalTopic: null,
  memos: [makeMemo('뒤집기', new Date(2026, 10, 10, 11), 'cdc-roll')],
};

test('물음표 없는 물음도 물음으로 읽는다', () => {
  assert.equal(isQuestion('오늘 손톱 잘랐나'), true);
  assert.equal(isQuestion('목욕 시켰니'), true);
  assert.equal(isQuestion('나 오늘 전체 뭐했어'), true);
  assert.equal(isQuestion('분유 120 먹였어'), false);
  assert.equal(isQuestion('10분 전에 소변 기저귀 갈았어'), false);
  assert.equal(isQuestion('오늘 하루 기록 초안으로 작성해 줘'), false);
});

test('하루 전체를 묻는 말 — 그날 합계와 루틴 · 발달 체크', () => {
  assert.equal(asksDaySummary('ㅋㅋ 나 오늘 전체 뭐했어?'), true);
  assert.equal(asksDaySummary('오늘 하루 요약해 줘'), true);
  assert.equal(asksDaySummary('어제 어땠어?'), true);
  assert.equal(asksDaySummary('오늘 분유 몇 번 먹었어?'), false);
  assert.equal(asksDaySummary('오늘 하루 기록 초안으로 작성해 줘'), false);
  const a = daySummaryAnswer('ㅋㅋ 나 오늘 전체 뭐했어?', data, NOW, NOW);
  assert.equal(a.text, '오늘은 수유 2번 280ml, 기저귀 2번, 잠 1시간 10분이에요. 비타민D, 발달 체크 「뒤집기」 기록도 있어요.');
  assert.ok(a.keys.length >= 6);
  assert.equal(daySummaryAnswer('어제 어땠어?', { ...data, events: [], memos: [] }, NOW, NOW).text, '어제는 목욕 기록이 있어요.');
  assert.equal(daySummaryAnswer('그제 뭐 했어?', { ...data, events: [], logs: [], memos: [] }, NOW, NOW).text, '그제는 아직 기록이 없어요.');
});

test('찾을 이름 — 때와 동사와 조사를 뗀다', () => {
  assert.deepEqual(searchTerms('오늘 손톱 잘랐나?'), ['손톱']);
  assert.deepEqual(searchTerms('비타민D 먹였나?'), ['비타민d']);
  assert.deepEqual(searchTerms('오늘 목욕했나'), ['목욕']);
  assert.deepEqual(searchTerms('마지막으로 목욕한 게 언제야?'), ['목욕']);
  assert.deepEqual(searchTerms('오늘 분유 몇 번 먹었어?'), []);
});

test('루틴 · 할 일 · 메모에 있는 일을 이름으로 찾는다', () => {
  assert.equal(findAnswer('오늘 손톱 잘랐나?', data, NOW, NOW)?.text, '오늘은 「손톱 깎기」 기록이 없어요. 마지막은 11월 3일 20:10이에요.');
  assert.equal(findAnswer('비타민D 먹였나?', data, NOW, NOW)?.text, '오늘 08:00에 비타민D 기록이 있어요.');
  assert.equal(findAnswer('어제 목욕했나', data, NOW, NOW)?.text, '어제 19:30에 목욕 기록이 있어요.');
  assert.equal(findAnswer('마지막으로 목욕한 게 언제야?', data, NOW, NOW)?.text, '마지막은 어제 19:30이에요.');
  assert.equal(findAnswer('오늘 뒤집기 했어?', data, NOW, NOW)?.text, '오늘 발달 체크에 「뒤집기」를 남겼어요.');
  assert.equal(findAnswer('트림 했어?', data, NOW, NOW)?.text, '오늘 10:30에 남긴 메모가 있어요. 「트림을 두 번 했어요」');
  assert.equal(findAnswer('오늘 산책 다녀왔나?', data, NOW, NOW)?.text, '오늘은 「산책」 기록이 없어요.');
  // 기록을 묻는 말과 가리키는 말은 여기서 답하지 않는다
  assert.equal(findAnswer('오늘 분유 몇 번 먹었어?', data, NOW, NOW), null);
  assert.equal(findAnswer('이거 언제 했어?', data, NOW, NOW), null);
  assert.equal(knowsTerm('비타민D 먹였나?', data), true);
  assert.equal(knowsTerm('오늘 분유 먹였나?', data), false);
});

test('이어 묻기는 짧은 말만 — 「오늘 몇 시에 일어났어?」를 앞 답의 대변에 붙이지 않는다', async () => {
  const { followUp, answerFor } = await import('./ask.ts');
  const last = answerFor({ what: 'poo', range: { key: 'today', from: new Date(2026, 10, 10).getTime(), to: new Date(2026, 10, 11).getTime(), label: '오늘' }, measure: 'last' }, data.events, NOW);
  assert.equal(followUp('오늘 몇 시에 일어났어?', last, NOW), null);
  assert.ok(followUp('어제는?', last, NOW));
  assert.deepEqual(searchTerms('오늘 몇 시에 일어났어?'), []);
});

test('에이전트가 고른 찾기 조건이 물음과 맞아야 쓴다', () => {
  assert.equal(questionFits('오늘 손톱 잘랐나?', 'diaper'), false);
  assert.equal(questionFits('마지막 대변은?', 'poo'), true);
  assert.equal(questionFits('어제 몇 시에 잤어?', 'sleep'), true);
});

test('깬 시각 — 마지막으로 깬 잠과 지난 7일 같은 잠 평균', async () => {
  const { wakeAnswer } = await import('./ask-local.ts');
  const nights = [4, 5, 6, 7, 8, 9].map((d) => ev({ kind: 'sleep', startAt: at(21, 0, d), endAt: at(6, 0, d + 1) }));
  const evs = [...nights, ev({ kind: 'sleep', startAt: at(21, 30, 9), endAt: at(6, 30, 10) }), ...data.events];
  // 오늘 마지막으로 깬 것은 낮잠(13:10)
  assert.equal(wakeAnswer('오늘 몇 시에 일어났어?', evs, NOW)?.text, '오늘 13:10에 깼어요. 낮잠 1시간 10분이었어요.');
  assert.equal(wakeAnswer('오늘 아침에 몇 시에 일어났어?', evs, NOW)?.text, '오늘 06:30에 깼어요. 밤잠 9시간이었어요. 지난 7일 밤잠은 평균 9시간이었어요.');
  const sleeping = [...evs, ev({ kind: 'sleep', startAt: at(14, 20) })];
  assert.equal(wakeAnswer('몇 시에 깼어?', sleeping, NOW)?.text, '지금 자는 중이에요. 14:20에 잠들었어요.');
  assert.equal(wakeAnswer('분유 몇 시에 먹었어?', evs, NOW), null);
});

test('누가 — 기록을 남긴 사람', async () => {
  const { whoAnswer } = await import('./ask-local.ts');
  const evs = [...data.events, ev({ kind: 'formula', startAt: at(14, 10), amount: 120, by: '엄마' })];
  assert.equal(whoAnswer('누가 마지막으로 분유 줬어?', evs, NOW)?.text, '오늘 14:10 분유 120ml는 엄마가 남긴 기록이에요.');
  assert.equal(whoAnswer('누가 마지막으로 기저귀 갈았어?', evs, NOW)?.text, '오늘 10:40 대변은 남긴 사람이 적혀 있지 않아요. 가족과 함께 쓰면 남긴 사람이 적혀요.');
  assert.equal(whoAnswer('마지막 대변은?', evs, NOW), null);
});

test('앞 기록과 비교 — 선택한 기록, 없으면 마지막', async () => {
  const { asksCompare, compareAnswer } = await import('./ask-local.ts');
  const evs = [...data.events, ev({ kind: 'formula', startAt: at(14, 10), amount: 120 })];
  assert.equal(asksCompare('이거 앞 수유보다 많이 먹은 거야?'), true);
  assert.equal(asksCompare('분유 120 먹였어'), false);
  assert.equal(compareAnswer('이거 앞 수유보다 많이 먹은 거야?', evs, null, NOW)?.text, '분유 120ml는 앞 수유(13:30, 140ml)보다 20ml 적어요.');
  const picked = evs.find((e) => e.kind === 'formula' && e.startAt === at(13, 30))!;
  assert.equal(compareAnswer('이거 앞 수유보다 많이 먹은 거야?', evs, picked, NOW)?.text, '분유 140ml는 앞 수유(10:30, 140ml)와 같아요.');
});

test('평소와 견준 한 줄 — 오늘은 지난 7일의 이 시각까지 평균', async () => {
  const { answerFor } = await import('./ask.ts');
  const past = [4, 5, 6, 7, 8, 9].flatMap((d) => [ev({ kind: 'formula', startAt: at(9, 0, d), amount: 120 }), ev({ kind: 'formula', startAt: at(12, 0, d), amount: 140 }), ev({ kind: 'formula', startAt: at(18, 0, d), amount: 160 })]);
  const evs = [...past, ...data.events];
  const today = { key: 'today' as const, from: new Date(2026, 10, 10).getTime(), to: new Date(2026, 10, 11).getTime(), label: '오늘' };
  const a = answerFor({ what: 'formula', range: today, measure: 'amount' }, evs, NOW);
  assert.ok(a.text.endsWith('지난 6일은 이 시각까지 평균 260ml였어요.'), a.text);
});

test('「초안」이라는 말이 없어도 하루 초안', async () => {
  const { asksDraft } = await import('./day-draft.ts');
  assert.equal(asksDraft('오늘 하루에 대해 이전 기록들을 보고 하루 기록 전체 초안 만들어줘'), true);
  assert.equal(asksDraft('이전 기록 보고 오늘 기록 채워줘'), true);
  assert.equal(asksDraft('평소대로 오늘 기록 만들어 줘'), true);
  assert.equal(asksDraft('평소처럼 분유 120 먹였어'), false);
});

test('초안을 부탁한 말은 기록으로 읽지 않는다 — 모델로 다시 보내지 않게', async () => {
  const { stripDraftAsk } = await import('./day-draft.ts');
  assert.equal(stripDraftAsk('이전 기록 보고 오늘 기록 채워줘'), '');
  assert.equal(stripDraftAsk('오늘 하루 기록 초안으로 작성해 줘. 10시 반에 분유 140 먹었어'), '10시 반에 분유 140 먹었어');
});
