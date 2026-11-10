/// <reference types="node" />
/**
 * 하루 초안 시험 — `node --test src/data/day-draft.test.ts`. 보는 날은 2026-11-09(월), 지난 7일은 11월 2일~8일.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Change } from './agent.ts';
import { applyChangeToDrafts, asksDraft, dayDrafts, draftContext, draftFlow, draftIdOfKey, draftWhen, editDraft, negatedDrafts, stripDraftAsk, usualTimes } from './day-draft.ts';
import type { CareEvent } from './events.ts';

const DAY = new Date(2026, 10, 9);
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
let n = 0;
const ev = (o: Partial<CareEvent> & Pick<CareEvent, 'kind' | 'startAt'>): CareEvent => ({
  id: `e${++n}`,
  endAt: o.startAt,
  amount: null,
  side: null,
  diaper: null,
  color: null,
  note: null,
  by: null,
  createdAt: o.startAt,
  updatedAt: o.startAt,
  ...o,
});

/** 11월 2일~8일 — 날마다 분유 다섯 번, 소변 둘, 대변 하나, 낮잠 둘. 날마다 5분씩 어긋난다 */
function week(): CareEvent[] {
  const out: CareEvent[] = [];
  for (let d = 2; d <= 8; d++) {
    const j = ((d % 3) - 1) * 5;
    for (const [h, m, ml] of [
      [7, 40, 120],
      [10, 30, 140],
      [13, 30, 140],
      [16, 50, 140],
      [19, 50, 150],
    ]) out.push(ev({ kind: 'formula', startAt: at(d, h, m + j), amount: ml + (d === 5 ? 10 : 0) }));
    out.push(ev({ kind: 'diaper', diaper: 'pee', startAt: at(d, 7, 35 + j) }));
    out.push(ev({ kind: 'diaper', diaper: 'poo', startAt: at(d, 10, 40 + j) }));
    out.push(ev({ kind: 'diaper', diaper: 'pee', startAt: at(d, 17, 0 + j) }));
    out.push(ev({ kind: 'sleep', startAt: at(d, 12, 0 + j), endAt: at(d, 13, 10 + j) }));
    out.push(ev({ kind: 'sleep', startAt: at(d, 15, 30 + j), endAt: at(d, 16, 20 + j) }));
    out.push(ev({ kind: 'sleep', startAt: at(d, 21, 0 + j), endAt: at(d + 1, 5, 30) }));
  }
  return out.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

test('초안을 부탁하는 말과 그 나머지', () => {
  assert.equal(asksDraft('오늘 하루 기록 초안으로 작성해 줘. 10시 반에 분유 140 먹었어'), true);
  assert.equal(asksDraft('초안 만들어 줘'), true);
  assert.equal(asksDraft('분유 120 먹였어'), false);
  assert.equal(asksDraft('전체 기록 작성해줘'), true);
  assert.equal(asksDraft('오늘 기록 다 채워 줘'), true);
  assert.equal(asksDraft('오늘 기록 보여줘'), false);
  assert.equal(stripDraftAsk('전체 기록 작성해줘'), '');
  assert.equal(stripDraftAsk('오늘 하루 기록 초안으로 작성해 줘. 10시 반에 분유 140 먹었어'), '10시 반에 분유 140 먹었어');
  assert.equal(stripDraftAsk('초안으로 잡아 주고 7시에 소변 갈았어'), '7시에 소변 갈았어');
  assert.equal(stripDraftAsk('오늘 하루 초안 작성해 줘'), '');
});

test('평소 시각 — 지난 7일에 되풀이된 분유 · 기저귀 · 낮잠, 밤잠은 빼고', () => {
  const list = usualTimes(week(), DAY, new Date(2026, 10, 9, 20, 30));
  const by = (kind: string) => list.filter((u) => u.kind === kind).map((u) => u.minute);
  assert.deepEqual(by('formula'), [7 * 60 + 40, 10 * 60 + 30, 13 * 60 + 30, 16 * 60 + 50, 19 * 60 + 50]);
  assert.deepEqual(by('pee'), [7 * 60 + 35, 17 * 60]);
  assert.deepEqual(by('poo'), [10 * 60 + 40]);
  assert.deepEqual(by('nap'), [12 * 60, 15 * 60 + 30]);
  const f = list.find((u) => u.kind === 'formula' && u.minute === 10 * 60 + 30)!;
  assert.equal(f.amount, 140);
  assert.equal(f.days, 7);
  const nap = list.find((u) => u.kind === 'nap' && u.minute === 12 * 60)!;
  assert.equal(nap.minutes, 70);
  // 사흘이 안 되면 평소가 아니다
  assert.deepEqual(usualTimes(week().filter((e) => new Date(e.startAt).getDate() >= 7), DAY), []);
});

test('하루 초안 — 말한 것은 그대로, 비어 있는 때는 평소로, 이미 적은 기록 근처는 비워 둔다', () => {
  const now = new Date(2026, 10, 9, 20, 30);
  const events = [...week(), ev({ kind: 'breast', startAt: at(9, 7, 45), endAt: at(9, 8, 0) })];
  const said = [{ type: 'event' as const, input: { kind: 'formula' as const, amount: 140, startAt: at(9, 10, 30) }, complete: true, title: '분유 140ml' }];
  const items = dayDrafts({ events, day: DAY, now, said, fill: true });
  const lines = items.map((d) => `${draftWhen(d)} ${d.title}`);
  assert.deepEqual(lines, [
    '07:35쯤 소변',
    '10:30 분유 140ml',
    '10:40쯤 대변',
    '12:00쯤 낮잠 1시간 10분',
    '13:30쯤 분유 140ml',
    '15:30쯤 낮잠 50분',
    '16:50쯤 분유 140ml',
    '17:00쯤 소변',
    '19:50쯤 분유 150ml',
  ]);
  assert.equal(items.filter((d) => !d.guessed).length, 1);
  // 채우지 않으면 말한 것만
  assert.equal(dayDrafts({ events, day: DAY, now, said, fill: false }).length, 1);
  // 오늘이면 지금까지만 — 11시에는 소변 · 분유 · 대변 셋
  const early = dayDrafts({ events, day: DAY, now: new Date(2026, 10, 9, 11, 0), said, fill: true });
  assert.deepEqual(
    early.map((d) => d.title),
    ['소변', '분유 140ml', '대변'],
  );
});

test('흐름에 놓는 모양과 key', () => {
  const items = dayDrafts({ events: [], day: DAY, now: new Date(2026, 10, 9, 20), said: [{ type: 'routine', title: '터미타임', at: at(9, 9, 0) }, { type: 'memo', text: '처음 웃었다', at: at(9, 9, 30) }], fill: false });
  const flow = draftFlow(items);
  assert.equal(flow.routines[0].title, '터미타임');
  assert.equal(flow.memos[0].text, '처음 웃었다');
  assert.equal(draftIdOfKey(`routine-${items[0].id}`), items[0].id);
  assert.equal(draftIdOfKey(`memo-${items[1].id}`), items[1].id);
  assert.equal(draftIdOfKey('routine-abc'), null);
  assert.equal(draftIdOfKey('ev-1'), null);
});

test('작은 창에서 고치기 — 시각을 옮기면 끝도 따라오고, 양과 걸린 시간을 바꾼다', () => {
  const now = new Date(2026, 10, 9, 20, 30);
  const [nap] = dayDrafts({ events: week(), day: DAY, now, said: [], fill: true }).filter((d) => d.title.startsWith('낮잠'));
  const moved = editDraft(nap, { at: nap.at + 10 * 60 * 1000 });
  assert.equal(moved.input.type === 'event' && moved.input.input.startAt, at(9, 12, 10));
  assert.equal(moved.input.type === 'event' && moved.input.input.endAt, at(9, 13, 20));
  assert.equal(moved.edited, true);
  assert.equal(moved.guessed, true);
  const shorter = editDraft(nap, { minutes: 40 });
  assert.equal(shorter.title, '낮잠 40분');
  const formula = { id: 'draft-x', input: { type: 'event' as const, input: { kind: 'formula' as const, amount: 140, startAt: at(9, 10, 30) }, complete: true, title: '분유 140ml' }, title: '분유 140ml', at: new Date(at(9, 10, 30)).getTime(), guessed: false, edited: false };
  assert.equal(editDraft(formula, { amount: 160 }).title, '분유 160ml');
  assert.equal(editDraft(formula, { amount: 9999 }).title, '분유 400ml');
});

test('「오후 낮잠은 안 잤어」 — 규칙으로 뺄 초안을 고른다', () => {
  const now = new Date(2026, 10, 9, 20, 30);
  const items = dayDrafts({ events: week(), day: DAY, now, said: [], fill: true });
  const afternoon = negatedDrafts('오후 낮잠은 안 잤어', items);
  assert.equal(afternoon.length, 1);
  assert.equal(draftWhen(afternoon[0]), '15:30쯤');
  // 낮잠이 둘인데 때가 없으면 정하지 못한다
  assert.equal(negatedDrafts('낮잠은 안 잤어', items).length, 0);
  assert.equal(negatedDrafts('낮잠은 다 안 잤어', items).length, 2);
  assert.equal(negatedDrafts('오후 5시 분유는 안 먹였어', items).map(draftWhen)[0], '16:50쯤');
  assert.equal(negatedDrafts('저녁에 소변 안 쌌어', items).map(draftWhen)[0], '17:00쯤');
  assert.equal(negatedDrafts('분유 먹였어', items).length, 0);
});

test('에이전트가 초안을 가리켜 고치거나 빼면 초안에 바로 반영한다', () => {
  const now = new Date(2026, 10, 9, 20, 30);
  const items = dayDrafts({ events: week(), day: DAY, now, said: [], fill: true });
  const ctx = draftContext(items, 3);
  assert.equal(ctx.records[0].ref, 'r3');
  assert.equal(ctx.sources[0].key, items[0].id);
  const nap = ctx.sources.find((s) => s.label.startsWith('낮잠') && s.type === 'event' && s.event.startAt === at(9, 15, 30))!;
  const del: Change = { op: 'delete', src: nap, title: nap.label, from: '15:30' };
  const r = applyChangeToDrafts(items, del)!;
  assert.equal(r.items.length, items.length - 1);
  assert.equal(r.line, '초안에서 15:30쯤 낮잠 50분을 뺐어요');
  const feed = ctx.sources.find((s) => s.label === '분유 140ml' && s.type === 'event' && s.event.startAt === at(9, 16, 50))!;
  const up: Change = { op: 'update', src: feed, title: feed.label, from: '140ml', to: '160ml', patch: { amount: 160 } };
  const u = applyChangeToDrafts(items, up)!;
  assert.equal(u.line, '초안의 분유 140ml를 160ml로 고쳤어요');
  assert.equal(u.items.find((d) => d.id === draftIdOfKey(feed.key))!.title, '분유 160ml');
  // 초안이 아닌 기록은 null
  const real: Change = { op: 'delete', src: { ...nap, key: 'ev-1' }, title: '잠', from: '15:30' };
  assert.equal(applyChangeToDrafts(items, real), null);
});
