/**
 * 「추가」 한 줄 읽기 (SPEC-MAIN-12, task today/015, 헌장 13) — 모델 없이 규칙으로.
 *
 * 기록 이름(분유 · 모유 · 기저귀 · 잠 · 체온 · 몸무게 · 키)이 있으면 기록으로 읽는다 — 양 · 쪽 · 걸린 시간 · 지나간 시각.
 * 시각은 지나간 가장 가까운 때로 읽는다(「12시 반」은 오늘 12:30 이나 0:30 중 지금보다 앞의 늦은 쪽, 「어제 밤 11시」, 「30분 전」).
 * 기록 이름이 없으면 할 일 입력이 쓰던 due-parse 로 날짜 · 시각 · 반복을 읽는다 — 반복이면 루틴, 날짜나 시각이 있으면 할 일, 없으면 이름만.
 * 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/add-parse.test.ts`).
 */

import { parseDue } from './due-parse.ts';
import type { DiaperKind, EventInput, EventKind, Side } from './events.ts';
import { repeatLabel, type Repeat } from './repeat.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type AddRoutine = { title: string; kind: 'check'; everyDays: number; weekdays: number[] | null; time: string | null; items: null };

export type AddResult =
  /** 기록 — complete 가 아니면(기저귀 종류 · 분유 양 · 숫자가 없으면) 입력 시트에서 마저 적는다 */
  | { type: 'record'; kind: EventKind; input: EventInput; complete: boolean; title: string; when: string }
  | { type: 'routine'; title: string; routine: AddRoutine; when: string }
  | { type: 'todo'; title: string; dueAt: Date; hasTime: boolean; repeat: Repeat | null; when: string }
  | { type: 'plain'; title: string };

/** 「오늘 12:30」 · 「어제 23:40」 · 「11월 1일 08:30」 */
export function whenLabel(at: Date, now = new Date()): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / DAY);
  const head = days === 0 ? '오늘' : days === 1 ? '어제' : days === -1 ? '내일' : `${at.getMonth() + 1}월 ${at.getDate()}일`;
  return `${head} ${hm(at)}`;
}

