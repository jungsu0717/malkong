/**
 * 처리 현황 문구 (SPEC-ASK-05, task ask/007) — 질문마다 다르게, 실제로 한 것만.
 *
 * 서버는 아직 답을 한 번에 돌려준다(스트리밍 없음). 그래서 기다리는 동안의 문구는 앱이 질문으로 만든다 — 질문의 주제,
 * 그 주제에 닿는 우리 아기 기록, 월령. 서버가 실제로 하는 순서(위험 신호 규칙 → 기록 · 표준 지식 → 답 정리)를 벗어난 말은
 * 쓰지 않는다. 끝난 뒤에는 응답으로 「무엇을 보고 답했는지」를 적는다. 출처가 없으면 그 단계를 빼고 부정 문구를 쓰지 않는다 —
 * 근거 없는 답이라는 표시는 답 아래 「일반 정보」가 맡는다(constitution 1).
 */

import type { AskResponse } from './api';
import type { TraceStep } from './chat';

type TopicKey = 'health' | 'vaccine' | 'checkup' | 'feed' | 'sleep' | 'stool' | 'skin' | 'development' | 'growth' | 'safety';

type Topic = { key: TopicKey; name: string; match: RegExp };

/** 앞에 있을수록 먼저 — 아픈 이야기가 섞이면 그것부터 */
const TOPICS: Topic[] = [
  { key: 'health', name: '건강', match: /열|체온|기침|콧물|아파|아픈|아프|병원|구토|토했|설사|숨|경련|해열|감기|다쳤|부딪/ },
  { key: 'vaccine', name: '접종', match: /접종|주사|백신/ },
  { key: 'checkup', name: '검진', match: /검진/ },
  { key: 'feed', name: '먹기', match: /수유|분유|모유|젖|먹|이유식|트림|게워|게움|ml|cc/i },
  { key: 'sleep', name: '잠', match: /잠|재우|재워|낮잠|밤잠|깨|수면|통잠|눕/ },
  { key: 'stool', name: '변', match: /변비|대변|응가|기저귀|똥/ },
  { key: 'skin', name: '피부', match: /피부|발진|태열|아토피|두드러기|로션|보습/ },
  { key: 'development', name: '발달', match: /발달|뒤집|옹알|앉|기어|걷|걸음|말을|낯가림|목\s*가누|이정표|웃/ },
  { key: 'growth', name: '키 · 몸무게', match: /몸무게|체중|키가|키는|성장|kg|cm/i },
  { key: 'safety', name: '안전', match: /카시트|안전|떨어|삼켰|목욕|화상|질식/ },
];

export function topicOf(question: string): Topic | null {
  return TOPICS.find((t) => t.match.test(question)) ?? null;
}

/** 같은 주제의 질문이라도 늘 같은 말이 되지 않게 — 질문 글로 고르는 결정적 순번 */
function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
const pick = (options: string[], seed: number, salt: number) => options[(seed + salt) % options.length];

/** 질문 주제에 닿는 기록 — 문구에 주제 말이 들어 있는 것 */
function topicRecords(topic: Topic | null, labels: string[]): string[] {
  return topic ? labels.filter((l) => topic.match.test(l)) : [];
}

type Context = {
  question: string;
  /** 보낸 기록 문구 */
  records: string[];
  month: number;
  name: string;
};

