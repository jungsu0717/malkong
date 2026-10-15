/**
 * 주제와 할 일을 화면들이 함께 보는 자리 (SPEC-TOPIC-01~03 · 06 · 09, decisions/024).
 *
 * 할 일 탭 · 주제 화면 · 기록 탭 요약 줄이 같은 목록을 본다. 처음 실행하면 기본 주제를 만든다(SPEC-TOPIC-01).
 * 반복 할 일을 완료하면 다음 차례 줄을 만들고, 되돌리면 지운다(SPEC-TOPIC-06).
 * 할 일이 바뀔 때마다 시각이 있는 할 일의 알림과 일주일 치 아침 알림을 다시 건다(SPEC-TOPIC-09).
 * 알림 허락은 처음 시각을 넣을 때 한 번 묻는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useBaby } from './baby-context';
import { checkupGroups } from './checkup-todos';
import { readSetting, writeSetting } from './db';
import { askNotifications, scheduleMorningAlerts, scheduleTodoReminders } from './notifications';
import { usePreferences } from './preferences-context';
import { useRecords } from './records-context';
import type { Repeat } from './repeat';
import {
  DEFAULT_TOPICS,
  RENAMED_TITLES,
  guessTopicKind,
  loadTodos,
  loadTopics,
  makeTodo,
  makeTopic,
  morningDays,
  nextRepeatTodo,
  removeTodo,
  repeatStart,
  saveTodo,
  saveTopic,
  spawnedBy,
  titleKey,
  type RepeatSuggestion,
  type Todo,
  type TodoInput,
  type Topic,
  type TopicKind,
} from './todos';

/** 할 일 알림 허락을 처음 시각을 넣을 때 한 번만 묻는다 */
const ASKED_KEY = 'todo_reminder_asked';
/** 반복 추천에서 「다시 보지 않기」를 누른 것 — JSON 배열(주제 id:띄어쓰기를 뺀 제목) */
const DISMISSED_KEY = 'repeat_suggest_dismissed';

