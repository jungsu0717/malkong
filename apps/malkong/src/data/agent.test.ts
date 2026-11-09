/// <reference types="node" />
/**
 * 물어보기 에이전트 시험 — `node --test src/data/agent.test.ts`. 기준 시각은 2026-11-06(금) 14:20.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { changesFrom, dayContext, lastTurns, onlyAdds, pointsOrEdits, selectedLabel, sourceOfKey, whenLabel } from './agent.ts';
import type { CareEvent } from './events.ts';
import type { RoutineLog } from './routine.ts';
import type { Memo } from './stage.ts';

const NOW = new Date(2026, 10, 6, 14, 20);
const at = (h: number, m = 0, d = 6) => new Date(2026, 10, d, h, m).toISOString();
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

const night = ev({ kind: 'sleep', startAt: at(21, 30, 5), endAt: at(6, 50) });
const left = ev({ kind: 'breast', side: 'left', startAt: at(7, 45), endAt: at(8, 0) });
const right = ev({ kind: 'breast', side: 'right', startAt: at(8, 2), endAt: at(8, 12) });
const f1 = ev({ kind: 'formula', amount: 140, startAt: at(10, 50), by: '엄마' });
const f2 = ev({ kind: 'formula', amount: 120, startAt: at(13, 50), by: '아빠' });
const nap = ev({ kind: 'sleep', startAt: at(12, 0), endAt: at(13, 10) });
const yesterday = ev({ kind: 'diaper', diaper: 'pee', startAt: at(9, 0, 5) });
const EVENTS = [yesterday, night, left, right, f1, nap, f2];
const tummy: RoutineLog = { id: 'l1', routineId: 'rt1', at: at(11, 30), endAt: at(11, 45), by: null, step: null, skip: false, createdAt: at(11, 45) };
const stepLog: RoutineLog = { id: 'l2', routineId: 'rt1', at: at(11, 0), by: null, step: 0, skip: false, createdAt: at(11, 0) };
const memo: Memo = { id: 'mm1', at: at(9, 10), text: '처음으로 뒤집기를 했어요\n둘째 줄', ref: null, createdAt: at(9, 10), updatedAt: at(9, 10) };
const devMemo: Memo = { id: 'mm-x', at: at(9, 20), text: '발달 체크', ref: 'x', createdAt: at(9, 20), updatedAt: at(9, 20) };

const ctx = dayContext(
  NOW,
  EVENTS,
  [
    { log: tummy, title: '터미타임' },
    { log: stepLog, title: '터미타임' },
  ],
  [memo, devMemo],
  NOW,
);

test('보는 날의 기록 — 시각 순서로 r1 부터, 전날 밤 잠은 들어가고 전날 기저귀 · 단계 줄 · 발달 메모는 빠진다', () => {
  assert.equal(ctx.day, '2026-11-06');
  assert.deepEqual(
    ctx.records.map((r) => `${r.ref} ${r.kind}`),
    ['r1 sleep', 'r2 breast', 'r3 breast', 'r4 memo', 'r5 formula', 'r6 routine', 'r7 sleep', 'r8 formula'],
  );
  assert.equal(ctx.records[4].by, '엄마');
  assert.equal(ctx.records[5].title, '터미타임');
  assert.equal(ctx.records[5].endAt, tummy.endAt);
});

test('흐름의 key — 수유 세션은 첫 줄 id, 루틴 · 메모는 접두어', () => {
  assert.equal(ctx.sources[2].key, left.id);
  assert.equal(ctx.sources[3].key, 'memo-mm1');
  assert.equal(ctx.sources[5].key, 'routine-l1');
  const s = sourceOfKey(ctx, f2.id);
  assert.equal(s?.ref, 'r8');
  assert.equal(selectedLabel(s!), '13:50 분유 120ml');
  assert.equal(sourceOfKey(ctx, 'todo-1'), null);
});

test('가리키거나 고치는 말', () => {
  for (const s of ['이거 앞 수유보다 많이 먹은 거야?', '10분 앞으로 옮겨 줘', '지워 줘', '분유 140으로 바꿔 줘', '30분 뒤로']) assert.ok(pointsOrEdits(s), s);
  for (const s of ['분유 120 먹였어', '이전 수유 언제 했어?', '오늘 분유 몇 ml?']) assert.ok(!pointsOrEdits(s), s);
});

test('수정 — 시각을 옮기면 끝도 함께, 바뀌는 칸만 「13:50 → 13:40」', () => {
  const [c] = changesFrom([{ op: 'update', ref: 'r8', startAt: '2026-11-06T13:40:00+09:00', amount: 120 }], ctx, NOW);
  assert.equal(c.op, 'update');
  if (c.op !== 'update') return;
  assert.equal(c.title, '분유 120ml');
  assert.equal(c.from, '13:50');
  assert.equal(c.to, '13:40');
  assert.deepEqual(Object.keys(c.patch), ['startAt']);

  const [m] = changesFrom([{ op: 'update', ref: 'r7', startAt: '2026-11-06T11:50:00+09:00' }], ctx, NOW);
  if (m.op !== 'update' || !('startAt' in m.patch)) return assert.fail();
  assert.equal(m.patch.endAt, new Date(2026, 10, 6, 13, 0).toISOString());
  assert.equal(m.from, '12:00');
});

test('수정 — 양 · 쪽 · 메모, 범위 밖 값과 바뀌지 않는 수정은 버린다', () => {
  const [a] = changesFrom([{ op: 'update', ref: 'r8', amount: 150, note: '트림 두 번' }], ctx, NOW);
  if (a.op !== 'update') return assert.fail();
  assert.equal(a.from, '120ml, 메모 없음');
  assert.equal(a.to, '150ml, 트림 두 번');
  assert.equal(changesFrom([{ op: 'update', ref: 'r8', amount: 900 }], ctx, NOW).length, 0);
  assert.equal(changesFrom([{ op: 'update', ref: 'r8', amount: 120 }], ctx, NOW).length, 0);
  assert.equal(changesFrom([{ op: 'update', ref: 'r99', amount: 100 }], ctx, NOW).length, 0);
  // 앞으로의 때로는 옮기지 않는다
  assert.equal(changesFrom([{ op: 'update', ref: 'r8', startAt: '2026-11-06T15:00:00+09:00' }], ctx, NOW).length, 0);
  const [s] = changesFrom([{ op: 'update', ref: 'r2', side: 'right' }], ctx, NOW);
  if (s.op !== 'update') return assert.fail();
  assert.equal(`${s.from} → ${s.to}`, '왼쪽 → 오른쪽');
});

test('루틴은 시각만, 메모는 글만 고친다', () => {
  const [r] = changesFrom([{ op: 'update', ref: 'r6', startAt: '2026-11-06T11:20:00+09:00' }], ctx, NOW);
  if (r.op !== 'update' || !('at' in r.patch)) return assert.fail();
  assert.equal(r.patch.endAt, new Date(2026, 10, 6, 11, 35).toISOString());
  const [m] = changesFrom([{ op: 'update', ref: 'r4', title: '처음으로 뒤집었어요' }], ctx, NOW);
  if (m.op !== 'update' || !('text' in m.patch)) return assert.fail();
  assert.equal(m.to, '처음으로 뒤집었어요');
});

test('삭제 · 일정 · 추가, 같은 기록을 두 번 고치지 않는다', () => {
  const list = changesFrom(
    [
      { op: 'delete', ref: 'r8' },
      { op: 'update', ref: 'r8', amount: 100 },
      { op: 'plan', title: ' 2개월 접종 ', startAt: '2026-11-07T09:00:00+09:00', hasTime: true },
      { op: 'add', kind: 'formula', amount: 160 },
      { op: 'add', kind: 'breast', side: 'left' },
    ],
    ctx,
    NOW,
  );
  assert.deepEqual(
    list.map((c) => c.op),
    ['delete', 'plan', 'add'],
  );
  const [del, plan, add] = list;
  if (del.op !== 'delete' || plan.op !== 'plan' || add.op !== 'add') return assert.fail();
  assert.equal(del.from, '13:50');
  assert.equal(plan.title, '2개월 접종');
  assert.equal(plan.when, '내일(11월 7일) 09:00');
  assert.equal(add.title, '분유 160ml');
  assert.ok(!onlyAdds(list));
  assert.ok(onlyAdds([add]));
});

test('날만 말한 일정은 그날 0시, 기록 없이 온 수정 · 삭제는 버린다', () => {
  const [p] = changesFrom([{ op: 'plan', title: 'BCG', startAt: '2026-11-20T10:00:00+09:00', hasTime: false }], null, NOW);
  if (p.op !== 'plan') return assert.fail();
  assert.equal(p.at.getHours(), 0);
  assert.equal(p.when, '11월 20일');
  assert.equal(changesFrom([{ op: 'delete', ref: 'r1' }], null, NOW).length, 0);
  assert.equal(whenLabel(new Date(2026, 10, 6, 9, 5), true, NOW), '오늘(11월 6일) 09:05');
});

test('앞 대화 — 빈 말은 빼고 마지막 6줄, 줄마다 600자', () => {
  const turns = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? ('app' as const) : ('user' as const), text: i === 8 ? 'x'.repeat(700) : `말 ${i}` }));
  const out = lastTurns([...turns, { role: 'app', text: '  ' }]);
  assert.equal(out.length, 6);
  assert.equal(out[0].text, '말 3');
  assert.equal(out[5].text.length, 600);
});
