/**
 * 위쪽 기록 줄 (SPEC-MAIN-08, task today/029 · 030, decisions/046 · 047) — 어떤 기록과 루틴을 어떤 순서로 보일지.
 *
 * 윗줄은 기록 종류 11가지(모유, 분유, 기저귀, 잠, 체온, 이유식, 유축 수유, 유축, 우유, 물, 간식)이고 처음부터 모두 보인다.
 * 아랫줄은 루틴이다. 둘 다 옆으로 밀어 더 보고, 「편집」에서 빼고 순서를 바꾼다.
 * 이 폰에서만 정한다(설정값 `record.bar`). 순서와 뺀 것만 저장한다 — 새로 만든 루틴은 뺀 적이 없으면 루틴 줄 끝에 붙는다.
 * 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/record-bar.test.ts`).
 */

import { INTAKE_KINDS, INTAKE_NAME, type IntakeKind } from './events.ts';
import { titleKey } from './routine.ts';

export type BarKind = 'breast' | 'formula' | 'diaper' | 'sleep' | 'temp' | IntakeKind;
export const BAR_KINDS: BarKind[] = ['breast', 'formula', 'diaper', 'sleep', 'temp', ...INTAKE_KINDS];
export const BAR_KIND_NAME: Record<BarKind, string> = { breast: '모유', formula: '분유', diaper: '기저귀', sleep: '잠', temp: '체온', ...INTAKE_NAME };
/** 12판에서 처음부터 보이던 넷 — 그때는 나머지를 넣어야 보였다 */
const OLD_FIRST: BarKind[] = ['breast', 'formula', 'diaper', 'sleep'];

/** 줄의 칸 하나 — 기록 종류는 그대로(`formula`), 루틴은 `routine:<id>` */
export type BarKey = string;
/** v 2 부터 기록 종류는 모두 처음부터 보인다(13판) */
export type BarSetting = { v?: number; order: BarKey[]; hidden: BarKey[] };

export const DEFAULT_BAR: BarSetting = { v: 2, order: [...BAR_KINDS], hidden: [] };

export const routineKey = (id: string): BarKey => `routine:${id}`;
export const routineIdOf = (key: BarKey): string | null => (key.startsWith('routine:') ? key.slice('routine:'.length) : null);
export const isBarKind = (key: BarKey): key is BarKind => (BAR_KINDS as string[]).includes(key);

/**
 * 저장된 글 → 설정. 없거나 깨졌으면 처음 값.
 * 12판(v 없음)은 편집을 마치면 넣지 않은 기록 종류까지 「뺀 것」으로 저장했다 — 처음 넷이 아닌 기록 종류는 다시 보이게 한다
 */
export function barFromText(text: string | null): BarSetting {
  if (!text) return DEFAULT_BAR;
  try {
    const v = JSON.parse(text) as Partial<BarSetting>;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : []);
    const hidden = list(v.hidden);
    return { v: 2, order: list(v.order), hidden: v.v === 2 ? hidden : hidden.filter((k) => !isBarKind(k) || OLD_FIRST.includes(k)) };
  } catch {
    return DEFAULT_BAR;
  }
}

export const barToText = (s: BarSetting) => JSON.stringify({ ...s, v: 2 });

export type BarLayout = {
  /** 윗줄 기록 종류, 순서대로 */
  kinds: BarKind[];
  /** 아랫줄 루틴 id, 순서대로 */
  routines: string[];
  hiddenKinds: BarKind[];
  hiddenRoutines: string[];
};

/**
 * 두 줄에 보일 것과 뺀 것 — routineIds 는 지우지 않은 루틴, 루틴 화면의 순서대로.
 * 뺀 적이 없는 기록 종류와 루틴은 저장된 순서 뒤에 붙는다
 */
export function arrangeBar(s: BarSetting, routineIds: string[]): BarLayout {
  const hidden = new Set(s.hidden);
  const kinds: BarKind[] = [];
  const routines: string[] = [];
  for (const k of s.order) {
    if (hidden.has(k)) continue;
    const id = routineIdOf(k);
    if (isBarKind(k) && !kinds.includes(k)) kinds.push(k);
    else if (id && routineIds.includes(id) && !routines.includes(id)) routines.push(id);
  }
  for (const k of BAR_KINDS) if (!hidden.has(k) && !kinds.includes(k)) kinds.push(k);
  for (const id of routineIds) if (!hidden.has(routineKey(id)) && !routines.includes(id)) routines.push(id);
  return {
    kinds,
    routines,
    hiddenKinds: BAR_KINDS.filter((k) => !kinds.includes(k)),
    hiddenRoutines: routineIds.filter((id) => !routines.includes(id)),
  };
}

/** 편집을 마친 뒤 저장할 값 — 두 줄의 순서, 그리고 보이지 않는 것은 모두 뺀 것으로 */
export function barAfterEdit(kinds: BarKind[], routines: string[], routineIds: string[]): BarSetting {
  return {
    v: 2,
    order: [...kinds, ...routines.map(routineKey)],
    hidden: [...BAR_KINDS.filter((k) => !kinds.includes(k)), ...routineIds.filter((id) => !routines.includes(id)).map(routineKey)],
  };
}

/**
 * 「루틴 추가」에 보이는 루틴 — 처음부터 만들어 두지 않고, 누르면 반복을 묻고 루틴으로 만든다(decisions/047).
 * 양을 적는 것(이유식, 유축, 우유, 물, 간식)은 루틴이 아니라 기록 종류다(BAR_KINDS, decisions/046)
 */
export type Starter = { title: string; everyDays: number; time: string };
export const STARTERS: Starter[] = [
  { title: '목욕', everyDays: 1, time: '19:30' },
  { title: '터미타임', everyDays: 1, time: '10:00' },
  { title: '놀이', everyDays: 0, time: '10:00' },
  { title: '병원', everyDays: 0, time: '10:00' },
  { title: '투약', everyDays: 0, time: '09:00' },
  { title: '기타', everyDays: 0, time: '10:00' },
];

/** 이미 같은 이름의 루틴이 있으면 뺀다 — 띄어쓰기는 보지 않는다 */
export function startersFor(titles: string[]): Starter[] {
  const have = new Set(titles.map(titleKey));
  return STARTERS.filter((s) => !have.has(titleKey(s.title)));
}

/** 끌어서 옮긴 목록 — from 자리의 것을 to 자리로 */
export function moveKey(list: BarKey[], from: number, to: number): BarKey[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [k] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, k);
  return next;
}
