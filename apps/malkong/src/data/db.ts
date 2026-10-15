/**
 * 기기 저장소 — expo-sqlite (iOS · Android).
 *
 * 스키마 정본은 docs/architecture/backend.md 의 「기기 DB 스키마」 절이다.
 *
 * 웹은 expo-sqlite 의 웹 지원이 알파(Metro WASM 설정·특수 헤더 필요)라 미리보기가 깨지므로,
 * 같은 함수를 localStorage 로 구현한 db.web.ts 가 대신 쓰인다.
 */

import * as SQLite from 'expo-sqlite';

import type { Baby } from './baby';
import type { ChatMessage } from './chat';
import type { CareEvent } from './events';
import type { InboxCard } from './inbox';
import type { BabyRecord } from './records';
import { repeatFromText, repeatToText } from './repeat';
import type { Todo, Topic } from './todos';

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
        CREATE TABLE IF NOT EXISTS inbox_card (
          id            TEXT PRIMARY KEY,
          kind          TEXT NOT NULL,
          payload_json  TEXT NOT NULL,
          read_at       TEXT,
          created_at    TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_inbox_created ON inbox_card(created_at);
        CREATE TABLE IF NOT EXISTS care_event (
          id          TEXT PRIMARY KEY,
          kind        TEXT NOT NULL,
          start_at    TEXT NOT NULL,
          end_at      TEXT,
          amount      REAL,
          side        TEXT,
          diaper      TEXT,
          color       TEXT,
          note        TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_event_start ON care_event(start_at);
        CREATE TABLE IF NOT EXISTS topic (
          id          TEXT PRIMARY KEY,
          kind        TEXT NOT NULL,
          title       TEXT NOT NULL,
          hidden      INTEGER NOT NULL DEFAULT 0,
          sort        INTEGER NOT NULL DEFAULT 0,
          icon        TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS todo (
          id          TEXT PRIMARY KEY,
          topic_id    TEXT NOT NULL,
          title       TEXT NOT NULL,
          note        TEXT,
          due_at      TEXT,
          has_time    INTEGER NOT NULL DEFAULT 0,
          buy         INTEGER NOT NULL DEFAULT 0,
          source      TEXT NOT NULL,
          done_at     TEXT,
          repeat      TEXT,
          ref         TEXT,
          ordered_at  TEXT,
          arrive_at   TEXT,
          store       TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_todo_topic ON todo(topic_id);
      `);
      // 나중에 더한 칸 — 아기의 고친 때(가족 공유의 「늦게 고친 쪽이 이긴다」 기준, task my/007)
      const babyColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(baby)');
      if (!babyColumns.some((col) => col.name === 'updated_at')) {
        await db.execAsync('ALTER TABLE baby ADD COLUMN updated_at TEXT');
      }
      // 변 색(task log/002) — 그 전에 만든 기록 표에는 없다
      const eventColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(care_event)');
      if (!eventColumns.some((col) => col.name === 'color')) {
        await db.execAsync('ALTER TABLE care_event ADD COLUMN color TEXT');
      }
      // 반복 규칙(task topic/002) — 그 전에 만든 할 일 표에는 없다
      const todoColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(todo)');
      if (!todoColumns.some((col) => col.name === 'repeat')) {
        await db.execAsync('ALTER TABLE todo ADD COLUMN repeat TEXT');
      }
      // 앱이 만든 할 일의 규칙 열쇠(task topic/003)
      if (!todoColumns.some((col) => col.name === 'ref')) {
        await db.execAsync('ALTER TABLE todo ADD COLUMN ref TEXT');
      }
      // 직접 만든 주제의 아이콘(task topic/005)
      const topicColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(topic)');
      if (!topicColumns.some((col) => col.name === 'icon')) {
        await db.execAsync('ALTER TABLE topic ADD COLUMN icon TEXT');
      }
      // 장보기 — 주문한 때 · 도착 예정일 · 어디서(task topic/004)
      for (const col of ['ordered_at', 'arrive_at', 'store']) {
        if (!todoColumns.some((c) => c.name === col)) await db.execAsync(`ALTER TABLE todo ADD COLUMN ${col} TEXT`);
      }
      return db;
    })();
  }
  return opening;
}

export async function readBabyRow(): Promise<Baby | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Omit<Baby, 'updatedAt'> & { updatedAt: string | null }>(
    'SELECT id, name, birth_date AS birthDate, created_at AS createdAt, updated_at AS updatedAt FROM baby LIMIT 1',
  );
  return row ? { ...row, updatedAt: row.updatedAt ?? row.createdAt } : null;
}

export async function writeBabyRow(baby: Baby): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO baby (id, name, birth_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, birth_date = excluded.birth_date, updated_at = excluded.updated_at`,
    baby.id,
    baby.name,
    baby.birthDate,
    baby.createdAt,
    baby.updatedAt,
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
  updated_at: string | null;
};

/** 기록 전체 — 오래된 것부터. 한 아기의 기록은 많지 않아서 한 번에 읽는다 */
export async function readRecordRows(): Promise<BabyRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT id, kind, label, covers, when_label, source_message_id, stale, created_at, updated_at
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
    updatedAt: row.updated_at ?? row.created_at,
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
    record.updatedAt,
  );
}

/** 가족에게서 받은 기록 — 있으면 통째로 덮고 없으면 넣는다 (task my/007) */
export async function upsertRecordRow(record: BabyRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO record (id, baby_id, kind, label, covers, when_label, source_message_id, stale, created_at, updated_at)
     VALUES (?, (SELECT id FROM baby LIMIT 1), ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, label = excluded.label, covers = excluded.covers,
       when_label = excluded.when_label, source_message_id = excluded.source_message_id, stale = excluded.stale,
       created_at = excluded.created_at, updated_at = excluded.updated_at`,
    record.id,
    record.kind,
    record.label,
    JSON.stringify(record.covers),
    record.whenLabel,
    record.sourceMessageId,
    record.stale ? 1 : 0,
    record.createdAt,
    record.updatedAt,
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

type InboxRow = { id: string; kind: InboxCard['kind']; payload_json: string; read_at: string | null; created_at: string };

/** 알림함 전체 — 오래된 것부터 (SPEC-HOME-07) */
export async function readInboxRows(): Promise<InboxCard[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<InboxRow>(
    'SELECT id, kind, payload_json, read_at, created_at FROM inbox_card ORDER BY created_at, rowid',
  );
  return rows.map((row) => ({
    ...(JSON.parse(row.payload_json) as Pick<InboxCard, 'title' | 'summary' | 'day'>),
    id: row.id,
    kind: row.kind,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

/** 같은 id 가 이미 있으면 그대로 둔다 — 읽은 표시가 지워지지 않게 */
export async function insertInboxRow(card: InboxCard): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO inbox_card (id, kind, payload_json, read_at, created_at) VALUES (?, ?, ?, ?, ?)',
    card.id,
    card.kind,
    JSON.stringify({ title: card.title, summary: card.summary, day: card.day }),
    card.readAt,
    card.createdAt,
  );
}

export async function markInboxReadRows(ids: string[], at: string): Promise<void> {
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync('UPDATE inbox_card SET read_at = ? WHERE id = ? AND read_at IS NULL', at, id);
  }
}

// --- 빠른 기록 (SPEC-LOG-01, decisions/023) ---

export async function readEventRows(): Promise<CareEvent[]> {
  const db = await getDb();
  return db.getAllAsync<CareEvent>(
    `SELECT id, kind, start_at AS startAt, end_at AS endAt, amount, side, diaper, color, note,
            created_at AS createdAt, updated_at AS updatedAt
       FROM care_event ORDER BY start_at`,
  );
}

/** 넣거나 덮어쓴다 — 고치기 · 가족에게서 받은 기록 모두 */
export async function upsertEventRow(e: CareEvent): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO care_event (id, kind, start_at, end_at, amount, side, diaper, color, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, start_at = excluded.start_at, end_at = excluded.end_at,
       amount = excluded.amount, side = excluded.side, diaper = excluded.diaper, color = excluded.color,
       note = excluded.note, updated_at = excluded.updated_at`,
    e.id,
    e.kind,
    e.startAt,
    e.endAt,
    e.amount,
    e.side,
    e.diaper,
    e.color ?? null,
    e.note,
    e.createdAt,
    e.updatedAt,
  );
}

export async function deleteEventRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM care_event WHERE id = ?', id);
}

