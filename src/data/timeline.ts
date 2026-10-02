/**
 * 지식층 모형.
 *
 * 겉으로 보이는 층은 둘 — L1(공공 지식) · L2(우리 아기 지식).
 * L2는 안쪽에서 다시 둘로 나눈다:
 *   - 기록: 관찰된 사실 (정정 가능, 답변의 근거로 안전)
 *   - 요약: 질의에서 추출한 해석 (낡을 수 있어 시점이 붙는다)
 * 사실과 해석을 한 칸에 섞으면 반드시 한쪽이 낡는다.
 *
 * L1 은 승인된 지식베이스(`@/data/l1`), L2 는 기기에 저장된 기록(`@/data/records`)이다.
 */

import { ageFrom } from '@/data/baby';
import { allItems, itemById, type KnowledgeItem } from '@/data/l1';
import type { BabyRecord } from '@/data/records';

export type L1Item = KnowledgeItem;
export type L2Item = BabyRecord;

export type MonthData = {
  month: number;
  headline?: string;
  /** 이 달에 시작하는 표준 항목 */
  l1: L1Item[];
  l2: L2Item[];
};

/** 타임라인의 마지막 월 — L1 1차 구축 범위(0~12개월) */
const LAST_MONTH = 12;

/** 월마다 한 줄 특징 (목업 문구 — 발달 지식이 쌓이면 그쪽에서 가져온다) */
const HEADLINES: Record<number, string> = {
  0: '세상에 온 첫 달',
  1: '낮밤이 없는 시기',
  2: '첫 사회적 미소',
  3: '목을 가누기 시작',
  4: '뒤집기 연습의 달',
  5: '이유식 준비',
  6: '앉기와 이유식 시작',
};

const startOf = (item: L1Item) => item.months[0];
const endOf = (item: L1Item) => item.months[item.months.length - 1];

/**
 * 타임라인 표준 트랙에 오르는 분류 — 그 달에 생기는 일정만. 수유·수면·생활·안전·대응은 월령 내내
 * 쓰는 상시 지식이라(대부분 0개월에 시작한다) 컬럼에 올리면 0개월이 수십 줄이 된다. 답변 근거와
 * 홈의 팁으로 쓴다.
 */
const TIMELINE_KINDS: L1Item['kind'][] = ['접종', '검진', '발달'];

/**
 * 기록이 놓일 월 — 완료 처리한 항목이 시작하는 월. 2개월 접종을 5개월에 알려도 2개월 컬럼에 놓여야
 * 표준과 나란히 보인다. 트랙에 오르지 않는 항목(생활 팁 등)만 닫는 기록이나 닫는 항목이 없는 기록은
 * 기록한 날의 월령에 놓는다 — 짝이 되는 표준 줄 없이 엉뚱한 달에 기록만 보이지 않게.
 */
function recordMonth(record: L2Item, birthDate: string): number {
  const starts = record.covers.flatMap((id) => {
    const item = itemById(id);
    return item && TIMELINE_KINDS.includes(item.kind) ? [startOf(item)] : [];
  });
  return starts.length > 0
    ? Math.min(...starts)
    : ageFrom(birthDate, new Date(record.createdAt)).month;
}

/** 0개월부터 이어지는 월 컬럼 — 표준 항목과 우리 아기 기록을 월마다 나란히 둔다 */
export function buildTimeline(records: L2Item[], birthDate: string): MonthData[] {
  return Array.from({ length: LAST_MONTH + 1 }, (_, month) => ({
    month,
    headline: HEADLINES[month],
    l1: allItems().filter((item) => TIMELINE_KINDS.includes(item.kind) && startOf(item) === month),
    l2: records.filter((r) => recordMonth(r, birthDate) === month),
  }));
}

/** 월 한 줄 특징 — 홈 아기 카드가 쓴다 */
export function headlineOf(month: number): string | undefined {
  return HEADLINES[month];
}

/**
 * - missed: 기간이 지났는데 기록이 없다 — 놓침으로 단정하지 않고 물어본다
 * - open: 지금이 그 기간 안이다
 * - soon: 다음 달에 시작한다
 */
export type GapStatus = 'missed' | 'open' | 'soon';
export type Gap = { item: L1Item; status: GapStatus };

/** 일정이 있는 표준 — 기간이 지나면 놓침을 묻는다 */
const SCHEDULE_KINDS: L1Item['kind'][] = ['접종', '검진'];

/**
 * 생활 항목(SPEC-HOME-02) — 터미타임·이유식 시작·안전한 잠자리 같은 알아 둘 것. 마감이 있는 일정이 아니라서
 * 놓침으로 묻지 않고, 기간 안이거나 다음 달에 시작할 때만 「챙길 것」에 오른다. 확인을 누르면 사라진다.
 * 발달은 「이번 달 발달 포인트」, 위험 신호(대응)는 물어보기의 몫이다.
 */
