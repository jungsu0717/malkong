/**
 * 아기 프로필 — 저장과 월령 계산 (SPEC-MY-01).
 *
 * 생일만 저장하고 월령·일수는 언제나 생일에서 계산한다. 계산 결과를 저장해 두면 반드시 낡는다.
 * 저장 위치는 기기 안이다 — 스키마 정본은 docs/architecture/backend.md 의 기기 DB 절.
 */

import { readBabyRow, writeBabyRow } from './db';

export type Baby = {
  id: string;
  /** 선택 입력 — 없으면 화면에서 "우리 아기"로 부른다 */
  name: string | null;
  /** YYYY-MM-DD */
  birthDate: string;
  createdAt: string;
};

export type BabyAge = {
  /** 생후 일수. 태어난 날이 D+0 이다 */
  days: number;
  /** 만 월령. 생후 87일이면 2(만 2개월)이고, 3개월이 되는 날은 생일과 같은 날짜다 */
  month: number;
};

export const DEFAULT_BABY_NAME = '우리 아기';

/** 'YYYY-MM-DD' → 그날 자정의 Date. 시각을 버려야 시간대·서머타임에 흔들리지 않는다 */
function parseDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // 2월 30일처럼 넘겨도 Date 가 알아서 굴러가므로, 되돌려 받아 같은 날인지 확인한다
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 입력받은 날짜가 실제 날짜이고 미래가 아닌지 — 온보딩 버튼 활성화 조건 */
export function validateBirthDate(ymd: string, today = new Date()): string | null {
  const birth = parseDate(ymd);
  if (!birth) return '없는 날짜예요. 다시 확인해 주세요';
  if (birth.getTime() > midnight(today).getTime()) return '아직 오지 않은 날짜예요';
  return null;
}

export function ageFrom(birthDate: string, today = new Date()): BabyAge {
  const birth = parseDate(birthDate);
  if (!birth) return { days: 0, month: 0 };

  const days = Math.max(
    0,
    Math.round((midnight(today).getTime() - birth.getTime()) / 86_400_000),
  );

  let month =
    (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) month -= 1;

  return { days, month: Math.max(0, month) };
}

export async function loadBaby(): Promise<Baby | null> {
  return readBabyRow();
}

export async function saveBaby(input: { name: string | null; birthDate: string }): Promise<Baby> {
  const existing = await readBabyRow();
  const baby: Baby = {
    id: existing?.id ?? 'baby-1',
    name: input.name?.trim() ? input.name.trim() : null,
    birthDate: input.birthDate,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  await writeBabyRow(baby);
  return baby;
}
