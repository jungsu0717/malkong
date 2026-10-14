/**
 * 가족 공유를 화면들이 함께 보는 자리 (SPEC-MY-05, task my/007).
 *
 * 앱을 열 때 · 앞으로 올 때 · 기록이나 아기가 바뀐 뒤(1.5초 모아서) 서버와 맞춘다. 서버에 닿지 못하면 조용히 다음에.
 * 맞춰서 바뀐 것이 있으면 기록 · 아기를 다시 읽게 한다 — 상대가 적은 기록이 다음 답 · 브리핑에 바로 들어간다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from './api';
import { useBaby } from './baby-context';
import {
  enterFamily,
  forgetFamily,
  loadFamilyState,
  quitFamily,
  startFamily,
  syncOnce,
  type FamilyState,
} from './family';
import { useEvents } from './events-context';
import { useRecords } from './records-context';
import { onSyncRequest } from './sync-events';

/** 기록 · 아기가 잇달아 바뀔 때 한 번에 올리려고 기다리는 시간 */
const DEBOUNCE_MS = 1500;

type FamilyContextValue = {
  /** 읽는 중 → 가족 없음 → 가족 있음 */
  status: 'loading' | 'none' | 'member';
  state: FamilyState | null;
  syncing: boolean;
  create: () => Promise<void>;
  join: (code: string) => Promise<void>;
  leave: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FamilyState | null>(null);
  const [status, setStatus] = useState<FamilyContextValue['status']>('loading');
  const [syncing, setSyncing] = useState(false);
  const { reload: reloadRecords } = useRecords();
  const { reload: reloadBaby } = useBaby();
  const { reload: reloadEvents } = useEvents();
  const stateRef = useRef<FamilyState | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((next: FamilyState | null) => {
    stateRef.current = next;
    setState(next);
    setStatus(next ? 'member' : 'none');
  }, []);

  const run = useCallback(async () => {
    const current = stateRef.current;
    if (!current) return;
    setSyncing(true);
    try {
      const { state: next, changed } = await syncOnce(current);
      apply(next);
      if (changed) {
        await Promise.all([reloadRecords(), reloadBaby(), reloadEvents()]);
      }
    } catch (error) {
      // 서버가 가족을 모르면(마지막 사람이 나가 지워짐 등) 폰도 잊는다. 그 밖(연결 없음 등)은 다음에 다시
      if (error instanceof ApiError && error.code === 'NOT_IN_FAMILY') {
        await forgetFamily();
        apply(null);
      }
    } finally {
      setSyncing(false);
    }
  }, [apply, reloadBaby, reloadEvents, reloadRecords]);

  /** 겹치지 않게 — 도는 중에 또 부르면 끝난 뒤 한 번 더 */
  const sync = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    inFlight.current = (async () => {
      do {
        again.current = false;
        await run();
      } while (again.current);
    })().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    loadFamilyState().then((loaded) => {
      if (cancelled) return;
      apply(loaded);
      if (loaded) void sync();
    });
    return () => {
      cancelled = true;
    };
  }, [apply, sync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && stateRef.current) void sync();
    });
    return () => sub.remove();
  }, [sync]);

  useEffect(
    () =>
      onSyncRequest(() => {
        if (!stateRef.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void sync(), DEBOUNCE_MS);
      }),
    [sync],
  );

  const create = useCallback(async () => {
    apply(await startFamily());
    await sync();
  }, [apply, sync]);

  const join = useCallback(
    async (code: string) => {
      apply(await enterFamily(code));
      await sync();
    },
    [apply, sync],
  );

  const leave = useCallback(async () => {
    await quitFamily();
    apply(null);
  }, [apply]);

  const value = useMemo<FamilyContextValue>(
    () => ({ status, state, syncing, create, join, leave, syncNow: sync }),
    [status, state, syncing, create, join, leave, sync],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const value = useContext(FamilyContext);
  if (!value) throw new Error('useFamily 는 FamilyProvider 안에서만 쓸 수 있어요');
  return value;
}
