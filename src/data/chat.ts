/**
 * 물어보기 대화 — 대화방 없이 하나로 이어지는 타임라인(SPEC-ASK-10, decisions/009).
 *
 * 대화 원문은 L2 기록의 아래층이다. 기록이 틀렸거나 낡았을 때 원문으로 돌아가 다시 증류할 수 있게
 * 기록의 `sourceMessageId` 가 여기 질문 말풍선을 가리킨다. 저장 위치는 기기 안이고 서버로 올라가지 않는다
 * (backend 「기기 DB 스키마」 chat_message).
 */

import type { AnswerLevel, Followup, Source } from './api';
import type { Briefing } from './briefing';
import { ageFrom } from './baby';
import { insertChatRow, readChatRows, updateChatMetaRow } from './db';

/** 처리 현황을 접었을 때 다시 펼쳐 볼 단계와 한 줄 결과(SPEC-ASK-05) */
export type TraceStep = { id: string; title: string; brief?: string };

/** 모델이 답하며 내놓은 해석 — 사용자가 맞다고 해야 요약(L2)이 된다 */
export type Guess = { label: string; covers: string[] };

export type UserMessage = {
  id: string;
  role: 'user';
  content: string;
  /** 되묻기에 답한 말이면 그 되묻기 말풍선의 id */
  meta: { replyTo?: string };
  createdAt: string;
};

export type MalkongMeta =
  | {
      type: 'answer';
      /** 이 답이 답한 질문 말풍선 */
      questionId: string;
      level: AnswerLevel;
      sources: Source[];
      eco: boolean;
      /** 이 답에서 저장한 L2 기록 — 「기록했어요」 줄 */
      recordIds: string[];
      /** 모델에 보낸 우리 아기 기록 수 — 「우리 아기 기록 N건 참고」 표시. 예전 답에는 없다 */
      usedRecords?: number;
      trace: TraceStep[];
      /** 접힌 처리 현황의 한 줄 — 「콩이 기록 2건과 출처 1곳을 보고 답했어요」(task ask/007). 예전 답에는 없다 */
      traceSummary?: string;
      /** 남긴 피드백(SPEC-ASK-06) — 다시 열어도 눌렀던 쪽이 보인다 */
      feedback?: 'up' | 'down';
      /** 버디의 짐작(해석) — 「맞아요」를 눌러야 요약 기록이 된다(SPEC-ASK-12). 누르기 전까지 여기 머문다. 예전 답에는 없다 */
      guesses?: Guess[];
    }
  | {
      type: 'followup';
      questionId: string;
      /** 되묻기에 답하면 다시 보낼 원래 질문 */
      question: string;
      followup: Followup;
      trace: TraceStep[];
      traceSummary?: string;
    }
  | { type: 'redflag'; questionId: string; sources: Source[] }
  | ({
      /** 데일리 브리핑 — 그날 처음 열면 버디가 먼저 건넨다(SPEC-HOME-06). 질문 없이 생긴다. 안부에 답하면 answer 가 채워진다 */
      type: 'briefing';
    } & Briefing);

export type MalkongMessage = {
  id: string;
  role: 'malkong';
  content: string;
  meta: MalkongMeta;
  createdAt: string;
};

export type ChatMessage = UserMessage | MalkongMessage;

export function newMessageId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 전체 대화 — 오래된 것부터 */
export async function loadMessages(): Promise<ChatMessage[]> {
  return readChatRows();
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  await insertChatRow(message);
}

export async function saveMessageMeta(id: string, meta: ChatMessage['meta']): Promise<void> {
  await updateChatMetaRow(id, meta);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 같은 날인지 가르는 열쇠 — 기기 시간대의 날짜 */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 날짜 구분선 문구 — "오늘 · 10월 3일 금요일 · D+86" (SPEC-ASK-10) */
export function dayLabel(iso: string, birthDate: string | null, today = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const relative =
    dayKey(iso) === dayKey(today.toISOString())
      ? '오늘 · '
      : dayKey(iso) === dayKey(yesterday.toISOString())
        ? '어제 · '
        : '';
  const year = d.getFullYear() === today.getFullYear() ? '' : `${d.getFullYear()}년 `;
  const date = `${year}${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
  const dplus = birthDate ? ` · D+${ageFrom(birthDate, d).days}` : '';
  return `${relative}${date}${dplus}`;
}
