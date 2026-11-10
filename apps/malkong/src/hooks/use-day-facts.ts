/**
 * 메모 쓰기 창 위의 그날 기록 칩 (SPEC-STAGE-03, decisions/042) — 기록 · 루틴 완료 · 할 일 완료 · 발달 체크를 모아 `dayFacts` 로 센다.
 * 달력의 「메모 쓰기」, 성장 일기, 기록 상세, 물어보기의 「오늘 일기 써 줘」가 같이 쓴다. `day` 가 null 이면(창을 닫았을 때) 세지 않는다.
 */

import { useMemo } from 'react';

import { dayFacts, factSummary, routineDones, todoDones, type Fact } from '@/data/day-facts';
import { startOfDay } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { useMemos } from '@/data/memos-context';
import { useRoutines } from '@/data/routines-context';
import { useTodos } from '@/data/todos-context';

export type DayFacts = { facts: Fact[]; summary: string | null; label: string };

const NONE: DayFacts = { facts: [], summary: null, label: '오늘 기록' };

export function useDayFacts(day: Date | null): DayFacts {
  const { events } = useEvents();
  const { routines, logs } = useRoutines();
  const { todos, topics } = useTodos();
  const { memos } = useMemos();
  const dayKey = day ? startOfDay(day).getTime() : null;
  return useMemo(() => {
    if (dayKey === null) return NONE;
    const now = new Date();
    const d = new Date(dayKey);
    const general = topics.find((t) => t.kind === 'general')?.id ?? null;
    return {
      facts: dayFacts(events, routineDones(routines, logs, d), todoDones(todos, general), memos, d, now),
      summary: factSummary(events, d, now),
      label: dayKey === startOfDay(now).getTime() ? '오늘 기록' : '이날 기록',
    };
  }, [dayKey, events, routines, logs, todos, topics, memos]);
}
