/**
 * 기기 저장소 — expo-sqlite (iOS · Android).
 *
 * 스키마 정본은 docs/architecture/backend.md 의 「기기 DB 스키마」 절이다. 여기서는 그 중
 * 지금 쓰는 테이블만 만든다 — inbox_card 는 그 기능 task 에서 추가한다.
 *
 * 웹은 expo-sqlite 의 웹 지원이 알파(Metro WASM 설정·특수 헤더 필요)라 미리보기가 깨지므로,
 * 같은 함수를 localStorage 로 구현한 db.web.ts 가 대신 쓰인다.
 */

import * as SQLite from 'expo-sqlite';

import type { Baby } from './baby';
import type { ChatMessage } from './chat';
import type { BabyRecord } from './records';

const DB_NAME = 'malkong.db';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS baby (
          id          TEXT PRIMARY KEY,
          name        TEXT,
          birth_date  TEXT NOT NULL,
          created_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key    TEXT PRIMARY KEY,
          value  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS record (
          id                 TEXT PRIMARY KEY,
          baby_id            TEXT NOT NULL REFERENCES baby(id),
          kind               TEXT NOT NULL CHECK (kind IN ('기록','요약')),
          label              TEXT NOT NULL,
          covers             TEXT,
          when_label         TEXT,
          source_message_id  TEXT,
          stale              INTEGER NOT NULL DEFAULT 0,
          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_message (
          id          TEXT PRIMARY KEY,
          role        TEXT NOT NULL CHECK (role IN ('user','malkong')),
          content     TEXT NOT NULL,
          meta_json   TEXT,
          created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_chat_created ON chat_message(created_at);
      `);
      return db;
    })();
  }
  return opening;
}

export async function readBabyRow(): Promise<Baby | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Baby>(
    'SELECT id, name, birth_date AS birthDate, created_at AS createdAt FROM baby LIMIT 1',
  );
  return row ?? null;
}

export async function writeBabyRow(baby: Baby): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO baby (id, name, birth_date, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, birth_date = excluded.birth_date`,
    baby.id,
    baby.name,
    baby.birthDate,
    baby.createdAt,
  );
}

/** 설정 한 칸 읽기 — 광고 제거 구매 여부·브리핑 시각처럼 작은 값들이 여기 들어간다 */
export async function readSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

type RecordRow = {
  id: string;
  kind: BabyRecord['kind'];
  label: string;
  covers: string | null;
  when_label: string | null;
  source_message_id: string | null;
  stale: number;
  created_at: string;
};

/** 기록 전체 — 오래된 것부터. 한 아기의 기록은 많지 않아서 한 번에 읽는다 */
export async function readRecordRows(): Promise<BabyRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT id, kind, label, covers, when_label, source_message_id, stale, created_at
     FROM record ORDER BY created_at`,
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    covers: row.covers ? (JSON.parse(row.covers) as string[]) : [],
    whenLabel: row.when_label,
    sourceMessageId: row.source_message_id,
    stale: row.stale === 1,
    createdAt: row.created_at,
  }));
}

export async function insertRecordRow(record: BabyRecord): Promise<void> {
  const db = await getDb();
  // 아기는 당분간 한 명이다 — 그 아기의 기록으로 넣는다
  await db.runAsync(
    `INSERT INTO record (id, baby_id, kind, label, covers, when_label, source_message_id, created_at, updated_at)
     VALUES (?, (SELECT id FROM baby LIMIT 1), ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.kind,
    record.label,
    JSON.stringify(record.covers),
    record.whenLabel,
    record.sourceMessageId,
    record.createdAt,
    record.createdAt,
  );
}

export async function deleteRecordRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM record WHERE id = ?', id);
}

type ChatRow = {
  id: string;
  role: ChatMessage['role'];
  content: string;
  meta_json: string | null;
  created_at: string;
};

/** 대화 전체 — 오래된 것부터. 길어지면 날짜 단위로 나눠 읽는다(검색·보관함 task) */
export async function readChatRows(): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ChatRow>(
    'SELECT id, role, content, meta_json, created_at FROM chat_message ORDER BY created_at, rowid',
  );
  return rows.map(
    (row) =>
      ({
        id: row.id,
        role: row.role,
        content: row.content,
        meta: row.meta_json ? JSON.parse(row.meta_json) : {},
        createdAt: row.created_at,
      }) as ChatMessage,
  );
}

export async function insertChatRow(message: ChatMessage): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO chat_message (id, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    message.id,
    message.role,
    message.content,
    JSON.stringify(message.meta),
    message.createdAt,
  );
}

/** 기록 문구 고치기 — 고친 시각을 남긴다(SPEC-MY-02 정정) */
export async function updateRecordLabelRow(id: string, label: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE record SET label = ?, stale = 0, updated_at = ? WHERE id = ?',
    label,
    new Date().toISOString(),
    id,
  );
}

/** 말풍선의 곁 정보 고치기 — 피드백을 남겼다는 표시처럼 원문은 그대로 두고 meta 만 바꾼다 */
export async function updateChatMetaRow(id: string, meta: ChatMessage['meta']): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE chat_message SET meta_json = ? WHERE id = ?', JSON.stringify(meta), id);
}
