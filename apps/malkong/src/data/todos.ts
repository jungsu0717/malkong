/**
 * 육아 할 일 (SPEC-TOPIC-01~03 · 06 · 11, decisions/024 · 025).
 *
 * 기본 주제는 앱이 할 일을 채워 주는 다섯(접종 · 검진, 신청 · 서류, 기념일, 사이즈 바꾸기, 생활 루틴)이고, 사용자가 적는 할 일은
 * 「내 할 일」(kind general) 하나에 모인다(헌장 1). 끝낸 할 일은 지우지 않고 `doneAt` 으로 남는다(헌장 2). 반복 추천 같은 해석은
 * 저장하지 않고 볼 때마다 센다(헌장 3). 기기 DB `topic` · `todo`(backend 「기기 DB 스키마」).
 */

import { deleteTodoRow, readTodoRows, readTopicRows, upsertTodoRow, upsertTopicRow } from './db';
import { SUGGEST_AFTER, firstDate, nextDate, startOfDay, suggestRepeat, withTimeOf, type Repeat } from './repeat';

/** 2026-10-15 까지 쓰던 기본 주제(decisions/025 로 뺐다) — 숨기고, 거기 적힌 할 일은 「내 할 일」로 옮긴다 */
export const LEGACY_KINDS = ['feeding', 'diaper', 'outing', 'sick', 'solids', 'shopping'] as const;
type LegacyKind = (typeof LEGACY_KINDS)[number];

export type TopicKind = 'checkup' | 'paperwork' | 'milestone' | 'size' | 'routine' | 'general' | 'custom' | LegacyKind;

export const isLegacyKind = (kind: TopicKind) => (LEGACY_KINDS as readonly string[]).includes(kind);

export type Topic = {
  id: string;
  kind: TopicKind;
  title: string;
  /** 사용자가 숨긴 주제 — 지우지 않는다 */
  hidden: boolean;
  /** 목록 순서 */
  sort: number;
  createdAt: string;
  updatedAt: string;
};

/** 어디서 생겼나 — 직접 적음 · 추천에서 추가 · 반복 할 일을 완료해서 다음 차례로 생김 · 앱이 생일로 만듦(SPEC-TOPIC-11) */
export type TodoSource = 'manual' | 'starter' | 'repeat' | 'auto';

