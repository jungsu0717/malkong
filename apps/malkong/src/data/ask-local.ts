/**
 * 물어보기 — 기기 안에서 바로 답하는 물음 (SPEC-MAIN-13, task today/024). 모델을 부르지 않는다(헌장 13).
 *
 * - 하루 전체를 묻는 말(「오늘 뭐 했어?」, 「오늘 하루 요약해 줘」, 「어제 어땠어?」) — 그날 합계와 루틴 · 할 일 · 발달 체크를 한두 문장으로
 * - 루틴 · 할 일 · 메모에 있는 일을 묻는 말(「오늘 손톱 잘랐나?」, 「비타민D 먹였나?」, 「마지막으로 목욕한 게 언제야?」) — 이름으로 찾아서
 *
 * 수유 · 기저귀 · 잠 · 체온 같은 기록을 묻는 말은 여기서 답하지 않는다(찾기 규칙 find-parse 와 에이전트가 맡는다).
 * 빌드 15 에서 「오늘 손톱 잘랐나?」에 기저귀 답이, 「나 오늘 전체 뭐했어?」에 「할 일로 추가」 카드가 나와서 만들었다.
 */

import { copula } from './ask.ts';
import { dayFacts, routineDones, todoDones, type Fact } from './day-facts.ts';
import { hhmm } from './day-flow.ts';
import { durationLabel, startOfDay, statsBetween } from './event-summary.ts';
import type { CareEvent } from './events.ts';
import type { Routine, RoutineLog } from './routine.ts';
import type { Memo } from './stage.ts';
import type { Todo } from './todos.ts';

const DAY = 24 * 60 * 60 * 1000;

export type LocalData = {
  events: CareEvent[];
  routines: Routine[];
  logs: RoutineLog[];
  todos: Todo[];
  generalTopic: string | null;
  memos: Memo[];
};

export type LocalAnswer = { text: string; keys: string[]; label: string };

/** 수유 · 기저귀 · 잠 · 체온 · 몸무게 · 키를 묻는 말 — 여기서 답하지 않는다 */
const EVENT_WORDS = /분유|모유|젖|수유|맘마|먹(었|였|은|인|어|여|일)|ml|cc|미리|기저귀|대소변|소변|대변|응가|똥|오줌|잠(?!깐)|잤|자고|낮잠|밤잠|깼|깨어|일어났|체온|열이|몸무게|(^|\s)키(는|가)?(\s|$|\?)/;
/** 화면의 기록을 가리키는 말 — 에이전트가 맡는다 */
const POINTING = /이거|그거|저거|이 기록|그 기록|방금 거|아까 거|이것|그것/;
/** 말에서 빼는 낱말 — 때, 사람, 꾸밈말 */
const STOP = new Set([
  '오늘', '어제', '그제', '그저께', '아까', '방금', '지금', '요즘', '나', '내가', '난', '우리', '저', '제가', '아기', '애기', '아가', '전체', '다', '좀', '혹시',
  '진짜', '정말', '언제', '몇', '몇시', '몇번', '시에', '번이나', '마지막', '마지막으로', '기록', '하루', '번', '시', '분', '쯤', '이번', '그', '이', '게', '거', '것', '뭐', '뭘', '무슨',
]);
/** 지나간 일을 말하는 끝 — 「잘랐나」, 「깎았어」, 「먹였니」 */
const VERB = /(았|었|였|랐|렀|켰|쳤|웠|줬|봤|갔|왔|났|잤|깼|셨|겼|됐|했|겠)/;

const clean = (text: string) => text.replace(/[ㄱ-ㅎㅏ-ㅣ]+/g, ' ').replace(/[?？!.,~]/g, ' ').replace(/\s+/g, ' ').trim();
const flat = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 하루 전체를 묻는 말인가 — 「오늘 뭐 했어?」, 「하루 요약해 줘」, 「어제 어땠어?」. 기록 이름이 있으면 아니다 */
export function asksDaySummary(text: string): boolean {
  const s = clean(text);
  if (EVENT_WORDS.test(s) || /할 ?일|일정|루틴|초안|일기|메모/.test(s)) return false;
  return /(뭐|뭘|무엇|무슨 ?일).*(했|하고|있었|보냈|지냈|해써|했어)|(요약|정리)(해|좀|하면)|어땠|어때$|어떻게 ?(보냈|지냈)/.test(s);
}