const LIFE_KINDS: L1Item['kind'][] = ['생활', '수유', '수면', '안전'];

export function isLifeKind(kind: L1Item['kind']): boolean {
  return LIFE_KINDS.includes(kind);
}

/** 묶음 줄이 생활 항목인가 — 완료 대신 「확인」이라 부른다 */
export function isLifeGroup(group: GapGroup): boolean {
  return group.items.every((i) => isLifeKind(i.kind));
}

/**
 * 표준(L1) 대비 우리 아기 기록(L2)의 차집합 — 홈의 추천이 여기서 나온다.
 * `scheduleOnly` 면 접종·검진만 본다(설정 「접종·검진만 보기」).
 */
export function getGaps(
  currentMonth: number,
  records: L2Item[],
  { scheduleOnly = false }: { scheduleOnly?: boolean } = {},
): Gap[] {
  const covered = new Set(records.flatMap((r) => r.covers));
  const gaps: Gap[] = [];

  for (const item of allItems()) {
    if (covered.has(item.id)) continue;
    if (SCHEDULE_KINDS.includes(item.kind)) {
      if (endOf(item) < currentMonth) gaps.push({ item, status: 'missed' });
      else if (startOf(item) <= currentMonth) gaps.push({ item, status: 'open' });
      else if (startOf(item) === currentMonth + 1) gaps.push({ item, status: 'soon' });
    } else if (!scheduleOnly && isLifeKind(item.kind)) {
      if (startOf(item) <= currentMonth && currentMonth <= endOf(item)) gaps.push({ item, status: 'open' });
      else if (startOf(item) === currentMonth + 1) gaps.push({ item, status: 'soon' });
    }
  }
  return gaps;
}

export type GapGroup = {
  key: string;
  status: GapStatus;
  /** 묶인 항목들이 시작하는 월 */
  month: number;
  label: string;
  items: L1Item[];
};

const STATUS_ORDER: GapStatus[] = ['missed', 'open', 'soon'];

/** 제목에서 괄호 풀이를 뗀 짧은 이름 — "DTaP 1차 (디프테리아·파상풍·백일해)" → "DTaP 1차" */
const shortTitle = (title: string) => title.replace(/\s*\([^)]*\)/g, '').trim();

/** 생활 항목 묶음의 이름 — 제목을 다 이으면 한 줄이 넘치므로 분류와 개수로 부른다 */
const LIFE_GROUP_NAMES: Partial<Record<L1Item['kind'], string>> = {
  수유: '먹이기',
  수면: '안전한 잠',
  안전: '집 안 안전',
  생활: '놀이와 생활',
};

/** 차수가 같은 것끼리 이름을 이어 붙인다 — "DTaP·폴리오 3차 · 인플루엔자" */
export function groupLabel(items: L1Item[]): string {
  if (items.length === 1) return items[0].title;
  if (items.every((i) => isLifeKind(i.kind) && i.kind === items[0].kind)) {
    return `${LIFE_GROUP_NAMES[items[0].kind] ?? items[0].kind} ${items.length}가지`;
  }
  const byDose = new Map<string, string[]>();
  for (const item of items) {
    const short = shortTitle(item.title);
    const dose = short.match(/\s(\d+차)$/)?.[1] ?? '';
    const name = dose ? short.slice(0, -dose.length).trim() : short;
    byDose.set(dose, [...(byDose.get(dose) ?? []), name]);
  }
  return [...byDose]
    .map(([dose, names]) => (dose ? `${names.join('·')} ${dose}` : names.join(' · ')))
    .join(' · ');
}

/**
 * 같은 월에 시작하는 같은 분류는 한 줄로 묶는다 (SPEC-HOME-02 묶음) — 한 번의 병원 방문이
 * 다섯 줄로 쪼개져 보이지 않게. 놓친 것 → 지금 → 다음 달 순서.
 */
export function groupGaps(gaps: Gap[]): GapGroup[] {
  const groups = new Map<string, GapGroup>();
  for (const { item, status } of gaps) {
    const month = startOf(item);
    const key = `${status}-${month}-${item.kind}`;
    const group = groups.get(key) ?? { key, status, month, label: '', items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, label: groupLabel(g.items) }))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        // 같은 상태면 병원에 가야 하는 일정이 생활 항목보다 먼저
        Number(isLifeKind(a.items[0].kind)) - Number(isLifeKind(b.items[0].kind)) ||
        a.month - b.month,
    );
}
