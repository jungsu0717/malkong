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
import { logsOn, makeRoutine, makeRoutineLog, routineReminders, todayState, type Routine, type RoutineInput, type RoutineLog } from './routine';
import { onRemoteChange, requestSync } from './sync-events';
import { useTodos } from './todos-context';

/** 알림 허락을 처음 알림 시각을 넣을 때 한 번만 묻는다 — 할 일과 같은 설정값 */
const ASKED_KEY = 'todo_reminder_asked';

type RoutinesValue = {
  /** 지운 것(숨김)은 뺀 루틴, 순서대로 */
  routines: Routine[];
  logs: RoutineLog[];
  loading: boolean;
  addRoutine: (input: RoutineInput) => Promise<Routine>;
  updateRoutine: (id: string, patch: Partial<RoutineInput>) => Promise<void>;
  /** 지우기 — 숨김이라 지난 기록은 남는다 */
  removeRoutine: (id: string) => Promise<void>;
  /** 체크 루틴: 오늘 안 했으면 완료로, 했으면 오늘 것을 되돌린다 */
  check: (id: string) => Promise<void>;
  /** 타이머 루틴: 분을 더한다 */
  addMinutes: (id: string, minutes: number) => Promise<void>;
  /** 타이머 루틴: 오늘 마지막 기록을 지운다 */
  undoLast: (id: string) => Promise<void>;
  startTimer: (id: string) => Promise<void>;
  /** 타이머를 멈추고 걸린 분(1분 이상)을 기록으로 남긴다 */
  stopTimer: (id: string) => Promise<void>;
};

const RoutinesContext = createContext<RoutinesValue | null>(null);

export function RoutinesProvider({ children }: { children: React.ReactNode }) {
  const { loading: todosLoading } = useTodos();
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
      const sort = Math.max(-1, ...current.current.all.map((r) => r.sort)) + 1;
      const routine = makeRoutine({ ...input, title: input.title.trim() }, sort);
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
      if (before) await save({ ...before, hidden: true, runningSince: null, updatedAt: new Date().toISOString() });
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
      const today = logsOn(id, current.current.logs, new Date());
      if (today.length > 0) {
        for (const l of today) await dropLog(l.id);
        return;
      }
      await addLog(makeRoutineLog(id, new Date()));
    },
    [addLog, dropLog],
  );

  const addMinutes = useCallback(
    async (id: string, minutes: number) => {
      await addLog(makeRoutineLog(id, new Date(), minutes));
    },
    [addLog],
  );

  const undoLast = useCallback(
    async (id: string) => {
      const last = logsOn(id, current.current.logs, new Date()).pop();
      if (last) await dropLog(last.id);
    },
    [dropLog],
  );

  const startTimer = useCallback(
    async (id: string) => {
      const before = current.current.all.find((r) => r.id === id);
      if (before) await save({ ...before, runningSince: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },
    [save],
  );

  const stopTimer = useCallback(
    async (id: string) => {
      const before = current.current.all.find((r) => r.id === id);
      if (!before?.runningSince) return;
      const minutes = Math.max(1, Math.round((Date.now() - new Date(before.runningSince).getTime()) / 60_000));
      await save({ ...before, runningSince: null, updatedAt: new Date().toISOString() });
      await addLog(makeRoutineLog(id, new Date(), minutes));
    },
    [save, addLog],
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
      if (routine.kind === 'check' && !state.firstAt) void addLog(makeRoutineLog(id, new Date()));
    });
  }, [loading, addLog]);

  const value = useMemo(
    () => ({ routines, logs, loading, addRoutine, updateRoutine, removeRoutine, check, addMinutes, undoLast, startTimer, stopTimer }),
    [routines, logs, loading, addRoutine, updateRoutine, removeRoutine, check, addMinutes, undoLast, startTimer, stopTimer],
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines(): RoutinesValue {
  const value = useContext(RoutinesContext);
  if (!value) throw new Error('useRoutines 는 RoutinesProvider 안에서만 쓸 수 있어요');
  return value;
}
