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
import { logsOn, makeRoutine, makeRoutineLog, routineReminders, titleKey, todayState, type Routine, type RoutineInput, type RoutineLog } from './routine';
import { onRemoteChange, requestSync } from './sync-events';
import { useTodos } from './todos-context';

/** 재는 중인 터미타임 — 루틴 id → 시작한 때(이 폰에서만) */
const TIMERS_KEY = 'routine.timers';

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
  /** 정한 때에 완료 한 줄 — 수유와 같이 먹인 비타민D, 물어보기로 적은 루틴(task log/008 · today/019). 새 줄의 id */
  logAt: (id: string, at: Date, endAt?: Date | null, logId?: string) => Promise<string>;
  /** 시간을 재는 루틴(터미타임) — 재는 중인 루틴 id → 시작한 때. 이 폰에서만 기억한다(task today/020) */
  timers: Record<string, string>;
  startTimer: (id: string) => Promise<void>;
  /** 재기를 끝내고 시작부터 지금까지를 완료 한 줄로 */
  stopTimer: (id: string) => Promise<void>;
  /** 이름으로 완료 한 줄 — 같은 이름(띄어쓰기 · 대소문자 무시)의 루틴이 없으면 매일 체크 루틴을 만든다. 새 줄의 id */
  logTitle: (title: string, at: Date) => Promise<string>;
  /** 완료한 한 줄의 때 바꾸기 — 하루 흐름의 기록 화면에서(task today/014) */
  moveLog: (logId: string, at: Date) => Promise<string | null>;
  /** 완료한 한 줄 지우기 — 「완료 취소」 */
  removeLog: (logId: string) => Promise<void>;
  /** 재고 확인 — 부족한 것을 장보기에 넣고 루틴을 끝낸다. 새로 넣은 수를 돌려준다(SPEC-MAIN-06) */
  completeStock: (id: string, short: string[]) => Promise<number>;
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

  const logAt = useCallback(
    async (id: string, at: Date, endAt: Date | null = null, logId?: string) => {
      const made = makeRoutineLog(id, at, null, null, false, endAt);
      const log = logId ? { ...made, id: logId } : made;
      await addLog(log);
      return log.id;
    },
    [addLog],
  );

  const [timers, setTimers] = useState<Record<string, string>>({});
  useEffect(() => {
    void readSetting(TIMERS_KEY).then((v) => {
      try {
        if (v) setTimers(JSON.parse(v) as Record<string, string>);
      } catch {
        // 깨진 값이면 재는 중인 것이 없는 것으로
      }
    });
  }, []);
  const saveTimers = useCallback((next: Record<string, string>) => {
    setTimers(next);
    void writeSetting(TIMERS_KEY, JSON.stringify(next));
  }, []);
  const startTimer = useCallback(
    async (id: string) => {
      saveTimers({ ...timers, [id]: new Date().toISOString() });
    },
    [timers, saveTimers],
  );
  const stopTimer = useCallback(
    async (id: string) => {
      const from = timers[id];
      const rest = { ...timers };
      delete rest[id];
      saveTimers(rest);
      if (from) await logAt(id, new Date(from), new Date());
    },
    [timers, saveTimers, logAt],
  );

  const logTitle = useCallback(
    async (title: string, at: Date) => {
      const key = title.replace(/\s/g, '').toLowerCase();
      const have = current.current.all.find((r) => !r.hidden && r.title.replace(/\s/g, '').toLowerCase() === key);
      const r = have ?? (await addRoutine({ title: title.trim(), kind: 'check', everyDays: 1, weekdays: null, time: null, items: null }));
      return logAt(r.id, at);
    },
    [addRoutine, logAt],
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

  // 때를 바꾸면 그 줄을 지우고 같은 내용으로 새 줄을 넣는다 — 가족 폰에서도 지운 줄과 새 줄로 맞춰진다
  const moveLog = useCallback(
    async (logId: string, at: Date) => {
      const before = current.current.logs.find((l) => l.id === logId);
      if (!before) return null;
      await dropLog(logId);
      // 터미타임처럼 끝이 있는 줄은 걸린 시간을 그대로 두고 함께 옮긴다
      const end = before.endAt ? new Date(new Date(before.endAt).getTime() + (at.getTime() - new Date(before.at).getTime())) : null;
      const moved = makeRoutineLog(before.routineId, at, before.by, before.step, before.skip, end);
      await addLog(moved);
      return moved.id;
    },
    [addLog, dropLog],
  );
  const removeLog = useCallback(async (logId: string) => dropLog(logId), [dropLog]);

  // 재고 확인은 확인만 남긴다 — 장보기를 앱에서 빼서 부족한 것을 살 것에 넣지 않는다(SPEC-MAIN-06, decisions/037)
  const completeStock = useCallback(
    async (id: string, _short: string[]) => {
      await completeAll(id);
      return 0;
    },
    [completeAll],
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
      logAt,
      logTitle,
      timers,
      startTimer,
      stopTimer,
      moveLog,
      removeLog,
      completeStock,
    }),
    [routines, logs, loading, addRoutine, updateRoutine, removeRoutine, restoreRoutine, check, toggleStep, completeAll, skipToday, logAt, logTitle, timers, startTimer, stopTimer, moveLog, removeLog, completeStock],
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines(): RoutinesValue {
  const value = useContext(RoutinesContext);
  if (!value) throw new Error('useRoutines 는 RoutinesProvider 안에서만 쓸 수 있어요');
  return value;
}
