/**
 * 하루 초안의 빈칸 (SPEC-MAIN-16, task today/029, decisions/046) — 흐름 화면(index)이 들고, 물어보기 창과 하루 보기가 함께 본다.
 *
 * 초안은 이 폰의 설정값 `day.draft` 에 그날 끝까지 남긴다. 만든 날이 지나면 채우지 않은 빈칸은 버린다.
 * 어느 빈칸이 채워졌는지는 그날 기록과 맞춰 볼 때마다 센다(day-draft.ts `openShells`) — 위쪽 단추로 기록해도, 가족이 기록해도 빈칸이 함께 채워진다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { readSetting, writeSetting } from '@/data/db';
import { dateOfYmd, dayRecords, liveShellSet, openShells, shellInput, shellSetFromText, type Shell, type ShellSet } from '@/data/day-draft';
import type { RoutineDone } from '@/data/day-flow';
import { newEventId, runningOf } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { newRoutineLogId, titleKey } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';

const KEY = 'day.draft';
const MIN = 60 * 1000;

export type ShellPatch = { amount?: number | null; minutes?: number | null };

export function useDayShells(now: Date) {
  const { events, add, update } = useEvents();
  const { routines, logs, logAt, logTitle } = useRoutines();
  const [stored, setStored] = useState<ShellSet | null>(null);

  useEffect(() => {
    void readSetting(KEY).then((v) => setStored(shellSetFromText(v)));
  }, []);

  const change = useCallback((fn: (prev: ShellSet | null) => ShellSet | null) => {
    setStored((prev) => {
      const next = fn(prev);
      void writeSetting(KEY, next ? JSON.stringify(next) : '').catch(() => undefined);
      return next;
    });
  }, []);

  const set = liveShellSet(stored, now);
  // 루틴 완료 줄 — 단계 줄과 건너뛴 줄은 빼고, 이름은 지금 루틴에서
  const dones = useMemo<RoutineDone[]>(
    () =>
      logs.flatMap((l) => {
        if (l.step != null || l.skip) return [];
        const r = routines.find((x) => x.id === l.routineId);
        return r ? [{ routineId: r.id, logId: l.id, title: r.title, at: l.at, by: l.by, endAt: l.endAt ?? null }] : [];
      }),
    [routines, logs],
  );
  const open = useMemo(() => (set ? openShells(set, dayRecords(events, dones, dateOfYmd(set.day))) : []), [set, events, dones]);

  const create = useCallback((next: ShellSet) => change(() => next), [change]);
  const drop = useCallback(() => change(() => null), [change]);
  const remove = useCallback((ids: string[]) => change((prev) => (prev ? { ...prev, removed: [...prev.removed, ...ids] } : prev)), [change]);
  const markFilled = (shellId: string, recordId: string) => change((prev) => (prev ? { ...prev, filled: { ...prev.filled, [shellId]: recordId } } : prev));

  /** 빈칸을 기록으로 — 고른 시각과 고친 양 · 걸린 시간으로. 어느 기록이 채웠는지 먼저 적어 두어 다른 빈칸이 함께 채워지지 않게 한다 */
  const fill = async (shell: Shell, at: Date, patch: ShellPatch = {}) => {
    const nowMs = Date.now();
    if (shell.kind === 'routine') {
      const r = routines.find((x) => x.id === shell.routineId) ?? routines.find((x) => titleKey(x.title) === titleKey(shell.title));
      const end = shell.minutes ? at.getTime() + shell.minutes * MIN : null;
      const endAt = end !== null && end <= nowMs ? new Date(end) : null;
      if (r) {
        const id = newRoutineLogId();
        markFilled(shell.id, id);
        await logAt(r.id, at, endAt, id);
      } else {
        // 그 루틴을 지웠으면 같은 이름으로 다시 만든다
        markFilled(shell.id, await logTitle(shell.title, at));
      }
      return;
    }
    const input = shellInput(shell, at.getTime(), patch, nowMs);
    if (!input) return;
    // 지금도 재는 중으로 두면 앞서 재던 것은 그때 끝낸다 — 종류마다 하나까지
    if (input.endAt === null && input.startAt) {
      const running = runningOf(events, input.kind);
      if (running) await update(running.id, { endAt: input.startAt });
    }
    const id = newEventId();
    markFilled(shell.id, id);
    await add(input, id);
  };

  return { set, open, create, drop, remove, fill };
}

export type DayShells = ReturnType<typeof useDayShells>;
