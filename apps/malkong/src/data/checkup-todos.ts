/**
 * 접종 · 검진 할 일 (SPEC-TOPIC-07) — 공공 일정(승인된 L1 접종 · 검진 항목)을 월령으로 계산해 할 일처럼 보여 준다.
 * 했는지는 기록(L2)의 covers 로 센다 — 「완료」는 use-mark-done 이 기록을 남긴다. 처치 · 증상 판단은 덧붙이지 않는다(헌장 5).
 */

import { monthStart } from './briefing';
import { allItems } from './l1';
import type { BabyRecord } from './records';
import { coveredIds, groupsToMark } from './schedule';
import type { GapGroup } from './timeline';

const isCheckup = (kind: string) => kind === '접종' || kind === '검진';

/** 안 한 접종 · 검진 묶음 — 지금(open) · 지난(missed) · 다가오는(soon) */
export function checkupGroups(records: BabyRecord[], month: number): GapGroup[] {
  const items = allItems().filter((i) => isCheckup(i.kind));
  return groupsToMark(items, coveredIds(records), month).sort((a, b) => a.month - b.month);
}

/** 주제 목록의 한 줄 — 「다음: 4개월 접종 · 10월 20일 무렵」 */
export function nextCheckupLine(groups: GapGroup[], birthDate: string, month: number): string {
  const open = groups.filter((g) => g.status === 'open');
  if (open.length > 0) return `이번 달 ${open.length}개`;
  const next = groups.find((g) => g.status === 'soon' && g.month > month);
  if (!next) return '다가오는 일정이 없어요';
  const d = monthStart(birthDate, next.month);
  return `다음: ${next.label} · ${d.getMonth() + 1}월 ${d.getDate()}일 무렵`;
}
