/**
 * 대화 타임라인을 화면들이 함께 보는 자리 — 물어보기가 쓰고, 홈의 최근 질문(SPEC-HOME-04)이 읽는다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loadMessages, saveMessage, type ChatMessage } from './chat';

type ChatContextValue = {
  messages: ChatMessage[];
  /** 기기에서 읽어오는 중 */
  loading: boolean;
  append: (message: ChatMessage) => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadMessages()
      .then((stored) => {
        if (!cancelled) setMessages(stored);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const append = useCallback(async (message: ChatMessage) => {
    // 화면에 먼저 붙인다 — 저장이 늦어도 말풍선이 기다리지 않게
    setMessages((prev) => [...prev, message]);
    await saveMessage(message);
  }, []);

  const value = useMemo(() => ({ messages, loading, append }), [messages, loading, append]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat 은 ChatProvider 안에서만 쓸 수 있어요');
  return value;
}
