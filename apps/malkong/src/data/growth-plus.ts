/**
 * 성장 탭 고도화 (SPEC-STAGE-04 · 05 · 06, task growth/007) — 화면 코드를 가져오지 않는 순수 함수(`node --test src/data/growth-plus.test.ts`).
 *
 * - 오늘의 놀이: 지금 시기의 「해 주면 좋아요」 가운데 날마다 하나. 「했어요」는 그날 그 놀이의 메모(`ref` = `play:<L1 id>:<날짜>`)로 남아
 *   가족 공유로 함께 맞춰진다. 메모 목록에는 따로 보이지 않고 성장 일기에서 달마다 「놀이 N번」으로 모인다
 * - 성장 일기: 메모 · 발달 체크 · 놀이 · 막대 칸(1개월 · 50일 · 100일 …) · 아기 일정 완료 기록을 아기 개월별로 한 줄씩
 * - 주차 · 달 알림: 주차가 바뀌는 날(6개월까지)과 달 · 50일 · 100일이 되는 날 아침 한 번. 알림에는 아기 이름을 넣지 않는다
 * 판정(정상 · 늦어요)은 하지 않고, 못 한 날을 탓하는 말도 쓰지 않는다(헌장 4 · 5).
 */

import { dayNumber, daysSince, monthDate, stageStops, weekOf, type Memo } from './stage.ts';

export const PLAY_PREFIX = 'play:';

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 그날 그 놀이의 메모 열쇠 — 같은 날 다시 누르면 지운다 */
export function playRef(itemId: string, day: Date): string {
  return `${PLAY_PREFIX}${itemId}:${dayKey(day)}`;
}

export function isPlayMemo(m: Pick<Memo, 'ref'>): boolean {
  return !!m.ref && m.ref.startsWith(PLAY_PREFIX);
}

/** 발달 체크로 남긴 메모 — 열쇠가 L1 id 다 */
export function isCheckMemo(m: Pick<Memo, 'ref'>): boolean {
  return !!m.ref && !m.ref.startsWith(PLAY_PREFIX);
}

/** `play:k-life-0211:2026-10-23` → `k-life-0211` */
export function playItemOf(ref: string): string {
  return ref.slice(PLAY_PREFIX.length).split(':')[0];
}

/** 오늘의 놀이 — 태어난 지 며칠째로 날마다 바뀌고, 「다른 놀이」를 누른 만큼 다음 것으로 */
export function todayPlayIndex(poolSize: number, dayNum: number, offset = 0): number {
  if (poolSize <= 0) return -1;
  return (((dayNum + offset) % poolSize) + poolSize) % poolSize;
}

/** 이번 주(월요일부터) 월~일 */
function weekStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

/** 이번 주에 한 놀이 수(월요일부터) */
export function weekPlayCount(memos: Pick<Memo, 'ref' | 'at'>[], now = new Date()): number {
  const from = weekStart(now).getTime();
  return memos.filter((m) => isPlayMemo(m) && new Date(m.at).getTime() >= from).length;
}

/** 오늘 그 놀이를 했는지 */
export function playedToday(memos: Pick<Memo, 'ref'>[], itemId: string, now = new Date()): boolean {
  const ref = playRef(itemId, now);
  return memos.some((m) => m.ref === ref);
}

// ───────── 성장 일기 ─────────

export type DiaryKind = 'memo' | 'check' | 'play' | 'stop' | 'schedule';

export type DiaryEntry = {
  key: string;
  kind: DiaryKind;
  at: Date;
  title: string;
  sub: string;
  /** 오른쪽 날 표시 — 「D+30」, 이번 달 놀이는 「이번 달」 */
  day: string;
  /** 메모 줄이면 그 메모(누르면 고친다) */
  memo?: Memo;
};

export type DiaryMonth = { month: number; title: string; entries: DiaryEntry[] };

/** 아기 일정에서 완료한 기록 — records 의 「기록」 줄 */
export type DiaryRecord = { id: string; label: string; createdAt: string };

/** 그날 아기가 몇 개월인지 — 생일에서 달을 센다 */
export function monthIndexAt(birthDate: string, at: Date): number {
  let m = 0;
  while (m < 60 && monthDate(birthDate, m + 1).getTime() <= at.getTime()) m++;
  return m;
}

const monthDay = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

