/**
 * 하루 기록 (SPEC-HOME-06 ② 하루 기록, task home/005) — 브리핑이 매일 가볍게 묻는 넷.
 *
 * 적으면 기기 안의 기록(L2) 한 줄이 된다 — 모델을 부르지 않는다. 대화에서 버디에게 말해 생긴 기록도 같은 말이 들어
 * 있으면 적은 것으로 센다. 안 적어도 불이익은 없다 — 답에 필요해지면 버디가 대화 중에 되묻는다(SPEC-ASK 되묻기).
 *
 * 했는지는 브리핑에 저장하지 않고 볼 때마다 기록에서 다시 센다 — 그래서 예전 브리핑에도 같은 넷이 붙는다.
 */

import type { BabyRecord } from './records';

export type LogKey = 'feed-total' | 'feed-interval' | 'weight' | 'note';

export type LogDef = {
  key: LogKey;
  title: string;
  /** 아직 안 적었을 때 줄 아래 한 줄 */
  hint: string;
  /** 숫자 기록의 단위 — 없으면 글로 적는다 */
  unit: 'ml' | '시간' | 'kg' | null;
  placeholder: string;
  /** 눌러서 바로 넣는 값 */
  quick: string[];
  /** 이 말이 든 기록이면 적은 것으로 본다 — 대화에서 생긴 기록도 */
  match: RegExp;
  /** 브리핑 날부터 며칠 전까지의 기록을 셀까 — 하루 기록은 그날만(0), 몸무게는 일주일 */
  withinDays: number;
  /** 저장할 기록 문구. 어제 하루를 묻는 것은 어제 날짜를 붙인다 — 다음 답에서 언제 일인지 알 수 있게 */
  label: (value: string, today: Date) => string;
};

const md = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
const yesterday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

export const DAILY_LOGS: LogDef[] = [
  {
    key: 'feed-total',
    title: '어제 총 수유량',
    hint: '모유·분유 합쳐 대략이면 돼요',
    unit: 'ml',
    placeholder: '800',
    quick: [],
    match: /수유량|총\s*\d+\s*(ml|cc)|하루\s*\S*\s*\d+\s*(ml|cc)/i,
    withinDays: 0,
    label: (v, today) => `${md(yesterday(today))} 하루 수유량 ${v}ml`,
  },
  {
    key: 'feed-interval',
    title: '평균 수유 간격',
    hint: '어제 보통 몇 시간마다 먹었나요',
    unit: '시간',
    placeholder: '3',
    quick: ['2', '2.5', '3', '3.5', '4'],
    match: /수유\s*(텀|간격)|\d+(\.\d+)?\s*시간\s*(마다|간격|텀)/,
    withinDays: 0,
    label: (v, today) => `${md(yesterday(today))} 수유 간격 평균 ${v}시간`,
  },
  {
    key: 'weight',
    title: '몸무게',
    hint: '일주일에 한 번이면 충분해요',
    unit: 'kg',
    placeholder: '6.4',
    quick: [],
    match: /몸무게|체중|\d+(\.\d+)?\s*(kg|킬로)/i,
    withinDays: 6,
    label: (v, today) => `몸무게 ${v}kg (${md(today)})`,
  },
  {
    key: 'note',
    title: '특이사항',
    hint: '열·변·잠투정처럼 평소와 달랐던 것',
    unit: null,
    placeholder: '예: 낮잠을 거의 안 잤어요',
    quick: ['특별한 일 없었어요', '평소보다 덜 먹었어요', '많이 보챘어요'],
    match: /특이\s*사항/,
    withinDays: 0,
    label: (v, today) => `${md(yesterday(today))} 특이사항: ${v}`,
  },
];

const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export type LogEntry = { def: LogDef; record: BabyRecord | null };

/** 그날(`day`) 브리핑의 하루 기록 넷과, 적었으면 그 기록 — 가장 최근 것 */
export function logsFor(day: Date, records: BabyRecord[]): LogEntry[] {
  const end = startOf(day) + 86_400_000;
  return DAILY_LOGS.map((def) => {
    const from = startOf(day) - def.withinDays * 86_400_000;
    const record =
      records
        .filter((r) => {
          const t = new Date(r.createdAt).getTime();
          return t >= from && t < end && def.match.test(r.label);
        })
        .at(-1) ?? null;
    return { def, record };
  });
}

/** 줄 오른쪽에 보일 값 — 「820ml」 「6.4kg」, 글 기록은 그 내용 */
export function valueOf(def: LogDef, record: BabyRecord): string {
  if (def.unit === null) return record.label.split(/특이\s*사항\s*:?\s*/).at(-1)?.trim() || record.label;
  const hit = record.label.match(/(\d+(?:\.\d+)?)\s*(ml|cc|kg|킬로|시간)/i);
  return hit ? `${hit[1]}${hit[2]}` : record.label;
}

/** 숫자 칸에 들어온 글을 다듬는다 — 쉼표는 소수점으로, 숫자와 점만 */
export function cleanNumber(text: string): string {
  return text.replace(',', '.').replace(/[^\d.]/g, '');
}

/** 하루 기록마다 질문에 실어 보낼 최근 개수 — 요즘 흐름만 보면 된다. 몸무게는 변화가 보이게 둘 */
const KEEP_PER_LOG: Record<LogKey, number> = { 'feed-total': 3, 'feed-interval': 3, weight: 2, note: 3 };

/**
 * 질문에 실어 보낼 기록 고르기 — 최근 `max` 개.
 * 하루 기록은 매일 쌓여 그대로 자르면 한 번 알려 준 사실(수유 방식 · 알레르기 · 접종)이 일주일 만에 밀려나고,
 * 버디가 이미 들은 것을 다시 묻게 된다. 그래서 하루 기록은 종류마다 최근 몇 개만 남기고 나머지 자리를 다른 기록에 준다.
 */
export function recordsForQuestion(records: BabyRecord[], max: number): BabyRecord[] {
  const kept = new Set<string>();
  const others: BabyRecord[] = [];
  const counts: Partial<Record<LogKey, number>> = {};
  for (const r of [...records].reverse()) {
    const def = DAILY_LOGS.find((d) => d.match.test(r.label));
    if (!def) {
      others.push(r);
      continue;
    }
    const n = counts[def.key] ?? 0;
    if (n < KEEP_PER_LOG[def.key]) kept.add(r.id);
    counts[def.key] = n + 1;
  }
  for (const r of others.slice(0, Math.max(0, max - kept.size))) kept.add(r.id);
  return records.filter((r) => kept.has(r.id)).slice(-max);
}
