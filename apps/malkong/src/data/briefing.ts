/**
 * 접종 · 검진 줄의 모양과 날짜(SPEC-TOPIC-01 · 02) — 할 일 탭 · 주제 화면 · 완료 확인 시트가 같은 줄을 그린다.
 * 예전 데일리 브리핑(AI 상담 시절)은 2026-10-19 에 뺐다(decisions/030). 이름은 그대로 둔다.
 */

import type { BabyRecord } from './records';
import { isLifeGroup, type GapGroup, type GapStatus } from './timeline';

/** 아침 알림 시각 고르기 — 온보딩과 마이가 같은 넷을 쓴다 */
export const BRIEFING_TIMES = ['07:00', '08:00', '09:00', '10:00'];
export const timeLabel = (t: string) => `오전 ${Number(t.split(':')[0])}시`;

/** 접종 · 검진 한 묶음의 줄 */
export type BriefingTodo = {
  kind: 'todo';
  key: string;
  status: GapStatus;
  /** 묶인 항목들이 시작하는 월 */
  month: number;
  label: string;
  /** 완료하면 기록의 covers 에 들어갈 L1 id */
  itemIds: string[];
  /** 생활 항목 — 「완료」 대신 「확인」 */
  life: boolean;
  /** 아이콘을 고를 분류 */
  category: string;
};

/** 받침이 있으면 true — 「콩이를」 / 「하은을」 같은 조사 고르기 */
export function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

/** 묶인 항목을 모두 기록으로 닫았으면 한 것 */
export function todoDone(todo: BriefingTodo, records: BabyRecord[]): boolean {
  const covered = new Set(records.flatMap((r) => r.covers));
  return todo.itemIds.every((id) => covered.has(id));
}

/** 그 월령이 시작하는 날 — 「4개월 · 10월 28일 무렵」 */
export function monthStart(birthDate: string, month: number): Date {
  const [y, m, d] = birthDate.split('-').map(Number);
  return new Date(y, m - 1 + month, d);
}

/** 한 줄의 시점 안내. 지난 것은 놓침으로 단정하지 않고 묻는다(SPEC-HOME-02) */
export function whenText(todo: BriefingTodo, birthDate: string, currentMonth: number, now = new Date()): {
  text: string;
  dday: number | null;
} {
  // 줄의 작은 글씨는 시점만 짧게 — 「기록이 없어요 — 했다면 알려 주세요」 같은 설명은 섹션 머리에 한 번만(task home/010)
  if (todo.life) {
    return { text: todo.status === 'soon' ? `${todo.month}개월부터` : '이번 달', dday: null };
  }
  if (todo.status === 'missed') {
    return { text: `${todo.month}개월 무렵`, dday: null };
  }
  const start = monthStart(birthDate, todo.month);
  const date = `${start.getMonth() + 1}월 ${start.getDate()}일 무렵`;
  if (todo.status === 'soon') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dday = Math.max(0, Math.round((start.getTime() - today.getTime()) / 86_400_000));
    return { text: `${todo.month}개월 · ${date}`, dday };
  }
  return { text: todo.month === currentMonth ? `이번 달 · ${date}부터` : `${todo.month}개월부터`, dday: null };
}

/** 「챙길 것」 묶음을 줄 모양으로 */
export function todoOf(group: GapGroup): BriefingTodo {
  return {
    kind: 'todo',
    key: group.key,
    status: group.status,
    month: group.month,
    label: group.label,
    itemIds: group.items.map((i) => i.id),
    life: isLifeGroup(group),
    category: group.items[0]?.kind ?? '',
  };
}