export function diaryMonths(args: {
  birthDate: string;
  memos: Memo[];
  records: DiaryRecord[];
  /** 놀이 L1 id → 짧은 이름 */
  playName: (itemId: string) => string;
  now?: Date;
}): DiaryMonth[] {
  const { birthDate, memos, records, playName } = args;
  const now = args.now ?? new Date();
  const dayLabel = (at: Date) => `D+${dayNumber(birthDate, at)}`;
  const entries: DiaryEntry[] = [];

  for (const m of memos) {
    if (isPlayMemo(m)) continue;
    const at = new Date(m.at);
    entries.push(
      isCheckMemo(m)
        ? { key: m.id, kind: 'check', at, title: m.text, sub: '발달 체크', day: dayLabel(at) }
        : { key: m.id, kind: 'memo', at, title: m.text, sub: '메모', day: dayLabel(at), memo: m },
    );
  }

  // 놀이는 달마다 한 줄 — 「놀이 12번」, 많이 한 것 둘
  const plays = new Map<number, { count: number; last: Date; by: Map<string, number> }>();
  for (const m of memos) {
    if (!isPlayMemo(m) || !m.ref) continue;
    const at = new Date(m.at);
    const month = monthIndexAt(birthDate, at);
    const slot = plays.get(month) ?? { count: 0, last: at, by: new Map<string, number>() };
    slot.count += 1;
    if (at > slot.last) slot.last = at;
    const name = playName(playItemOf(m.ref));
    slot.by.set(name, (slot.by.get(name) ?? 0) + 1);
    plays.set(month, slot);
  }
  const nowMonth = monthIndexAt(birthDate, now);
  for (const [month, slot] of plays) {
    const top = [...slot.by].sort((a, b) => b[1] - a[1]).slice(0, 2);
    entries.push({
      key: `play-${month}`,
      kind: 'play',
      at: slot.last,
      title: `놀이 ${slot.count}번`,
      sub: top.map(([name, n]) => `${name} ${n}번`).join(' · '),
      day: month === nowMonth ? '이번 달' : dayLabel(slot.last),
    });
  }

  // 막대 칸 — 지난 것만(태어남은 빼고)
  for (const stop of stageStops(birthDate)) {
    if (stop.kind === 'birth' || stop.date.getTime() > now.getTime()) continue;
    entries.push({ key: `stop-${stop.key}`, kind: 'stop', at: stop.date, title: `${stop.label}이 됐어요`, sub: monthDay(stop.date), day: dayLabel(stop.date) });
  }

  for (const r of records) {
    const at = new Date(r.createdAt);
    entries.push({ key: `rec-${r.id}`, kind: 'schedule', at, title: r.label, sub: '아기 일정', day: dayLabel(at) });
  }

  const byMonth = new Map<number, DiaryEntry[]>();
  for (const e of entries) {
    if (e.at.getTime() > now.getTime() + 60_000) continue;
    const month = monthIndexAt(birthDate, e.at);
    byMonth.set(month, [...(byMonth.get(month) ?? []), e]);
  }
  return [...byMonth]
    .sort((a, b) => b[0] - a[0])
    .map(([month, list]) => {
      const start = monthDate(birthDate, month);
      return {
        month,
        title: `${month}개월 · ${start.getMonth() + 1}월`,
        // 같은 날이면 막대 칸(「1개월이 됐어요」)이 위로
        entries: list.sort((a, b) => b.at.getTime() - a.at.getTime() || (a.kind === 'stop' ? -1 : b.kind === 'stop' ? 1 : 0)),
      };
    });
}

// ───────── 주차 · 달 알림 ─────────

export type GrowthNotice = { id: string; at: Date; title: string; body: string };

/** 받침이 있으면 「을」, 없으면 「를」 */
export function objectParticle(word: string): string {
  const last = word.trim().charCodeAt(word.trim().length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를';
  return (last - 0xac00) % 28 === 0 ? '를' : '을';
}

/** 주차 알림은 6개월(26주차)까지 — 그 뒤로는 달마다만 */
const WEEKLY_UNTIL = 26;

/**
 * 앞으로 `days` 일 안의 주차 · 달 · 50일 · 100일 알림(그날 `hour:minute`). 같은 날이면 달 · 기념일이 이긴다.
 * `playFor(day)` — 그날 시기의 놀이 하나(없으면 주차 알림 본문은 성장 탭 안내)
 * `checkpointOpens(month)` — 그 달에 새 발달 체크 목록이 열리면 그 개월(예: 2개월이 되면 4)
 */
export function growthNotices(args: {
  birthDate: string;
  now?: Date;
  days?: number;
  hour: number;
  minute: number;
  playFor: (day: Date) => string | null;
  checkpointOpens: (month: number) => number | null;
}): GrowthNotice[] {
  const { birthDate, hour, minute, playFor, checkpointOpens } = args;
  const now = args.now ?? new Date();
  const horizon = args.days ?? 35;
  const out = new Map<string, GrowthNotice>();
  const at = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);

  for (let i = 0; i <= horizon; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const since = daysSince(birthDate, day);
    if (since <= 0 || since % 7 !== 0) continue;
    const week = weekOf(since);
    if (week > WEEKLY_UNTIL) continue;
    const play = playFor(day);
    out.set(dayKey(day), {
      id: `week-${week}`,
      at: at(day),
      title: `아기가 ${week}주차가 됐어요`,
      body: play ? `이번 주에는 「${play}」${objectParticle(play)} 해 볼까요?` : '성장 탭에서 이번 주에 해 줄 수 있는 것을 볼 수 있어요.',
    });
  }

  const stops = stageStops(birthDate);
  for (const stop of stops) {
    if (stop.kind === 'birth') continue;
    const when = at(stop.date);
    const days = Math.round((stop.date.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
    if (days < 0 || days > horizon) continue;
    let body: string;
    const month = stop.kind === 'month' ? Number(stop.key.slice(1)) : null;
    const opens = month !== null ? checkpointOpens(month) : null;
    if (opens) body = `${opens}개월까지 대부분 하는 것이 새로 열렸어요.`;
    else {
      const next = stops.find((s) => s.date.getTime() > stop.date.getTime());
      body = next ? `다음은 ${next.label}이에요(${monthDay(next.date)}).` : '오늘을 성장 일기에 남겨 둘까요?';
    }
    const title = stop.kind === 'day' ? `오늘은 아기가 태어난 지 ${stop.label}이에요` : month === 12 ? '오늘은 아기 첫 돌이에요' : `아기가 ${stop.label}이 됐어요`;
    out.set(dayKey(stop.date), { id: `stop-${stop.key}`, at: when, title, body });
  }

  return [...out.values()].filter((n) => n.at.getTime() > now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime());
}
