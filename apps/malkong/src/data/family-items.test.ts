/// <reference types="node" />
/**
 * 가족 공유 할 일 · 루틴 맞추기 시험 — `node --test src/data/family-items.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { outgoingItems, planIncoming, type SyncItem } from './family-items.ts';
import type { Routine, RoutineLog } from './routine.ts';
import type { Todo, Topic } from './todos.ts';

const T = (h: number) => new Date(2026, 9, 16, h).toISOString();
const topic = (id: string, kind: Topic['kind'], title: string = kind): Topic => ({
  id,
  kind,
  title,
  hidden: false,
  sort: 0,
  icon: null,
  createdAt: T(1),
  updatedAt: T(1),
});
const todo = (id: string, topicId: string, o: Partial<Todo> = {}): Todo => ({
  id,
  topicId,
  title: '기저귀 4단계',
  note: null,
  dueAt: null,
  hasTime: false,
  buy: false,
  source: 'manual',
  doneAt: null,
  repeat: null,
  ref: null,
  orderedAt: null,
  arriveAt: null,
  store: null,
  doneBy: null,
  createdAt: T(1),
  updatedAt: T(1),
  ...o,
});
const routine = (id: string, o: Partial<Routine> = {}): Routine => ({
  id,
  title: '목욕',
  kind: 'check',
  everyDays: 1,
  time: '19:00',
  goalMinutes: null,
  hidden: false,
  sort: 0,
  runningSince: null,
  createdAt: T(1),
  updatedAt: T(1),
  ...o,
});
const log = (id: string, routineId: string, at: string, by: string | null = null): RoutineLog => ({
  id,
  routineId,
  at,
  minutes: null,
  by,
  createdAt: at,
});

// 엄마 폰과 아빠 폰 — 기본 주제 id 가 다르다
const momTopics = [topic('tp-mom-shop', 'shopping'), topic('tp-mom-mine', 'general'), topic('tp-mom-trip', 'custom', '여행 짐')];
const dadTopics = [topic('tp-dad-shop', 'shopping'), topic('tp-dad-mine', 'general')];

test('올릴 것 — 할 일에 주제 kind, 직접 만든 주제만 주제째, 지운 표시', () => {
  const items = outgoingItems({
    topics: momTopics,
    todos: [todo('td-1', 'tp-mom-shop', { updatedAt: T(9) }), todo('td-old', 'tp-mom-mine')],
    routines: [routine('rt-1', { updatedAt: T(9) })],
    logs: [log('rl-1', 'rt-1', T(8))],
    tombstones: [{ id: 'td-x', deletedAt: T(10) }, { id: 'ev-1', deletedAt: T(10) }],
    since: T(2),
  });
  assert.deepEqual(
    items.map((i) => `${i.kind}:${i.id}:${i.deleted}`),
    ['todo:td-1:false', 'routine:rt-1:false', 'routineLog:rl-1:false', 'todo:td-x:true'],
  );
  assert.equal(items[0].data.topicKind, 'shopping');
  // 처음(since 빈 글)이면 직접 만든 주제도 간다
  const first = outgoingItems({ topics: momTopics, todos: [], routines: [], logs: [], tombstones: [], since: '' });
  assert.deepEqual(
    first.map((i) => i.id),
    ['tp-mom-trip'],
  );
});

test('받은 할 일 — 기본 주제는 내 폰의 같은 kind 주제로, 직접 만든 목록은 주제째', () => {
  const sent = outgoingItems({
    topics: momTopics,
    todos: [todo('td-1', 'tp-mom-shop', { store: '다이소' }), todo('td-2', 'tp-mom-trip', { title: '아기띠' })],
    routines: [],
    logs: [],
    tombstones: [],
    since: '',
  });
  const plan = planIncoming({ items: sent, topics: dadTopics, todos: [], routines: [], logs: [], tombstones: [] });
  assert.deepEqual(
    plan.upsertTopics.map((t) => t.title),
    ['여행 짐'],
  );
  assert.deepEqual(
    plan.upsertTodos.map((t) => `${t.id}:${t.topicId}:${t.store ?? ''}`),
    ['td-1:tp-dad-shop:다이소', 'td-2:tp-mom-trip:'],
  );
});

test('늦게 고친 쪽이 이기고, 지운 것은 되살리지 않는다', () => {
  const incoming: SyncItem[] = [
    { kind: 'todo', id: 'td-1', updatedAt: T(9), deleted: false, data: { ...todo('td-1', 'tp-mom-shop'), topicKind: 'shopping', doneAt: T(9), doneBy: '엄마' } },
    { kind: 'todo', id: 'td-2', updatedAt: T(5), deleted: false, data: { ...todo('td-2', 'tp-mom-mine'), topicKind: 'general', title: '옛 값' } },
    { kind: 'todo', id: 'td-3', updatedAt: T(5), deleted: false, data: { ...todo('td-3', 'tp-mom-mine'), topicKind: 'general' } },
  ];
  const plan = planIncoming({
    items: incoming,
    topics: dadTopics,
    todos: [todo('td-1', 'tp-dad-shop'), todo('td-2', 'tp-dad-mine', { title: '새 값', updatedAt: T(7) })],
    routines: [],
    logs: [],
    tombstones: [{ id: 'td-3', deletedAt: T(6) }],
  });
  assert.deepEqual(
    plan.upsertTodos.map((t) => `${t.id}:${t.doneBy}`),
    ['td-1:엄마'],
  );
});

test('앱이 채운 할 일은 같은 ref 의 내 줄에 덮어쓴다', () => {
  const plan = planIncoming({
    items: [
      { kind: 'todo', id: 'td-mom-auto', updatedAt: T(9), deleted: false, data: { ...todo('td-mom-auto', 'x'), ref: 'day:100-photo', topicKind: 'milestone', doneAt: T(9) } },
    ],
    topics: [topic('tp-dad-day', 'milestone')],
    todos: [todo('td-dad-auto', 'tp-dad-day', { ref: 'day:100-photo' })],
    routines: [],
    logs: [],
    tombstones: [],
  });
  assert.deepEqual(
    plan.upsertTodos.map((t) => `${t.id}:${t.topicId}:${t.doneAt === T(9)}`),
    ['td-dad-auto:tp-dad-day:true'],
  );
});

test('루틴과 루틴 기록 — 누가 했는지 함께, 지운 기록은 지운다, 타이머는 내 폰 것', () => {
  const plan = planIncoming({
    items: [
      { kind: 'routine', id: 'rt-1', updatedAt: T(9), deleted: false, data: { ...routine('rt-1', { runningSince: T(9) }), time: '20:00' } },
      { kind: 'routineLog', id: 'rl-1', updatedAt: T(8), deleted: false, data: { ...log('rl-1', 'rt-1', T(8), '엄마') } },
      { kind: 'routineLog', id: 'rl-old', updatedAt: T(10), deleted: true, data: {} },
    ],
    topics: [],
    todos: [],
    routines: [routine('rt-1')],
    logs: [log('rl-old', 'rt-1', T(7))],
    tombstones: [],
  });
  assert.equal(plan.upsertRoutines[0].time, '20:00');
  assert.equal(plan.upsertRoutines[0].runningSince, null);
  assert.deepEqual(
    plan.insertLogs.map((l) => `${l.id}:${l.by}`),
    ['rl-1:엄마'],
  );
  assert.deepEqual(plan.deleteLogs, ['rl-old']);
});
