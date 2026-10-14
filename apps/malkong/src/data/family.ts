/**
 * 가족 공유 — 폰 쪽 상태와 맞추기 (SPEC-MY-05, task my/007, api-contract /v1/family).
 *
 * 가족은 기기 키로 묶인다(로그인 없음). 폰은 가족 정보 · 마지막으로 받은 번호(seq) · 마지막으로 올린 때(pushedAt) ·
 * 지운 기록 표시(tombstone)를 설정 칸에 둔다. 맞추기는 한 번의 요청이다 — 올린 때 뒤에 고친 기록과 지운 표시, 고친 아기를
 * 싣고, 번호 뒤에 바뀐 것을 받아 폰에 적용한다. 규칙은 「늦게 고친 쪽이 이긴다」(updatedAt 비교).
 * 처음 맞출 때(들어간 직후)는 아기를 싣지 않는다 — 가족의 아기가 이긴다. 가족에 아기가 없을 때만 내 아기를 올린다.
 */

import {
  createFamily,
  getFamily,
  joinFamily,
  leaveFamily,
  syncFamily,
  type FamilyInfo,
  type SyncEvent,
  type SyncRecord,
} from './api';
import { loadBaby, replaceBaby } from './baby';
import { readSetting, writeSetting } from './db';
import { loadEvents, removeEvent, upsertEvents, type CareEvent } from './events';
import { loadRecords, removeRecord, upsertRecords, type BabyRecord } from './records';

const INFO_KEY = 'family.info';
const SEQ_KEY = 'family.seq';
const PUSHED_KEY = 'family.pushedAt';
/** 빠른 기록을 마지막으로 올린 때 — 옛 서버는 events 를 버리므로, 받아 준 서버에서만 넘긴다 */
const EVENTS_PUSHED_KEY = 'family.eventsPushedAt';
const SYNCED_KEY = 'family.syncedAt';
const TOMBSTONES_KEY = 'family.tombstones';
const CONSENT_KEY = 'family.consentedAt';
/** 지운 표시는 올린 뒤 지우지만, 혹시 남아도 이만큼만 */
const MAX_TOMBSTONES = 300;

export type FamilyState = {
  info: FamilyInfo;
  /** 마지막으로 받은 번호 — 그 뒤에 바뀐 것만 받는다 */
  seq: number;
  /** 마지막으로 올린 때(ISO). 처음이면 null — 들어간 직후 */
  pushedAt: string | null;
  /** 마지막으로 맞춘 때(ISO) — 화면 표시용 */
  syncedAt: string | null;
};

type Tombstone = { id: string; deletedAt: string };

/** 빠른 기록의 id 는 `ev-` 로 시작한다(events.ts newEventId) — 지운 표시를 기록과 가른다 */
const isEventId = (id: string) => id.startsWith('ev-');

export async function loadFamilyState(): Promise<FamilyState | null> {
  const raw = await readSetting(INFO_KEY);
  if (!raw) return null;
  try {
    const info = JSON.parse(raw) as FamilyInfo;
    if (!info.familyId || !info.inviteCode) return null;
    return {
      info,
      seq: Number(await readSetting(SEQ_KEY)) || 0,
      pushedAt: (await readSetting(PUSHED_KEY)) || null,
      syncedAt: (await readSetting(SYNCED_KEY)) || null,
    };
  } catch {
    return null;
  }
}

async function saveState(state: FamilyState): Promise<void> {
  await writeSetting(INFO_KEY, JSON.stringify(state.info));
  await writeSetting(SEQ_KEY, String(state.seq));
  await writeSetting(PUSHED_KEY, state.pushedAt ?? '');
  await writeSetting(SYNCED_KEY, state.syncedAt ?? '');
}

async function clearState(): Promise<void> {
  await writeSetting(INFO_KEY, '');
  await writeSetting(SEQ_KEY, '');
  await writeSetting(PUSHED_KEY, '');
  await writeSetting(EVENTS_PUSHED_KEY, '');
  await writeSetting(SYNCED_KEY, '');
  await writeSetting(TOMBSTONES_KEY, '');
}

