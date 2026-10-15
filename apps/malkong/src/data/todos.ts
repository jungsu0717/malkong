/**
 * 주제별 육아 할 일 (SPEC-TOPIC-01~04, decisions/024).
 *
 * 할 일은 주제에 속한다(헌장 1). 끝낸 할 일은 지우지 않고 `doneAt` 으로 남는다(헌장 2). 반복 · 남은 양 같은 해석은
 * 저장하지 않고 볼 때마다 센다(헌장 3). 기기 DB `topic` · `todo`(backend 「기기 DB 스키마」).
 */

import { deleteTodoRow, readTodoRows, readTopicRows, upsertTodoRow, upsertTopicRow } from './db';

export type TopicKind = 'feeding' | 'diaper' | 'checkup' | 'outing' | 'sick' | 'solids' | 'shopping' | 'general' | 'custom';

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

export type TodoSource = 'manual' | 'starter';

export type Todo = {
  id: string;
  topicId: string;
  title: string;
  note: string | null;
  /** 기한 ISO — 시각이 없으면 그날 0시 */
  dueAt: string | null;
  /** 시각까지 정했나 — 정했으면 그 시각에 알린다(SPEC-TOPIC-09) */
  hasTime: boolean;
  /** 살 것 — 장보기 주제에도 모여 보인다(SPEC-TOPIC-01) */
  buy: boolean;
  source: TodoSource;
  /** 끝낸 때. 되돌리면 null */
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 기본 주제 — 처음 실행할 때 만든다(SPEC-TOPIC-01). 「기타」는 주제를 못 고른 한 줄이 들어가는 곳 */

/** 예전 기본 주제 이름 → 지금 이름(2026-10-15 Julian: 「분유 · 수유」가 아니라 「분유」). 고치지 않은 기본 주제만 바꾼다 */
export const RENAMED_TITLES: Record<string, string> = { '분유 · 수유': '분유', '그 밖의 할 일': '기타' };
export const DEFAULT_TOPICS: { kind: TopicKind; title: string }[] = [
  { kind: 'feeding', title: '분유' },
  { kind: 'diaper', title: '기저귀' },
  { kind: 'checkup', title: '접종 · 검진' },
  { kind: 'outing', title: '외출' },
  { kind: 'sick', title: '아플 때' },
  { kind: 'solids', title: '이유식' },
  { kind: 'shopping', title: '장보기' },
  { kind: 'general', title: '기타' },
];

/** 이유식은 이 월령부터 보인다(SPEC-TOPIC-01) */
export const SOLIDS_FROM_MONTH = 5;

/**
 * 기본 주제의 추천 목록 — 한 번 만들어 두고 자주 고치지 않는다(헌장 8). 약 · 처치 · 증상 판단은 넣지 않는다(헌장 5).
 * 정본 표는 menu-spec/topic.md 「기본 주제와 추천 목록」.
 */
export const STARTERS: Partial<Record<TopicKind, { title: string; buy?: boolean }[]>> = {
  feeding: [{ title: '분유 주문', buy: true }, { title: '젖병 소독' }, { title: '젖병 솔 바꾸기' }, { title: '젖꼭지 바꾸기' }],
  diaper: [{ title: '기저귀 주문', buy: true }, { title: '물티슈 주문', buy: true }, { title: '기저귀 휴지통 비우기' }],
  checkup: [
    { title: '아기수첩 챙기기' },
    { title: '모바일 건강보험증 챙기기' },
    { title: '기저귀와 물티슈 챙기기' },
    { title: '여벌 옷 챙기기' },
    { title: '분유와 젖병 챙기기' },
    { title: '겉싸개나 담요 챙기기' },
  ],
  outing: [
    { title: '기저귀와 물티슈' },
    { title: '여벌 옷' },
    { title: '분유 · 젖병 · 보온병' },
    { title: '손수건과 턱받이' },
    { title: '쪽쪽이' },
    { title: '작은 장난감' },
    { title: '겉싸개나 담요' },
    { title: '기저귀 담을 비닐봉지' },
  ],
  sick: [
    { title: '아기수첩 챙기기' },
    { title: '모바일 건강보험증 챙기기' },
    { title: '체온 · 수유 기록 보여 주기' },
    { title: '기저귀와 물티슈 챙기기' },
    { title: '여벌 옷 챙기기' },
    { title: '분유와 젖병 챙기기' },
  ],
  solids: [{ title: '재료 장보기', buy: true }, { title: '이유식 용기 소독' }, { title: '이유식 만들어 얼리기' }, { title: '숟가락과 턱받이 챙기기' }],
};

/** 주제를 고르지 않고 적은 한 줄이 어느 주제인지 — 낱말로 짐작한다(앞의 것이 이긴다) */
const GUESS: { kind: TopicKind; pattern: RegExp }[] = [
  { kind: 'checkup', pattern: /접종|검진|예방주사/ },
  { kind: 'solids', pattern: /이유식|미음|퓨레/ },
  { kind: 'outing', pattern: /외출|나들이|여행|기저귀 ?가방/ },
  { kind: 'feeding', pattern: /분유|수유|젖병|젖꼭지|모유|유축/ },
  { kind: 'diaper', pattern: /기저귀|물티슈/ },
  { kind: 'sick', pattern: /병원|약국/ },
  { kind: 'shopping', pattern: /장보기|마트|사기|사 오기|사오기|주문|구매/ },
];

export function guessTopicKind(title: string): TopicKind {
  return GUESS.find((g) => g.pattern.test(title))?.kind ?? 'general';
}

/** 살 것인지 — 「주문」 「사기」가 들어가면 장보기에도 모인다 */
export function looksLikeBuy(title: string): boolean {
  return /주문|사기|사 오기|사오기|구매|장보기/.test(title);
}

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

export type TodoInput = { topicId: string; title: string } & Partial<Pick<Todo, 'note' | 'dueAt' | 'hasTime' | 'buy' | 'source'>>;

export function makeTodo(input: TodoInput, now = new Date()): Todo {
  const at = now.toISOString();
  return {
    id: newTodoId(),
    topicId: input.topicId,
    title: input.title,
    note: input.note ?? null,
    dueAt: input.dueAt ?? null,
    hasTime: input.hasTime ?? false,
    buy: input.buy ?? looksLikeBuy(input.title),
    source: input.source ?? 'manual',
    doneAt: null,
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

/** 한 주제에 보이는 할 일 — 장보기는 다른 주제의 살 것까지 모은다(SPEC-TOPIC-01) */
export function todosOfTopic(topic: Topic, todos: Todo[]): Todo[] {
  if (topic.kind === 'shopping') return todos.filter((t) => t.topicId === topic.id || t.buy);
  return todos.filter((t) => t.topicId === topic.id);
}

export function topicCount(topic: Topic, todos: Todo[]): { done: number; total: number } {
  const list = todosOfTopic(topic, todos);
  return { done: list.filter((t) => t.doneAt).length, total: list.length };
}

/** 주제 목록에 보일 것 — 숨긴 것 빼고, 이유식은 그 월령부터(할 일이 있으면 늘) */
export function visibleTopics(topics: Topic[], todos: Todo[], month: number): Topic[] {
  return [...topics]
    .filter((t) => !t.hidden)
    .filter((t) => t.kind !== 'solids' || month >= SOLIDS_FROM_MONTH || todos.some((d) => d.topicId === t.id))
    .sort((a, b) => a.sort - b.sort);
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
