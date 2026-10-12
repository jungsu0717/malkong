/**
 * 지식(L1) 내려받기 — 스토어 심사 없이 지식만 새로 받는다
 * (l1-knowledge-base 「저장 위치와 로더」, api-contract /v1/knowledge, task common/019).
 *
 * 앱을 열면 ① 기기에 저장해 둔 판을 먼저 얹고(번들보다 새 것일 때만) ② 하루에 한 번 서버의 판 번호를 물어,
 * 더 새 판이 있으면 승인된 항목 전부를 받아 저장하고 얹는다. 서버에 닿지 못하면 조용히 넘어간다 — 번들이 있다.
 * 받은 것은 번들과 같은 규칙으로 검사하고 승인된 항목만 쓴다(`applyBundle`).
 * 받은 판은 다음에 그리는 화면부터 쓰인다 — 보고 있던 화면을 억지로 다시 그리지 않는다.
 */

import { getKnowledgeBundle, getKnowledgeVersion } from './api';
import { readSetting, writeSetting } from './db';
import {
  applyBundle,
  compareVersion,
  isKnowledgeItems,
  isValidVersion,
  l1Version,
  type KnowledgeItem,
} from './l1';

const BUNDLE_SETTING = 'l1.bundle';
const CHECKED_SETTING = 'l1.checkedAt';
/** 서버에 판 번호를 묻는 간격 — 지식은 분기에 한 번쯤 바뀐다 */
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

type StoredBundle = { version: string; items: KnowledgeItem[] };

function parseStored(raw: string | null): StoredBundle | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { version?: unknown; items?: unknown };
    if (isValidVersion(value.version) && isKnowledgeItems(value.items)) {
      return { version: value.version, items: value.items };
    }
  } catch {
    // 깨진 저장값은 없는 것으로 본다
  }
  return null;
}

/** 기기에 저장해 둔 판을 얹는다 — 첫 화면을 그리기 전에 한 번 */
export async function loadStoredKnowledge(): Promise<void> {
  try {
    const stored = parseStored(await readSetting(BUNDLE_SETTING));
    if (stored) applyBundle(stored.version, stored.items);
  } catch {
    // 저장소를 못 읽어도 번들로 간다
  }
}

let inFlight: Promise<boolean> | null = null;

/**
 * 서버에 더 새 판이 있으면 받아 둔다. 하루에 한 번만 묻고, 서버에 닿지 못하면 다음에 다시 묻는다.
 * 돌려주는 값은 새 판을 받아 얹었는지.
 */
export function refreshKnowledge(now = Date.now()): Promise<boolean> {
  if (!inFlight) {
    inFlight = refresh(now).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function refresh(now: number): Promise<boolean> {
  try {
    const last = Number(await readSetting(CHECKED_SETTING)) || 0;
    if (now - last < CHECK_EVERY_MS) return false;
    const { version } = await getKnowledgeVersion();
    // 물어보는 데 성공했을 때만 날짜를 적는다 — 못 닿았으면 다음 실행 때 다시
    await writeSetting(CHECKED_SETTING, String(now));
    if (!isValidVersion(version) || compareVersion(version, l1Version()) <= 0) return false;

    const bundle = await getKnowledgeBundle();
    if (!isValidVersion(bundle.version) || !isKnowledgeItems(bundle.items)) return false;
    if (!applyBundle(bundle.version, bundle.items)) return false;
    await writeSetting(BUNDLE_SETTING, JSON.stringify({ version: bundle.version, items: bundle.items }));
    return true;
  } catch {
    return false;
  }
}
