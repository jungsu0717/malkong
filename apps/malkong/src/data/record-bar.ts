/**
 * 위쪽 기록 단추 줄 (SPEC-MAIN-08, task today/029, decisions/046) — 어떤 단추를 어떤 순서로 보일지.
 *
 * 기록 종류(모유, 분유, 기저귀, 잠, 체온)와 루틴 단추가 한 줄에 놓이고, 옆으로 밀어 더 본다. 줄 끝의 「편집」에서 넣고 빼고 순서를 바꾼다.
 * 이 폰에서만 정한다(설정값 `record.bar`). 순서와 뺀 단추만 저장한다 — 새로 만든 루틴은 뺀 적이 없으면 줄 끝에 붙는다.
 * 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/record-bar.test.ts`).
 */

import { INTAKE_KINDS, INTAKE_NAME, type IntakeKind } from './events.ts';
import { titleKey } from './routine.ts';

export type BarKind = 'breast' | 'formula' | 'diaper' | 'sleep' | 'temp' | IntakeKind;
export const BAR_KINDS: BarKind[] = ['breast', 'formula', 'diaper', 'sleep', 'temp', ...INTAKE_KINDS];
export const BAR_KIND_NAME: Record<BarKind, string> = { breast: '모유', formula: '분유', diaper: '기저귀', sleep: '잠', temp: '체온', ...INTAKE_NAME };
/** 처음부터 보이는 기록 단추 — 나머지 기록 종류는 「추가할 수 있는 단추」에서 넣는다 */
const FIRST_KINDS: BarKind[] = ['breast', 'formula', 'diaper', 'sleep'];

/** 단추 하나의 이름 — 기록 종류는 그대로(`formula`), 루틴은 `routine:<id>` */
export type BarKey = string;
export type BarSetting = { order: BarKey[]; hidden: BarKey[] };

/** 처음 — 수유 · 기저귀 · 잠 넷, 그 뒤에 루틴. 체온, 이유식, 유축 같은 것은 추가할 수 있는 단추에 둔다 */
export const DEFAULT_BAR: BarSetting = { order: [...FIRST_KINDS], hidden: [] };

export const routineKey = (id: string): BarKey => `routine:${id}`;
export const routineIdOf = (key: BarKey): string | null => (key.startsWith('routine:') ? key.slice('routine:'.length) : null);
export const isBarKind = (key: BarKey): key is BarKind => (BAR_KINDS as string[]).includes(key);

/** 저장된 글 → 설정. 없거나 깨졌으면 처음 값 */
export function barFromText(text: string | null): BarSetting {
  if (!text) return DEFAULT_BAR;
  try {
    const v = JSON.parse(text) as Partial<BarSetting>;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : []);
    return { order: list(v.order), hidden: list(v.hidden) };
  } catch {
    return DEFAULT_BAR;
  }
}

export const barToText = (s: BarSetting) => JSON.stringify(s);

/**
 * 보이는 단추(순서대로)와 추가할 수 있는 단추 — routineIds 는 지우지 않은 루틴, 루틴 화면의 순서대로.
 * 처음 넷과 루틴은 뺀 적이 없으면 줄 끝에 붙고, 나머지 기록 종류는 넣어야 보인다(새 종류가 생겨도 줄이 저절로 길어지지 않게)
 */
export function arrangeBar(s: BarSetting, routineIds: string[]): { shown: BarKey[]; more: BarKey[] } {
  const all = [...BAR_KINDS, ...routineIds.map(routineKey)];
  const joins = (k: BarKey) => (isBarKind(k) ? FIRST_KINDS.includes(k) : true);
  const shown: BarKey[] = [];
  for (const k of s.order) if (all.includes(k) && !s.hidden.includes(k) && !shown.includes(k)) shown.push(k);
  for (const k of all) if (joins(k) && !shown.includes(k) && !s.hidden.includes(k) && !s.order.includes(k)) shown.push(k);
  return { shown, more: all.filter((k) => !shown.includes(k)) };
}

/** 편집을 마친 뒤 저장할 값 — 보이는 순서, 그리고 보이지 않는 것은 모두 뺀 것으로 */
export function barAfterEdit(shown: BarKey[], routineIds: string[]): BarSetting {
  const all = [...BAR_KINDS, ...routineIds.map(routineKey)];
  return { order: shown, hidden: all.filter((k) => !shown.includes(k)) };
}

/**
 * 추가할 수 있는 단추 가운데 아직 루틴이 아닌 것 — 누르면 반복을 묻고 루틴으로 만든다.
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

/** 끌어서 옮긴 줄 — from 자리의 단추를 to 자리로 */
export function moveKey(list: BarKey[], from: number, to: number): BarKey[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [k] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, k);
  return next;
}
