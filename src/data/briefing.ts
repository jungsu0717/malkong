/**
 * 데일리 브리핑 (SPEC-HOME-06, task home/004 · 008, decisions/018) — 하루 처음 앱을 열면 버디가 먼저 건네는 말.
 *
 * 그날 하루의 것이다 — ① 아기 안부(어제 일에 이어) ② 부모 안부 ③ 오늘 챙기면 좋을 것(월령 생활 팁) ④ 기록하면 좋을 것
 * ⑤ 이번 주 일정. 안부는 `care-signals.ts` 가 어제 · 오늘 대화와 기록에서 찾는다. 일이 없으면 ①④는 비운다.
 *
 * 기기 안에서 규칙과 문구 틀로 만든다(backend 「능동 브리핑」 1단계 온디바이스) — 모델을 부르지 않으니 할당량을 쓰지 않고,
 * 아기 기록이 기기 밖으로 나가지 않는다. 대화 타임라인에 그날의 첫 메시지로 저장되고, 지난 것은 일정 탭 달력의 그날에서 다시 본다.
 * 했는지는 볼 때마다 기록(L2)에서 다시 센다 — 어디서 완료해도 같은 결과가 보인다(SPEC-HOME-06).
 * 2026-10-04 전의 브리핑은 챙길 것 목록(items)을 들고 있다 — 그대로 그린다.
 */

import { ageFrom, DEFAULT_BABY_NAME, type Baby } from './baby';
import {
  activeSignals,
  babyCheck,
  parentCheck,
  SIGNAL_NAMES,
  type CareCheck,
  type ParentCheck,
  type SuggestKey,
} from './care-signals';
import type { ChatMessage } from './chat';
import { allItems, itemById } from './l1';
import type { BabyRecord } from './records';
import { isLifeGroup, type GapGroup, type GapStatus, type L1Item } from './timeline';

/** 오늘 챙기면 좋을 것 — 하루 두 가지까지 */
const MAX_TIPS = 2;
/** 생활 팁을 고르는 분류 — 상시 지식(SPEC-HOME-02 생활 항목과 같은 넷) */
const TIP_KINDS: L1Item['kind'][] = ['수유', '수면', '생활', '안전'];
/** 같은 팁이 며칠 잇달아 나오지 않게 — 최근 브리핑 몇 개의 팁은 다른 것이 있으면 피한다 */
const RECENT_BRIEFINGS = 3;

/** 아침 브리핑 알림 시각 고르기 — 온보딩과 마이가 같은 넷을 쓴다 */
export const BRIEFING_TIMES = ['07:00', '08:00', '09:00', '10:00'];
export const timeLabel = (t: string) => `오전 ${Number(t.split(':')[0])}시`;

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

/** 2026-10-04 전 브리핑의 「몸무게를 알려 주세요」 줄 — 정보 입력은 브리핑 밖으로 나가 그리지 않는다 */
type LegacyCheck = { kind: 'check'; key: string };

export type BriefingItem = BriefingTodo | LegacyCheck;

export type Briefing = {
  /** 그날의 dayKey — 하루 하나 */
  day: string;
  greeting: string;
  headline: string;
  /** 2026-10-04 전 브리핑의 챙길 것 목록. 새 브리핑은 비어 있다 — 일정은 주간 · 월간 브리핑과 일정 탭의 몫 */
  items: BriefingItem[];
  /** ① 아기 안부 — 어제 일이 없으면 null */
  care?: CareCheck | null;
  /** ② 부모 안부 */
  parent?: ParentCheck | null;
  /** ③ 오늘 챙기면 좋을 것 — L1 id */
  tips?: string[];
  /** ④ 기록하면 좋을 것 */
  suggest?: SuggestKey | null;
  /** ⑤ 다가오는 일정 — 오늘부터 7일 안에 무렵인 접종 · 검진, L1 id */
  week?: string[];
};

/** 받침이 있으면 true — "콩이는" / "하준이는" / "하은은" 같은 조사 고르기 */
function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

export function topic(name: string): string {
  return `${name}${hasBatchim(name) ? '은' : '는'}`;
}

function greetingAt(hour: number): string {
  if (hour >= 5 && hour < 11) return '좋은 아침이에요';
  if (hour >= 11 && hour < 17) return '좋은 오후예요';
  if (hour >= 17 && hour < 22) return '좋은 저녁이에요';
  return '편안한 밤 보내고 계세요';
}

/** 그날의 한 줄 — 100일 · 첫돌 같은 날은 따로 챙긴다. 100일은 태어난 날을 1일로 센다 */
function headlineFor(name: string, birthDate: string, now: Date): string {
  const { days } = ageFrom(birthDate, now);
  const birth = new Date(birthDate);
  const dayCount = days + 1;
  if (dayCount === 100) return `오늘은 ${name}의 100일이에요. 축하해요!`;
  if (dayCount > 90 && dayCount < 100) return `${topic(name)} 태어난 지 ${days}일, 100일까지 ${100 - dayCount}일 남았어요`;
  if (
    days > 0 &&
    now.getMonth() === birth.getMonth() &&
    now.getDate() === birth.getDate()
  ) {
    const years = now.getFullYear() - birth.getFullYear();
    return years === 1 ? `오늘은 ${name}의 첫돌이에요. 축하해요!` : `오늘은 ${name}의 ${years}번째 생일이에요`;
  }
  return `${topic(name)} 오늘 태어난 지 ${days}일이에요`;
}

