/**
 * 일기 쓰기 도우미 (SPEC-STAGE-03, task growth/011, decisions/042) — 그날 기록을 시간순 칩으로 만든다.
 *
 * 메모 쓰기 창 위에 보여 주고, 칩을 누르면 「07:45 모유 15분」 같은 글자가 글에 들어간다. 글과 말투는 사람이 쓰고 모델은 부르지 않는다.
 * 발달 체크로 남긴 것(「뒤집기」)은 맨 앞에 온다. 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/day-facts.test.ts`).
 */

import { dayFlow, feedTitle, hhmm, sleepTitle, type RoutineDone, type SleepSpan, type TodoDone } from './day-flow.ts';
import { durationLabel, startOfDay, statsBetween } from './event-summary.ts';
import type { CareEvent } from './events.ts';
import { isCheckMemo } from './growth-plus.ts';
import { isTimed, logsOn, type Routine, type RoutineLog } from './routine.ts';
import type { Memo } from './stage.ts';
import type { Todo } from './todos.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export type FactKind = 'breast' | 'formula' | 'pee' | 'poo' | 'both' | 'sleep' | 'routine' | 'todo' | 'temp' | 'weight' | 'height' | 'check';

export type Fact = {
  key: string;
  at: number;
  /** 「07:45」 — 어제 시작한 밤잠은 「어제 21:10」, 발달 체크는 null */
  time: string | null;
  text: string;
  kind: FactKind;
  /** 글에 넣을 글자 — 「07:45 모유 15분」 */
  insert: string;
};

/** 그날 끝낸 루틴 — 하루 보기와 같은 규칙(단계 줄과 건너뛴 줄은 빼고, 시간을 재는 루틴은 그날 한 것 모두) */
export function routineDones(routines: Routine[], logs: RoutineLog[], day: Date): RoutineDone[] {
  return routines.flatMap((r) => {
    const done = logsOn(r.id, logs, day).filter((l) => l.step == null && !l.skip);
    const list = isTimed(r) ? done : done.slice(0, 1);
    return list.map((l) => ({ routineId: r.id, logId: l.id, title: r.title, at: l.at, by: l.by, endAt: l.endAt ?? null }));
  });
}

/** 완료한 일반 할 일 */
export function todoDones(todos: Todo[], generalTopic: string | null): TodoDone[] {
  return todos.filter((t) => t.topicId === generalTopic && t.doneAt).map((t) => ({ todoId: t.id, title: t.title, at: t.doneAt as string, by: t.doneBy }));
}

/** 그날 기록을 시간순 칩으로 — 발달 체크가 맨 앞, 그다음 시간순 */
export function dayFacts(events: CareEvent[], routines: RoutineDone[], todos: TodoDone[], memos: Memo[], day: Date, now = new Date()): Fact[] {
  const dayStart = startOfDay(day).getTime();
  const inDay = (at: number) => at >= dayStart && at < dayStart + DAY;
  const flow = dayFlow(events, routines, todos, day, now);
  const out: Fact[] = [];
  const push = (key: string, at: number, time: string | null, text: string, kind: FactKind) => out.push({ key, at, time, text, kind, insert: time ? `${time} ${text}` : text });
  const sleep = (s: SleepSpan) => push(s.event.id, s.from, s.from < dayStart ? `어제 ${hhmm(s.from)}` : hhmm(s.from), sleepTitle(s, now), 'sleep');

  for (const part of flow.parts) {
    if (part.type === 'sleep') {
      sleep(part.sleep);
      continue;
    }
    for (const it of part.block.items) {
      if (it.type === 'memo') continue;
      if (it.type === 'feed') push(it.key, it.at, hhmm(it.at), feedTitle(it.session, now), it.session.kind);
      else if (it.type === 'routine') push(it.key, it.at, hhmm(it.at), it.end !== null && it.end > it.at ? `${it.title} ${durationLabel((it.end - it.at) / MIN)}` : it.title, 'routine');
      else if (it.type === 'todo') push(it.key, it.at, hhmm(it.at), it.title, 'todo');
      else {
        const e = it.event;
        if (e.kind === 'diaper') push(it.key, it.at, hhmm(it.at), e.diaper === 'pee' ? '소변' : e.diaper === 'poo' ? '대변' : '소변, 대변', e.diaper ?? 'pee');
        else if (e.kind === 'temp') push(it.key, it.at, hhmm(it.at), e.amount !== null ? `체온 ${e.amount}℃` : '체온', 'temp');
        else if (e.kind === 'weight') push(it.key, it.at, hhmm(it.at), e.amount !== null ? `몸무게 ${e.amount}kg` : '몸무게', 'weight');
        else if (e.kind === 'height') push(it.key, it.at, hhmm(it.at), e.amount !== null ? `키 ${e.amount}cm` : '키', 'height');
      }
    }
  }
  if (flow.sleeping) sleep(flow.sleeping);
  out.sort((a, b) => a.at - b.at);

  const checks: Fact[] = memos
    .filter((m) => isCheckMemo(m) && inDay(new Date(m.at).getTime()))
    .map((m) => ({ key: `memo-${m.id}`, at: new Date(m.at).getTime(), time: null, text: m.text.trim(), kind: 'check' as const, insert: m.text.trim() }))
    .sort((a, b) => a.at - b.at);
  return [...checks, ...out];
}

/** 하루 합계 한 줄 — 「수유 6번 710ml, 잠 8시간 20분」. 수유도 잠도 없으면 null */
export function factSummary(events: CareEvent[], day: Date, now = new Date()): string | null {
  const from = startOfDay(day);
  const s = statsBetween(events, from, new Date(from.getTime() + DAY), now);
  const parts: string[] = [];
  if (s.feeds > 0) parts.push(`수유 ${s.feeds}번${s.formulaMl > 0 ? ` ${Math.round(s.formulaMl)}ml` : ''}`);
  if (s.sleepMin >= 1) parts.push(`잠 ${durationLabel(s.sleepMin)}`);
  return parts.length ? parts.join(', ') : null;
}

/** 글 끝에 칩 글자를 붙인다 — 앞 글이 있고 빈칸으로 끝나지 않으면 한 칸 띄운다 */
export function appendFact(text: string, insert: string): string {
  if (!text) return insert;
  return /\s$/.test(text) ? `${text}${insert}` : `${text} ${insert}`;
}

/** 「오늘 일기 써 줘」 · 「일기 작성해 줘」 · 「메모 써 줘」(내용 없이) — 메모 쓰기 창을 연다 */
export function asksDiary(text: string): boolean {
  const s = text.trim();
  if (/일기/.test(s) && /써|쓰|적|작성/.test(s)) return true;
  return /^(오늘\s*)?메모(를|좀|\s)?\s*(써|쓰|적어|작성)/.test(s) && s.length <= 14;
}
