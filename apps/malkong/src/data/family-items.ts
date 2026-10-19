/**
 * 가족 공유로 맞추는 할 일 · 주제 · 루틴 · 루틴 기록(task my/009) — 무엇을 올리고, 받은 것을 폰에 어떻게 적용할지만 계산한다.
 * 저장은 부르는 쪽(family.ts)이 한다. 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/family-items.test.ts`).
 *
 * - 규칙은 기록과 같다 — 늦게 고친 쪽이 이기고(updatedAt), 여기서 지운 것은 되살리지 않는다(지운 표시)
 * - 기본 주제(접종 · 검진, 장보기, 내 할 일 …)는 폰마다 id 가 다르다 — 할 일에 주제 kind 를 실어 보내고, 받는 폰은 같은 kind 의 자기 주제로 넣는다.
 *   직접 만든 주제(목록)만 주제째 맞춘다
 * - 앱이 채운 할 일(기념일 · 사이즈)은 폰마다 따로 생겨 id 가 다르다 — 같은 ref 의 내 줄에 덮어쓴다
 * - 루틴 기록은 고치지 않는다 — 없으면 넣고, 지운 표시가 오면 지운다
 */

import type { Routine, RoutineKind, RoutineLog } from './routine.ts';
import type { Todo, Topic, TopicKind } from './todos.ts';

export type ItemKind = 'topic' | 'todo' | 'routine' | 'routineLog';

export type SyncItem = {
  kind: ItemKind;
  id: string;
  updatedAt: string;
  deleted: boolean;
  data: Record<string, unknown>;
};

export type Tombstone = { id: string; deletedAt: string };

/** 지운 표시의 id 로 무엇인지 가른다 — 할 일 `td-`, 루틴 기록 `rl-` */
export function itemKindOfId(id: string): ItemKind | null {
  if (id.startsWith('td-')) return 'todo';
  if (id.startsWith('rl-')) return 'routineLog';
  if (id.startsWith('tp-')) return 'topic';
  if (id.startsWith('rt-')) return 'routine';
  return null;
}

/** 올릴 것 — `since` 뒤에 바뀐 것과 지운 표시. 처음이면 since 를 빈 글로 */
export function outgoingItems(args: {
  topics: Topic[];
  todos: Todo[];
  routines: Routine[];
  logs: RoutineLog[];
  tombstones: Tombstone[];
  since: string;
}): SyncItem[] {
  const { topics, todos, routines, logs, tombstones, since } = args;
  const kindOf = new Map(topics.map((t) => [t.id, t.kind]));
  const out: SyncItem[] = [];
  for (const t of topics) {
    if (t.kind === 'custom' && t.updatedAt > since) {
      out.push({ kind: 'topic', id: t.id, updatedAt: t.updatedAt, deleted: false, data: { ...t } });
    }
  }
  for (const t of todos) {
    if (t.updatedAt > since) {
      out.push({ kind: 'todo', id: t.id, updatedAt: t.updatedAt, deleted: false, data: { ...t, topicKind: kindOf.get(t.topicId) ?? null } });
    }
  }
  for (const r of routines) {
    if (r.updatedAt > since) out.push({ kind: 'routine', id: r.id, updatedAt: r.updatedAt, deleted: false, data: { ...r } });
  }
  for (const l of logs) {
    if (l.createdAt > since) out.push({ kind: 'routineLog', id: l.id, updatedAt: l.createdAt, deleted: false, data: { ...l } });
  }
  for (const t of tombstones) {
    const kind = itemKindOfId(t.id);
    if (kind && t.deletedAt > since) out.push({ kind, id: t.id, updatedAt: t.deletedAt, deleted: true, data: {} });
  }
  return out;
}

export type IncomingPlan = {
  upsertTopics: Topic[];
  upsertTodos: Todo[];
  deleteTodos: string[];
  upsertRoutines: Routine[];
  insertLogs: RoutineLog[];
  deleteLogs: string[];
};

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown): boolean => v === true;

