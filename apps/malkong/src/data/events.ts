/**
 * 빠른 기록 (SPEC-LOG-01~03, decisions/023 · 036) — 수유 · 기저귀 · 잠 · 체온 · 키와 몸무게.
 *
 * 한 줄이 한 번의 일이다. 모유 · 잠은 시작과 끝이 있고, 끝이 비어 있으면 재는 중이다(종류마다 하나까지).
 * 기기 DB `care_event`(backend 「기기 DB 스키마」, 읽고 쓰기는 db.ts). 가족 공유를 켜면 맞춰지고, 누가 남겼는지(by)가 가족에게 보인다(family.ts).
 * 이 파일은 저장소를 부르지 않는다 — node 시험(event-summary.test.ts)이 바로 읽는다.
 */

export type EventKind = 'breast' | 'formula' | 'diaper' | 'sleep' | 'temp' | 'weight' | 'height';
export type Side = 'left' | 'right';
export type DiaperKind = 'pee' | 'poo' | 'both';
/** 변 색 — 대변 · 둘 다일 때 고른다(SPEC-LOG-01) */
export type StoolColor = 'yellow' | 'brown' | 'green' | 'black' | 'red' | 'white';

export type CareEvent = {
  id: string;
  kind: EventKind;
  /** 그 일이 일어난(시작한) 때 ISO */
  startAt: string;
  /** 모유 · 잠의 끝. null 이면 재는 중 */
  endAt: string | null;
  /** 분유 ml · 체온 ℃ · 몸무게 kg · 키 cm */
  amount: number | null;
  side: Side | null;
  diaper: DiaperKind | null;
  /** 변 색 — 대변이 있을 때만. 옛 기록에는 없다 */
  color: StoolColor | null;
  note: string | null;
  /** 남긴 사람의 「가족에게 보일 이름」(엄마 · 할머니) — 가족 공유를 켠 폰에서만. 옛 기록에는 없다 */
  by: string | null;
  createdAt: string;
  /** 마지막으로 고친 때 — 가족 공유에서 늦게 고친 쪽이 이긴다 */
  updatedAt: string;
};

export const EVENT_KINDS: EventKind[] = ['breast', 'formula', 'diaper', 'sleep', 'temp', 'weight', 'height'];

/** 시작과 끝으로 재는 기록 */
export const TIMED_KINDS: EventKind[] = ['breast', 'sleep'];

/** 숫자 하나를 적는 기록과 그 범위 — 잘못 친 값을 막는다 */
export const AMOUNT_RANGE: Partial<Record<EventKind, { min: number; max: number; unit: string }>> = {
  formula: { min: 1, max: 400, unit: 'ml' },
  temp: { min: 34, max: 43, unit: '℃' },
  weight: { min: 1, max: 30, unit: 'kg' },
  height: { min: 30, max: 130, unit: 'cm' },
};

/** 숫자 칸 입력 — 쉼표를 점으로, 숫자와 점만 남긴다 */
export function cleanNumber(text: string): string {
  return text.replace(',', '.').replace(/[^\d.]/g, '');
}

export function newEventId(): string {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type EventInput = Partial<Omit<CareEvent, 'id' | 'kind' | 'createdAt' | 'updatedAt'>> & { kind: EventKind };

/** 새 기록 한 줄 — 때를 주지 않으면 지금 */
export function makeEvent(input: EventInput, now = new Date()): CareEvent {
  const at = now.toISOString();
  return {
    id: newEventId(),
    kind: input.kind,
    startAt: input.startAt ?? at,
    endAt: input.endAt ?? null,
    amount: input.amount ?? null,
    side: input.side ?? null,
    diaper: input.diaper ?? null,
    color: input.color ?? null,
    note: input.note ?? null,
    by: input.by ?? null,
    createdAt: at,
    updatedAt: at,
  };
}

/** 지금 재는 중인 것 — 그 종류에서 끝이 빈 가장 늦은 줄 */
export function runningOf(events: CareEvent[], kind: EventKind): CareEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === kind && e.endAt === null) return e;
  }
  return null;
}

/** 시작 순서로 — 화면과 셈이 모두 이 순서를 가정한다 */
export function sortEvents(events: CareEvent[]): CareEvent[] {
  return [...events].sort((a, b) => a.startAt.localeCompare(b.startAt));
}