async function loadTombstones(): Promise<Tombstone[]> {
  try {
    const raw = await readSetting(TOMBSTONES_KEY);
    return raw ? (JSON.parse(raw) as Tombstone[]) : [];
  } catch {
    return [];
  }
}

async function saveTombstones(list: Tombstone[]): Promise<void> {
  await writeSetting(TOMBSTONES_KEY, JSON.stringify(list.slice(-MAX_TOMBSTONES)));
}

/** 기록을 지울 때 부른다 — 가족에게도 지워지게 표시를 남긴다. 가족이 없으면 아무것도 안 한다 */
export async function noteDeleted(id: string): Promise<void> {
  if (!(await readSetting(INFO_KEY))) return;
  const list = await loadTombstones();
  await saveTombstones([...list.filter((t) => t.id !== id), { id, deletedAt: new Date().toISOString() }]);
}

export async function consentedAt(): Promise<string | null> {
  return (await readSetting(CONSENT_KEY)) || null;
}

/** 가족 만들기 — 동의한 때를 서버에도 보낸다 */
export async function startFamily(): Promise<FamilyState> {
  const at = new Date().toISOString();
  const info = await createFamily(at);
  await writeSetting(CONSENT_KEY, at);
  const state: FamilyState = { info, seq: 0, pushedAt: null, syncedAt: null };
  await saveState(state);
  return state;
}

/** 초대 코드로 들어가기 */
export async function enterFamily(code: string): Promise<FamilyState> {
  const at = new Date().toISOString();
  const info = await joinFamily(code.trim().toUpperCase(), at);
  await writeSetting(CONSENT_KEY, at);
  const state: FamilyState = { info, seq: 0, pushedAt: null, syncedAt: null };
  await saveState(state);
  return state;
}

/** 가족에서 나가기 — 폰의 아기와 기록은 그대로 둔다 */
export async function quitFamily(): Promise<void> {
  await leaveFamily();
  await clearState();
}

/** 서버가 가족을 모른다고 하면(마지막 사람이 나가 지워졌거나 기기 키가 바뀜) 폰 쪽도 정리한다 */
export async function forgetFamily(): Promise<void> {
  await clearState();
}

/** 서버가 아는 내 가족 — 폰이 잊었을 때(앱을 다시 깔았을 때) 되찾는 용도 */
export async function recoverFamily(): Promise<FamilyState | null> {
  try {
    const info = await getFamily();
    const state: FamilyState = { info, seq: 0, pushedAt: null, syncedAt: null };
    await saveState(state);
    return state;
  } catch {
    return null;
  }
}

export type SyncOutcome = { state: FamilyState; changed: boolean };

function eventTombstone(t: Tombstone): SyncEvent {
  return {
    id: t.id,
    kind: 'diaper',
    startAt: t.deletedAt,
    endAt: null,
    amount: null,
    side: null,
    diaper: null,
    color: null,
    note: null,
    createdAt: t.deletedAt,
    updatedAt: t.deletedAt,
    deleted: true,
  };
}

function tombstoneOf(record: BabyRecord | Tombstone, deleted: boolean): SyncRecord {
  if (!deleted) return { ...(record as BabyRecord), deleted: false };
  const t = record as Tombstone;
  return {
    id: t.id,
    kind: '기록',
    label: '',
    covers: [],
    whenLabel: null,
    sourceMessageId: null,
    stale: false,
    createdAt: t.deletedAt,
    updatedAt: t.deletedAt,
    deleted: true,
  };
}

/**
 * 한 번 맞춘다. 올린 때 뒤에 바뀐 것을 싣고, 번호 뒤에 바뀐 것을 받아 폰에 적용한다.
 * 돌려주는 값의 changed 가 true 면 화면이 기록 · 아기를 다시 읽어야 한다.
 */
