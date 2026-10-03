/**
 * 육아버디 서버와 이야기하는 자리 — 모양의 정본은 docs/architecture/api-contract.md 다.
 *
 * 서버 주소는 빌드 때 박히는 `EXPO_PUBLIC_API_URL` 이고, 없으면 배포된 Cloud Run 이다.
 * 로컬 서버로 시험할 때는 `.env.local` 에 `EXPO_PUBLIC_API_URL=http://localhost:8000` 을 둔다.
 */

import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import { readSetting, writeSetting } from './db';
import type { RecordKind } from './records';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://malkong-server-481623022922.asia-northeast3.run.app';

/** 모델이 20초씩 두 번 시도하고, 서버가 0 에서 깨어나는 시간까지 더한 여유 */
const ASK_TIMEOUT_MS = 65_000;
const SHORT_TIMEOUT_MS = 15_000;

export type Source = { id: string; name: string; url: string };

/** 답변 수위(SPEC-ASK-08) */
export type AnswerLevel = '사실' | '일반' | '판단';

export type RecordSuggestion = { kind: RecordKind; label: string; covers?: string[] | null };

export type Followup = { question: string; chips: string[]; recordLabel: string };

export type AskRequest = {
  question: string;
  baby: { months: number; records: { kind: RecordKind; label: string }[] };
  /** 질문 말풍선의 id — 같은 값의 재요청은 서버가 같은 응답으로 돌려준다(계약) */
  clientMessageId: string;
  /** "eco" 면 기록 없이 일반 기준으로 답한다 */
  mode?: 'eco';
};

export type AskAnswer = {
  type: 'answer';
  answer: string;
  level: AnswerLevel;
  sources: Source[];
  records: RecordSuggestion[];
  /** 오늘 남은 정밀 답변 수. 운영자(가족) 기기는 null */
  usage: { remaining: number | null };
  eco: boolean;
};

export type AskFollowup = { type: 'followup'; followup: Followup };

export type AskRedflag = { type: 'redflag'; answer: string; sources: Source[] };

export type AskResponse = AskAnswer | AskFollowup | AskRedflag;

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
  rewardMaxPerDay: number;
  remaining: number | null;
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

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  timeoutMs: number,
  key?: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'X-Device-Key': key } : {}),
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
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  try {
    return await request<T>(method, path, body, timeoutMs, await getDeviceKey());
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'DEVICE_KEY_INVALID') throw error;
    deviceKey = null;
    await writeSetting(DEVICE_KEY_SETTING, '');
    return request<T>(method, path, body, timeoutMs, await getDeviceKey());
  }
}

export function postAsk(req: AskRequest): Promise<AskResponse> {
  return withDeviceKey<AskResponse>('POST', '/v1/ask', req, ASK_TIMEOUT_MS);
}

export function getEntitlements(): Promise<Entitlements> {
  return withDeviceKey<Entitlements>('GET', '/v1/entitlements', undefined, SHORT_TIMEOUT_MS);
}

export type FeedbackRequest = {
  answerId: string;
  rating: 'up' | 'down';
  comment?: string;
  answer: { level: AnswerLevel; sourceIds: string[]; eco: boolean };
  /** 사용자가 「질문과 답도 함께 보내기」를 골랐을 때만 */
  shared?: { question: string; answer: string };
};

export function postFeedback(req: FeedbackRequest): Promise<void> {
  return withDeviceKey<void>('POST', '/v1/feedback', req, SHORT_TIMEOUT_MS);
}
