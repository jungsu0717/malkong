/**
 * 주제와 할 일을 화면들이 함께 보는 자리 (SPEC-TOPIC-01~03 · 09, decisions/024).
 *
 * 할 일 탭 · 주제 화면 · 기록 탭 요약 줄이 같은 목록을 본다. 처음 실행하면 기본 주제를 만든다(SPEC-TOPIC-01).
 * 할 일이 바뀔 때마다 시각이 있는 할 일의 알림을 다시 건다(SPEC-TOPIC-09). 알림 허락은 처음 시각을 넣을 때 한 번 묻는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { readSetting, writeSetting } from './db';
import { askNotifications, scheduleTodoReminders } from './notifications';
import {
  DEFAULT_TOPICS,
  guessTopicKind,
  loadTodos,
  loadTopics,
  makeTodo,
  makeTopic,
  removeTodo,
  saveTodo,
  saveTopic,
  type Todo,
  type TodoInput,
  type Topic,
  type TopicKind,
} from './todos';

/** 할 일 알림 허락을 처음 시각을 넣을 때 한 번만 묻는다 */
const ASKED_KEY = 'todo_reminder_asked';

type TodosContextValue = {
  topics: Topic[];
  /** 적은 순서 */
  todos: Todo[];
  loading: boolean;
  /** 주제를 주지 않으면 제목으로 짐작한다(없으면 「그 밖의 할 일」) */
  add: (input: Omit<TodoInput, 'topicId'> & { topicId?: string }) => Promise<Todo | null>;
  update: (id: string, patch: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  /** 끝냄 ↔ 되돌림 */
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTopic: (title: string) => Promise<Topic>;
  updateTopic: (id: string, patch: Partial<Pick<Topic, 'title' | 'hidden'>>) => Promise<void>;
  topicOfKind: (kind: TopicKind) => Topic | undefined;
};

const TodosContext = createContext<TodosContextValue | null>(null);

export function TodosProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  // 고칠 때 지금 줄을 찾는 자리 — 화면이 그려진 뒤의 목록
  const currentTodos = useRef<Todo[]>([]);
  const currentTopics = useRef<Topic[]>([]);
  useEffect(() => {
    currentTodos.current = todos;
  }, [todos]);
  useEffect(() => {
    currentTopics.current = topics;
  }, [topics]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored = await loadTopics();
      // 처음 실행 — 기본 주제를 만든다(SPEC-TOPIC-01)
      if (stored.length === 0) {
        stored = DEFAULT_TOPICS.map((d, i) => makeTopic(d.kind, d.title, i));
        for (const t of stored) await saveTopic(t);
      }
      const storedTodos = await loadTodos();
      if (cancelled) return;
      setTopics(stored);
      setTodos(storedTodos);
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 할 일 알림 — 시각이 있고, 안 끝냈고, 아직 오지 않은 것만(SPEC-TOPIC-09)
  useEffect(() => {
    if (loading) return;
    const now = Date.now();
    const items = todos
      .filter((t) => t.hasTime && t.dueAt && !t.doneAt && new Date(t.dueAt).getTime() > now)
      .map((t) => ({ id: t.id, at: new Date(t.dueAt as string), title: t.title }));
    void scheduleTodoReminders(items).catch(() => undefined);
  }, [todos, loading]);

  /** 시각을 처음 넣을 때 알림 허락을 한 번 묻는다 */
  const askOnce = useCallback(async () => {
    if (await readSetting(ASKED_KEY)) return;
    await writeSetting(ASKED_KEY, 'yes');
    await askNotifications().catch(() => false);
  }, []);

  const topicOfKind = useCallback((kind: TopicKind) => currentTopics.current.find((t) => t.kind === kind), []);

  const add = useCallback<TodosContextValue['add']>(
    async (input) => {
      const title = input.title.trim();
      if (!title) return null;
      const topicId =
        input.topicId ??
        currentTopics.current.find((t) => t.kind === guessTopicKind(title))?.id ??
        currentTopics.current.find((t) => t.kind === 'general')?.id;
      if (!topicId) return null;
      const todo = makeTodo({ ...input, title, topicId });
      await saveTodo(todo);
      setTodos((prev) => [...prev, todo]);
      if (todo.hasTime) await askOnce();
      return todo;
    },
    [askOnce],
  );

  const update = useCallback<TodosContextValue['update']>(
    async (id, patch) => {
      const before = currentTodos.current.find((t) => t.id === id);
      if (!before) return;
      const next: Todo = { ...before, ...patch, updatedAt: new Date().toISOString() };
      await saveTodo(next);
      setTodos((prev) => prev.map((t) => (t.id === id ? next : t)));
      if (next.hasTime && !before.hasTime) await askOnce();
    },
    [askOnce],
  );

  const toggleDone = useCallback(
    async (id: string) => {
      const before = currentTodos.current.find((t) => t.id === id);
      if (!before) return;
      await update(id, { doneAt: before.doneAt ? null : new Date().toISOString() });
    },
    [update],
  );

  const remove = useCallback(async (id: string) => {
    await removeTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addTopic = useCallback(async (title: string) => {
    const sort = Math.max(0, ...currentTopics.current.map((t) => t.sort)) + 1;
    const topic = makeTopic('custom', title.trim(), sort);
    await saveTopic(topic);
    setTopics((prev) => [...prev, topic]);
    return topic;
  }, []);

  const updateTopic = useCallback<TodosContextValue['updateTopic']>(async (id, patch) => {
    const before = currentTopics.current.find((t) => t.id === id);
    if (!before) return;
    const next: Topic = { ...before, ...patch, updatedAt: new Date().toISOString() };
    await saveTopic(next);
    setTopics((prev) => prev.map((t) => (t.id === id ? next : t)));
  }, []);

  const value = useMemo(
    () => ({ topics, todos, loading, add, update, toggleDone, remove, addTopic, updateTopic, topicOfKind }),
    [topics, todos, loading, add, update, toggleDone, remove, addTopic, updateTopic, topicOfKind],
  );

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosContextValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodos 는 TodosProvider 안에서만 쓸 수 있어요');
  return value;
}
