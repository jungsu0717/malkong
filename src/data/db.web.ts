/**
 * 기기 저장소 — 웹 미리보기용 (localStorage).
 *
 * 실제 앱(iOS · Android)은 db.ts 의 sqlite 를 쓴다. expo-sqlite 의 웹 지원이 알파라서
 * 브라우저 검토가 깨지지 않도록 같은 함수만 맞춰 둔 가벼운 구현이다.
 * 시크릿 모드처럼 저장이 막힌 환경에서도 화면이 뜨도록 읽기·쓰기를 모두 감싼다.
 */

import type { Baby } from './baby';
import type { ChatMessage } from './chat';
import type { BabyRecord } from './records';

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

const RECORDS_KEY = 'malkong.records';

export async function readRecordRows(): Promise<BabyRecord[]> {
  try {
    const raw = globalThis.localStorage?.getItem(RECORDS_KEY);
    if (!raw) return [];
    // 칸이 늘기 전에 저장된 기록도 읽을 수 있게 메워 준다
    type Stored = Omit<BabyRecord, 'sourceMessageId' | 'stale'> &
      Partial<Pick<BabyRecord, 'sourceMessageId' | 'stale'>>;
    return (JSON.parse(raw) as Stored[]).map((record) => ({
      ...record,
      sourceMessageId: record.sourceMessageId ?? null,
      stale: record.stale ?? false,
    }));
  } catch {
    return [];
  }
}

async function writeRecordRows(records: BabyRecord[]): Promise<void> {
  try {
    globalThis.localStorage?.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // 저장이 막힌 브라우저에서도 화면은 그대로 동작해야 한다 (이번 실행에만 유지된다)
  }
}

export async function insertRecordRow(record: BabyRecord): Promise<void> {
  await writeRecordRows([...(await readRecordRows()), record]);
}

export async function deleteRecordRow(id: string): Promise<void> {
  await writeRecordRows((await readRecordRows()).filter((r) => r.id !== id));
}

const CHAT_KEY = 'malkong.chat';

export async function readChatRows(): Promise<ChatMessage[]> {
  try {
    const raw = globalThis.localStorage?.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export async function insertChatRow(message: ChatMessage): Promise<void> {
  const messages = [...(await readChatRows()), message];
  try {
    globalThis.localStorage?.setItem(CHAT_KEY, JSON.stringify(messages));
  } catch {
    // 저장이 막힌 브라우저에서도 화면은 그대로 동작해야 한다 (이번 실행에만 유지된다)
  }
}

export async function updateRecordLabelRow(id: string, label: string): Promise<void> {
  await writeRecordRows(
    (await readRecordRows()).map((r) => (r.id === id ? { ...r, label, stale: false } : r)),
  );
}
