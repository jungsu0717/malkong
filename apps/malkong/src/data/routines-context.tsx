/**
 * 루틴을 화면들이 함께 보는 자리 (SPEC-MAIN-01~04, task today/001, decisions/028).
 *
 * 오늘 탭이 루틴과 기록을 본다. 루틴이나 기록이 바뀔 때마다 사흘 치 루틴 알림을 다시 건다(SPEC-MAIN-04).
 * 할 일 쪽이 먼저 「생활 루틴」 주제의 반복 할 일을 루틴으로 옮기므로, 할 일을 다 읽은 뒤에 읽는다.
 * 알림의 「완료」 · 「1시간 뒤」 단추도 여기서 처리한다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { deleteRoutineLogRow, insertRoutineLogRow, readRoutineLogRows, readRoutineRows, readSetting, upsertRoutineRow, writeSetting } from './db';
import { memberName, noteDeleted } from './family';
import { askNotifications, onAlertAction, scheduleRoutineReminders, snoozeTodo } from './notifications';
import { logsOn, makeRoutine, makeRoutineLog, routineReminders, stockToBuy, titleKey, todayState, type Routine, type RoutineInput, type RoutineLog } from './routine';
import { onRemoteChange, requestSync } from './sync-events';
import { placeOf } from './todos';
import { useTodos } from './todos-context';

/** 알림 허락을 처음 알림 시각을 넣을 때 한 번만 묻는다 — 할 일과 같은 설정값 */
const ASKED_KEY = 'todo_reminder_asked';

type RoutinesValue = {
  /** 지운 것(숨김)은 뺀 루틴, 순서대로 */
  routines: Routine[];
  logs: RoutineLog[];
  loading: boolean;
  /** 같은 이름으로 지운 루틴이 있으면 그것을 되살려 지난 기록을 잇는다(task today/004) */
  addRoutine: (input: RoutineInput) => Promise<Routine>;
  updateRoutine: (id: string, patch: Partial<RoutineInput>) => Promise<void>;
  /** 지우기 — 숨김이라 지난 기록은 남는다 */
  removeRoutine: (id: string) => Promise<void>;
  /** 지운 루틴을 그대로 되살림 — 「되돌리기」 */
  restoreRoutine: (id: string) => Promise<void>;
  /** 체크 루틴: 오늘 안 했으면 완료로, 했으면 오늘 것(단계 포함)을 되돌린다 */
  check: (id: string) => Promise<void>;
  /** 단계 하나를 끝냄 ↔ 되돌림. 마지막 단계까지 끝내면 루틴 전체 한 줄을 남기고, 단계를 되돌리면 그 줄도 지운다(SPEC-MAIN-05) */
  toggleStep: (id: string, step: number) => Promise<void>;
  /** 루틴 전체를 끝냄(단계 시트 「모두 완료」) — 이미 끝났으면 그대로 */
  completeAll: (id: string) => Promise<void>;
  /** 「오늘은 건너뛰기」 ↔ 취소 — 그날 알림과 진행에서 빠진다(task common/022) */
  skipToday: (id: string) => Promise<void>;
  /** 재고 확인 — 부족한 것을 장보기에 넣고 루틴을 끝낸다. 새로 넣은 수를 돌려준다(SPEC-MAIN-06) */
  completeStock: (id: string, short: string[]) => Promise<number>;
};

const RoutinesContext = createContext<RoutinesValue | null>(null);

