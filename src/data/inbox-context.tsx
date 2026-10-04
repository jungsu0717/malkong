/**
 * 알림함을 화면들이 함께 보는 자리 (SPEC-HOME-07) — 브리핑을 만드는 쪽이 줄을 넣고, 버디 탭 배지 · 알림함 · 일정 탭이 읽는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { insertInboxRow, markInboxReadRows, readInboxRows } from './db';
import type { InboxCard } from './inbox';

type InboxContextValue = {
  /** 새것부터 */
  cards: InboxCard[];
  loading: boolean;
  unread: number;
  /** 같은 id 가 있으면 그대로 둔다 */
  add: (card: InboxCard) => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  /** 그날을 가리키는 브리핑 줄을 모두 읽음으로 — 일정 탭에서 그날을 보거나 「확인하러 가기」 */
  markDayRead: (day: string) => Promise<void>;
};

const InboxContext = createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<InboxCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readInboxRows()
      .then((stored) => {
        if (!cancelled) setCards(stored);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(async (card: InboxCard) => {
    setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
    await insertInboxRow(card);
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const at = new Date().toISOString();
    const wanted = new Set(ids);
    setCards((prev) => prev.map((c) => (wanted.has(c.id) && !c.readAt ? { ...c, readAt: at } : c)));
    await markInboxReadRows(ids, at);
  }, []);

  const value = useMemo(() => {
    const sorted = [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      cards: sorted,
      loading,
      unread: cards.filter((c) => !c.readAt).length,
      add,
      markRead,
      markDayRead: (day: string) =>
        markRead(cards.filter((c) => c.day === day && c.kind !== 'nudge' && !c.readAt).map((c) => c.id)),
    };
  }, [cards, loading, add, markRead]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): InboxContextValue {
  const value = useContext(InboxContext);
  if (!value) throw new Error('useInbox 는 InboxProvider 안에서만 쓸 수 있어요');
  return value;
}
