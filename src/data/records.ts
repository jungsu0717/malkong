/**
 * L2 — 우리 아기 기록과 요약.
 *
 * 저장 위치는 기기 안이다(knowledge-layers 저장 규칙). 스키마 정본은 docs/architecture/backend.md 의
 * 기기 DB 절의 record 테이블이다.
 */

import { deleteRecordRow, insertRecordRow, readRecordRows } from './db';

export type RecordKind = '기록' | '요약';

export type BabyRecord = {
  id: string;
  kind: RecordKind;
  label: string;
  /** 이 기록이 완료 처리하는 L1 항목 id — 하나의 기록이 여러 항목을 닫을 수 있다 */
  covers: string[];
  /** "D+98에 알림" 같은 시점 표기 */
  whenLabel: string | null;
  createdAt: string;
};

export async function loadRecords(): Promise<BabyRecord[]> {
  return readRecordRows();
}

export async function addRecord(
  input: Pick<BabyRecord, 'kind' | 'label' | 'covers' | 'whenLabel'>,
): Promise<BabyRecord> {
  const record: BabyRecord = {
    ...input,
    id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await insertRecordRow(record);
  return record;
}

export async function removeRecord(id: string): Promise<void> {
  await deleteRecordRow(id);
}
