/**
 * 질문과 함께 보낼 대화 기억 고르기 (decisions/022, task ask/013).
 *
 * 세 겹이다 — 바로 앞 대화 원문 몇 마디(chat.ts recentTurns) · 대화 요약(지난 답에 서버가 돌려준 것) ·
 * 우리 아기 기록(이번 질문의 주제에 닿는 것만). 기록을 통째로 보내면 모델이 에어컨 질문에도 분유 기록을 끌어와
 * 「분유를 먹이고 있으니」로 답을 시작했다(Julian, 2026-10-12). 그래서 주제에 닿는 기록만 폰 밖으로 내보낸다.
 *
 * 질문의 주제는 이렇게 정한다.
 * - 앞 답을 문제 삼는 말(「분유 먹이는 거랑 무슨 상관이에요?」)은 원래 질문의 주제로 — 그 말 속 낱말(분유)이 아니라
 * - 주제 말이 없고 앞 말을 가리키는 질문(「몇 개월까지 그렇게 해요?」)은 앞 질문의 주제로
 * - 그 밖에는 질문 자신의 주제. 주제 말이 없는 새 질문(「에어컨 틀어도 돼요?」)에는 기록을 보내지 않는다
 * 서버(server/app/domain/ask/memory.py)도 같은 두 규칙으로 지식을 찾는다 — 낱말 목록을 고치면 둘 다 고친다.
 */

import { topicsOf, type TopicKey } from './ask-trace';
import type { ChatMessage } from './chat';
import { recordsForQuestion } from './daily-log';
import { contextLines } from './event-summary';
import type { CareEvent } from './events';
import type { BabyRecord } from './records';

/** 앞 답을 문제 삼는 말. 「상관없어요?」처럼 보통 질문에도 나오는 말은 넣지 않는다 */
const OBJECTION =
  /(무슨|뭔|뭐랑|무엇과)\s*(상관|관계|관련)|(그게|그런\s*게|그\s*말이|그런\s*말이|그건)\s*아니(라|고|에요|야|죠)|내\s*말은|엉뚱|동문서답|딴\s*(소리|얘기|이야기)|(잘못|못)\s*(알아들|이해)|질문을?\s*(잘못|다시)|(왜|갑자기)\s*\S{0,12}\s*(얘기|이야기)(를|가)?\s*(해|하|나와|꺼내)/;

/** 앞 말을 가리키는 말 — 이게 있어야 앞 질문의 주제를 빌려 온다 */
const REFERS_BACK = /그렇게|그거|그건|그걸|그것|그럼|그러면|그때|그런|이것|이거|아까|방금|저번|앞에서|말씀하신|말한/;

/** 같이 봐야 답이 맞는 주제 — 열을 물으면 최근 접종도(접종 뒤 열인지), 되묻기 표(SPEC-ASK-03)와 같은 짝 */
const ALSO: Partial<Record<TopicKey, TopicKey[]>> = { health: ['vaccine'] };

/** 대화 요약을 이어 쓰는 시간 — 바로 앞 대화(chat.ts)와 같은 하루. 그보다 오래되면 새 대화로 본다 */
const SUMMARY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 서버도 이 길이에서 자른다(memory.MAX_SUMMARY_CHARS) */
const SUMMARY_CHARS = 600;

function before(messages: ChatMessage[], beforeId: string): ChatMessage[] {
  const end = messages.findIndex((m) => m.id === beforeId);
  return end === -1 ? messages : messages.slice(0, end);
}

/** 이 질문 앞에서 부모가 마지막으로 물은 것 — 되묻기에 고른 답(replyTo)은 질문이 아니라서 뺀다 */
export function previousQuestion(messages: ChatMessage[], beforeId: string): string | null {
  const prev = before(messages, beforeId)
    .filter((m) => m.role === 'user' && !m.meta.replyTo)
    .pop();
  return prev ? prev.content : null;
}

/** 앞 답을 문제 삼는 말인가 — 버디가 앞에서 답한 적이 있을 때만 */
export function isObjection(question: string, messages: ChatMessage[], beforeId: string): boolean {
  const answered = before(messages, beforeId).some((m) => m.role === 'malkong' && m.meta.type !== 'briefing');
  return answered && previousQuestion(messages, beforeId) !== null && OBJECTION.test(question);
}

/** 기록과 처리 현황 문구의 주제를 정할 글 — 위 머리말의 세 규칙 */
export function focusOf(question: string, messages: ChatMessage[], beforeId: string): string {
  const prev = previousQuestion(messages, beforeId);
  if (!prev) return question;
  if (isObjection(question, messages, beforeId)) return prev;
  if (topicsOf(question).length === 0 && REFERS_BACK.test(question)) return prev;
  return question;
}

/**
 * 보낼 기록 — 주제에 닿는 것과 이번 시도에 막 저장한 것(되묻기에 고른 답). 하루 기록이 몰리지 않게 recordsForQuestion 으로 자른다.
 * 주제가 없는 질문에는 막 저장한 것 말고는 보내지 않는다.
 */
function topicKeys(focus: string): Set<TopicKey> {
  const keys = new Set<TopicKey>();
  for (const t of topicsOf(focus)) {
    keys.add(t.key);
    for (const k of ALSO[t.key] ?? []) keys.add(k);
  }
  return keys;
}

export function recordsForAsk(records: BabyRecord[], focus: string, carriedIds: string[], max: number): BabyRecord[] {
  const keys = topicKeys(focus);
  const carried = new Set(carriedIds);
  const near = records.filter((r) => carried.has(r.id) || topicsOf(r.label).some((t) => keys.has(t.key)));
  return recordsForQuestion(near, max);
}

/** 이어 쓸 대화 요약 — 하루 안의 가장 최근 버디 답에 붙어 있던 것 */
export function latestSummary(messages: ChatMessage[], beforeId: string, now = Date.now()): string | undefined {
  for (const m of [...before(messages, beforeId)].reverse()) {
    if (m.role !== 'malkong') continue;
    if (now - Date.parse(m.createdAt) > SUMMARY_WINDOW_MS) return undefined;
    if ((m.meta.type === 'answer' || m.meta.type === 'followup') && m.meta.summary) {
      return m.meta.summary.slice(0, SUMMARY_CHARS);
    }
  }
  return undefined;
}

/**
 * 빠른 기록의 요약 줄 가운데 이번 질문의 주제에 닿는 것(SPEC-LOG-06) — 「최근 24시간 수유 7번 …」.
 * 기록 줄과 같은 규칙으로 고른다. 주제가 없는 질문에는 보내지 않는다
 */
export function eventLinesForAsk(events: CareEvent[], focus: string, now = new Date()): string[] {
  const keys = topicKeys(focus);
  if (keys.size === 0) return [];
  return contextLines(events, now).filter((line) => topicsOf(line).some((t) => keys.has(t.key)));
}
