/**
 * 아침 브리핑 (SPEC-HOME-06, task home/004) — 하루 처음 앱을 열면 말콩이가 먼저 건네는 말.
 *
 * 기기 안에서 만든다(backend 「능동 브리핑」 1단계 온디바이스) — 모델을 부르지 않으니 할당량을 쓰지 않고,
 * 아기 기록이 기기 밖으로 나가지 않는다. 대화 타임라인에 그날의 첫 메시지로 저장되고, 지난 것은 보관함에서 다시 본다.
 *
 * 저장하는 것은 그날 고른 항목의 목록뿐이다. 했는지 안 했는지는 볼 때마다 기록(L2)에서 다시 센다 —
 * 브리핑에서 완료해도, 우리 아기 탭에서 완료해도 같은 결과가 보인다(SPEC-HOME-06 「어긋나지 않아야」).
 */

import { ageFrom, DEFAULT_BABY_NAME, type Baby } from './baby';
import type { BabyRecord } from './records';
import { getGaps, groupGaps, isLifeGroup, type GapGroup, type GapStatus } from './timeline';

/** 브리핑에 올리는 「챙길 것」 수 — 홈과 같은 기준(SPEC-HOME-02 분량) */
const MAX_TODOS = 3;

/** 아침 브리핑 알림 시각 고르기 — 온보딩과 마이가 같은 넷을 쓴다 */
export const BRIEFING_TIMES = ['07:00', '08:00', '09:00', '10:00'];
export const timeLabel = (t: string) => `오전 ${Number(t.split(':')[0])}시`;

/** 몸무게 기록이 이보다 오래되면 가볍게 묻는다(SPEC-HOME-06 ③ 아기 상태 확인) */
const WEIGHT_STALE_DAYS = 14;

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

export type BriefingCheck = {
  kind: 'check';
  key: string;
  label: string;
  detail: string;
  /** 누르면 입력창에 담기는 말 */
  prompt: string;
};

export type BriefingItem = BriefingTodo | BriefingCheck;

export type Briefing = {
  /** 그날의 dayKey — 하루 하나 */
  day: string;
  greeting: string;
  headline: string;
  items: BriefingItem[];
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

export function buildBriefing(
  baby: Baby,
  records: BabyRecord[],
  { scheduleOnly = false, now = new Date(), day }: { scheduleOnly?: boolean; now?: Date; day: string },
): Briefing {
  const name = baby.name ?? DEFAULT_BABY_NAME;
  const { month } = ageFrom(baby.birthDate, now);
  const todos: BriefingItem[] = groupGaps(getGaps(month, records, { scheduleOnly }))
    .slice(0, MAX_TODOS)
    .map((g) => ({
      kind: 'todo',
      key: g.key,
      status: g.status,
      month: g.month,
      label: g.label,
      itemIds: g.items.map((i) => i.id),
      life: isLifeGroup(g),
      category: g.items[0].kind,
    }));

  const items: BriefingItem[] = [...todos];
  const weights = records.filter((r) => /몸무게|체중|\d\s*kg/i.test(r.label));
  const lastWeight = weights.at(-1);
  const staleDays = lastWeight
    ? Math.floor((now.getTime() - new Date(lastWeight.createdAt).getTime()) / 86_400_000)
    : null;
  if (staleDays === null || staleDays >= WEIGHT_STALE_DAYS) {
    items.push({
      kind: 'check',
      key: 'weight',
      label: staleDays === null ? '몸무게를 알려 주세요' : `몸무게 잰 지 ${staleDays}일 됐어요`,
      detail: '말로 알려 주면 기록해 두고 다음 답에 반영해요',
      prompt: '오늘 몸무게는 ',
    });
  }

  return { day, greeting: greetingAt(now.getHours()), headline: headlineFor(name, baby.birthDate, now), items };
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
