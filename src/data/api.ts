/**
 * 말콩 서버와 이야기하는 자리 — 모양의 정본은 docs/architecture/api-contract.md 다.
 *
 * 서버 주소는 빌드 때 박히는 `EXPO_PUBLIC_API_URL` 이고, 없으면 배포된 Cloud Run 이다.
 * 로컬 서버로 시험할 때는 `.env.local` 에 `EXPO_PUBLIC_API_URL=http://localhost:8000` 을 둔다.
 */

import type { RecordKind } from './records';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://malkong-server-481623022922.asia-northeast3.run.app';

/** 모델이 20초씩 두 번 시도하고, 서버가 0 에서 깨어나는 시간까지 더한 여유 */
const ASK_TIMEOUT_MS = 65_000;

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
  usage: { remaining: number };
  eco: boolean;
};

export type AskFollowup = { type: 'followup'; followup: Followup };

export type AskRedflag = { type: 'redflag'; answer: string; sources: Source[] };

export type AskResponse = AskAnswer | AskFollowup | AskRedflag;

/** 서버가 준 오류(`{code, message}`) 또는 연결 실패(status 0, code NETWORK) */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 닿지 못했어요');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    throw new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? '');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function postAsk(request: AskRequest): Promise<AskResponse> {
  return post<AskResponse>('/v1/ask', request, ASK_TIMEOUT_MS);
}
