/**
 * 육아버디 서버와 이야기하는 자리 — 모양의 정본은 docs/architecture/api-contract.md 다.
 *
 * 서버 주소는 빌드 때 박히는 `EXPO_PUBLIC_API_URL` 이고, 없으면 배포된 Cloud Run 이다.
 * 로컬 서버로 시험할 때는 `.env.local` 에 `EXPO_PUBLIC_API_URL=http://localhost:8000` 을 둔다.
 */

import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import { readSetting, writeSetting } from './db';
import type { BabyRecord } from './records';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://malkong-server-481623022922.asia-northeast3.run.app';

const SHORT_TIMEOUT_MS = 15_000;

/** 하루 정밀 답변을 다 썼을 때 서버가 함께 주는 것(429 LIMIT_EXCEEDED) */
export type LimitInfo = { resetAt: string; rewardAvailable: boolean; ecoAvailable: boolean };

/** 서버가 준 오류(`{code, message}`) 또는 연결 실패(status 0, code NETWORK) */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** 429 LIMIT_EXCEEDED 일 때만 */
    readonly limit?: LimitInfo,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Entitlements = {
  ads: boolean;
  dailyLimit: number | null;
  /** 보상형 광고 1편이 채우는 정밀 답변 수 */
  rewardPerAd: number;
  rewardMaxPerDay: number;
  remaining: number | null;
  /** 이 키가 가족 명단에 있는지 — 일반 사용자로 보기 중에도 true. 옛 서버는 보내지 않는다 */
  operator?: boolean;
};

// --- 기기 키 (POST /v1/devices) — 처음 한 번 받아 기기 settings 에 둔다 ---

const DEVICE_KEY_SETTING = 'device_key';
let deviceKey: string | null = null;
let issuing: Promise<string> | null = null;

async function getDeviceKey(): Promise<string> {
  if (deviceKey) return deviceKey;
  const stored = await readSetting(DEVICE_KEY_SETTING);
  if (stored) return (deviceKey = stored);
  // 동시에 여러 요청이 와도 한 번만 받는다
  issuing ??= request<{ deviceKey: string }>('POST', '/v1/devices', undefined, SHORT_TIMEOUT_MS)
    .then(async ({ deviceKey: issued }) => {
      await writeSetting(DEVICE_KEY_SETTING, issued);
      return (deviceKey = issued);
    })
    .finally(() => {
      issuing = null;
    });
  return issuing;
}

/**
 * 보상형 광고의 서버 확인(SSV)에 실을 기기 이름 — 키의 SHA-256. 서버도 키를 해시로만 알아서 이것으로 기기를 찾는다.
 * 키 원문은 광고 회사로 보내지 않는다.
 */
export async function deviceKeyHash(): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, await getDeviceKey());
}

/** 운영자(가족) 기기 등록용으로 마이에서 보여준다 — 아직 없으면 null */
export async function storedDeviceKey(): Promise<string | null> {
  return deviceKey ?? (await readSetting(DEVICE_KEY_SETTING));
}

// --- 일반 사용자로 보기 — 가족 기기의 숨은 스위치(backend 「운영자 기기」) ---

const AS_USER_SETTING = 'as_user';
let asUser: boolean | null = null;

/** 켜 두었는지 — 기기 settings 에서 한 번 읽는다 */
export async function loadAsUser(): Promise<boolean> {
  asUser ??= (await readSetting(AS_USER_SETTING)) === 'true';
  return asUser;
}

/**
 * 켜면 요청에 `X-As-User: 1` 을 실어, 가족 기기도 한도 · 광고 · 하루 천장을 일반 기기처럼 받는다.
 * 권한을 낮추기만 하는 머리라서 일반 기기에서는 서버가 보지 않는다.
 */
export async function saveAsUser(on: boolean): Promise<void> {
  asUser = on;
  await writeSetting(AS_USER_SETTING, on ? 'true' : 'false');
}

async function deviceHeaders(): Promise<Record<string, string>> {
  return { 'X-Device-Key': await getDeviceKey(), ...((await loadAsUser()) ? { 'X-As-User': '1' } : {}) };
}

type Method = 'GET' | 'POST' | 'DELETE';