/** 지나간 시각 읽기 — 읽은 말은 글에서 뺀다. 못 읽으면 null */
function pastTime(text: string, now: Date): { at: Date; rest: string } | null {
  let m = /(\d{1,3})\s*(분|시간)\s*전/.exec(text);
  if (m) {
    const n = Number(m[1]) * (m[2] === '시간' ? 60 : 1);
    return { at: new Date(now.getTime() - n * MIN), rest: text.replace(m[0], ' ') };
  }
  m = /(어제|오늘|그저께)?\s*(오전|오후|아침|저녁|밤|새벽|낮)?\s*(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?/.exec(text);
  let h: number | null = null;
  let mm = 0;
  let marker: string | undefined;
  let dayWord: string | undefined;
  if (m) {
    dayWord = m[1];
    marker = m[2];
    h = Number(m[3]);
    mm = m[4] ? Number(m[4]) : m[5] ? 30 : 0;
  } else {
    m = /(어제|오늘)?\s*(\d{1,2}):(\d{2})/.exec(text);
    if (m) {
      dayWord = m[1];
      h = Number(m[2]);
      mm = Number(m[3]);
      marker = 'exact';
    }
  }
  if (!m || h === null || h > 24 || mm > 59) return null;
  const rest = text.replace(m[0], ' ');
  const base = dayWord === '어제' ? new Date(now.getTime() - DAY) : dayWord === '그저께' ? new Date(now.getTime() - 2 * DAY) : now;
  const at = (hour: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour % 24, mm);
  let candidates: number[];
  if (marker === '오후' || marker === '저녁' || marker === '밤') candidates = [h < 12 ? h + 12 : h];
  else if (marker === '오전' || marker === '아침' || marker === '새벽') candidates = [h === 12 ? 0 : h];
  else if (marker === '낮') candidates = [h < 7 ? h + 12 : h];
  else if (marker === 'exact' || h > 12) candidates = [h];
  else candidates = [h % 12, (h % 12) + 12];
  // 지금보다 앞의 가장 늦은 때 — 오늘이 안 되면 하루 전
  const past = candidates.map(at).filter((d) => d.getTime() <= now.getTime() + MIN);
  if (past.length > 0) return { at: past.sort((a, b) => b.getTime() - a.getTime())[0], rest };
  if (!dayWord) {
    const prev = candidates.map((c) => new Date(at(c).getTime() - DAY)).sort((a, b) => b.getTime() - a.getTime())[0];
    return { at: prev, rest };
  }
  return { at: at(candidates[0]), rest };
}

/** 걸린 시간 — 「15분」 「1시간 10분」 「2시간」(「30분 전」은 시각이라 빼고) */
function duration(text: string): number | null {
  for (const x of text.matchAll(/(?:(\d{1,2})\s*시간\s*)?(\d{1,3})\s*분(?!\s*전)|(\d{1,2})\s*시간(?!\s*전)/g)) {
    const h = Number(x[1] ?? x[3] ?? 0);
    const mm = Number(x[2] ?? 0);
    if (h || mm) return h * 60 + mm;
  }
  return null;
}

const number = (text: string): number | null => {
  const m = /(\d+(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]) : null;
};

/** 기록 이름 읽기 — 없으면 null */
function readRecord(raw: string, now: Date): AddResult | null {
  const text = ` ${raw} `;
  // 반복이나 살 것 · 예약은 기록이 아니라 할 일 — 「매달 1일 분유 주문」
  if (/매일|매주|매달|매월|마다|주문|사기|사야|구매|예약|챙기/.test(text)) return null;
  let kind: EventKind | null = null;
  if (/분유/.test(text)) kind = 'formula';
  else if (/모유|젖/.test(text)) kind = 'breast';
  else if (/수유/.test(text)) kind = /\d+\s*(ml|미리|cc)/i.test(text) ? 'formula' : 'breast';
  else if (/기저귀|소변|대변|응가|똥|오줌|쉬했|쉬\s/.test(text)) kind = 'diaper';
  else if (/체온|열이|열\s/.test(text)) kind = 'temp';
  else if (/몸무게|체중/.test(text)) kind = 'weight';
  else if (/키\s|키가|키는|신장/.test(text)) kind = 'height';
  else if (/잠|잤|재웠/.test(text)) kind = 'sleep';
  if (!kind) return null;

  const time = pastTime(text, now);
  const rest = time?.rest ?? text;
  const at = time?.at ?? now;
  const when = whenLabel(at, now);
  const startAt = at.toISOString();

  if (kind === 'formula') {
    const ml = number(rest.replace(/\d+\s*분/g, ''));
    const ok = ml !== null && ml >= 1 && ml <= 400;
    return { type: 'record', kind, input: { kind, amount: ok ? ml : null, startAt }, complete: ok, title: ok ? `분유 ${ml}ml` : '분유', when };
  }
  if (kind === 'breast') {
    const side: Side | null = /왼/.test(rest) ? 'left' : /오른/.test(rest) ? 'right' : null;
    const min = duration(rest);
    const ok = min !== null && min >= 1 && min <= 180;
    const from = !time && ok ? new Date(now.getTime() - min * MIN) : at;
    const sideWord = side === 'left' ? '왼쪽 ' : side === 'right' ? '오른쪽 ' : '';
    return {
      type: 'record',
      kind,
      input: { kind, side, startAt: from.toISOString(), endAt: ok ? new Date(from.getTime() + min * MIN).toISOString() : null },
      complete: ok,
      title: ok ? `모유 ${sideWord}${min}분` : '모유',
      when: whenLabel(from, now),
    };
  }
  if (kind === 'diaper') {
    // 「대소변」은 「대변」을 품지 않아서 따로 본다
    const both = /대소변|똥오줌|쉬\s*응가|응가\s*쉬/.test(rest);
    const poo = both || /대변|응가|똥/.test(rest);
    const pee = both || /소변|쉬|오줌/.test(rest);
    const diaper: DiaperKind | null = poo && pee ? 'both' : poo ? 'poo' : pee ? 'pee' : null;
    const title = diaper === 'both' ? '소변, 대변' : diaper === 'poo' ? '대변' : diaper === 'pee' ? '소변' : '기저귀';
    return { type: 'record', kind, input: { kind, diaper, startAt }, complete: diaper !== null, title, when };
  }
  if (kind === 'sleep') {
    const min = duration(rest);
    const ok = min !== null && min >= 1 && min <= 16 * 60;
    const from = !time && ok ? new Date(now.getTime() - min * MIN) : at;
    const label = min !== null ? (min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`) : '';
    return {
      type: 'record',
      kind,
      input: { kind, startAt: from.toISOString(), endAt: ok ? new Date(from.getTime() + min * MIN).toISOString() : null },
      complete: ok,
      title: ok ? `잠 ${label}` : '잠',
      when: whenLabel(from, now),
    };
  }
  const value = number(rest);
  const range = kind === 'temp' ? [34, 43] : kind === 'weight' ? [1, 30] : [30, 130];
  const ok = value !== null && value >= range[0] && value <= range[1];
  const unit = kind === 'temp' ? '℃' : kind === 'weight' ? 'kg' : 'cm';
  const name = kind === 'temp' ? '체온' : kind === 'weight' ? '몸무게' : '키';
  return { type: 'record', kind, input: { kind, amount: ok ? value : null, startAt }, complete: ok, title: ok ? `${name} ${value}${unit}` : name, when };
}

/** 반복을 루틴으로 — 매달은 루틴에 없어서 null(반복 할 일로) */
function routineOf(title: string, repeat: Repeat, at: Date | null, hasTime: boolean): AddRoutine | null {
  const time = hasTime && at ? hm(at) : null;
  if (repeat.kind === 'daily') return { title, kind: 'check', everyDays: 1, weekdays: null, time, items: null };
  if (repeat.kind === 'every') return { title, kind: 'check', everyDays: repeat.days, weekdays: null, time, items: null };
  if (repeat.kind === 'weekly') return { title, kind: 'check', everyDays: 7, weekdays: repeat.days, time, items: null };
  return null;
}

export function parseAdd(raw: string, now = new Date()): AddResult | null {
  const text = raw.trim();
  if (!text) return null;
  const record = readRecord(text, now);
  if (record) return record;
  const due = parseDue(text, now);
  // 「2개월 접종 일정 넣어 줘」 → 「2개월 접종」 — 부탁하는 말과 끝의 「일정」은 이름에서 뺀다(물어보기 창, task today/022)
  const title =
    due.title
      .replace(/\s*(하기|할 것|해야 해|해야 함)$/, '')
      .replace(/\s*(일정|할 ?일)?\s*(으로|로)?\s*(넣어|추가해|잡아|등록해|적어|만들어)\s*(줘|주세요|줄래|줘요|둬)?\s*\.?$/, '')
      .replace(/\s+일정$/, '')
      .trim() || text;
  if (due.repeat) {
    const routine = routineOf(title, due.repeat, due.dueAt, due.hasTime);
    const label = `${repeatLabel(due.repeat)}${due.hasTime && due.dueAt ? ` ${hm(due.dueAt)}` : ''}`;
    if (routine) return { type: 'routine', title, routine, when: label };
    if (due.dueAt) return { type: 'todo', title, dueAt: due.dueAt, hasTime: due.hasTime, repeat: due.repeat, when: label };
  }
  if (due.dueAt) {
    const when = due.hasTime ? whenLabel(due.dueAt, now) : whenLabel(due.dueAt, now).replace(/ \d\d:\d\d$/, '');
    return { type: 'todo', title, dueAt: due.dueAt, hasTime: due.hasTime, repeat: null, when };
  }
  return { type: 'plain', title: text };
}
