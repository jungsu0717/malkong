/**
 * 주제와 할 일을 화면들이 함께 보는 자리 (SPEC-TOPIC-01~03 · 06 · 09 · 11, decisions/024 · 025).
 *
 * 홈 · 할 일 탭 · 장보기 탭 · 주제 화면 · 기록 탭 요약 줄이 같은 목록을 본다. 처음 실행하면 기본 주제를 만들고, 예전 기본 주제는 숨기고
 * 거기 적힌 할 일을 「내 할 일」로 옮긴다(SPEC-TOPIC-01). 아기 생일로 앱이 채워 주는 할 일을 기한 전에 만든다(SPEC-TOPIC-11).
 * 반복 할 일을 완료하면 다음 차례 줄을 만들고, 되돌리면 지운다(SPEC-TOPIC-06).
 * 할 일이 바뀔 때마다 시각이 있는 할 일의 알림과 일주일 치 아침 알림을 다시 건다(SPEC-TOPIC-09).
 * 알림 허락은 처음 시각을 넣을 때 한 번 묻는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { autoRulesToAdd, birthOf } from './auto-todos';
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
  isLegacyKind,
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
/** 장보기 주제의 숨김을 한 번 풀었는지(task topic/004) */
const SHOP_READY_KEY = 'shop_tab_ready';
/** 앱이 만든 할 일 중 사용자가 지운 것의 규칙 열쇠 — 다시 만들지 않는다. JSON 배열 */
const AUTO_REMOVED_KEY = 'auto_todo_removed';

function readJsonList(raw: string | null): string[] {
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

type TodosContextValue = {
  topics: Topic[];
  /** 적은 순서 */
  todos: Todo[];
  loading: boolean;
  /** 주제를 주지 않으면 「내 할 일」에 */
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
  /** 앱이 만든 할 일 중 사용자가 지운 것의 규칙 열쇠 — 주제 화면 「다가오는 할 일」에서도 뺀다 */
  autoRemoved: string[];
};

const TodosContext = createContext<TodosContextValue | null>(null);

export function TodosProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [autoRemoved, setAutoRemoved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { briefingTime, loading: prefsLoading } = usePreferences();
  const { baby, age } = useBaby();
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
      const now = () => new Date().toISOString();
      let stored = await loadTopics();
      // 예전 기본 주제 이름을 지금 이름으로(사용자가 바꾼 이름은 그대로)
      stored = stored.map((t) => {
        const renamed = t.kind !== 'custom' ? RENAMED_TITLES[t.title] : undefined;
        return renamed ? { ...t, title: renamed, updatedAt: now() } : t;
      });
      // 기본 주제 — 없는 것은 만들고, 순서를 맞추고, 예전 기본 주제(decisions/025)는 숨긴다(SPEC-TOPIC-01)
      for (const [i, d] of DEFAULT_TOPICS.entries()) {
        const have = stored.find((t) => t.kind === d.kind);
        if (!have) stored.push(makeTopic(d.kind, d.title, i));
        else if (have.sort !== i) stored = stored.map((t) => (t === have ? { ...t, sort: i, updatedAt: now() } : t));
      }
      stored = stored.map((t) => (isLegacyKind(t.kind) && !t.hidden ? { ...t, hidden: true, updatedAt: now() } : t));
      // 장보기는 topic/003 에서 예전 기본 주제로 숨겼다가 topic/004 에서 탭으로 돌아왔다 — 한 번만 숨김을 푼다
      if (!(await readSetting(SHOP_READY_KEY))) {
        stored = stored.map((t) => (t.kind === 'shopping' && t.hidden ? { ...t, hidden: false, updatedAt: now() } : t));
        await writeSetting(SHOP_READY_KEY, 'yes');
      }
      for (const t of stored) await saveTopic(t);

      // 예전 기본 주제에 적힌 할 일은 「내 할 일」로 옮긴다 — 지우지 않는다(헌장 2)
      const general = stored.find((t) => t.kind === 'general');
      const legacyIds = new Set(stored.filter((t) => isLegacyKind(t.kind)).map((t) => t.id));
      let storedTodos = await loadTodos();
      if (general && legacyIds.size > 0) {
        storedTodos = await Promise.all(
          storedTodos.map(async (t) => {
            if (!legacyIds.has(t.topicId)) return t;
            const moved = { ...t, topicId: general.id, updatedAt: now() };
            await saveTodo(moved);
            return moved;
          }),
        );
      }
      const storedDismissed = await readSetting(DISMISSED_KEY);
      const storedRemoved = await readSetting(AUTO_REMOVED_KEY);
      if (cancelled) return;
      setTopics(stored);
      setTodos(storedTodos);
      setDismissed(readJsonList(storedDismissed));
      setAutoRemoved(readJsonList(storedRemoved));
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

  // 앱이 채워 주는 할 일 — 기한 전 보일 날이 되면 그 주제의 할 일로 만든다(SPEC-TOPIC-11). 숨긴 주제에는 만들지 않는다
  const birthDate = baby?.birthDate ?? null;
  const filling = useRef(false);
  useEffect(() => {
    if (loading || !birthDate || filling.current) return;
    const have = new Set([...todos.map((t) => t.ref).filter((r): r is string => !!r), ...autoRemoved]);
    const rules = autoRulesToAdd(birthOf(birthDate), new Date(), have);
    const made = rules.flatMap((r) => {
      const topic = topics.find((t) => t.kind === r.kind && !t.hidden);
      return topic
        ? [makeTodo({ topicId: topic.id, title: r.title, dueAt: r.due(birthOf(birthDate)).toISOString(), source: 'auto', ref: r.ref })]
        : [];
    });
    if (made.length === 0) return;
    filling.current = true;
    void (async () => {
      for (const t of made) await saveTodo(t);
      setTodos((prev) => [...prev, ...made]);
    })().finally(() => {
      filling.current = false;
    });
  }, [loading, birthDate, todos, topics, autoRemoved]);

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
      const topicId = input.topicId ?? currentTopics.current.find((t) => t.kind === 'general')?.id;
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

  // 앱이 만든 할 일을 지우면 그 규칙을 남겨 다시 만들지 않는다
  const remove = useCallback(async (id: string) => {
    const ref = currentTodos.current.find((t) => t.id === id)?.ref;
    await removeTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (ref) {
      setAutoRemoved((prev) => {
        const next = [...prev.filter((r) => r !== ref), ref];
        void writeSetting(AUTO_REMOVED_KEY, JSON.stringify(next));
        return next;
      });
    }
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
      autoRemoved,
    }),
    [
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
      autoRemoved,
    ],
  );

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosContextValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodos 는 TodosProvider 안에서만 쓸 수 있어요');
  return value;
}