export type Todo = {
  id: string;
  topicId: string;
  title: string;
  note: string | null;
  /** 기한 ISO — 시각이 없으면 그날 0시 */
  dueAt: string | null;
  /** 시각까지 정했나 — 정했으면 그 시각에 알린다(SPEC-TOPIC-09) */
  hasTime: boolean;
  /** 살 것 — 2026-10-15 까지 장보기에 모으던 표시. 지금은 화면에서 쓰지 않고 값만 남는다 */
  buy: boolean;
  source: TodoSource;
  /** 끝낸 때. 되돌리면 null */
  doneAt: string | null;
  /** 반복 규칙(SPEC-TOPIC-06) — 완료하면 다음 날짜로 새 줄이 생긴다 */
  repeat: Repeat | null;
  /** 앱이 만든 할 일이면 그 규칙의 열쇠(auto-todos.ts) — 같은 것을 두 번 만들지 않게 */
  ref: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 예전 기본 주제 이름 → 지금 이름. 사용자가 바꾸지 않은 기본 주제만 바꾼다 */
export const RENAMED_TITLES: Record<string, string> = { '분유 · 수유': '분유', '그 밖의 할 일': '내 할 일', 기타: '내 할 일' };

/** 기본 주제(SPEC-TOPIC-01) — 처음 실행할 때, 그리고 예전 기기에 없으면 만든다. 「내 할 일」은 사용자가 적는 목록 */
export const DEFAULT_TOPICS: { kind: TopicKind; title: string }[] = [
  { kind: 'checkup', title: '접종 · 검진' },
  { kind: 'paperwork', title: '신청 · 서류' },
  { kind: 'milestone', title: '기념일' },
  { kind: 'size', title: '사이즈 바꾸기' },
  { kind: 'routine', title: '생활 루틴' },
  { kind: 'general', title: '내 할 일' },
];

export type Starter = { title: string; repeat?: Repeat };

/**
 * 추천 목록 — 한 번 만들어 두고 자주 고치지 않는다(헌장 8). 약 · 처치 · 증상 판단은 넣지 않는다(헌장 5).
 * 생활 루틴은 반복 할 일로 추가된다. 간격은 제품 안내에서 흔히 보는 값이고 사용자가 편집할 수 있다.
 * 정본 표는 menu-spec/topic.md 「기본 주제」.
 */
export const STARTERS: Partial<Record<TopicKind, Starter[]>> = {
  checkup: [
    { title: '아기수첩 챙기기' },
    { title: '모바일 건강보험증 챙기기' },
    { title: '기저귀와 물티슈 챙기기' },
    { title: '여벌 옷 챙기기' },
    { title: '분유와 젖병 챙기기' },
    { title: '겉싸개나 담요 챙기기' },
  ],
  routine: [
    { title: '손톱 깎기', repeat: { kind: 'every', days: 7 } },
    { title: '쪽쪽이 바꾸기', repeat: { kind: 'every', days: 60 } },
    { title: '젖꼭지 바꾸기', repeat: { kind: 'every', days: 60 } },
    { title: '젖병 솔 바꾸기', repeat: { kind: 'every', days: 30 } },
    { title: '가습기 청소', repeat: { kind: 'every', days: 7 } },
    { title: '장난감 소독', repeat: { kind: 'every', days: 7 } },
    { title: '아기 침구 빨래', repeat: { kind: 'every', days: 7 } },
  ],
};

export function newTopicId(): string {
  return `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newTodoId(): string {
  return `td-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeTopic(kind: TopicKind, title: string, sort: number, now = new Date()): Topic {
  const at = now.toISOString();
  return { id: newTopicId(), kind, title, hidden: false, sort, createdAt: at, updatedAt: at };
}

export type TodoInput = { topicId: string; title: string } & Partial<
  Pick<Todo, 'note' | 'dueAt' | 'hasTime' | 'buy' | 'source' | 'repeat' | 'ref'>
>;

export function makeTodo(input: TodoInput, now = new Date()): Todo {
  const at = now.toISOString();
  return {
    id: newTodoId(),
    topicId: input.topicId,
    title: input.title,
    note: input.note ?? null,
    dueAt: input.dueAt ?? null,
    hasTime: input.hasTime ?? false,
    buy: input.buy ?? false,
    source: input.source ?? 'manual',
    doneAt: null,
    repeat: input.repeat ?? null,
    ref: input.ref ?? null,
    createdAt: at,
    updatedAt: at,
  };
}

const endOfToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const startOfToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** 오늘 할 일 — 안 끝낸 것 중 기한이 오늘이거나 지난 것, 그리고 오늘 끝낸 것(흐리게)(SPEC-TOPIC-02) */
export function todayTodos(todos: Todo[], now = new Date()): { open: Todo[]; doneToday: Todo[] } {
  const end = endOfToday(now).toISOString();
  const start = startOfToday(now).toISOString();
  const open = todos.filter((t) => !t.doneAt && t.dueAt !== null && t.dueAt < end);
  const doneToday = todos.filter((t) => t.doneAt && t.doneAt >= start && t.dueAt !== null && t.dueAt < end);
  return { open: sortOpen(open), doneToday };
}

/** 예정 — 안 끝낸 것 중 기한이 내일부터인 것, 가까운 순(SPEC-TOPIC-02) */
export function laterTodos(todos: Todo[], now = new Date()): Todo[] {
  const end = endOfToday(now).toISOString();
  return sortOpen(todos.filter((t) => !t.doneAt && t.dueAt !== null && t.dueAt >= end));
}

/** 안 끝낸 것 — 기한 가까운 순, 기한 없는 것은 적은 순으로 뒤에 */
export function sortOpen(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** 끝낸 것 — 최근에 끝낸 순 */
export function sortDone(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
}

/** 한 주제의 할 일 */
export function todosOfTopic(topic: Topic, todos: Todo[]): Todo[] {
  return todos.filter((t) => t.topicId === topic.id);
}

/** 보이는 주제 — 숨긴 것과 예전 기본 주제를 빼고 순서대로 */
export function visibleTopics(topics: Topic[]): Topic[] {
  return [...topics].filter((t) => !t.hidden && !isLegacyKind(t.kind)).sort((a, b) => a.sort - b.sort);
}

/** 같은 할 일인지 볼 때 — 띄어쓰기를 뺀 제목 */
export const titleKey = (title: string) => title.replace(/\s+/g, '');

/** 주제 그리드의 숫자 — 안 끝낸 것 중 기한이 오늘까지거나 없는 것(SPEC-TOPIC-01) */
export function nowCount(topic: Topic, todos: Todo[], now = new Date()): number {
  const end = endOfToday(now).toISOString();
  return todosOfTopic(topic, todos).filter((t) => !t.doneAt && (t.dueAt === null || t.dueAt < end)).length;
}

/** 이번 달 할 일 — 이번 달에 완료한 것 + 안 끝낸 것 중 기한이 이번 달 안이거나 지났거나 없는 것(SPEC-TOPIC-10) */
export function monthTodos(topic: Topic, todos: Todo[], now = new Date()): Todo[] {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return todosOfTopic(topic, todos).filter((t) => (t.doneAt ? t.doneAt >= start : t.dueAt === null || t.dueAt < next));
}

/** 이번 주(월요일부터) 완료한 수 */
export function weekDoneCount(todos: Todo[], now = new Date()): number {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).toISOString();
  return todos.filter((t) => t.doneAt && t.doneAt >= monday).length;
}

/** 반복을 새로 붙일 때 첫 기한 — 마지막으로 완료한 날의 다음 차례, 그날이 지났으면 오늘부터 맞는 첫날 */
export function repeatStart(rule: Repeat, lastDone: Date | null, now = new Date()): Date {
  const today = startOfDay(now);
  const next = lastDone ? nextDate(rule, null, lastDone) : firstDate(rule, today);
  return next < today ? firstDate(rule, today) : next;
}

/** 반복 할 일을 완료했을 때 다음 차례 줄(SPEC-TOPIC-06) — 반복이 없으면 null. 시각을 정했으면 같은 시각 */
export function nextRepeatTodo(done: Todo, doneAt: Date): Todo | null {
  if (!done.repeat) return null;
  const due = done.dueAt ? new Date(done.dueAt) : null;
  const day = nextDate(done.repeat, due, doneAt);
  return makeTodo({
    topicId: done.topicId,
    title: done.title,
    note: done.note,
    buy: done.buy,
    repeat: done.repeat,
    source: 'repeat',
    hasTime: done.hasTime,
    dueAt: withTimeOf(day, done.hasTime ? due : null).toISOString(),
  });
}

/** 완료를 되돌릴 때 지울 다음 차례 줄 — 그 완료로 생겼고 아직 손대지 않은 것만 */
export function spawnedBy(done: Todo, todos: Todo[]): Todo | undefined {
  if (!done.repeat || !done.doneAt) return undefined;
  const key = titleKey(done.title);
  return todos.find(
    (t) =>
      t.source === 'repeat' &&
      !t.doneAt &&
      t.topicId === done.topicId &&
      titleKey(t.title) === key &&
      t.createdAt >= (done.doneAt as string) &&
      t.updatedAt === t.createdAt,
  );
}

/**
 * 아침 알림에 넣을 날짜별 할 일 제목(SPEC-TOPIC-09) — 오늘부터 `count` 일.
 * 그날 할 일 = 안 끝낸 것 중 기한이 그날까지인 것(지난 것 포함) + `checkups`(지금 기간인 접종 · 검진 이름, 날마다 같이 넣는다).
 */
export function morningDays(todos: Todo[], checkups: string[], now = new Date(), count = 7): { day: Date; titles: string[] }[] {
  const open = sortOpen(todos.filter((t) => !t.doneAt && t.dueAt));
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1).toISOString();
    const titles = open.filter((t) => (t.dueAt as string) < end).map((t) => t.title);
    return { day, titles: [...new Set([...titles, ...checkups])] };
  });
}

