/**
 * 버디에게 묻는 흐름 — 보내기 · 되묻기에 답하기 · 다시 시도 (task ask/002).
 *
 * 화면은 그리기만 하고, 무엇을 저장하고 무엇을 다시 보낼지는 여기서 정한다:
 * - 질문과 답은 대화 타임라인에 저장한다(SPEC-ASK-10). 실패한 시도는 저장하지 않는다
 * - 되묻기에 고른 답은 L2 기록으로 남기고 원래 질문을 다시 보낸다. "잘 모르겠어요"는 일반 기준으로(SPEC-ASK-03)
 * - 답변의 기록 제안은 자동 저장하고 답 아래 「기록됨」으로 보인다(ask.md L2 추출 규칙)
 * - 자동 재시도는 하지 않는다 — 서버가 같은 clientMessageId 를 아직 같은 응답으로 돌려주지 못해서,
 *   다시 보내면 모델 호출이 한 번 더 나간다. 사용자가 「다시 시도」를 고른다
 */

import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { watchRewardedAd } from '@/data/ads';
import {
  ApiError,
  deviceKeyHash,
  getEntitlements,
  postAsk,
  type AskResponse,
  type LimitInfo,
} from '@/data/api';
import { useBaby } from '@/data/baby-context';
import {
  newMessageId,
  type MalkongMessage,
  type TraceStep,
  type UserMessage,
} from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useEntitlements } from '@/data/entitlements-context';
import { recordsForQuestion } from '@/data/daily-log';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';

/** 되묻기 칩 맨 끝에 늘 있는 회피 선택지 — 서버가 붙여 보낸다 */
export const DONT_KNOW = '잘 모르겠어요';

/** 모델에 보내는 기록 수 — 최근 것부터 */
const MAX_RECORDS_SENT = 30;

type Attempt = {
  /** 이번 요청의 clientMessageId — 질문이나 되묻기 답 말풍선의 id */
  questionId: string;
  question: string;
  mode?: 'eco';
  /** 이번 시도 전에 이미 저장한, 답과 함께 보여줄 기록(되묻기 답) */
  carriedRecordIds: string[];
};

export type AskFailure = Attempt & { status: number; code: string; limit?: LimitInfo };

function traceFor(response: AskResponse, sentRecords: number): TraceStep[] {
  if (response.type === 'redflag') return [];
  const eco = response.type === 'answer' && response.eco;
  const l2: TraceStep = {
    id: 'l2',
    title: '우리 아기 기록 확인',
    brief: eco ? '일반 기준이라 기록은 쓰지 않았어요' : sentRecords ? `기록 ${sentRecords}건` : '아직 기록이 없어요',
  };
  if (response.type === 'followup') {
    return [l2, { id: 'compose', title: '확인할 것 정리', brief: '먼저 여쭤볼 게 있어요' }];
  }
  const names = response.sources.map((s) => s.name);
  return [
    l2,
    {
      id: 'l1',
      title: '표준 지식 찾기',
      brief: names.length
        ? `${names[0]}${names.length > 1 ? ` 외 ${names.length - 1}건` : ''}`
        : '맞는 표준 지식이 없었어요',
    },
    { id: 'compose', title: '답변 정리' },
  ];
}

