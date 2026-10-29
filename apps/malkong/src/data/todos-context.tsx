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

import { isApptRef } from './appointment';
import { autoRulesToAdd, birthOf, reconcileAuto } from './auto-todos';
import { useBaby } from './baby-context';
import { checkupGroups } from './checkup-todos';
import { insertRoutineLogRow, readSetting, upsertRoutineRow, writeSetting } from './db';
import { memberName, noteDeleted } from './family';
import { happyMoment } from './review';
import { onRemoteChange, requestSync } from './sync-events';
import { EVENING_HOUR, deliveryChecks, eveningPlan, morningPlan, reminderBody } from './alert-plan';
import {
  askNotifications,
  cancelSnooze,
  onAlertAction,
  scheduleDeliveryChecks,
  scheduleEveningAlerts,
  scheduleMorningAlerts,
  scheduleTodoReminders,
  snoozeTodo,
} from './notifications';
import { usePreferences } from './preferences-context';
import { useRecords } from './records-context';
import type { Repeat } from './repeat';
import { makeRoutine, makeRoutineLog } from './routine';
import {
  DEFAULT_TOPICS,
  RENAMED_TITLES,
  isLegacyKind,
  loadTodos,
  loadTopics,
  makeTodo,
  makeTopic,
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
/** 생활 루틴 주제의 반복 할 일을 루틴으로 옮겼는지(task today/001) */
const ROUTINES_MOVED_KEY = 'routines_moved_from_topic';
/** 2026-10-15 에 앱이 만든 신청 · 서류 할 일(ref `paper:`)을 한 번 지웠는지 — 신청 · 서류는 넣지 않는다(decisions/026 · 029 · 030) */
const PAPER_REMOVED_KEY = 'paper_todos_removed';
/** 장보기 주제의 숨김을 한 번 풀었는지(task topic/004) */
const SHOP_READY_KEY = 'shop_tab_ready';
/** 앱이 만든 할 일 중 사용자가 지운 것의 규칙 열쇠 — 다시 만들지 않는다. JSON 배열 */
const AUTO_REMOVED_KEY = 'auto_todo_removed';
/** 앱이 만든 할 일을 마지막으로 맞춘 생일 — 생일이 바뀌면 안 끝낸 것을 새 생일로 다시 맞춘다(task common/026) */
const AUTO_BIRTH_KEY = 'auto_todo_birth';

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
  /** 주제 만들기 — 아이콘과, 추천 주제면 날짜 없이 채울 할 일 제목들(SPEC-TOPIC-12) */
  addTopic: (title: string, icon?: string | null, items?: string[]) => Promise<Topic>;
  updateTopic: (id: string, patch: Partial<Pick<Topic, 'title' | 'hidden' | 'icon'>>) => Promise<void>;
  /** 모두 체크 해제 — 그 주제에서 완료한 할 일(반복 없는 것)을 되돌린다 */
  resetTopic: (id: string) => Promise<void>;
  topicOfKind: (kind: TopicKind) => Topic | undefined;
  /** 반복 추천에서 「다시 보지 않기」를 누른 열쇠들 */
  dismissed: string[];
  /** 반복 추천 받아들이기 — 안 끝낸 같은 할 일이 있으면 거기에 반복을 붙이고, 없으면 다음 차례로 새로 만든다 */
  acceptRepeat: (s: RepeatSuggestion, rule: Repeat) => Promise<void>;
  dismissRepeat: (key: string) => Promise<void>;
  /** 앱이 만든 할 일 중 사용자가 지운 것의 규칙 열쇠 — 주제 화면 「다가오는 할 일」에서도 뺀다 */
  autoRemoved: string[];
  /** 아직 만들지 않은 앞날 일정을 지운다 — 그 규칙으로 다시 만들지 않는다(아기 일정의 달력 줄, task topic/010) */
  skipAuto: (ref: string) => Promise<void>;
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

      // 「생활 루틴」 주제의 반복 할 일은 루틴으로 옮긴다 — 한 번만(task today/001, decisions/028).
      // 마지막으로 완료한 때를 루틴 기록 한 줄로 남겨 「마지막 6일 전」이 이어지게 한다
      if (!(await readSetting(ROUTINES_MOVED_KEY))) {
        const routineTopic = stored.find((t) => t.kind === 'routine');
        if (routineTopic) {
          const all = await loadTodos();
          const repeating = all.filter((t) => t.topicId === routineTopic.id && !t.doneAt && t.repeat);
          for (const [i, t] of repeating.entries()) {
            const rule = t.repeat as NonNullable<Todo['repeat']>;
            const everyDays = rule.kind === 'daily' ? 1 : rule.kind === 'every' ? rule.days : rule.kind === 'weekly' ? 7 : 30;
            const due = t.hasTime && t.dueAt ? new Date(t.dueAt) : null;
            const time = due ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : null;
            const routine = makeRoutine({ title: t.title, kind: 'check', everyDays, weekdays: null, time, items: null }, i);
            await upsertRoutineRow(routine);
            const lastDone = all
              .filter((d) => d.doneAt && d.topicId === routineTopic.id && titleKey(d.title) === titleKey(t.title))
              .map((d) => d.doneAt as string)
              .sort()
              .pop();
            if (lastDone) await insertRoutineLogRow(makeRoutineLog(routine.id, new Date(lastDone)));
            await removeTodo(t.id);
          }
        }
        await writeSetting(ROUTINES_MOVED_KEY, 'yes');
      }

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
      // 앱이 만든 신청 · 서류 할 일 중 안 끝낸 것은 한 번 지운다 — 사용자가 적은 것이 아니다. 끝낸 것은 기록으로 남긴다
      if (!(await readSetting(PAPER_REMOVED_KEY))) {
        const paper = storedTodos.filter((t) => t.ref?.startsWith('paper:') && !t.doneAt);
        for (const t of paper) {
          await removeTodo(t.id);
          await noteDeleted(t.id);
        }
        storedTodos = storedTodos.filter((t) => !paper.includes(t));
        await writeSetting(PAPER_REMOVED_KEY, 'yes');
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

  // 가족 폰에서 온 할 일 · 주제를 다시 읽는다(task my/009)
  useEffect(
    () =>
      onRemoteChange((kinds) => {
        if (!kinds.includes('todos')) return;
        void Promise.all([loadTopics(), loadTodos()]).then(([t, d]) => {
          setTopics(t);
          setTodos(d);
        });
      }),
    [],
  );

  // 할 일 알림 — 시각이 있고, 안 끝냈고, 아직 오지 않은 것만(SPEC-TOPIC-09). 반복 할 일은 「마지막으로 한 지 7일 지났어요」
  useEffect(() => {
    if (loading) return;
    const now = Date.now();
    const items = todos
      .filter((t) => t.hasTime && t.dueAt && !t.doneAt && new Date(t.dueAt).getTime() > now)
      .map((t) => ({ id: t.id, at: new Date(t.dueAt as string), title: t.title, body: reminderBody(t, todos) }));
    enqueue(() => scheduleTodoReminders(items));
  }, [todos, loading, enqueue]);

  // 아침 알림 · 전날 저녁 · 받으셨나요(SPEC-TOPIC-09 · SPEC-SHOP-04) — 일주일 치를 날짜마다.
  // 아침에는 지금 기간인 접종 · 검진 이름과 도착 예정도 넣는다. 전날 저녁은 아침 알림을 켰을 때만
  const month = age?.month ?? null;
  useEffect(() => {
    if (loading || prefsLoading) return;
    const checkups = month === null ? [] : checkupGroups(records, month).filter((g) => g.status === 'open').map((g) => g.label);
    const shopIds = new Set(topics.filter((t) => t.kind === 'shopping').map((t) => t.id));
    const morning = morningPlan(todos, checkups);
    // 전날 저녁은 사흘 치만 — iOS 알림 한도 안에 루틴 알림을 넣으려고(task today/001)
    const evening = eveningPlan(todos, shopIds, new Date(), 3);
    const checks = deliveryChecks(todos);
    enqueue(async () => {
      await scheduleMorningAlerts(briefingTime, morning);
      await scheduleEveningAlerts(briefingTime !== null, evening, EVENING_HOUR);
      await scheduleDeliveryChecks(checks);
    });
  }, [todos, topics, loading, prefsLoading, briefingTime, records, month, enqueue]);

  // 앱이 채워 주는 할 일 — 기한 전 보일 날이 되면 그 주제의 할 일로 만든다(SPEC-TOPIC-11). 숨긴 주제에는 만들지 않는다
  const birthDate = baby?.birthDate ?? null;

  // 생일이 바뀌면(프로필 수정 · 가족에 참여해 가족의 아기로 바뀜) 예전 생일로 만든 할 일을 새 생일에 맞춘다(task common/026).
  // 처음 실행은 지금 생일을 적어 두기만 한다 — 사용자가 고친 기한을 덮지 않게 생일이 바뀔 때만 맞춘다
  const reconciling = useRef(false);
  useEffect(() => {
    if (loading || !birthDate || reconciling.current) return;
    reconciling.current = true;
    void (async () => {
      const last = await readSetting(AUTO_BIRTH_KEY);
      if (last === birthDate) return;
      if (last) {
        const { update, remove } = reconcileAuto(currentTodos.current, birthOf(birthDate), new Date());
        const at = new Date().toISOString();
        const moved = new Map(update.map((u) => [u.id, u.dueAt]));
        for (const t of currentTodos.current) {
          const dueAt = moved.get(t.id);
          if (dueAt) await saveTodo({ ...t, dueAt, updatedAt: at });
        }
        for (const id of remove) {
          await removeTodo(id);
          await noteDeleted(id);
        }
        if (update.length + remove.length > 0) {
          setTodos((prev) =>
            prev
              .filter((t) => !remove.includes(t.id))
              .map((t) => (moved.has(t.id) ? { ...t, dueAt: moved.get(t.id) as string, updatedAt: at } : t)),
          );
          requestSync();
        }
      }
      await writeSetting(AUTO_BIRTH_KEY, birthDate);
    })().finally(() => {
      reconciling.current = false;
    });
  }, [loading, birthDate]);
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
      requestSync();
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
      requestSync();
      if (next.hasTime && !before.hasTime) await askOnce();
    },
    [askOnce],
  );

  // 앱이 만든 할 일을 지우면 그 규칙을 남겨 다시 만들지 않는다
  const skipAuto = useCallback(async (ref: string) => {
    setAutoRemoved((prev) => {
      const next = [...prev.filter((r) => r !== ref), ref];
      void writeSetting(AUTO_REMOVED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback(
    async (id: string) => {
      const ref = currentTodos.current.find((t) => t.id === id)?.ref;
      await removeTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      // 가족 폰에서도 지워지게 지운 표시를 남긴다(task my/009)
      await noteDeleted(id);
      requestSync();
      // 접종 · 검진 예약(appt:)은 앱이 만드는 규칙이 아니라 건너뛸 것이 없다
      if (ref && !isApptRef(ref)) await skipAuto(ref);
    },
    [skipAuto],
  );

  // 반복 할 일은 완료하면 다음 차례 줄을 만들고, 되돌리면 그 줄을 지운다(SPEC-TOPIC-06)
  const toggleDone = useCallback(
    async (id: string) => {
      const before = currentTodos.current.find((t) => t.id === id);
      if (!before) return;
      if (before.doneAt) {
        const spawned = spawnedBy(before, currentTodos.current);
        if (spawned) await remove(spawned.id);
        await update(id, { doneAt: null, doneBy: null });
        return;
      }
      const now = new Date();
      // 누가 했는지 — 가족 공유를 켠 폰에서만 이름이 있다(task my/009)
      await update(id, { doneAt: now.toISOString(), doneBy: await memberName() });
      // 좋은 순간 — 쌓이면 스토어 별점 창(SPEC-MY-09). 알림 단추로 완료하면 앱이 뒤에 있어 띄우지 않는다
      void happyMoment();
      const next = nextRepeatTodo(before, now);
      if (next) {
        await saveTodo(next);
        setTodos((prev) => [...prev, next]);
        requestSync();
      }
    },
    [update, remove],
  );

  // 알림 단추(SPEC-TOPIC-09) — 완료 · 수령 완료는 완료로, 1시간 뒤는 같은 알림을 한 번 더
  const toggleRef = useRef(toggleDone);
  useEffect(() => {
    toggleRef.current = toggleDone;
  }, [toggleDone]);
  useEffect(() => {
    if (loading) return;
    return onAlertAction('todo', (action, todoId, title, body) => {
      if (action === 'snooze') {
        void snoozeTodo(todoId, title, body).catch(() => undefined);
        return;
      }
      void cancelSnooze(todoId).catch(() => undefined);
      const todo = currentTodos.current.find((t) => t.id === todoId);
      if (todo && !todo.doneAt) void toggleRef.current(todoId);
    });
  }, [loading]);

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
      requestSync();
    },
    [update],
  );

  const dismissRepeat = useCallback(async (key: string) => {
    const next = [...currentDismissed.current.filter((k) => k !== key), key];
    setDismissed(next);
    await writeSetting(DISMISSED_KEY, JSON.stringify(next));
  }, []);

  const addTopic = useCallback<TodosContextValue['addTopic']>(async (title, icon = null, items = []) => {
    const sort = Math.max(0, ...currentTopics.current.map((t) => t.sort)) + 1;
    const topic = makeTopic('custom', title.trim(), sort, icon);
    await saveTopic(topic);
    setTopics((prev) => [...prev, topic]);
    const made = items.map((item) => makeTodo({ topicId: topic.id, title: item, source: 'starter' }));
    for (const t of made) await saveTodo(t);
    if (made.length > 0) setTodos((prev) => [...prev, ...made]);
    requestSync();
    return topic;
  }, []);

  const resetTopic = useCallback(async (id: string) => {
    const at = new Date().toISOString();
    const undone = currentTodos.current
      .filter((t) => t.topicId === id && t.doneAt && !t.repeat)
      .map((t) => ({ ...t, doneAt: null, doneBy: null, updatedAt: at }));
    for (const t of undone) await saveTodo(t);
    const ids = new Map(undone.map((t) => [t.id, t]));
    setTodos((prev) => prev.map((t) => ids.get(t.id) ?? t));
    requestSync();
  }, []);

  const updateTopic = useCallback<TodosContextValue['updateTopic']>(async (id, patch) => {
    const before = currentTopics.current.find((t) => t.id === id);
    if (!before) return;
    const next: Topic = { ...before, ...patch, updatedAt: new Date().toISOString() };
    await saveTopic(next);
    setTopics((prev) => prev.map((t) => (t.id === id ? next : t)));
    requestSync();
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
      resetTopic,
      topicOfKind,
      dismissed,
      acceptRepeat,
      dismissRepeat,
      autoRemoved,
      skipAuto,
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
      resetTopic,
      topicOfKind,
      dismissed,
      acceptRepeat,
      dismissRepeat,
      autoRemoved,
      skipAuto,
    ],
  );

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosContextValue {
  const value = useContext(TodosContext);
  if (!value) throw new Error('useTodos 는 TodosProvider 안에서만 쓸 수 있어요');
  return value;
}
