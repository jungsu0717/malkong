/**
 * 아기 일정 줄의 셈 (SPEC-TOPIC-02 · 07 · 11, SPEC-MAIN-08 · 09) — 접종 · 검진(공공 일정)과 기념일 · 사이즈(생일로 계산)를 날짜순 한 줄씩.
 *
 * 할 일 탭 아기 일정 칸 · 홈 「다가오는 일」 · 폰 홈 화면 위젯이 같은 줄을 쓴다. 화면이 아닌 곳(위젯 타임라인)에서도 쓰려고 화면 코드와 떼어 두었다.
 * `at` 은 그날 0시이고, 지금 기간인 접종 · 검진은 어제로 두어 맨 앞에 온다.
 */

import { birthOf, upcomingAuto } from './auto-todos';
import type { Baby, BabyAge } from './baby';
import { monthStart, todoOf, whenText } from './briefing';
import { checkupGroups } from './checkup-todos';
import { dueLabel } from './due-parse';
import type { BabyRecord } from './records';
import type { GapGroup } from './timeline';
import type { Todo, Topic, TopicKind } from './todos';
import { ddayText } from './upcoming';

const TAGS: Partial<Record<TopicKind, string>> = { milestone: '기념일', size: '사이즈' };

export type BabyRowData = {
  key: string;
  at: number;
  title: string;
  tag: string;
  meta: string;
  /** 「D-3」 「지금」 */
  right: string | null;
  /** 아직 목록에 없는 앞날 일정 — 체크할 수 없다 */
  future: boolean;
  group?: GapGroup;
  todo?: Todo;
};

export type BabyRowsInput = {
  baby: Baby | null;
  age: BabyAge | null;
  records: BabyRecord[];
  topics: Topic[];
  todos: Todo[];
  /** 사용자가 지운 앱 할 일의 ref — 다시 만들지 않는다 */
  autoRemoved: string[];
};

/** 그날 0시 */
export function dayStartOf(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** 아기 일정 줄(날짜순)과 놓친 접종 · 검진 묶음 */
export function babyRows({ baby, age, records, topics, todos, autoRemoved }: BabyRowsInput, now: Date): { rows: BabyRowData[]; missed: GapGroup[] } {
  const today = dayStartOf(now);
  const groups = age ? checkupGroups(records, age.month) : [];
  const kindOf = new Map(topics.map((t) => [t.id, t.kind]));
  const autoTodos = todos.filter((t) => (kindOf.get(t.topicId) === 'milestone' || kindOf.get(t.topicId) === 'size') && !t.doneAt);
  const have = new Set([...todos.map((t) => t.ref).filter((r): r is string => !!r), ...autoRemoved]);

  const rows: BabyRowData[] =
    !baby || !age
      ? []
      : [
          ...groups
            .filter((g) => g.status === 'open' || g.status === 'soon')
            .map((g) => {
              const w = whenText(todoOf(g), baby.birthDate, age.month, now);
              const at = monthStart(baby.birthDate, g.month).getTime();
              return {
                key: g.key,
                at: Math.max(at, g.status === 'open' ? today - 1 : at),
                title: g.label,
                tag: todoOf(g).category,
                // 지금 기간인 것은 「이번 달」 — 「0개월부터」처럼 읽히지 않게
                meta: g.status === 'open' && g.month < age.month ? '이번 달' : w.text,
                right: g.status === 'open' ? '지금' : ddayText(at, today),
                future: false,
                group: g,
              };
            }),
          ...autoTodos.map((t) => {
            const at = t.dueAt ? new Date(t.dueAt).getTime() : today;
            return {
              key: t.id,
              at,
              title: t.title,
              tag: TAGS[kindOf.get(t.topicId) as TopicKind] ?? '',
              meta: t.dueAt ? dueLabel(new Date(t.dueAt), t.hasTime, now) : '',
              right: t.dueAt ? (ddayText(at, today) ?? '지남') : null,
              future: false,
              todo: t,
            };
          }),
          ...(['milestone', 'size'] as const).flatMap((k) =>
            upcomingAuto(k, birthOf(baby.birthDate), now, have).map((u) => ({
              key: u.rule.ref,
              at: u.due.getTime(),
              title: u.rule.title,
              tag: TAGS[k] ?? '',
              meta: dueLabel(u.due, false, now),
              right: ddayText(u.due.getTime(), today),
              future: true,
            })),
          ),
        ].sort((a, b) => a.at - b.at);
  const missed = groups.filter((g) => g.status === 'missed');
  return { rows, missed };
}