export function useMalkong() {
  const { age } = useBaby();
  const { messages, append } = useChat();
  const { records, add } = useRecords();
  const { setRemaining } = useEntitlements();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<AskFailure | null>(null);
  const { mutateAsync: askServer } = useMutation({ mutationFn: postAsk, retry: 0 });

  /** 아직 답하지 않은 되묻기 — 마지막 말풍선이 되묻기일 때만 열려 있다 */
  const openFollowup = useMemo(() => {
    const last = messages[messages.length - 1];
    return last?.role === 'malkong' && last.meta.type === 'followup' ? last : null;
  }, [messages]);

  const run = useCallback(
    async (attempt: Attempt, known: BabyRecord[]) => {
      if (!age) return;
      setFailure(null);
      setPendingId(attempt.questionId);
      const sent = recordsForQuestion(known, MAX_RECORDS_SENT).map((r) => ({ kind: r.kind, label: r.label }));
      try {
        const response = await askServer({
          question: attempt.question,
          baby: { months: age.month, records: sent },
          clientMessageId: attempt.questionId,
          ...(attempt.mode ? { mode: attempt.mode } : {}),
        });
        const trace = traceFor(response, attempt.mode ? 0 : sent.length);
        const base = {
          id: newMessageId(),
          role: 'malkong' as const,
          createdAt: new Date().toISOString(),
        };
        let message: MalkongMessage;
        if (response.type === 'answer') {
          setRemaining(response.usage.remaining);
          // 기록 제안은 자동 저장한다 — 같은 문구가 이미 있으면 다시 넣지 않는다
          const savedIds = [...attempt.carriedRecordIds];
          const labels = new Set(known.map((r) => r.label));
          for (const suggestion of response.records) {
            if (labels.has(suggestion.label)) continue;
            labels.add(suggestion.label);
            const record = await add({
              kind: suggestion.kind,
              label: suggestion.label,
              covers: suggestion.covers ?? [],
              whenLabel: `D+${age.days} 질문에서`,
              sourceMessageId: attempt.questionId,
            });
            savedIds.push(record.id);
          }
          message = {
            ...base,
            content: response.answer,
            meta: {
              type: 'answer',
              questionId: attempt.questionId,
              level: response.level,
              sources: response.sources,
              eco: response.eco,
              recordIds: savedIds,
              usedRecords: response.eco ? 0 : sent.length,
              trace,
            },
          };
        } else if (response.type === 'followup') {
          message = {
            ...base,
            content: response.followup.question,
            meta: {
              type: 'followup',
              questionId: attempt.questionId,
              question: attempt.question,
              followup: response.followup,
              trace,
            },
          };
        } else {
          message = {
            ...base,
            content: response.answer,
            meta: { type: 'redflag', questionId: attempt.questionId, sources: response.sources },
          };
        }
        await append(message);
      } catch (error) {
        const e = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', '');
        setFailure({ ...attempt, status: e.status, code: e.code, limit: e.limit });
      } finally {
        setPendingId(null);
      }
    },
    [age, askServer, add, append, setRemaining],
  );

  /** 되묻기에 답한다 — 칩을 누르거나, 되묻기가 열려 있을 때 입력창에 친 글 */
  const reply = useCallback(
    async (followup: MalkongMessage, text: string) => {
      if (followup.meta.type !== 'followup' || !age) return;
      const message: UserMessage = {
        id: newMessageId(),
        role: 'user',
        content: text,
        meta: { replyTo: followup.id },
        createdAt: new Date().toISOString(),
      };
      await append(message);
      const question = followup.meta.question;
      if (text === DONT_KNOW) {
        await run({ questionId: message.id, question, mode: 'eco', carriedRecordIds: [] }, records);
        return;
      }
      const record = await add({
        kind: '기록',
        label: `${followup.meta.followup.recordLabel}: ${text}`,
        covers: [],
        whenLabel: `D+${age.days} 질문에서`,
        sourceMessageId: message.id,
      });
      await run(
        { questionId: message.id, question, carriedRecordIds: [record.id] },
        [...records, record],
      );
    },
    [age, append, add, records, run],
  );

  /** 입력창에서 보내기 — 되묻기가 열려 있으면 그 답으로 본다 */
  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || pendingId) return;
      if (openFollowup) {
        await reply(openFollowup, question);
        return;
      }
      const message: UserMessage = {
        id: newMessageId(),
        role: 'user',
        content: question,
        meta: {},
        createdAt: new Date().toISOString(),
      };
      await append(message);
      await run({ questionId: message.id, question, carriedRecordIds: [] }, records);
    },
    [append, openFollowup, pendingId, records, reply, run],
  );

  const retry = useCallback(async () => {
    if (!failure || pendingId) return;
    const { questionId, question, mode, carriedRecordIds } = failure;
    await run({ questionId, question, mode, carriedRecordIds }, records);
  }, [failure, pendingId, records, run]);

  /** 하루 정밀 답변을 다 썼을 때 — 같은 질문을 기록 없이 일반 기준으로 다시 묻는다(backend 일일 한도 절약 모드) */
  const answerInEco = useCallback(async () => {
    if (!failure || pendingId) return;
    const { questionId, question, carriedRecordIds } = failure;
    await run({ questionId, question, mode: 'eco', carriedRecordIds }, records);
  }, [failure, pendingId, records, run]);

  /**
   * 광고 1편을 보고 정밀 답변 1회를 채운 뒤 같은 질문을 다시 보낸다(ask.md 한도 표시).
   * 적립은 AdMob 이 서버로 직접 알리므로(SSV) 서버가 남은 수를 올릴 때까지 잠깐 기다린다.
   * 끝까지 보지 않았거나 확인이 늦으면 false — 화면은 그대로 선택지를 다시 보인다.
   */
  const refillWithAd = useCallback(async (): Promise<boolean> => {
    if (!failure || pendingId) return false;
    const earned = await watchRewardedAd(await deviceKeyHash());
    if (!earned) return false;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const { remaining } = await getEntitlements();
        if (remaining === null || remaining > 0) {
          setRemaining(remaining);
          const { questionId, question, carriedRecordIds } = failure;
          await run({ questionId, question, carriedRecordIds }, records);
          return true;
        }
      } catch {
        // 연결이 잠깐 끊겨도 몇 번 더 본다
      }
    }
    return false;
  }, [failure, pendingId, records, run, setRemaining]);

  return {
    messages,
    pendingId,
    failure,
    openFollowup,
    send,
    reply,
    retry,
    answerInEco,
    refillWithAd,
  };
}
