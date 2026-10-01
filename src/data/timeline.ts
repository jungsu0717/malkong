/**
 * 지식층 모형.
 *
 * 겉으로 보이는 층은 둘 — L1(공공 지식) · L2(우리 아기 지식).
 * L2는 안쪽에서 다시 둘로 나눈다:
 *   - 기록: 관찰된 사실 (정정 가능, 답변의 근거로 안전)
 *   - 요약: 질의에서 추출한 해석 (낡을 수 있어 시점이 붙는다)
 * 사실과 해석을 한 칸에 섞으면 반드시 한쪽이 낡는다.
 *
 * L1 은 승인된 지식베이스(`@/data/l1`)에서 온다. L2 는 기록 저장이 생기기 전까지 목업이다.
 */

import { allItems, type KnowledgeItem } from '@/data/l1';

export type L1Item = KnowledgeItem;

export type L2Kind = '기록' | '요약';
export type L2Item = {
  kind: L2Kind;
  label: string;
  when?: string;
  /** 이 기록이 완료 처리하는 L1 항목 id — 하나의 기록이 여러 항목을 닫을 수 있다 */
  covers?: string[];
};

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

/**
 * 우리 아기 기록 (목업 — 기록 저장 task 에서 기기 DB 로 바뀐다).
 * 아기 월령과 상관없이 고정이라, 아직 오지 않은 달의 것은 없는 것으로 다룬다.
 */
const MOCK_RECORDS: Record<number, L2Item[]> = {
  0: [
    { kind: '기록', label: '3.2kg 출생 · 자연분만', when: 'D+0' },
    {
      kind: '기록',
      label: 'BCG · B형간염 1차 접종 완료',
      when: 'D+1',
      covers: ['k-vacc-0001', 'k-vacc-0002'],
    },
  ],
  1: [
    {
      kind: '기록',
      label: '건강검진 1차 완료 — 이상 없음',
      when: 'D+21',
      covers: ['k-chk-0001'],
    },
    { kind: '요약', label: '밤중 수유 3회, 등센서 있는 편', when: 'D+28 질문에서' },
  ],
  2: [
    {
      kind: '기록',
      label: '1차 접종 완료 · 접종 후 미열 하루',
      when: 'D+61',
      covers: ['k-vacc-0201', 'k-vacc-0202', 'k-vacc-0203', 'k-vacc-0204', 'k-vacc-0205'],
    },
    { kind: '요약', label: '분유량 갑자기 줄어 걱정 → 급성장기로 판단', when: 'D+70 질문에서' },
  ],
  3: [
    { kind: '기록', label: '몸무게 6.4kg (50~75 백분위)', when: 'D+85' },
    { kind: '요약', label: '밤중 수유 2회로 줄음 — 수면 흐름 좋아지는 중', when: 'D+86 질문에서' },
  ],
};

const startOf = (item: L1Item) => item.months[0];
const endOf = (item: L1Item) => item.months[item.months.length - 1];

export const TIMELINE: MonthData[] = Array.from({ length: LAST_MONTH + 1 }, (_, month) => ({
  month,
  headline: HEADLINES[month],
  l1: allItems().filter((item) => startOf(item) === month),
  l2: MOCK_RECORDS[month] ?? [],
}));

export function monthData(month: number): MonthData | undefined {
  return TIMELINE.find((m) => m.month === month);
}

/**
 * - missed: 기간이 지났는데 기록이 없다 — 놓침으로 단정하지 않고 물어본다
 * - open: 지금이 그 기간 안이다
 * - soon: 다음 달에 시작한다
 */
export type GapStatus = 'missed' | 'open' | 'soon';
export type Gap = { item: L1Item; status: GapStatus };

/** 표준(L1 접종·검진) 대비 우리 아기 기록(L2)의 차집합 — 홈의 추천이 여기서 나온다 */
export function getGaps(currentMonth: number): Gap[] {
  const covered = new Set(
    TIMELINE.filter((m) => m.month <= currentMonth).flatMap((m) =>
      m.l2.flatMap((r) => r.covers ?? []),
    ),
  );
  const gaps: Gap[] = [];

  for (const item of allItems()) {
    if (item.kind !== '접종' && item.kind !== '검진') continue;
    if (covered.has(item.id)) continue;
    if (endOf(item) < currentMonth) gaps.push({ item, status: 'missed' });
    else if (startOf(item) <= currentMonth) gaps.push({ item, status: 'open' });
    else if (startOf(item) === currentMonth + 1) gaps.push({ item, status: 'soon' });
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

/** 차수가 같은 것끼리 이름을 이어 붙인다 — "DTaP·폴리오 3차 · 인플루엔자" */
function groupLabel(items: L1Item[]): string {
  if (items.length === 1) return items[0].title;
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
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.month - b.month,
    );
}
