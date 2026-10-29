/**
 * 접종 · 검진 병원 예약일 (SPEC-TOPIC-02, task topic/010) — 예약은 「접종 · 검진」 주제의 할 일 하나(ref `appt:<개월>-<종류>`)로 둔다.
 * 그래서 가족 공유와 시각 알림 · 아침 알림 · 전날 저녁 알림을 보통 할 일과 같이 받는다.
 * 묶음 열쇠(GapGroup.key)는 다가옴 → 지금 → 지남에 따라 바뀌므로 예약 열쇠는 개월과 종류로만 만든다.
 * 순수 함수만(`node --test src/data/appointment.test.ts`).
 */

import { dueLabel } from './due-parse.ts';
import type { Todo } from './todos.ts';
import { ddayText } from './upcoming.ts';

/** 「appt:2-접종」 — 그 개월에 시작하는 접종(또는 검진) 묶음의 예약 */
export const apptRef = (month: number, kind: string) => `appt:${month}-${kind}`;
export const isApptRef = (ref: string | null | undefined): boolean => !!ref && ref.startsWith('appt:');

/** 그 묶음의 안 끝낸 예약 — 없으면 null */
export function apptFor(todos: Todo[], month: number, kind: string): Todo | null {
  const ref = apptRef(month, kind);
  return todos.find((t) => t.ref === ref && !t.doneAt && t.dueAt) ?? null;
}

/** 예약이 있는 줄 — 날짜는 예약한 날 0시, 설명은 「예약 11월 3일 (화) 10:00」, 오른쪽은 예약 날로 센 D-day(지났으면 「지남」) */
export function apptLine(appt: Todo, today: number, now: Date): { at: number; meta: string; right: string } {
  const due = new Date(appt.dueAt as string);
  const at = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return { at, meta: `예약 ${dueLabel(due, appt.hasTime, now)}`, right: ddayText(at, today) ?? '지남' };
}