type TodosContextValue = {
  topics: Topic[];
  /** 적은 순서 */
  todos: Todo[];
  loading: boolean;
  /** 주제를 주지 않으면 제목으로 짐작한다(없으면 「기타」) */
  add: (input: Omit<TodoInput, 'topicId'> & { topicId?: string }) => Promise<Todo | null>;
  update: (id: string, patch: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  /** 끝냄 ↔ 되돌림 */
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTopic: (title: string) => Promise<Topic>;
  updateTopic: (id: string, patch: Partial<Pick<Topic, 'title' | 'hidden'>>) => Promise<void>;
  topicOfKind: (kind: TopicKind) => Topic | undefined;
  /** 반복 추천에서 「다시 보지 않기」를 누른 열쇠들 */
  dismissed: string[];
  /** 반복 추천 받아들이기 — 안 끝낸 같은 할 일이 있으면 거기에 반복을 붙이고, 없으면 다음 차례로 새로 만든다 */
  acceptRepeat: (s: RepeatSuggestion, rule: Repeat) => Promise<void>;
  dismissRepeat: (key: string) => Promise<void>;
};

const TodosContext = createContext<TodosContextValue | null>(null);

export function TodosProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { briefingTime, loading: prefsLoading } = usePreferences();
  const { age } = useBaby();
  const { records } = useRecords();
  /** 알림 걸기를 차례로 — 앞의 것이 지우고 거는 도중에 다음 것이 끼면 지운 알림이 다시 살아날 수 있어서 */
  const alertQueue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    alertQueue.current = alertQueue.current.then(job).catch(() => undefined);
  }, []);
  // 고칠 때 지금 줄을 찾는 자리 — 화면이 그려진 뒤의 목록
  const currentTodos = useRef<Todo[]>([]);
  const currentTopics = useRef<Topic[]>([]);
  const currentDismissed = useRef<string[]>([]);
  useEffect(() => {
    currentTodos.current = todos;
  }, [todos]);
  useEffect(() => {
    currentDismissed.current = dismissed;
  }, [dismissed]);
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
      // 예전 기본 주제 이름을 지금 이름으로(사용자가 바꾼 이름은 그대로)
      stored = await Promise.all(
        stored.map(async (t) => {
          const renamed = t.kind !== 'custom' ? RENAMED_TITLES[t.title] : undefined;
          if (!renamed) return t;
          const next = { ...t, title: renamed, updatedAt: new Date().toISOString() };
          await saveTopic(next);
          return next;
        }),
      );
      const storedTodos = await loadTodos();
      const storedDismissed = await readSetting(DISMISSED_KEY);
      if (cancelled) return;
      setTopics(stored);
      setTodos(storedTodos);
      try {
        setDismissed(storedDismissed ? (JSON.parse(storedDismissed) as string[]) : []);
      } catch {
        setDismissed([]);
      }
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
    enqueue(() => scheduleTodoReminders(items));
  }, [todos, loading, enqueue]);

  // 아침 알림 — 일주일 치를 날짜마다 그날 할 일 제목으로(SPEC-TOPIC-09). 지금 기간인 접종 · 검진 이름도 넣는다
  const month = age?.month ?? null;
  useEffect(() => {
    if (loading || prefsLoading) return;
    const checkups = month === null ? [] : checkupGroups(records, month).filter((g) => g.status === 'open').map((g) => g.label);
    const days = morningDays(todos, checkups);
    enqueue(() => scheduleMorningAlerts(briefingTime, days));
  }, [todos, loading, prefsLoading, briefingTime, records, month, enqueue]);

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
      // 반복을 정했는데 기한이 없으면 오늘부터 맞는 첫날로
      const dueAt = input.dueAt ?? (input.repeat ? repeatStart(input.repeat, null).toISOString() : null);
      const todo = makeTodo({ ...input, title, topicId, dueAt });
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
      if (next.repeat && !next.dueAt) next.dueAt = repeatStart(next.repeat, null).toISOString();
      await saveTodo(next);
      setTodos((prev) => prev.map((t) => (t.id === id ? next : t)));
      if (next.hasTime && !before.hasTime) await askOnce();
    },
    [askOnce],
  );

  const remove = useCallback(async (id: string) => {
    await removeTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 반복 할 일은 완료하면 다음 차례 줄을 만들고, 되돌리면 그 줄을 지운다(SPEC-TOPIC-06)
  const toggleDone = useCallback(
    async (id: string) => {
      const before = currentTodos.current.find((t) => t.id === id);
      if (!before) return;
      if (before.doneAt) {
        const spawned = spawnedBy(before, currentTodos.current);
        if (spawned) await remove(spawned.id);
        await update(id, { doneAt: null });
        return;
      }
      const now = new Date();
      await update(id, { doneAt: now.toISOString() });
      const next = nextRepeatTodo(before, now);
      if (next) {
        await saveTodo(next);
        setTodos((prev) => [...prev, next]);
      }
    },
    [update, remove],
  );

  const acceptRepeat = useCallback<TodosContextValue['acceptRepeat']>(
    async (s, rule) => {
      const key = titleKey(s.title);
      const open = currentTodos.current.find((t) => !t.doneAt && t.topicId === s.topicId && titleKey(t.title) === key);
      if (open) {
        await update(open.id, { repeat: rule, dueAt: open.dueAt ?? repeatStart(rule, null).toISOString() });
        return;
      }
      const start = repeatStart(rule, s.last.doneAt ? new Date(s.last.doneAt) : null);
      const todo = makeTodo({
        topicId: s.topicId,
        title: s.last.title,
        note: s.last.note,
        buy: s.last.buy,
        repeat: rule,
        source: 'repeat',
        dueAt: start.toISOString(),
      });
      await saveTodo(todo);
      setTodos((prev) => [...prev, todo]);
    },
    [update],
  );

  const dismissRepeat = useCallback(async (key: string) => {
    const next = [...currentDismissed.current.filter((k) => k !== key), key];
    setDismissed(next);
    await writeSetting(DISMISSED_KEY, JSON.stringify(next));
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
    () => ({
      topics,
      todos,
      loading,
      add,
      update,
      toggleDone,
      remove,
      addTopic,
      updateTopic,
      topicOfKind,
      dismissed,
      acceptRepeat,
      dismissRepeat,
    }),
    [topics, todos, loading, add, update, toggleDone, remove, addTopic, updateTopic, topicOfKind, dismissed, acceptRepeat, dismissRepeat],
  );

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosContextValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodos 는 TodosProvider 안에서만 쓸 수 있어요');
  return value;
}
