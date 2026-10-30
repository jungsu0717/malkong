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
import type { CareEvent } from './events';
import type { BabyRecord } from './records';
import { repeatFromText, repeatToText } from './repeat';
import { routineKindOf, type Routine, type RoutineLog } from './routine';
import type { Memo } from './stage';
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
          done_by     TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_todo_topic ON todo(topic_id);
        CREATE TABLE IF NOT EXISTS routine (
          id             TEXT PRIMARY KEY,
          title          TEXT NOT NULL,
          kind           TEXT NOT NULL,
          every_days     INTEGER NOT NULL DEFAULT 1,
          time           TEXT,
          goal_minutes   INTEGER,
          hidden         INTEGER NOT NULL DEFAULT 0,
          sort           INTEGER NOT NULL DEFAULT 0,
          running_since  TEXT,
          items          TEXT,
          weekdays       TEXT,
          created_at     TEXT NOT NULL,
          updated_at     TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS routine_log (
          id          TEXT PRIMARY KEY,
          routine_id  TEXT NOT NULL,
          at          TEXT NOT NULL,
          minutes     INTEGER,
          by          TEXT,
          step        INTEGER,
          skip        INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_routine_log ON routine_log(routine_id, at);
        CREATE TABLE IF NOT EXISTS memo (
          id          TEXT PRIMARY KEY,
          at          TEXT NOT NULL,
          text        TEXT NOT NULL,
          ref         TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
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
          by          TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_event_start ON care_event(start_at);
      `);
      // 빠른 기록의 변 색(task log/002) · 누가 남겼는지(task log/003) — 그 전에 만든 기록 표에는 없다
      const eventColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(care_event)');
      for (const col of ['color', 'by']) {
        if (!eventColumns.some((c) => c.name === col)) await db.execAsync(`ALTER TABLE care_event ADD COLUMN ${col} TEXT`);
      }
      // 메모의 발달 체크 열쇠(task growth/005) — 처음 만든 memo 표에는 없다
      const memoColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memo)');
      if (!memoColumns.some((col) => col.name === 'ref')) {
        await db.execAsync('ALTER TABLE memo ADD COLUMN ref TEXT');
      }
      // 나중에 더한 칸 — 아기의 고친 때(가족 공유의 「늦게 고친 쪽이 이긴다」 기준, task my/007)
      const babyColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(baby)');
      if (!babyColumns.some((col) => col.name === 'updated_at')) {
        await db.execAsync('ALTER TABLE baby ADD COLUMN updated_at TEXT');
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
      for (const col of ['ordered_at', 'arrive_at', 'store', 'done_by']) {
        if (!todoColumns.some((c) => c.name === col)) await db.execAsync(`ALTER TABLE todo ADD COLUMN ${col} TEXT`);
      }
      // 누가 했는지(task my/009) — 루틴 기록
      const logColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(routine_log)');
      if (!logColumns.some((col) => col.name === 'by')) {
        await db.execAsync('ALTER TABLE routine_log ADD COLUMN by TEXT');
      }
      // 단계 · 확인할 물건과 단계 기록(task today/003)
      if (!logColumns.some((col) => col.name === 'step')) {
        await db.execAsync('ALTER TABLE routine_log ADD COLUMN step INTEGER');
      }
      const routineColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(routine)');
      if (!routineColumns.some((col) => col.name === 'items')) {
        await db.execAsync('ALTER TABLE routine ADD COLUMN items TEXT');
      }
      // 요일 반복 · 건너뛰기(task common/022)
      if (!routineColumns.some((col) => col.name === 'weekdays')) {
        await db.execAsync('ALTER TABLE routine ADD COLUMN weekdays TEXT');
      }
      if (!logColumns.some((col) => col.name === 'skip')) {
        await db.execAsync('ALTER TABLE routine_log ADD COLUMN skip INTEGER NOT NULL DEFAULT 0');
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

// 예전 대화 · 알림함 표(chat_message · inbox_card)는 2026-10-19 에 쓰지 않게 됐다(decisions/030).
// 이미 있는 폰의 표와 내용은 지우지 않는다(헌장 2).

// --- 빠른 기록 (SPEC-LOG-01, decisions/023 · 036) ---

export async function readEventRows(): Promise<CareEvent[]> {
  const db = await getDb();
  return db.getAllAsync<CareEvent>(
    `SELECT id, kind, start_at AS startAt, end_at AS endAt, amount, side, diaper, color, note, by,
            created_at AS createdAt, updated_at AS updatedAt
       FROM care_event ORDER BY start_at`,
  );
}

/** 넣거나 덮어쓴다 — 고치기 · 가족에게서 받은 기록 모두 */
export async function upsertEventRow(e: CareEvent): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO care_event (id, kind, start_at, end_at, amount, side, diaper, color, note, by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, start_at = excluded.start_at, end_at = excluded.end_at,
       amount = excluded.amount, side = excluded.side, diaper = excluded.diaper, color = excluded.color,
       note = excluded.note, by = excluded.by, updated_at = excluded.updated_at`,
    e.id,
    e.kind,
    e.startAt,
    e.endAt,
    e.amount,
    e.side,
    e.diaper,
    e.color ?? null,
    e.note,
    e.by ?? null,
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
            repeat, ref, ordered_at AS orderedAt, arrive_at AS arriveAt, store, done_by AS doneBy,
            created_at AS createdAt, updated_at AS updatedAt
       FROM todo ORDER BY created_at`,
  );
  return rows.map((r) => ({ ...r, hasTime: r.hasTime === 1, buy: r.buy === 1, repeat: repeatFromText(r.repeat) }));
}

export async function upsertTodoRow(t: Todo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO todo (id, topic_id, title, note, due_at, has_time, buy, source, done_at, repeat, ref, ordered_at, arrive_at, store,
       done_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET topic_id = excluded.topic_id, title = excluded.title, note = excluded.note,
       due_at = excluded.due_at, has_time = excluded.has_time, buy = excluded.buy, source = excluded.source,
       done_at = excluded.done_at, repeat = excluded.repeat, ref = excluded.ref, ordered_at = excluded.ordered_at,
       arrive_at = excluded.arrive_at, store = excluded.store, done_by = excluded.done_by, updated_at = excluded.updated_at`,
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
    t.doneBy,
    t.createdAt,
    t.updatedAt,
  );
}

export async function deleteTodoRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM todo WHERE id = ?', id);
}