export function RoutinesProvider({ children }: { children: React.ReactNode }) {
  const { loading: todosLoading, todos, topics, add: addTodo } = useTodos();
  const [all, setAll] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const current = useRef<{ all: Routine[]; logs: RoutineLog[] }>({ all: [], logs: [] });
  useEffect(() => {
    current.current = { all, logs };
  }, [all, logs]);

  useEffect(() => {
    if (todosLoading) return;
    let cancelled = false;
    (async () => {
      const [rows, logRows] = await Promise.all([readRoutineRows(), readRoutineLogRows()]);
      if (cancelled) return;
      setAll(rows);
      setLogs(logRows);
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [todosLoading]);

  const routines = useMemo(() => all.filter((r) => !r.hidden).sort((a, b) => a.sort - b.sort), [all]);

  // 루틴 알림 — 사흘 치를 통째로 다시 건다. 앞의 것을 지우고 거는 도중에 다음 것이 끼지 않게 차례로
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (loading) return;
    const items = routineReminders(routines, logs);
    queue.current = queue.current.then(() => scheduleRoutineReminders(items)).catch(() => undefined);
  }, [routines, logs, loading]);

  // 가족 폰에서 온 루틴 · 기록을 다시 읽는다(task my/009) — 배우자가 먼저 했으면 그날 알림도 지워진다
  useEffect(
    () =>
      onRemoteChange((kinds) => {
        if (!kinds.includes('routines')) return;
        void Promise.all([readRoutineRows(), readRoutineLogRows()]).then(([rows, logRows]) => {
          setAll(rows);
          setLogs(logRows);
        });
      }),
    [],
  );

  const save = useCallback(async (next: Routine) => {
    await upsertRoutineRow(next);
    setAll((prev) => (prev.some((r) => r.id === next.id) ? prev.map((r) => (r.id === next.id ? next : r)) : [...prev, next]));
    requestSync();
  }, []);

  const askOnce = useCallback(async () => {
    if (await readSetting(ASKED_KEY)) return;
    await writeSetting(ASKED_KEY, 'yes');
    await askNotifications().catch(() => false);
  }, []);

  const addRoutine = useCallback<RoutinesValue['addRoutine']>(
    async (input) => {
      const title = input.title.trim();
      const gone = current.current.all
        .filter((r) => r.hidden && titleKey(r.title) === titleKey(title))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const sort = Math.max(-1, ...current.current.all.map((r) => r.sort)) + 1;
      const routine = gone
        ? { ...gone, ...input, title, hidden: false, sort, updatedAt: new Date().toISOString() }
        : makeRoutine({ ...input, title }, sort);
      await save(routine);
      if (routine.time) await askOnce();
      return routine;
    },
    [save, askOnce],
  );

  const updateRoutine = useCallback<RoutinesValue['updateRoutine']>(
    async (id, patch) => {
      const before = current.current.all.find((r) => r.id === id);
      if (!before) return;
      await save({ ...before, ...patch, updatedAt: new Date().toISOString() });
      if (patch.time && !before.time) await askOnce();
    },
    [save, askOnce],
  );

  const removeRoutine = useCallback(
    async (id: string) => {
      const before = current.current.all.find((r) => r.id === id);
      if (before) await save({ ...before, hidden: true, updatedAt: new Date().toISOString() });
    },
    [save],
  );

  const restoreRoutine = useCallback(
    async (id: string) => {
      const before = current.current.all.find((r) => r.id === id);
      if (before?.hidden) await save({ ...before, hidden: false, updatedAt: new Date().toISOString() });
    },
    [save],
  );

  // 누가 했는지 — 가족 공유를 켠 폰에서만 이름이 있다(task my/009)
  const addLog = useCallback(async (log: RoutineLog) => {
    const withBy = { ...log, by: log.by ?? (await memberName()) };
    await insertRoutineLogRow(withBy);
    setLogs((prev) => [...prev, withBy]);
    requestSync();
  }, []);

  const dropLog = useCallback(async (id: string) => {
    await deleteRoutineLogRow(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await noteDeleted(id);
    requestSync();
  }, []);

  const check = useCallback(
    async (id: string) => {
      const all = logsOn(id, current.current.logs, new Date());
      if (all.some((l) => l.step == null && !l.skip)) {
        for (const l of all.filter((x) => !x.skip)) await dropLog(l.id);
        return;
      }
      await addLog(makeRoutineLog(id, new Date()));
    },
    [addLog, dropLog],
  );

  const skipToday = useCallback(
    async (id: string) => {
      const skips = logsOn(id, current.current.logs, new Date()).filter((l) => l.skip);
      if (skips.length > 0) {
        for (const l of skips) await dropLog(l.id);
        return;
      }
      await addLog(makeRoutineLog(id, new Date(), null, null, true));
    },
    [addLog, dropLog],
  );

  const toggleStep = useCallback(
    async (id: string, step: number) => {
      const routine = current.current.all.find((r) => r.id === id);
      if (!routine?.items) return;
      const all = logsOn(id, current.current.logs, new Date());
      const mine = all.filter((l) => l.step === step);
      const whole = all.filter((l) => l.step == null && !l.skip);
      // 끝낸 단계를 누르거나, 「모두 완료」한 뒤 아무 단계나 누르면 되돌림 — 루틴 전체 줄도 지운다
      if (mine.length > 0 || whole.length > 0) {
        for (const l of [...mine, ...whole]) await dropLog(l.id);
        return;
      }
      await addLog(makeRoutineLog(id, new Date(), null, step));
      const doneSteps = new Set([...all.filter((l) => l.step != null).map((l) => l.step), step]);
      if (doneSteps.size >= routine.items.length && whole.length === 0) await addLog(makeRoutineLog(id, new Date()));
    },
    [addLog, dropLog],
  );

  const completeAll = useCallback(
    async (id: string) => {
      const all = logsOn(id, current.current.logs, new Date());
      if (!all.some((l) => l.step == null && !l.skip)) await addLog(makeRoutineLog(id, new Date()));
    },
    [addLog],
  );

  const completeStock = useCallback(
    async (id: string, short: string[]) => {
      let added = 0;
      const shop = topics.find((t) => t.kind === 'shopping');
      if (shop && short.length > 0) {
        const items = todos.filter((t) => t.topicId === shop.id);
        const open = items.filter((t) => !t.doneAt).map((t) => t.title);
        const bought = items.filter((t) => t.doneAt).map((t) => ({ title: t.title, store: placeOf(t), doneAt: t.doneAt as string }));
        for (const it of stockToBuy(short, open, bought)) {
          await addTodo({ title: it.title, topicId: shop.id, store: it.store, source: 'stock' });
          added += 1;
        }
      }
      await completeAll(id);
      return added;
    },
    [topics, todos, addTodo, completeAll],
  );

  // 알림 단추 — 「완료」는 오늘 아직 안 했으면 완료로, 「1시간 뒤」는 같은 알림을 한 번 더
  useEffect(() => {
    if (loading) return;
    return onAlertAction('routine', (action, id, title, body) => {
      if (action === 'snooze') {
        void snoozeTodo(id, title, body, true).catch(() => undefined);
        return;
      }
      const routine = current.current.all.find((r) => r.id === id);
      if (!routine) return;
      const state = todayState(routine, current.current.logs);
      // 단계 · 재고 확인도 알림의 「완료」는 루틴 전체를 끝낸 것으로 본다
      if (!state.firstAt) void addLog(makeRoutineLog(id, new Date()));
    });
  }, [loading, addLog]);

  const value = useMemo(
    () => ({
      routines,
      logs,
      loading,
      addRoutine,
      updateRoutine,
      removeRoutine,
      restoreRoutine,
      check,
      toggleStep,
      completeAll,
      skipToday,
      completeStock,
    }),
    [routines, logs, loading, addRoutine, updateRoutine, removeRoutine, restoreRoutine, check, toggleStep, completeAll, skipToday, completeStock],
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines(): RoutinesValue {
  const value = useContext(RoutinesContext);
  if (!value) throw new Error('useRoutines 는 RoutinesProvider 안에서만 쓸 수 있어요');
  return value;
}
