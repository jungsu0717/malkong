/**
 * 빠른 기록을 화면들이 함께 보는 자리 (SPEC-LOG-01~05, decisions/023).
 *
 * 기록 탭 · 그래프 · 질문 맥락 · 기록 요청이 같은 목록을 본다. 기록이 바뀔 때마다 수유 알림을 다시 걸고(SPEC-LOG-05),
 * 가족 공유가 켜져 있으면 맞추기를 부탁한다(SPEC-LOG-07).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { readSetting, writeSetting } from './db';
import { durationLabel, feedReminderAt } from './event-summary';
import {
  loadEvents,
  makeEvent,
  removeEvent,
  saveEvent,
  sortEvents,
  type CareEvent,
  type EventInput,
} from './events';
import { noteDeleted } from './family';
import { askNotifications, scheduleFeedReminder } from './notifications';
import { usePreferences } from './preferences-context';
import { requestSync } from './sync-events';

/** 수유 알림 허락을 처음 수유를 적을 때 한 번만 묻는다 — 쓸모를 알 때 묻는 게 덜 성가시다 */
const FEED_ASKED_KEY = 'feed_reminder_asked';

type EventsContextValue = {
  /** 시작 순서 */
  events: CareEvent[];
  loading: boolean;
  add: (input: EventInput) => Promise<CareEvent>;
  /** 고치기 · 재는 중 끝내기 */
  update: (id: string, patch: Partial<Omit<CareEvent, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** 가족에게서 받은 기록이 폰에 적용된 뒤 다시 읽는다 */
  reload: () => Promise<void>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { feedReminder, loading: prefsLoading } = usePreferences();
  // 고칠 때 지금 줄을 찾는 자리 — 화면이 그려진 뒤의 목록
  const current = useRef<CareEvent[]>([]);
  useEffect(() => {
    current.current = events;
  }, [events]);

  useEffect(() => {
    let cancelled = false;
    loadEvents()
      .then((stored) => {
        if (!cancelled) setEvents(sortEvents(stored));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 수유 알림 — 기록 · 설정이 바뀔 때마다 마지막 수유 시작 + 정한 시간으로 다시 건다(지난 때면 끈다)
  useEffect(() => {
    if (loading || prefsLoading) return;
    const at = feedReminderAt(events, feedReminder);
    void scheduleFeedReminder(at, durationLabel(feedReminder ?? 0)).catch(() => undefined);
  }, [events, feedReminder, loading, prefsLoading]);

  const add = useCallback<EventsContextValue['add']>(
    async (input) => {
      const event = makeEvent(input);
      await saveEvent(event);
      setEvents((prev) => sortEvents([...prev, event]));
      requestSync();
      if ((event.kind === 'breast' || event.kind === 'formula') && feedReminder && !(await readSetting(FEED_ASKED_KEY))) {
        await writeSetting(FEED_ASKED_KEY, 'yes');
        await askNotifications().catch(() => false);
      }
      return event;
    },
    [feedReminder],
  );

  const update = useCallback<EventsContextValue['update']>(async (id, patch) => {
    const before = current.current.find((e) => e.id === id);
    if (!before) return;
    const next: CareEvent = { ...before, ...patch, updatedAt: new Date().toISOString() };
    await saveEvent(next);
    setEvents((prev) => sortEvents(prev.map((e) => (e.id === id ? next : e))));
    requestSync();
  }, []);

  const remove = useCallback(async (id: string) => {
    await noteDeleted(id);
    await removeEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    requestSync();
  }, []);

  const reload = useCallback(async () => {
    setEvents(sortEvents(await loadEvents()));
  }, []);

  const value = useMemo(
    () => ({ events, loading, add, update, remove, reload }),
    [events, loading, add, update, remove, reload],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsContextValue {
  const value = useContext(EventsContext);
  if (!value) throw new Error('useEvents 는 EventsProvider 안에서만 쓸 수 있어요');
  return value;
}
