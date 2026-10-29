/**
 * 첫 실행의 「앞으로 1년, 챙길 일 23개를 채웠어요」 (SPEC-MY-10, task my/011) — 오늘부터 1년 안의 접종 · 검진 묶음과 기념일 · 사이즈 확인.
 *
 * 접종 · 검진 묶음은 공공 일정을 읽어야 해서 부르는 쪽(온보딩)이 `checkupGroups` 로 만들어 넘기고, 여기서는 기념일 · 사이즈 규칙과 합쳐 날짜순으로 센다.
 * 순수 함수만 둔다(`node --test src/data/first-year.test.ts`).
 */

import { AUTO_RULES, birthOf } from './auto-todos.ts';

const DAY = 86_400_000;
/** 화면에 보이는 줄 수 — 그다음은 「외 N개」 */
export const FIRST_YEAR_ROWS = 7;
/** 이보다 적으면 화면을 건너뛴다 */
export const FIRST_YEAR_MIN = 3;

export type FirstYearItem = {
  key: string;
  title: string;
  /** 그날 0시. 지금 기간인 접종 · 검진은 오늘 */
  at: number;
  /** 접종 · 검진 · 기념일 · 사이즈 */
  tag: string;
  /** 지금 기간인 접종 · 검진 — 날짜 대신 「이번 달」 */
  open: boolean;
};

export type FirstYearCheckup = { key: string; title: string; at: number; tag: string; open: boolean };

export function firstYearPlan(birthDate: string, checkups: FirstYearCheckup[], now = new Date()): { total: number; items: FirstYearItem[] } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = today + 365 * DAY;
  const birth = birthOf(birthDate);
  const items: FirstYearItem[] = [
    ...checkups.filter((c) => c.at <= end).map((c) => ({ ...c, at: Math.max(c.at, today) })),
    ...AUTO_RULES.map((rule) => ({ rule, at: rule.due(birth).getTime() }))
      .filter((x) => x.at > today && x.at <= end)
      .map(({ rule, at }) => ({ key: rule.ref, title: rule.title, at, tag: rule.kind === 'milestone' ? '기념일' : '사이즈', open: false })),
  ].sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
  return { total: items.length, items };
}

/** 「11월 12일」 */
export function dayLabel(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