/** 오늘 챙기면 좋을 것 — 그 월령의 생활 팁 가운데 아직 확인하지 않은 것을 날마다 돌려 고른다 */
function todayTips(month: number, records: BabyRecord[], recent: Set<string>, days: number): string[] {
  const covered = new Set(records.flatMap((r) => r.covers));
  const pool = allItems().filter((i) => TIP_KINDS.includes(i.kind) && i.months.includes(month) && !covered.has(i.id));
  const fresh = pool.filter((i) => !recent.has(i.id));
  const list = fresh.length >= MAX_TIPS ? fresh : pool;
  if (list.length === 0) return [];
  return Array.from({ length: Math.min(MAX_TIPS, list.length) }, (_, k) => list[(days + k) % list.length].id);
}

/** 오늘부터 7일 안에 무렵인 접종 · 검진 가운데 아직 안 한 것 — 주 단위 정리는 주간 브리핑의 몫 */
function weekItems(birthDate: string, records: BabyRecord[], now: Date): string[] {
  const covered = new Set(records.flatMap((r) => r.covers));
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return allItems()
    .filter((i) => (i.kind === '접종' || i.kind === '검진') && !covered.has(i.id))
    .filter((i) => {
      const due = monthStart(birthDate, i.months[0]);
      return due >= start && due < end;
    })
    .map((i) => i.id);
}

export function buildBriefing(
  baby: Baby,
  records: BabyRecord[],
  messages: ChatMessage[],
  { scheduleOnly = false, now = new Date(), day }: { scheduleOnly?: boolean; now?: Date; day: string },
): Briefing {
  const name = baby.name ?? DEFAULT_BABY_NAME;
  const { month, days } = ageFrom(baby.birthDate, now);
  const { keys, vaccine } = activeSignals(messages, records, now);
  const { care, suggest } = babyCheck(keys, { name, month, vaccine });
  const parent = parentCheck(keys, { name, days, hasBabyCheck: care !== null });
  const recent = new Set(
    messages
      .flatMap((m) => (m.role === 'malkong' && m.meta.type === 'briefing' ? [m.meta] : []))
      .slice(-RECENT_BRIEFINGS)
      .flatMap((b) => b.tips ?? []),
  );
  // 「접종·검진만 보기」를 고른 사람에게는 생활 팁도 올리지 않는다(SPEC-HOME-02 생활 항목)
  const tips = scheduleOnly ? [] : todayTips(month, records, recent, days);

  return {
    day,
    greeting: greetingAt(now.getHours()),
    headline: headlineFor(name, baby.birthDate, now),
    items: [],
    care,
    parent,
    tips,
    suggest,
    week: weekItems(baby.birthDate, records, now),
  };
}

/** 알림함 줄에 보일 한 줄(SPEC-HOME-07) — 「열 안부 · 터미타임 · 이번 주 일정 2」 */
export function briefingSummary(briefing: Briefing): string {
  const todos = todosOf(briefing.items);
  if (todos.length > 0) {
    return todos.length === 1 ? `챙길 것 · ${todos[0].label}` : `챙길 것 ${todos.length}개 · ${todos[0].label} 외`;
  }
  const parts = [
    briefing.care ? `${SIGNAL_NAMES[briefing.care.signal]} 안부` : null,
    briefing.parent ? '부모님 안부' : null,
    ...(briefing.tips ?? []).slice(0, 1).map((id) => tipTitle(id)),
    briefing.week && briefing.week.length > 0 ? `다가오는 일정 ${briefing.week.length}` : null,
  ].filter((t): t is string => !!t);
  return parts.length > 0 ? parts.join(' · ') : briefing.headline;
}

/** 팁의 짧은 이름 — 「깨어 있을 때 터미타임」 */
export function tipTitle(id: string): string {
  const title = itemById(id)?.title ?? '';
  return title.split(/\s+—\s+/)[0];
}

export const todosOf = (items: BriefingItem[]) =>
  items.filter((i): i is BriefingTodo => i.kind === 'todo');

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
  if (todo.life) {
    return { text: todo.status === 'soon' ? `${todo.month}개월부터 알아 두면 좋아요` : '이번 달 알아 둘 것', dday: null };
  }
  if (todo.status === 'missed') {
    return { text: `${todo.month}개월 항목인데 기록이 없어요 — 했다면 알려 주세요`, dday: null };
  }
  const start = monthStart(birthDate, todo.month);
  const date = `${start.getMonth() + 1}월 ${start.getDate()}일 무렵`;
  if (todo.status === 'soon') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dday = Math.max(0, Math.round((start.getTime() - today.getTime()) / 86_400_000));
    return { text: `${todo.month}개월 · ${date}`, dday };
  }
  return { text: todo.month === currentMonth ? `이번 달 · ${date}부터` : `${todo.month}개월부터 챙길 시기예요`, dday: null };
}

/** 「챙길 것」 묶음을 브리핑 줄 모양으로 — 우리 아기 탭이 브리핑과 같은 줄을 그리게 한다 */
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