/** 기다리는 동안 돌리는 문구 — 질문마다 다르다 */
export function waitingPhrases({ question, records, month, name }: Context): string[] {
  const topic = topicOf(question);
  const seed = seedOf(question);
  const near = topicRecords(topic, records);
  const subject = topic ? `${month}개월 ${topic.name}` : `${month}개월`;
  const phrases: string[] = [];
  if (topic?.key === 'health') {
    phrases.push(pick(['바로 병원에 가야 하는 신호인지 먼저 보고 있어요…', '위험 신호 기준부터 대조하고 있어요…'], seed, 0));
  }
  if (near.length > 0) {
    phrases.push(`${name} ${topic!.name} 기록 ${near.length}건을 보고 있어요…`);
  } else if (records.length > 0) {
    phrases.push(pick([`${name} 기록 ${records.length}건을 훑어보고 있어요…`, `${name}에 대해 아는 것부터 떠올리고 있어요…`], seed, 1));
  } else {
    phrases.push(`${month}개월 ${name} 기준으로 살펴보고 있어요…`);
  }
  phrases.push(pick([`${subject} 기준을 찾고 있어요…`, `${subject} 공공 지식을 뒤져 보고 있어요…`, `${subject}에 맞는 자료를 고르고 있어요…`], seed, 2));
  phrases.push(pick(['출처를 대조하고 있어요…', '근거가 맞는지 한 번 더 보고 있어요…'], seed, 3));
  phrases.push(pick([`${name}에게 맞게 정리하고 있어요…`, '쉬운 말로 다듬고 있어요…', '답을 가지런히 정리하고 있어요…'], seed, 4));
  return phrases;
}

/** 기다리는 동안 펼쳐 보면 보이는 단계 — 문구와 같은 순서, 아직 끝나지 않은 것 */
export function waitingSteps(ctx: Context): TraceStep[] {
  return waitingPhrases(ctx).map((title, i) => ({ id: `wait-${i}`, title: title.replace(/…$/, '') }));
}

/** 끝난 뒤 — 실제로 한 것만, 그리고 접힌 머리의 한 줄 */
export function doneTrace(
  response: AskResponse,
  { question, records, month, name, eco }: Context & { eco: boolean },
): { steps: TraceStep[]; summary: string } {
  if (response.type === 'redflag') return { steps: [], summary: '' };
  const topic = topicOf(question);
  const near = eco ? [] : topicRecords(topic, records);
  const steps: TraceStep[] = [];

  if (topic?.key === 'health') {
    steps.push({ id: 'redflag', title: '위험 신호 기준 대조', brief: '고열 · 숨쉬기 · 경련 같은 신호 기준과 먼저 맞춰 봤어요' });
  }
  if (eco) {
    steps.push({ id: 'l2', title: '일반 기준으로', brief: '기록 없이 월령으로만 답했어요' });
  } else if (near.length > 0) {
    steps.push({
      id: 'l2',
      title: `${name} ${topic!.name} 기록`,
      brief: `${near.slice(0, 2).join(' · ')}${near.length > 2 ? ` 외 ${near.length - 2}건` : ''}`,
    });
  } else if (records.length > 0) {
    steps.push({ id: 'l2', title: `${name} 기록`, brief: `${records.length}건 함께 봤어요` });
  }

  if (response.type === 'followup') {
    steps.push({ id: 'compose', title: '먼저 여쭤볼 것', brief: response.followup.question });
    return { steps, summary: '답하기 전에 하나만 여쭤볼게요' };
  }

  const names = [...new Set(response.sources.map((s) => s.name))];
  if (names.length > 0) {
    steps.push({ id: 'l1', title: '공공 지식 확인', brief: names.join(' · ') });
  }
  steps.push({
    id: 'compose',
    title: response.level === '사실' ? '출처대로 정리' : response.level === '판단' ? '상황별로 나눠 정리' : `${month}개월 기준으로 정리`,
  });

  // 주제에 닿는 기록이 있으면 그 수를 주제와 함께 — 답 아래 「우리 아기 기록 N건 참고」(보낸 전체)와 헷갈리지 않게
  const used = near.length > 0 ? `${name} ${topic!.name} 기록 ${near.length}건` : !eco && records.length > 0 ? `${name} 기록 ${records.length}건` : null;
  const summary =
    names.length > 0 && used
      ? `${used}과 출처 ${names.length}곳을 보고 답했어요`
      : names.length > 0
        ? `출처 ${names.length}곳을 확인하고 답했어요`
        : used
          ? `${used}을 보고 답했어요`
          : `${month}개월 기준으로 답했어요`;
  return { steps, summary };
}