// --- 루틴 (SPEC-MAIN-01~07, task today/001 · 003) ---

type RoutineRow = Omit<Routine, 'kind' | 'hidden' | 'items' | 'weekdays'> & { kind: string; hidden: number; items: string | null; weekdays: string | null };

/** 요일 반복은 JSON 숫자 배열 — 깨졌으면 없는 것으로 */
function parseWeekdays(text: string | null): number[] | null {
  if (!text) return null;
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 6) : null;
  } catch {
    return null;
  }
}

/** 단계 · 확인할 물건은 JSON 글 — 깨졌으면 없는 것으로 */
function parseItems(text: string | null): string[] | null {
  if (!text) return null;
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

export async function readRoutineRows(): Promise<Routine[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoutineRow>(
    `SELECT id, title, kind, every_days AS everyDays, time, hidden, sort, items, weekdays, created_at AS createdAt, updated_at AS updatedAt
       FROM routine ORDER BY sort`,
  );
  // 옛 타이머 루틴은 체크로 읽는다(task today/006) — goal_minutes · running_since 칸은 더 쓰지 않는다
  return rows.map((r) => ({
    ...r,
    kind: routineKindOf(r.kind),
    hidden: r.hidden === 1,
    items: parseItems(r.items),
    weekdays: parseWeekdays(r.weekdays),
  }));
}

export async function upsertRoutineRow(r: Routine): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO routine (id, title, kind, every_days, time, goal_minutes, hidden, sort, running_since, items, weekdays, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, kind = excluded.kind, every_days = excluded.every_days, time = excluded.time,
       goal_minutes = NULL, hidden = excluded.hidden, sort = excluded.sort, running_since = NULL,
       items = excluded.items, weekdays = excluded.weekdays, updated_at = excluded.updated_at`,
    r.id,
    r.title,
    r.kind,
    r.everyDays,
    r.time,
    r.hidden ? 1 : 0,
    r.sort,
    r.items && r.items.length > 0 ? JSON.stringify(r.items) : null,
    r.weekdays && r.weekdays.length > 0 ? JSON.stringify(r.weekdays) : null,
    r.createdAt,
    r.updatedAt,
  );
}

/** 최근 `days` 일 기록 — N일마다 루틴의 지난번을 보려고 넉넉히 */
export async function readRoutineLogRows(days = 400): Promise<RoutineLog[]> {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await db.getAllAsync<Omit<RoutineLog, 'skip'> & { skip: number }>(
    `SELECT id, routine_id AS routineId, at, by, step, skip, created_at AS createdAt FROM routine_log WHERE at >= ? ORDER BY at`,
    since,
  );
  return rows.map((l) => ({ ...l, skip: l.skip === 1 }));
}

export async function insertRoutineLogRow(l: RoutineLog): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO routine_log (id, routine_id, at, by, step, skip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    l.id,
    l.routineId,
    l.at,
    l.by,
    l.step,
    l.skip ? 1 : 0,
    l.createdAt,
  );
}

export async function deleteRoutineLogRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM routine_log WHERE id = ?', id);
}

/** 우리 아기 메모(SPEC-STAGE-03, task growth/004) — 최근 것이 위로 */
export async function readMemoRows(): Promise<Memo[]> {
  const db = await getDb();
  return db.getAllAsync<Memo>('SELECT id, at, text, ref, created_at AS createdAt, updated_at AS updatedAt FROM memo ORDER BY at DESC');
}

export async function upsertMemoRow(m: Memo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO memo (id, at, text, ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET at = excluded.at, text = excluded.text, ref = excluded.ref, updated_at = excluded.updated_at`,
    m.id,
    m.at,
    m.text,
    m.ref,
    m.createdAt,
    m.updatedAt,
  );
}

export async function deleteMemoRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM memo WHERE id = ?', id);
}