export async function syncOnce(state: FamilyState): Promise<SyncOutcome> {
  const now = new Date().toISOString();
  const pushedAt = state.pushedAt ?? '';
  const [records, events, baby, tombstones] = await Promise.all([loadRecords(), loadEvents(), loadBaby(), loadTombstones()]);

  // 빠른 기록은 따로 센 때부터 — 들어간 직후(null)면 전부
  const eventsPushedAt = state.pushedAt === null ? '' : ((await readSetting(EVENTS_PUSHED_KEY)) ?? '');
  const dirty = records.filter((r) => r.updatedAt > pushedAt).map((r) => tombstoneOf(r, false));
  const deleted = tombstones.filter((t) => !isEventId(t.id) && t.deletedAt > pushedAt).map((t) => tombstoneOf(t, true));
  // 빠른 기록(SPEC-LOG-07) — 고친 것과 지운 표시
  const dirtyEvents: SyncEvent[] = [
    ...events.filter((e) => e.updatedAt > eventsPushedAt).map((e) => ({ ...e, deleted: false })),
    ...tombstones.filter((t) => isEventId(t.id) && t.deletedAt > eventsPushedAt).map(eventTombstone),
  ];
  const first = state.pushedAt === null;
  const pushBaby = baby && !first && baby.updatedAt > pushedAt;

  let res = await syncFamily({
    since: state.seq,
    records: [...dirty, ...deleted],
    events: dirtyEvents,
    ...(pushBaby ? { baby } : {}),
  });
  const incoming = [...res.records];
  const incomingEvents = [...(res.events ?? [])];
  // 들어간 직후 — 가족에 아기가 없을 때만 내 아기를 올린다
  if (first && res.baby === null && baby) {
    res = await syncFamily({ since: res.seq, records: [], baby });
    incoming.push(...res.records);
    incomingEvents.push(...(res.events ?? []));
  }

  let changed = false;
  const byTombstone = new Map(tombstones.map((t) => [t.id, t.deletedAt]));
  const local = new Map(records.map((r) => [r.id, r]));
  const toUpsert: BabyRecord[] = [];
  for (const r of incoming) {
    const deletedHere = byTombstone.get(r.id);
    if (deletedHere && deletedHere >= r.updatedAt) continue;
    const mine = local.get(r.id);
    if (mine && mine.updatedAt >= r.updatedAt) continue;
    if (r.deleted) {
      if (mine) {
        await removeRecord(r.id);
        changed = true;
      }
      continue;
    }
    const { deleted: _deleted, ...record } = r;
    toUpsert.push(record);
  }
  if (toUpsert.length > 0) {
    await upsertRecords(toUpsert);
    changed = true;
  }

  // 빠른 기록도 같은 규칙 — 늦게 고친 쪽이 이기고, 여기서 지운 것은 되살리지 않는다
  const localEvents = new Map(events.map((e) => [e.id, e]));
  const eventsToUpsert: CareEvent[] = [];
  for (const e of incomingEvents) {
    const deletedHere = byTombstone.get(e.id);
    if (deletedHere && deletedHere >= e.updatedAt) continue;
    const mine = localEvents.get(e.id);
    if (mine && mine.updatedAt >= e.updatedAt) continue;
    if (e.deleted) {
      if (mine) {
        await removeEvent(e.id);
        changed = true;
      }
      continue;
    }
    const { deleted: _deleted, ...event } = e;
    eventsToUpsert.push(event);
  }
  if (eventsToUpsert.length > 0) {
    await upsertEvents(eventsToUpsert);
    changed = true;
  }
  if (res.baby && (first || !baby || res.baby.updatedAt > baby.updatedAt)) {
    const same =
      baby &&
      baby.id === res.baby.id &&
      baby.name === res.baby.name &&
      baby.birthDate === res.baby.birthDate &&
      baby.updatedAt === res.baby.updatedAt;
    if (!same) {
      await replaceBaby(res.baby);
      changed = true;
    }
  }

  // 올린 표시는 치운다 — 올린 때 이후 것만 남긴다
  // 서버가 빠른 기록을 받아 줬는지 — 옛 서버는 events 칸이 없다. 못 받았으면 빠른 기록의 올린 때와 지운 표시를 남겨 둔다
  const eventsAccepted = res.events !== undefined;
  if (eventsAccepted) await writeSetting(EVENTS_PUSHED_KEY, now);
  await saveTombstones(tombstones.filter((t) => t.deletedAt > now || (!eventsAccepted && isEventId(t.id))));
  const next: FamilyState = {
    info: { ...state.info, members: res.members },
    seq: res.seq,
    pushedAt: now,
    syncedAt: now,
  };
  await saveState(next);
  return { state: next, changed };
}
