/**
 * 기기 저장소 — 웹 미리보기용 (localStorage).
 *
 * 실제 앱(iOS · Android)은 db.ts 의 sqlite 를 쓴다. expo-sqlite 의 웹 지원이 알파라서
 * 브라우저 검토가 깨지지 않도록 같은 함수만 맞춰 둔 가벼운 구현이다.
 * 시크릿 모드처럼 저장이 막힌 환경에서도 화면이 뜨도록 읽기·쓰기를 모두 감싼다.
 */

import type { Baby } from './baby';
import type { BabyRecord } from './records';
import type { Routine, RoutineLog } from './routine';
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

// 예전 대화 · 알림함 · 빠른 기록은 2026-10-19 에 쓰지 않게 됐다(decisions/030). 저장된 것은 지우지 않는다.

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
      doneBy: r.doneBy ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function upsertTodoRow(t: Todo): Promise<void> {
  upsertIn(TODOS_KEY, t);
}

export async function deleteTodoRow(id: string): Promise<void> {
  writeList(TODOS_KEY, readList<Todo>(TODOS_KEY).filter((r) => r.id !== id));
}

// --- 루틴 (SPEC-MAIN-01~04) ---

const ROUTINES_KEY = 'malkong.routines';
const ROUTINE_LOGS_KEY = 'malkong.routineLogs';

export async function readRoutineRows(): Promise<Routine[]> {
  return readList<Routine>(ROUTINES_KEY)
    .map((r) => ({ ...r, items: r.items ?? null }))
    .sort((a, b) => a.sort - b.sort);
}

export async function upsertRoutineRow(r: Routine): Promise<void> {
  upsertIn(ROUTINES_KEY, r);
}

export async function readRoutineLogRows(): Promise<RoutineLog[]> {
  return readList<RoutineLog>(ROUTINE_LOGS_KEY)
    .map((l) => ({ ...l, by: l.by ?? null, step: l.step ?? null }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export async function insertRoutineLogRow(l: RoutineLog): Promise<void> {
  upsertIn(ROUTINE_LOGS_KEY, l);
}

export async function deleteRoutineLogRow(id: string): Promise<void> {
  writeList(ROUTINE_LOGS_KEY, readList<RoutineLog>(ROUTINE_LOGS_KEY).filter((r) => r.id !== id));
}