// --- 주제별 할 일 (SPEC-TOPIC-01~03, decisions/024) ---

type TopicRow = Omit<Topic, 'hidden'> & { hidden: number };
type TodoRow = Omit<Todo, 'hasTime' | 'buy' | 'repeat'> & { hasTime: number; buy: number; repeat: string | null };

export async function readTopicRows(): Promise<Topic[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TopicRow>(
    `SELECT id, kind, title, hidden, sort, icon, created_at AS createdAt, updated_at AS updatedAt FROM topic ORDER BY sort`,
  );
  return rows.map((r) => ({ ...r, hidden: r.hidden === 1 }));
}

export async function upsertTopicRow(t: Topic): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO topic (id, kind, title, hidden, sort, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, title = excluded.title, hidden = excluded.hidden,
       sort = excluded.sort, icon = excluded.icon, updated_at = excluded.updated_at`,
    t.id,
    t.kind,
    t.title,
    t.hidden ? 1 : 0,
    t.sort,
    t.icon,
    t.createdAt,
    t.updatedAt,
  );
}

export async function readTodoRows(): Promise<Todo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TodoRow>(
    `SELECT id, topic_id AS topicId, title, note, due_at AS dueAt, has_time AS hasTime, buy, source, done_at AS doneAt,
            repeat, ref, ordered_at AS orderedAt, arrive_at AS arriveAt, store, created_at AS createdAt, updated_at AS updatedAt
       FROM todo ORDER BY created_at`,
  );
  return rows.map((r) => ({ ...r, hasTime: r.hasTime === 1, buy: r.buy === 1, repeat: repeatFromText(r.repeat) }));
}

export async function upsertTodoRow(t: Todo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO todo (id, topic_id, title, note, due_at, has_time, buy, source, done_at, repeat, ref, ordered_at, arrive_at, store,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET topic_id = excluded.topic_id, title = excluded.title, note = excluded.note,
       due_at = excluded.due_at, has_time = excluded.has_time, buy = excluded.buy, source = excluded.source,
       done_at = excluded.done_at, repeat = excluded.repeat, ref = excluded.ref, ordered_at = excluded.ordered_at,
       arrive_at = excluded.arrive_at, store = excluded.store, updated_at = excluded.updated_at`,
    t.id,
    t.topicId,
    t.title,
    t.note,
    t.dueAt,
    t.hasTime ? 1 : 0,
    t.buy ? 1 : 0,
    t.source,
    t.doneAt,
    repeatToText(t.repeat),
    t.ref,
    t.orderedAt,
    t.arriveAt,
    t.store,
    t.createdAt,
    t.updatedAt,
  );
}

export async function deleteTodoRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM todo WHERE id = ?', id);
}
