/// <reference types="node" />
/**
 * 물어보기 에이전트의 앱 기능 시험 — `node --test src/data/agent-tools.test.ts`. 기준 시각은 2026-11-10(화) 15:00.
 * 서버의 기능 목록(tools.json)과 앱의 실행 코드가 같은 이름과 값을 쓰는지도 본다(decisions/043).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { compareRanges, feedGapAnswer, runTool, TOOL_NAMES, TOOL_VALUES, type ToolEnv } from './agent-tools.ts';
import type { LocalData } from './ask-local.ts';
import { makeEvent, type CareEvent, type EventInput } from './events.ts';
import type { Routine, RoutineLog } from './routine.ts';

const NOW = new Date(2026, 10, 10, 15, 0);
const at = (h: number, m = 0, day = 10) => new Date(2026, 10, day, h, m).toISOString();
const ev = (input: EventInput): CareEvent => makeEvent(input, new Date(input.startAt ?? NOW));

type Catalog = { maxCalls: number; args: Record<string, { values?: string[]; type?: string }>; tools: { name: string; args: string[]; examples: { call: Record<string, string> }[] }[] };
const catalog = JSON.parse(readFileSync(new URL('../../server/app/domain/agent/tools.json', import.meta.url), 'utf8')) as Catalog;

// 이번 주(11월 9일 월 ~ 10일 화)와 지난주(2일 ~ 8일) 낮잠, 오늘과 어제 분유
const naps = [
  ...[2, 3, 4, 5, 6, 7, 8].map((d) => ev({ kind: 'sleep', startAt: at(13, 0, d), endAt: at(14, 40, d) })),
  ...[9, 10].map((d) => ev({ kind: 'sleep', startAt: at(13, 0, d), endAt: at(14, 10, d) })),
];
const feeds = [
  ev({ kind: 'formula', startAt: at(7, 0, 9), amount: 120 }),
  ev({ kind: 'formula', startAt: at(10, 0, 9), amount: 140 }),
  ev({ kind: 'formula', startAt: at(13, 0, 9), amount: 140 }),
  ev({ kind: 'formula', startAt: at(16, 0, 9), amount: 140 }),
  ev({ kind: 'formula', startAt: at(7, 10), amount: 120 }),
  ev({ kind: 'formula', startAt: at(10, 10), amount: 140 }),
  ev({ kind: 'formula', startAt: at(13, 10), amount: 160 }),
];
const routine = { id: 'r1', title: '손톱 깎기', kind: 'check', everyDays: 1, weekdays: null, time: null, items: null, sort: 0 } as unknown as Routine;
const log = { id: 'l1', routineId: 'r1', at: at(20, 10, 3), by: null, step: null, skip: false, createdAt: at(20, 10, 3) } as RoutineLog;
const data: LocalData = { events: [...naps, ...feeds], routines: [routine], logs: [log], todos: [], generalTopic: null, memos: [] };
const env: ToolEnv = { data, viewDay: NOW, now: NOW, selected: null };
const text = (call: Parameters<typeof runTool>[0]) => {
  const r = runTool(call, env);
  return r?.kind === 'answer' ? r.answer.text : r;
};

test('서버의 기능 목록과 앱의 실행 코드가 같은 이름과 값을 쓴다', () => {
  assert.deepEqual(catalog.tools.map((t) => t.name).sort(), [...TOOL_NAMES].sort());
  for (const [name, arg] of Object.entries(catalog.args)) {
    if (arg.type === 'string') continue;
    assert.deepEqual(arg.values, TOOL_VALUES[name], name);
  }
  // 지시문의 보기 하나하나를 앱이 실행할 수 있어야 한다
  for (const tool of catalog.tools) for (const ex of tool.examples) assert.ok(runTool(ex.call as never, env), `${tool.name} ${JSON.stringify(ex.call)}`);
});

test('두 기간 견주기 — 여러 날은 하루 평균, 오늘과 어제는 같은 시각까지', () => {
  assert.equal(compareRanges('nap', 'duration', 'thisWeek', 'lastWeek', data.events, NOW).text, '이번 주 낮잠은 하루 평균 1시간 10분, 지난주는 1시간 40분이에요. 지난주보다 30분 줄었어요.');
  assert.equal(compareRanges('formula', 'amount', 'today', 'yesterday', data.events, NOW).text, '오늘 분유는 지금까지 420ml, 어제 이 시각까지는 400ml였어요. 어제보다 20ml 늘었어요.');
});

test('수유 간격 — 최근 사흘 간격, 마지막 수유에서 지난 시간, 다음 수유', () => {
  assert.equal(feedGapAnswer(data.events, NOW).text, '최근 사흘 수유 간격은 3시간쯤이에요. 마지막 수유(13:10 분유 160ml)에서 1시간 50분 지났어요. 다음은 16:10쯤이에요.');
});

test('기능마다 앱의 답 — 이름 찾기, 하루 요약, 초안과 메모 창은 화면 동작', () => {
  assert.equal(text({ tool: 'find_name', name: '손톱', when: 'today' }), '오늘은 「손톱 깎기」 기록이 없어요. 마지막은 11월 3일 20:10이에요.');
  assert.equal(text({ tool: 'find_name', name: '손톱', when: 'last' }), '마지막은 11월 3일 20:10이에요.');
  assert.equal(text({ tool: 'total', what: 'formula', range: 'today', measure: 'amount' })?.toString().startsWith('오늘 분유 420ml'), true);
  assert.equal(text({ tool: 'wake', sleep: 'nap' }), '오늘 14:10에 깼어요. 낮잠 1시간 10분이었어요. 지난 7일 낮잠은 평균 1시간 35분이었어요.');
  assert.deepEqual(runTool({ tool: 'day_draft' }, env), { kind: 'action', action: 'draft' });
  assert.deepEqual(runTool({ tool: 'write_diary' }, env), { kind: 'action', action: 'diary' });
  // 모르는 기능, 목록에 없는 값은 실행하지 않는다
  assert.equal(runTool({ tool: 'delete_all' }, env), null);
  assert.equal(runTool({ tool: 'total', what: 'nail', range: 'today', measure: 'count' }, env), null);
});

test('모델 없이 고르는 기능 — 두 기간 견주기, 기간 없는 견주기는 카드, 수유 간격', async () => {
  const { localIntent, rangesIn } = await import('./agent-tools.ts');
  assert.deepEqual(rangesIn('이번 주 낮잠이 지난주보다 줄었어?'), ['thisWeek', 'lastWeek']);
  assert.deepEqual(rangesIn('어제 밤에 몇 시간 잤어?'), ['lastNight']);
  assert.deepEqual(localIntent('이번 주 낮잠이 지난주보다 줄었어?'), { kind: 'run', call: { tool: 'compare_ranges', what: 'nap', measure: 'duration', range: 'thisWeek', rangeB: 'lastWeek' } });
  assert.deepEqual(localIntent('오늘 어제보다 많이 먹었어?'), { kind: 'run', call: { tool: 'compare_ranges', what: 'feed', measure: 'count', range: 'today', rangeB: 'yesterday' } });
  assert.deepEqual(localIntent('이번 주 분유 줄었어?'), { kind: 'run', call: { tool: 'compare_ranges', what: 'formula', measure: 'amount', range: 'thisWeek', rangeB: 'lastWeek' } });
  const choose = localIntent('낮잠 줄었어?');
  assert.equal(choose?.kind, 'choose');
  assert.deepEqual(choose?.kind === 'choose' ? choose.calls.map((c) => c.tool) : [], ['compare_ranges', 'compare_ranges', 'compare_previous']);
  assert.deepEqual(localIntent('요즘 몇 시간마다 먹어?'), { kind: 'run', call: { tool: 'feed_gap' } });
  // 견주는 말이 아니거나 기록 종류가 없으면 고르지 않는다
  assert.equal(localIntent('오늘 분유 몇 번 먹었어?'), null);
  assert.equal(localIntent('더 재워야 하나?'), null);
});

test('카드 글 — 앱이 기능에서 쓴다', async () => {
  const { localIntent, suggestFor, toolLabel } = await import('./agent-tools.ts');
  const choose = localIntent('낮잠 줄었어?');
  const labels = choose?.kind === 'choose' ? choose.calls.map((c) => toolLabel(c)) : [];
  assert.deepEqual(
    labels.map((l) => [l.title, l.sub, l.tile]),
    [
      ['이번 주와 지난주 낮잠', '하루 평균으로 비교해요', 'sleep'],
      ['오늘과 어제 낮잠', '지금 시각까지 비교해요', 'sleep'],
      ['방금 낮잠과 그 앞 낮잠', '잔 시간으로 비교해요', 'sleep'],
    ],
  );
  assert.deepEqual(
    suggestFor('애기 요즘 어때?').map((c) => toolLabel(c).title),
    ['오늘 하루 요약', '이번 주와 지난주 잠', '요즘 수유 간격'],
  );
  assert.deepEqual(
    suggestFor('기저귀 괜찮나?').map((c) => toolLabel(c).title),
    ['마지막 기저귀', '오늘 기저귀', '마지막 기저귀를 남긴 사람'],
  );
  // 카드의 기능은 모두 앱이 실행할 수 있어야 한다
  for (const c of [...suggestFor('애기 요즘 어때?'), ...suggestFor('잠 어때?'), ...suggestFor('수유 어때?'), ...suggestFor('기저귀 어때?'), ...suggestFor('체온 어때?')]) assert.ok(runTool(c, env), JSON.stringify(c));
});

test('한쪽 기간에만 기록이 있으면 견주지 않고 있는 쪽만', () => {
  const onlyLast = data.events.filter((e) => new Date(e.startAt).getTime() < new Date(2026, 10, 9).getTime());
  assert.equal(compareRanges('nap', 'duration', 'thisWeek', 'lastWeek', onlyLast, NOW).text, '이번 주는 낮잠 기록이 없어요. 지난주는 하루 평균 1시간 40분이었어요.');
  assert.equal(compareRanges('formula', 'amount', 'today', 'yesterday', [], NOW).text, '오늘과 어제 모두 분유 기록이 없어요.');
});

test('섞인 기록은 조각을 모두 읽었을 때만 규칙으로, 「요즘 어때?」는 오늘 요약이 아니다', async () => {
  const { splitAll } = await import('./ask.ts');
  const { asksDaySummary } = await import('./ask-local.ts');
  assert.equal(splitAll('10분 전에 소변 기저귀 갈고 분유 120 먹였어', NOW).length, 2);
  assert.equal(splitAll('분유 120 먹이고 할머니 댁 다녀왔어', NOW).length, 0);
  assert.equal(asksDaySummary('애기 요즘 어때?'), false);
  const { searchTerms } = await import('./ask-local.ts');
  assert.deepEqual(searchTerms('애기 요즘 어때?'), []);
  assert.deepEqual(searchTerms('목욕은 괜찮아?'), ['목욕']);
  assert.equal(asksDaySummary('오늘 어땠어?'), true);
});
