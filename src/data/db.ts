/**
 * 기기 저장소 — expo-sqlite (iOS · Android).
 *
 * 스키마 정본은 docs/architecture/backend.md 의 「기기 DB 스키마」 절이다. 여기서는 그 중
 * 지금 쓰는 테이블만 만든다 — record · chat_message · inbox_card 는 각 기능 task 에서 추가한다.
 *
 * 웹은 expo-sqlite 의 웹 지원이 알파(Metro WASM 설정·특수 헤더 필요)라 미리보기가 깨지므로,
 * 같은 함수를 localStorage 로 구현한 db.web.ts 가 대신 쓰인다.
 */

import * as SQLite from 'expo-sqlite';

import type { Baby } from './baby';

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