async function request<T>(
  method: Method,
  path: string,
  body: unknown,
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 닿지 못했어요');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | ({ code?: string; message?: string } & Partial<LimitInfo>)
      | null;
    const limit =
      error?.code === 'LIMIT_EXCEEDED'
        ? {
            resetAt: error.resetAt ?? '',
            rewardAvailable: !!error.rewardAvailable,
            ecoAvailable: error.ecoAvailable !== false,
          }
        : undefined;
    throw new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? '', limit);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * 기기 키를 실어 보낸다. 서버가 키를 모르면(401 — 서버 저장소가 바뀐 경우 등) 키를 새로 받아 한 번만
 * 다시 보낸다. 서버가 모델을 부르기 전에 거절한 것이라 다시 보내도 모델 호출이 두 번 나가지 않는다.
 */
async function withDeviceKey<T>(
  method: Method,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  try {
    return await request<T>(method, path, body, timeoutMs, await deviceHeaders());
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'DEVICE_KEY_INVALID') throw error;
    deviceKey = null;
    await writeSetting(DEVICE_KEY_SETTING, '');
    return request<T>(method, path, body, timeoutMs, await deviceHeaders());
  }
}

export function getEntitlements(): Promise<Entitlements> {
  return withDeviceKey<Entitlements>('GET', '/v1/entitlements', undefined, SHORT_TIMEOUT_MS);
}

// --- 가족 공유 (SPEC-MY-05, task my/007) — api-contract /v1/family ---

export type FamilyInfo = { familyId: string; inviteCode: string; members: number };
export type SyncBaby = { id: string; name: string | null; birthDate: string; createdAt: string; updatedAt: string };
/** 기록 한 줄 그대로 + 지웠는지 */
export type SyncRecord = BabyRecord & { deleted: boolean };
/** 할 일 · 주제 · 루틴 · 루틴 기록(task my/009) — 옛 서버는 items 를 모른다(응답에 없으면 받아 주지 않은 것) */
export type { SyncItem } from './family-items';
export type SyncRequest = {
  since: number;
  baby?: SyncBaby;
  records: SyncRecord[];
  items?: import('./family-items').SyncItem[];
};
export type SyncResponse = {
  seq: number;
  baby: SyncBaby | null;
  records: SyncRecord[];
  items?: import('./family-items').SyncItem[];
  members: number;
};

/** 서버가 0 에서 깨어나는 시간을 더한 여유 — 맞추기는 뒤에서 조용히 도니 조금 길어도 된다 */
const FAMILY_TIMEOUT_MS = 30_000;

export function getFamily(): Promise<FamilyInfo> {
  return withDeviceKey<FamilyInfo>('GET', '/v1/family', undefined, FAMILY_TIMEOUT_MS);
}

export function createFamily(consentedAt: string): Promise<FamilyInfo> {
  return withDeviceKey<FamilyInfo>('POST', '/v1/family', { consentedAt }, FAMILY_TIMEOUT_MS);
}

export function joinFamily(code: string, consentedAt: string): Promise<FamilyInfo> {
  return withDeviceKey<FamilyInfo>('POST', '/v1/family/join', { code, consentedAt }, FAMILY_TIMEOUT_MS);
}

export function leaveFamily(): Promise<void> {
  return withDeviceKey<void>('DELETE', '/v1/family/me', undefined, FAMILY_TIMEOUT_MS);
}

export function syncFamily(req: SyncRequest): Promise<SyncResponse> {
  return withDeviceKey<SyncResponse>('POST', '/v1/family/sync', req, FAMILY_TIMEOUT_MS);
}

/** 지식(L1) 판 확인 · 묶음 — 공공 지식이라 기기 키 없이 받는다. 항목 모양은 받는 쪽(knowledge-update)이 검사한다 */
export function getKnowledgeVersion(): Promise<{ version: string }> {
  return request<{ version: string }>('GET', '/v1/knowledge/version', undefined, SHORT_TIMEOUT_MS);
}

export function getKnowledgeBundle(): Promise<{ version: string; items: unknown }> {
  return request<{ version: string; items: unknown }>('GET', '/v1/knowledge/bundle', undefined, SHORT_TIMEOUT_MS);
}
