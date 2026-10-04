/**
 * 그날 처음 열면 아침 브리핑을 대화의 첫 메시지로 둔다 (SPEC-HOME-06, task home/004).
 *
 * 하루 하나 — 이미 오늘 것이 있으면 만들지 않는다. 앱을 켜 둔 채 날이 바뀌어도 다시 앞으로 오면 만든다.
 * 기록과 설정을 다 읽은 뒤에 만든다 — 덜 읽은 채 만들면 이미 한 일이 다시 올라온다.
 * 만들면 알림함에도 한 줄(SPEC-HOME-07). 알림함이 생기기 전의 지난 브리핑은 읽은 줄로 옮겨 둔다.
 * 주간(그 주 월요일) · 월간(지금 월령) 브리핑도 여기서 — 아직 없으면 가장 최근 것 하나만 알림함에 넣는다(SPEC-HOME-08).
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useBaby } from '@/data/baby-context';
import { ageFrom } from '@/data/baby';
import { briefingSummary, buildBriefing, monthStart } from '@/data/briefing';
import { dayKey, newMessageId } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useInbox } from '@/data/inbox-context';
import {
  mondayOf,
  monthlyBriefing,
  monthlyId,
  monthlySummary,
  weeklyBriefing,
  weeklyId,
  weeklySummary,
} from '@/data/period-briefing';
import { usePreferences } from '@/data/preferences-context';
import { useRecords } from '@/data/records-context';

export function useDailyBriefing() {
  const { baby } = useBaby();
  const { messages, loading, append } = useChat();
  const { records, loading: recordsLoading } = useRecords();
  const { scheduleOnly, loading: prefsLoading } = usePreferences();
  const { cards, loading: inboxLoading, add: addToInbox } = useInbox();
  const [today, setToday] = useState(() => dayKey(new Date().toISOString()));
  const made = useRef<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(dayKey(new Date().toISOString()));
    });
    return () => sub.remove();
  }, []);

  // 알림함이 생기기 전의 지난 브리핑 — 읽은 줄로 옮긴다(배지가 갑자기 쌓이지 않게)
  const backfilled = useRef(false);
  useEffect(() => {
    if (loading || inboxLoading || backfilled.current) return;
    backfilled.current = true;
    const known = new Set(cards.map((c) => c.id));
    for (const m of messages) {
      if (m.role !== 'malkong' || m.meta.type !== 'briefing' || m.meta.day === today) continue;
      if (known.has(`daily-${m.meta.day}`)) continue;
      void addToInbox({
        id: `daily-${m.meta.day}`,
        kind: 'daily',
        title: '그날의 브리핑',
        summary: briefingSummary(m.meta),
        day: m.meta.day,
        readAt: m.createdAt,
        createdAt: m.createdAt,
      });
    }
  }, [loading, inboxLoading, cards, messages, today, addToInbox]);

  useEffect(() => {
    if (loading || recordsLoading || prefsLoading || !baby) return;
    if (made.current === today) return;
    const exists = messages.some(
      (m) => m.role === 'malkong' && m.meta.type === 'briefing' && m.meta.day === today,
    );
    made.current = today;
    if (exists) return;
    const briefing = buildBriefing(baby, records, messages, { scheduleOnly, day: today });
    const createdAt = new Date().toISOString();
    void append({
      id: newMessageId(),
      role: 'malkong',
      content: `${briefing.greeting}. ${briefing.headline}`,
      meta: { type: 'briefing', ...briefing },
      createdAt,
    });
    void addToInbox({
      id: `daily-${today}`,
      kind: 'daily',
      title: '오늘의 브리핑이 도착했어요',
      summary: briefingSummary(briefing),
      day: today,
      readAt: null,
      createdAt,
    });
  }, [today, loading, recordsLoading, prefsLoading, baby, messages, records, scheduleOnly, append, addToInbox]);

  // 주간 · 월간 — 그 주 · 그 달 것이 알림함에 없으면 하나
  useEffect(() => {
    if (inboxLoading || recordsLoading || prefsLoading || !baby) return;
    const now = new Date();
    const { month } = ageFrom(baby.birthDate, now);
    const monday = mondayOf(now);
    if (!cards.some((c) => c.id === weeklyId(monday))) {
      const week = weeklyBriefing(monday, baby.birthDate, records, month);
      void addToInbox({
        id: weeklyId(monday),
        kind: 'weekly',
        title: '이번 주 일정이 도착했어요',
        summary: weeklySummary(week, records),
        day: dayKey(monday.toISOString()),
        readAt: null,
        createdAt: now.toISOString(),
      });
    }
    if (!cards.some((c) => c.id === monthlyId(month))) {
      const m = monthlyBriefing(month, baby.birthDate, records, { scheduleOnly });
      void addToInbox({
        id: monthlyId(month),
        kind: 'monthly',
        title: month === 0 ? '첫 달 일정이 도착했어요' : `${month}개월 일정이 도착했어요`,
        summary: monthlySummary(m),
        day: dayKey(monthStart(baby.birthDate, month).toISOString()),
        readAt: null,
        createdAt: now.toISOString(),
      });
    }
  }, [today, inboxLoading, recordsLoading, prefsLoading, baby, cards, records, scheduleOnly, addToInbox]);

  return today;
}