/** 물음에서 찾을 이름 — 「오늘 손톱 잘랐나」는 「손톱」, 「비타민D 먹였나」는 「비타민d」 */
export function searchTerms(text: string): string[] {
  const out: string[] = [];
  for (let w of clean(text).split(' ')) {
    if (!w) continue;
    // 「목욕했나」 · 「목욕시켰어」 · 「산책한 게」 — 이름 뒤에 붙은 하다 · 시키다를 떼고
    w = w.replace(/(했었|했|하였|시켰|해줬|해 줬|한|하는|할)[가-힣]*$/, '');
    if (VERB.test(w)) continue;
    // 조사
    w = w.replace(/(이랑|에서|하고|은|는|이|가|을|를|도|만|요|의|에|랑)$/, (m, _g, i: number) => (i >= 2 ? '' : m));
    if (w.length < 2 || STOP.has(w) || /^언제/.test(w) || EVENT_WORDS.test(w)) continue;
    out.push(w.toLowerCase());
  }
  return [...new Set(out)];
}

/** 루틴 · 할 일 · 메모에 있는 일 하나 */
type Hit = { at: number; title: string; key: string; type: 'routine' | 'todo' | 'memo' | 'check' };

function occurrences(terms: string[], data: LocalData): Hit[] {
  const match = (title: string) => terms.some((t) => flat(title).includes(flat(t)));
  const out: Hit[] = [];
  const titleOf = new Map(data.routines.map((r) => [r.id, r.title]));
  for (const l of data.logs) {
    const title = titleOf.get(l.routineId);
    if (!title || l.step != null || l.skip || !match(title)) continue;
    out.push({ at: new Date(l.at).getTime(), title, key: `routine-${l.id}`, type: 'routine' });
  }
  for (const t of data.todos) if (t.doneAt && match(t.title)) out.push({ at: new Date(t.doneAt).getTime(), title: t.title, key: `todo-${t.id}`, type: 'todo' });
  for (const m of data.memos) if (match(m.text)) out.push({ at: new Date(m.at).getTime(), title: m.text.trim(), key: `memo-${m.id}`, type: m.ref ? 'check' : 'memo' });
  // 기록에 붙인 메모 — 「트림을 두 번 했어요」
  for (const e of data.events) if (e.note && match(e.note)) out.push({ at: new Date(e.startAt).getTime(), title: e.note.trim(), key: e.id, type: 'memo' });
  return out.sort((a, b) => a.at - b.at);
}

/** 이름이 있는 일이 기록 어딘가에 있는가 — 「비타민D 먹였나?」를 수유 찾기보다 먼저 */
export function knowsTerm(text: string, data: LocalData): boolean {
  const terms = searchTerms(text);
  if (!terms.length) return false;
  if (occurrences(terms, data).length) return true;
  return data.routines.some((r) => terms.some((t) => flat(r.title).includes(flat(t))));
}

/** 물음이 가리키는 날 — 「어제」, 「그제」, 「오늘」, 말이 없으면 보는 날 */
function dayOf(text: string, viewDay: Date, now: Date): { day: Date; explicit: boolean } {
  const today = startOfDay(now);
  if (/그제|그저께/.test(text)) return { day: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2), explicit: true };
  if (/어제|어젯/.test(text)) return { day: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), explicit: true };
  if (/오늘/.test(text)) return { day: today, explicit: true };
  return { day: startOfDay(viewDay), explicit: false };
}

/** 「오늘」 · 「어제」 · 「11월 6일」 */
function dayWord(day: Date, now: Date): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(day).getTime()) / DAY);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff === 2) return '그제';
  return `${day.getMonth() + 1}월 ${day.getDate()}일`;
}

/** 「오늘 20:10」 · 「11월 3일 20:10」 */
function whenWord(at: number, now: Date): string {
  return `${dayWord(new Date(at), now)} ${hhmm(at)}`;
}

const topic = (w: string) => `${w}${copula(w) === '이에요' ? '은' : '는'}`;
const short = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);

function hitsLine(hits: Hit[], word: string): string {
  if (hits.length === 1) {
    const h = hits[0];
    if (h.type === 'memo') return `${word} ${hhmm(h.at)}에 남긴 메모가 있어요. 「${short(h.title)}」`;
    if (h.type === 'check') return `${word} 발달 체크에 「${short(h.title)}」${copula(h.title) === '이에요' ? '을' : '를'} 남겼어요.`;
    return `${word} ${hhmm(h.at)}에 ${h.title} 기록이 있어요.`;
  }
  if (hits.every((h) => h.title === hits[0].title) && hits[0].type !== 'memo') {
    return `${word} ${hits[0].title} 기록이 ${hits.length}번 있어요(${hits.map((h) => hhmm(h.at)).join(', ')}).`;
  }
  return `${word} ${hits.slice(0, 4).map((h) => `${hhmm(h.at)} ${short(h.title)}`).join(', ')} 기록이 있어요.`;
}

