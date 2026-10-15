/**
 * 기기 저장소 — 웹 미리보기용 (localStorage).
 *
 * 실제 앱(iOS · Android)은 db.ts 의 sqlite 를 쓴다. expo-sqlite 의 웹 지원이 알파라서
 * 브라우저 검토가 깨지지 않도록 같은 함수만 맞춰 둔 가벼운 구현이다.
 * 시크릿 모드처럼 저장이 막힌 환경에서도 화면이 뜨도록 읽기·쓰기를 모두 감싼다.
 */

import type { Baby } from './baby';
import type { ChatMessage } from './chat';
import type { CareEvent } from './events';
import type { InboxCard } from './inbox';
import type { BabyRecord } from './records';
import type { Todo, Topic } from './todos';

const KEY = 'malkong.baby';
const SETTING_PREFIX = 'malkong.setting.';

export async function readBabyRow(): Promise<Baby | null> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const baby = JSON.parse(raw) as Baby;
    return { ...baby, updatedAt: baby.updatedAt ?? baby.createdAt };
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
    type Stored = Omit<BabyRecord, 'sourceMessageId' | 'stale' | 'updatedAt'> &
      Partial<Pick<BabyRecord, 'sourceMessageId' | 'stale' | 'updatedAt'>>;
    return (JSON.parse(raw) as Stored[]).map((record) => ({
      ...record,
      sourceMessageId: record.sourceMessageId ?? null,
      stale: record.stale ?? false,
      updatedAt: record.updatedAt ?? record.createdAt,
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

export async function upsertRecordRow(record: BabyRecord): Promise<void> {
  const rows = await readRecordRows();
  const index = rows.findIndex((r) => r.id === record.id);
  if (index >= 0) rows[index] = record;
  else rows.push(record);
  await writeRecordRows(rows);
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
    (await readRecordRows()).map((r) =>
      r.id === id ? { ...r, label, stale: false, updatedAt: new Date().toISOString() } : r,
    ),
  );
}

export async function updateChatMetaRow(id: string, meta: ChatMessage['meta']): Promise<void> {
  const messages = (await readChatRows()).map((m) =>
    m.id === id ? ({ ...m, meta } as ChatMessage) : m,
  );
  try {
    globalThis.localStorage?.setItem(CHAT_KEY, JSON.stringify(messages));
  } catch {
    // 위와 같다
  }
}

const INBOX_KEY = 'malkong.inbox';

/** 읽고 쓰는 사이에 await 를 두지 않는다 — 브리핑 셋이 한꺼번에 들어올 때 서로 덮어쓰지 않게 */
function readInboxSync(): InboxCard[] {
  try {
    const raw = globalThis.localStorage?.getItem(INBOX_KEY);
    return raw ? (JSON.parse(raw) as InboxCard[]) : [];
  } catch {
    return [];
  }
}

function writeInboxRows(cards: InboxCard[]): void {
  try {
    globalThis.localStorage?.setItem(INBOX_KEY, JSON.stringify(cards));
  } catch {
    // 저장이 막힌 브라우저에서도 화면은 그대로 동작해야 한다 (이번 실행에만 유지된다)
  }
}

export async function readInboxRows(): Promise<InboxCard[]> {
  return readInboxSync();
}

export async function insertInboxRow(card: InboxCard): Promise<void> {
  const cards = readInboxSync();
  if (cards.some((c) => c.id === card.id)) return;
  writeInboxRows([...cards, card]);
}

export async function markInboxReadRows(ids: string[], at: string): Promise<void> {
  const wanted = new Set(ids);
  writeInboxRows(readInboxSync().map((c) => (wanted.has(c.id) && !c.readAt ? { ...c, readAt: at } : c)));
}

// --- 빠른 기록 (SPEC-LOG-01) ---

const EVENTS_KEY = 'malkong.events';

export async function readEventRows(): Promise<CareEvent[]> {
  try {
    const raw = globalThis.localStorage?.getItem(EVENTS_KEY);
    const rows = raw ? (JSON.parse(raw) as CareEvent[]) : [];
    // 변 색 칸이 생기기 전에 저장한 줄도 읽게 메운다
    return rows.map((r) => ({ ...r, color: r.color ?? null })).sort((a, b) => a.startAt.localeCompare(b.startAt));
  } catch {
    return [];
  }
}

function writeEventRows(rows: CareEvent[]): void {
  try {
    globalThis.localStorage?.setItem(EVENTS_KEY, JSON.stringify(rows));
  } catch {
    // 저장이 막힌 브라우저에서도 화면은 그대로 동작해야 한다 (이번 실행에만 유지된다)
  }
}

export async function upsertEventRow(e: CareEvent): Promise<void> {
  const rows = await readEventRows();
  const i = rows.findIndex((r) => r.id === e.id);
  if (i >= 0) rows[i] = e;
  else rows.push(e);
  writeEventRows(rows);
}

export async function deleteEventRow(id: string): Promise<void> {
  writeEventRows((await readEventRows()).filter((r) => r.id !== id));
}

// --- 주제별 할 일 (SPEC-TOPIC-01~03) ---

const TOPICS_KEY = 'malkong.topics';
const TODOS_KEY = 'malkong.todos';

function readList<T>(key: string): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, rows: T[]): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(rows));
  } catch {
    // 저장이 막힌 브라우저에서도 화면은 그대로 동작해야 한다 (이번 실행에만 유지된다)
  }
}

function upsertIn<T extends { id: string }>(key: string, row: T): void {
  const rows = readList<T>(key);
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  writeList(key, rows);
}

export async function readTopicRows(): Promise<Topic[]> {
  // 아이콘 칸(task topic/005) 전에 저장한 주제에는 icon 이 없다
  return readList<Topic>(TOPICS_KEY)
    .map((t) => ({ ...t, icon: t.icon ?? null }))
    .sort((a, b) => a.sort - b.sort);
}

export async function upsertTopicRow(t: Topic): Promise<void> {
  upsertIn(TOPICS_KEY, t);
}

export async function readTodoRows(): Promise<Todo[]> {
  // 반복(task topic/002) · 규칙 열쇠(003) · 장보기(004) 칸 전에 저장한 줄에는 그 값이 없다
  return readList<Todo>(TODOS_KEY)
    .map((r) => ({
      ...r,
      repeat: r.repeat ?? null,
      ref: r.ref ?? null,
      orderedAt: r.orderedAt ?? null,
      arriveAt: r.arriveAt ?? null,
      store: r.store ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function upsertTodoRow(t: Todo): Promise<void> {
  upsertIn(TODOS_KEY, t);
}

export async function deleteTodoRow(id: string): Promise<void> {
  writeList(TODOS_KEY, readList<Todo>(TODOS_KEY).filter((r) => r.id !== id));
}
