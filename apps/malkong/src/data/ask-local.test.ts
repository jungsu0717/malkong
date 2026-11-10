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
