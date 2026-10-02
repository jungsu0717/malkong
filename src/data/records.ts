/**
 * L2 — 우리 아기 기록과 요약. **증류된 쪽**이다.
 *
 * 아래층에 대화 원문(`chat_message`)이 있고, 이 기록은 거기서 뽑아낸 것이다 — `sourceMessageId` 가
 * 그 연결이다. 원문을 남겨 두는 이유는 요약이 틀렸거나 낡았을 때 **원문으로 돌아가 다시 증류**하기
 * 위해서다. 요약만 남기면 고칠 길이 없다.
 *
 * 저장 위치는 기기 안이다(knowledge-layers 저장 규칙). 스키마 정본은 docs/architecture/backend.md 의
 * 기기 DB 절의 record 테이블이다.
 */

import { deleteRecordRow, insertRecordRow, readRecordRows, updateRecordLabelRow } from './db';

export type RecordKind = '기록' | '요약';

export type BabyRecord = {
  id: string;
  kind: RecordKind;
  label: string;
  /** 이 기록이 완료 처리하는 L1 항목 id — 하나의 기록이 여러 항목을 닫을 수 있다 */
  covers: string[];
  /** "D+98에 알림" 같은 시점 표기 */
  whenLabel: string | null;
  /** 이 기록이 나온 대화 — 다시 증류하거나 되짚을 때의 실마리 */
  sourceMessageId: string | null;
  /** 요약이 낡았다고 보는 표시. 그대로 단정하지 않고 재확인한다 */
  stale: boolean;
  createdAt: string;
};

export async function loadRecords(): Promise<BabyRecord[]> {
  return readRecordRows();
}

export async function addRecord(
  input: Pick<BabyRecord, 'kind' | 'label' | 'covers' | 'whenLabel'> &
    Partial<Pick<BabyRecord, 'sourceMessageId'>>,
): Promise<BabyRecord> {
  const record: BabyRecord = {
    sourceMessageId: null,
    ...input,
    id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    stale: false,
    createdAt: new Date().toISOString(),
  };
  await insertRecordRow(record);
  return record;
}

export async function removeRecord(id: string): Promise<void> {
  await deleteRecordRow(id);
}

/** 문구를 고친다. 고친 기록은 사용자가 확인한 것이라 낡음 표시를 지운다 */
export async function updateRecordLabel(id: string, label: string): Promise<void> {
  await updateRecordLabelRow(id, label);
}
