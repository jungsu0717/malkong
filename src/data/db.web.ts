/**
 * 기기 저장소 — 웹 미리보기용 (localStorage).
 *
 * 실제 앱(iOS · Android)은 db.ts 의 sqlite 를 쓴다. expo-sqlite 의 웹 지원이 알파라서
 * 브라우저 검토가 깨지지 않도록 같은 함수만 맞춰 둔 가벼운 구현이다.
 * 시크릿 모드처럼 저장이 막힌 환경에서도 화면이 뜨도록 읽기·쓰기를 모두 감싼다.
 */

import type { Baby } from './baby';

const KEY = 'malkong.baby';
const SETTING_PREFIX = 'malkong.setting.';

export async function readBabyRow(): Promise<Baby | null> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Baby) : null;
  } catch {
    return null;
  }
}

export async function writeBabyRow(baby: Baby): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(baby));
  } catch {
    // 저장이 막힌 브라우저에서도 앱은 그대로 동작해야 한다 (이번 실행에만 유지된다)
  }
}

export async function readSetting(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(`${SETTING_PREFIX}${key}`) ?? null;
  } catch {
    return null;
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  try {
    globalThis.localStorage?.setItem(`${SETTING_PREFIX}${key}`, value);
  } catch {
    // 위와 같다
  }
}