/** 그날 합계와 루틴 · 할 일 · 발달 체크 — 「오늘은 수유 3번 280ml, 기저귀 4번, 잠 7시간 40분이에요. 목욕, 터미타임 기록도 있어요.」 */
export function daySummaryAnswer(text: string, data: LocalData, viewDay: Date, now: Date): LocalAnswer {
  const { day } = dayOf(text, viewDay, now);
  const word = dayWord(day, now);
  const facts: Fact[] = dayFacts(data.events, routineDones(data.routines, data.logs, day), todoDones(data.todos, data.generalTopic), data.memos, day, now);
  const s = statsBetween(data.events, day, new Date(day.getTime() + DAY), now);
  const parts: string[] = [];
  if (s.feeds > 0) parts.push(`수유 ${s.feeds}번${s.formulaMl > 0 ? ` ${Math.round(s.formulaMl)}ml` : ''}`);
  if (s.diapers > 0) parts.push(`기저귀 ${s.diapers}번`);
  if (s.sleepMin >= 1) parts.push(`잠 ${durationLabel(s.sleepMin)}`);
  const names = [
    ...new Set(facts.filter((f) => f.kind === 'routine' || f.kind === 'todo').map((f) => f.text.replace(/ \d+(시간|분).*$/, ''))),
    ...facts.filter((f) => f.kind === 'check').map((f) => `발달 체크 「${f.text}」`),
  ];
  const sentences: string[] = [];
  if (parts.length) {
    const body = parts.join(', ');
    sentences.push(`${topic(word)} ${body}${copula(body)}.`);
  }
  if (names.length) {
    const list = names.slice(0, 5).join(', ');
    sentences.push(parts.length ? `${list} 기록도 있어요.` : `${topic(word)} ${list} 기록이 있어요.`);
  }
  if (!sentences.length) return { text: `${topic(word)} 아직 기록이 없어요.`, keys: [], label: `${word} 기록` };
  return { text: sentences.join(' '), keys: facts.map((f) => f.key), label: `${word} 기록` };
}

/**
 * 루틴 · 할 일 · 메모에 있는 일을 이름으로 찾아 답한다 — 찾을 이름이 없거나 기록을 묻는 말이면 null.
 * 「언제」를 물으면 마지막 때, 아니면 그날(말한 날이나 보는 날)에 있었는지와 없으면 마지막 때.
 */
export function findAnswer(text: string, data: LocalData, viewDay: Date, now: Date): LocalAnswer | null {
  const s = clean(text);
  if (POINTING.test(text)) return null;
  // 「비타민D 먹였나?」 — 먹였어도 루틴 이름이 있으면 여기서
  if (EVENT_WORDS.test(s) && !knowsTerm(text, data)) return null;
  const terms = searchTerms(text);
  if (!terms.length) return null;
  const all = occurrences(terms, data).filter((h) => h.at <= now.getTime());
  const routine = data.routines.find((r) => terms.some((t) => flat(r.title).includes(flat(t))));
  const name = all[all.length - 1]?.type === 'routine' || all[all.length - 1]?.type === 'todo' ? all[all.length - 1].title : (routine?.title ?? terms[0]);
  const { day, explicit } = dayOf(s, viewDay, now);
  const label = '찾은 기록';

  if (/언제|마지막/.test(s) && !explicit) {
    const last = all[all.length - 1];
    if (!last) return { text: `「${name}」 기록을 찾지 못했어요.`, keys: [], label };
    const w = whenWord(last.at, now);
    return { text: `마지막은 ${w}${copula(w)}.${last.type === 'memo' ? ` 「${short(last.title)}」` : ''}`, keys: [last.key], label };
  }

  const from = day.getTime();
  const hits = all.filter((h) => h.at >= from && h.at < from + DAY);
  const word = dayWord(day, now);
  if (hits.length) return { text: hitsLine(hits, word), keys: hits.map((h) => h.key), label };
  const before = all.filter((h) => h.at < from);
  const last = before[before.length - 1];
  const tail = last ? ` 마지막은 ${whenWord(last.at, now)}${copula(hhmm(last.at))}.` : '';
  return { text: `${topic(word)} 「${name}」 기록이 없어요.${tail}`, keys: [], label };
}

/** 에이전트가 고른 찾기 조건이 물음과 맞는가 — 「손톱 잘랐나?」에 기저귀를 고르면 쓰지 않는다 */
const WHAT_WORDS: Record<string, RegExp> = {
  feed: /수유|먹|분유|모유|젖|맘마/,
  formula: /분유|먹/,
  breast: /모유|젖|수유/,
  diaper: /기저귀|소변|대변|쉬|응가|똥|오줌|갈았/,
  pee: /소변|쉬|오줌/,
  poo: /대변|응가|똥/,
  sleep: /잠|잤|자|깼|깨|일어/,
  nap: /낮잠|잠|잤/,
  night: /밤잠|밤|잠|잤/,
  temp: /체온|열/,
  weight: /몸무게|kg|키로|무게/,
  height: /키|cm|센티/,
};
export function questionFits(text: string, what: string): boolean {
  const re = WHAT_WORDS[what];
  return re ? re.test(text) : true;
}
