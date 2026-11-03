/**
 * 아기 일정 줄과 시트 (SPEC-MAIN-11 · SPEC-TOPIC-02 · 07 · 11) — 앱이 채우는 일(접종 · 검진, 기념일 · 사이즈)을 날짜순 줄로 만들고,
 * 동그라미 · 이름을 누를 때의 흐름과 그때 여는 시트를 둔다. 줄 모양은 1년 보기(year-view)와 하루 흐름(day-view)이 그린다(decisions/037).
 *
 * 접종 · 검진의 동그라미는 무엇을 했는지 고르는 시트를, 이름은 병원 예약일 시트(appt-sheet)를 연다 — 예약을 적으면 그 날짜로 D-day 를 센다.
 * 앞날 일정도 이름을 누르면 편집 시트가 열린다 — 저장하면 그때 할 일로 만들고, 삭제하면 그 일정을 다시 만들지 않는다(task topic/010).
 * 셈은 `src/data/baby-rows.ts` 에 있고 폰 홈 화면 위젯도 같은 줄을 쓴다(SPEC-MAIN-09).
 */

import { useState } from 'react';

import { ApptSheet } from '@/components/todo/appt-sheet';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import { apptRef } from '@/data/appointment';
import { babyRows, dayStartOf, type BabyRowData } from '@/data/baby-rows';
import { useRecords } from '@/data/records-context';
import { makeTodo, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useMarkDone } from '@/hooks/use-mark-done';

export type { BabyRowData };
/**
 * 아기 일정 줄 — 날짜순 줄(`at` 은 그날 0시, 지금 기간인 접종 · 검진은 어제)과 놓친 접종 · 검진,
 * 동그라미 · 이름을 누를 때의 흐름, 그때 여는 시트(`sheets` 를 화면에 한 번 둔다).
 */
export function useBabyRows(now: Date) {
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, toggleDone, add, update, remove, autoRemoved, skipAuto } = useTodos();
  // 완료를 알린 묶음에 병원 예약이 있으면 그 예약도 완료로 — 지난 예약 알림이 남지 않게
  const markDone = useMarkDone((g) => {
    const ref = apptRef(g.month, g.items[0]?.kind ?? '');
    const appt = todos.find((t) => t.ref === ref && !t.doneAt);
    if (appt) void toggleDone(appt.id);
  });
  const [editing, setEditing] = useState<Todo | null>(null);
  /** 병원 예약일을 적는 접종 · 검진 줄 */
  const [booking, setBooking] = useState<BabyRowData | null>(null);
  /** 편집 중인 것이 아직 만들지 않은 앞날 일정인가 — 저장하면 새로 만들고, 삭제하면 규칙을 건너뛴다 */
  const [draft, setDraft] = useState(false);

  const today = dayStartOf(now);
  const { rows, missed } = babyRows({ baby, age, records, topics, todos, autoRemoved }, now);

  const check = (r: BabyRowData) => {
    if (r.group) markDone.pick(r.group);
    else if (r.todo) {
      tap('success');
      void toggleDone(r.todo.id);
    }
  };
  const open = (r: BabyRowData) => {
    if (r.group) setBooking(r);
    else if (r.todo) {
      setDraft(false);
      setEditing(r.todo);
    } else if (r.auto) {
      const kind = r.auto.kind;
      const topic = topics.find((t) => t.kind === kind && !t.hidden);
      if (!topic) return;
      setDraft(true);
      setEditing(makeTodo({ topicId: topic.id, title: r.title, dueAt: new Date(r.at).toISOString(), source: 'auto', ref: r.auto.ref }));
    }
  };

  const saveAppt = (r: BabyRowData, due: { at: Date; hasTime: boolean }) => {
    const g = r.group;
    if (!g) return;
    const patch = { dueAt: due.at.toISOString(), hasTime: due.hasTime };
    if (r.appt) void update(r.appt.id, patch);
    else {
      const topic = topics.find((t) => t.kind === 'checkup') ?? topics.find((t) => t.kind === 'general');
      if (topic) void add({ ...patch, title: `${r.title} 예약`, topicId: topic.id, ref: apptRef(g.month, g.items[0]?.kind ?? '') });
    }
  };

  const sheets = (
    <>
      {markDone.sheet}
      <ApptSheet
        key={booking?.key ?? 'none'}
        target={
          booking
            ? {
                title: booking.title,
                tag: booking.tag,
                when: booking.when ?? '',
                current: booking.appt?.dueAt ? { at: new Date(booking.appt.dueAt), hasTime: booking.appt.hasTime } : null,
              }
            : null
        }
        onClose={() => setBooking(null)}
        onSave={(due) => {
          if (booking) saveAppt(booking, due);
          setBooking(null);
        }}
        onClear={() => {
          if (booking?.appt) void remove(booking.appt.id);
          setBooking(null);
        }}
      />
      <TodoSheet
        key={editing?.id ?? 'none'}
        todo={editing}
        topics={topics.filter((t) => !t.hidden)}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing && draft) void add({ ...patch, source: 'auto', ref: editing.ref });
          else if (editing) void update(editing.id, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing && draft && editing.ref) void skipAuto(editing.ref);
          else if (editing) void remove(editing.id);
          setEditing(null);
        }}
      />
    </>
  );

  return { rows, missed, today, check, open, sheets };
}