export type RepeatSuggestion = {
  /** 「다시 보지 않기」에 남기는 열쇠 — 주제 id 와 띄어쓰기를 뺀 제목 */
  key: string;
  topicId: string;
  title: string;
  /** 완료한 횟수 */
  count: number;
  rule: Repeat;
  /** 가장 최근에 완료한 줄 — 새 반복 할 일의 살 것 · 메모를 여기서 가져온다 */
  last: Todo;
};

/**
 * 반복 추천(SPEC-TOPIC-06) — 같은 주제에서 제목이 같은 할 일을 세 번 이상 완료했고, 반복을 한 번도 정한 적이 없으면.
 * 여럿이면 가장 최근에 완료한 것 하나. `topicId` 를 주면 그 주제 안에서만 찾는다.
 */
export function repeatSuggestion(todos: Todo[], dismissed: string[], topicId?: string): RepeatSuggestion | null {
  const groups = new Map<string, Todo[]>();
  for (const t of todos) {
    if (topicId && t.topicId !== topicId) continue;
    const key = `${t.topicId}:${titleKey(t.title)}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  let best: RepeatSuggestion | null = null;
  for (const [key, list] of groups) {
    if (dismissed.includes(key) || list.some((t) => t.repeat)) continue;
    const done = list.filter((t) => t.doneAt);
    if (done.length < SUGGEST_AFTER) continue;
    const rule = suggestRepeat(done.map((t) => new Date(t.doneAt as string)));
    if (!rule) continue;
    const last = sortDone(done)[0];
    if (!best || (last.doneAt ?? '') > (best.last.doneAt ?? '')) {
      best = { key, topicId: last.topicId, title: last.title, count: done.length, rule, last };
    }
  }
  return best;
}

export async function loadTopics(): Promise<Topic[]> {
  return readTopicRows();
}

export async function saveTopic(topic: Topic): Promise<void> {
  await upsertTopicRow(topic);
}

export async function loadTodos(): Promise<Todo[]> {
  return readTodoRows();
}

export async function saveTodo(todo: Todo): Promise<void> {
  await upsertTodoRow(todo);
}

export async function removeTodo(id: string): Promise<void> {
  await deleteTodoRow(id);
}
