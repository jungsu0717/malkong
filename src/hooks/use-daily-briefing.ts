/**
 * 그날 처음 열면 아침 브리핑을 대화의 첫 메시지로 둔다 (SPEC-HOME-06, task home/004).
 *
 * 하루 하나 — 이미 오늘 것이 있으면 만들지 않는다. 앱을 켜 둔 채 날이 바뀌어도 다시 앞으로 오면 만든다.
 * 기록과 설정을 다 읽은 뒤에 만든다 — 덜 읽은 채 만들면 이미 한 일이 다시 올라온다.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useBaby } from '@/data/baby-context';
import { buildBriefing } from '@/data/briefing';
import { dayKey, newMessageId } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { usePreferences } from '@/data/preferences-context';
import { useRecords } from '@/data/records-context';

export function useDailyBriefing() {
  const { baby } = useBaby();
  const { messages, loading, append } = useChat();
  const { records, loading: recordsLoading } = useRecords();
  const { scheduleOnly, loading: prefsLoading } = usePreferences();
  const [today, setToday] = useState(() => dayKey(new Date().toISOString()));
  const made = useRef<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(dayKey(new Date().toISOString()));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loading || recordsLoading || prefsLoading || !baby) return;
    if (made.current === today) return;
    const exists = messages.some(
      (m) => m.role === 'malkong' && m.meta.type === 'briefing' && m.meta.day === today,
    );
    made.current = today;
    if (exists) return;
    const briefing = buildBriefing(baby, records, { scheduleOnly, day: today });
    void append({
      id: newMessageId(),
      role: 'malkong',
      content: `${briefing.greeting}. ${briefing.headline}`,
      meta: { type: 'briefing', ...briefing },
      createdAt: new Date().toISOString(),
    });
  }, [today, loading, recordsLoading, prefsLoading, baby, messages, records, scheduleOnly, append]);

  return today;
}