/** 받은 것을 폰에 적용할 쓰기 목록으로 — 늦게 고친 쪽이 이기고, 여기서 지운 것은 되살리지 않는다 */
export function planIncoming(args: {
  items: SyncItem[];
  topics: Topic[];
  todos: Todo[];
  routines: Routine[];
  logs: RoutineLog[];
  tombstones: Tombstone[];
}): IncomingPlan {
  const plan: IncomingPlan = { upsertTopics: [], upsertTodos: [], deleteTodos: [], upsertRoutines: [], insertLogs: [], deleteLogs: [] };
  const gone = new Map(args.tombstones.map((t) => [t.id, t.deletedAt]));
  const blocked = (item: SyncItem) => {
    const at = gone.get(item.id);
    return !!at && at >= item.updatedAt;
  };
  const topics = new Map(args.topics.map((t) => [t.id, t]));
  const todos = new Map(args.todos.map((t) => [t.id, t]));
  const routines = new Map(args.routines.map((r) => [r.id, r]));
  const logIds = new Set(args.logs.map((l) => l.id));

  // 주제 먼저 — 할 일이 그 주제를 찾을 수 있게
  for (const item of args.items.filter((i) => i.kind === 'topic')) {
    if (blocked(item) || item.deleted) continue;
    const mine = topics.get(item.id);
    if (mine && mine.updatedAt >= item.updatedAt) continue;
    const d = item.data;
    const topic: Topic = {
      id: item.id,
      kind: 'custom',
      title: str(d.title) ?? '목록',
      hidden: bool(d.hidden),
      sort: num(d.sort, 100),
      icon: str(d.icon),
      createdAt: str(d.createdAt) ?? item.updatedAt,
      updatedAt: item.updatedAt,
    };
    plan.upsertTopics.push(topic);
    topics.set(topic.id, topic);
  }

  const byKind = new Map<TopicKind, Topic>();
  for (const t of topics.values()) if (t.kind !== 'custom' && !byKind.has(t.kind)) byKind.set(t.kind, t);

  for (const item of args.items.filter((i) => i.kind === 'todo')) {
    if (blocked(item)) continue;
    const d = item.data;
    // 앱이 채운 할 일은 같은 ref 의 내 줄로
    const ref = str(d.ref);
    const sameRef = ref ? [...todos.values()].find((t) => t.ref === ref && t.id !== item.id) : undefined;
    const targetId = sameRef?.id ?? item.id;
    const mine = todos.get(targetId);
    if (mine && mine.updatedAt >= item.updatedAt) continue;
    if (item.deleted) {
      if (mine) {
        plan.deleteTodos.push(targetId);
        todos.delete(targetId);
      }
      continue;
    }
    // 주제 — 기본 주제는 kind 로 내 폰의 주제를, 직접 만든 주제는 id 그대로
    const topicKind = str(d.topicKind) as TopicKind | null;
    const topicId = mine?.topicId ?? (topicKind && topicKind !== 'custom' ? byKind.get(topicKind)?.id : str(d.topicId) ?? undefined);
    if (!topicId || !topics.has(topicId)) continue;
    const todo: Todo = {
      id: targetId,
      topicId,
      title: str(d.title) ?? '',
      note: str(d.note),
      dueAt: str(d.dueAt),
      hasTime: bool(d.hasTime),
      buy: bool(d.buy),
      source: (str(d.source) as Todo['source']) ?? 'manual',
      doneAt: str(d.doneAt),
      repeat: (d.repeat as Todo['repeat']) ?? null,
      ref,
      orderedAt: str(d.orderedAt),
      arriveAt: str(d.arriveAt),
      store: str(d.store),
      doneBy: str(d.doneBy),
      createdAt: mine?.createdAt ?? str(d.createdAt) ?? item.updatedAt,
      updatedAt: item.updatedAt,
    };
    if (!todo.title) continue;
    plan.upsertTodos.push(todo);
    todos.set(todo.id, todo);
  }

  for (const item of args.items.filter((i) => i.kind === 'routine')) {
    if (blocked(item) || item.deleted) continue;
    const mine = routines.get(item.id);
    if (mine && mine.updatedAt >= item.updatedAt) continue;
    const d = item.data;
    const kind = str(d.kind) as RoutineKind;
    const routine: Routine = {
      id: item.id,
      title: str(d.title) ?? '',
      kind: kind === 'minutes' || kind === 'stock' ? kind : 'check',
      everyDays: Math.max(1, num(d.everyDays, 1)),
      weekdays: Array.isArray(d.weekdays)
        ? d.weekdays.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 6)
        : null,
      time: str(d.time),
      goalMinutes: typeof d.goalMinutes === 'number' ? d.goalMinutes : null,
      // 단계 · 확인할 물건(task today/003) — 글자만, 스무 개까지
      items: Array.isArray(d.items) ? d.items.filter((x): x is string => typeof x === 'string').slice(0, 20) : null,
      hidden: bool(d.hidden),
      sort: num(d.sort, 0),
      // 타이머는 그 폰의 것 — 다른 폰의 타이머를 이어 받지 않는다
      runningSince: mine?.runningSince ?? null,
      createdAt: str(d.createdAt) ?? item.updatedAt,
      updatedAt: item.updatedAt,
    };
    if (!routine.title) continue;
    plan.upsertRoutines.push(routine);
    routines.set(routine.id, routine);
  }

  for (const item of args.items.filter((i) => i.kind === 'routineLog')) {
    if (item.deleted) {
      if (logIds.has(item.id)) {
        plan.deleteLogs.push(item.id);
        logIds.delete(item.id);
      }
      continue;
    }
    if (blocked(item) || logIds.has(item.id)) continue;
    const d = item.data;
    const routineId = str(d.routineId);
    const at = str(d.at);
    if (!routineId || !at) continue;
    plan.insertLogs.push({
      id: item.id,
      routineId,
      at,
      minutes: typeof d.minutes === 'number' ? d.minutes : null,
      by: str(d.by),
      step: typeof d.step === 'number' && Number.isInteger(d.step) && d.step >= 0 ? d.step : null,
      skip: bool(d.skip),
      createdAt: str(d.createdAt) ?? item.updatedAt,
    });
    logIds.add(item.id);
  }
  return plan;
}
