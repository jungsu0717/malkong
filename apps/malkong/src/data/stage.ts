/**
 * 성장 탭의 계산 (SPEC-STAGE-01~03, task growth/004, decisions/031) — 화면 코드를 가져오지 않는 순수 함수만(`node --test src/data/stage.test.ts`).
 *
 * - 막대의 칸은 달마다 · 50일 · 100일이고, 발달 단계는 승인된 CDC 이정표(L1 `k-dev-MM01`)의 달에 붙는다
 * - 막대에는 당근 걷기처럼 네 칸만 보인다 — 지난 칸 하나와 앞으로 올 칸. 아기가 크면 칸이 앞으로 넘어간다
 * - 발달 체크 · 해 주면 좋아요 · 알아 두면 좋아요는 L1 id 목록으로 정한다(task growth/005)
 * - 버디 자세는 개월로 고른다 — 누워서 바둥(0~5) · 기기(6~11) · 걷기(12~)
 */

export type StageStop = {
  key: string;
  date: Date;
  /** 막대 아래 큰 글씨 — 「2개월」 「50일」 「돌」 */
  label: string;
  /** 그 아래 작은 글씨 — 발달 단계가 있으면 그 이름(코랄), 아니면 날짜 */
  sub: string;
  kind: 'birth' | 'month' | 'day';
  /** 이 달까지 대부분의 아기가 하는 것 — 승인된 CDC 이정표(L1) */
  milestone: { name: string; short: string; l1Id: string } | null;
};

/** 발달 단계가 있는 달 — 승인된 L1 `k-dev-MM01` */
const MILESTONES: Record<number, { name: string; short: string }> = {
  2: { name: '사회적 미소', short: '미소' },
  4: { name: '옹알이', short: '옹알이' },
  6: { name: '뒤집기', short: '뒤집기' },
  9: { name: '혼자 앉기', short: '혼자 앉기' },
  12: { name: '잡고 서기', short: '잡고 서기' },
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 막대의 칸 — 태어남, 달마다(1~24개월, 12개월은 「돌」 · 24개월은 「두 돌」), 50일 · 100일.
 * 칸이 몇 주마다 있어서 막대가 자주 움직인다(Julian, 2026-10-22: 「2개월마다 확인할 수 있는 정보들밖에 없잖아」).
 */
export function stageStops(birthDate: string): StageStop[] {
  const birth = birthDay(birthDate);
  const dateText = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const addDays = (n: number) => new Date(birth.getFullYear(), birth.getMonth(), birth.getDate() + n);
  const stops: StageStop[] = [{ key: 'birth', date: birth, label: '태어남', sub: dateText(birth), kind: 'birth', milestone: null }];
  for (let m = 1; m <= 24; m++) {
    const date = monthDate(birthDate, m);
    const ms = MILESTONES[m];
    stops.push({
      key: `m${m}`,
      date,
      label: m === 12 ? '돌' : m === 24 ? '두 돌' : `${m}개월`,
      sub: ms ? ms.short : dateText(date),
      kind: 'month',
      milestone: ms ? { ...ms, l1Id: `k-dev-${pad2(m)}01` } : null,
    });
  }
  // 50일 · 100일 — 태어난 날을 1일로 센다(50일 = 태어나고 49일 뒤)
  for (const [n, label] of [[49, '50일'], [99, '100일']] as const) {
    const date = addDays(n);
    stops.push({ key: `d${n + 1}`, date, label, sub: dateText(date), kind: 'day', milestone: null });
  }
  return stops.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** 막대에 보이는 칸 수 */
export const WINDOW = 4;

export type BuddyPose = 'lie' | 'crawl' | 'walk';

const DAY = 86_400_000;

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 「2026-09-20」 → 그날 0시 */
export function birthDay(birthDate: string): Date {
  const [y, m, d] = birthDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 생일에서 `month` 개월이 되는 날 */
export function monthDate(birthDate: string, month: number): Date {
  const b = birthDay(birthDate);
  return new Date(b.getFullYear(), b.getMonth() + month, b.getDate());
}

/** 태어나고 지난 날 수 — 태어난 날이 0(「D+0」) */
export function daysSince(birthDate: string, now = new Date()): number {
  return Math.max(0, Math.round((dayStart(now) - birthDay(birthDate).getTime()) / DAY));
}

/** 「5주차」 — 첫 주가 1주차 */
export function weekOf(days: number): number {
  return Math.floor(days / 7) + 1;
}

export function poseOf(month: number): BuddyPose {
  if (month < 6) return 'lie';
  if (month < 12) return 'crawl';
  return 'walk';
}

export type StageWindow = {
  stops: StageStop[];
  /** 막대에서 지금 자리(0~1) — 칸 사이는 날짜로 나눈다 */
  progress: number;
  /** 지난 칸 수(보이는 칸 기준) */
  passed: number;
  /** 다음 칸 — 다 지났으면 null */
  next: StageStop | null;
};

/** 막대에 보일 네 칸과 지금 자리 — 지난 칸 하나와 앞으로 올 칸 */
export function stageWindow(birthDate: string, now = new Date(), stops = stageStops(birthDate)): StageWindow {
  const today = dayStart(now);
  const at = (s: StageStop) => s.date.getTime();
  const nextIndex = stops.findIndex((s) => at(s) > today);
  const start = nextIndex < 0 ? stops.length - WINDOW : Math.min(Math.max(0, nextIndex - 1), stops.length - WINDOW);
  const shown = stops.slice(start, start + WINDOW);
  const passed = shown.filter((s) => at(s) <= today).length;
  let progress = 1;
  if (nextIndex >= 0) {
    const local = nextIndex - start;
    const from = at(stops[nextIndex - 1] ?? stops[0]);
    const to = at(stops[nextIndex]);
    const part = to > from ? Math.min(1, Math.max(0, (today - from) / (to - from))) : 0;
    progress = (local - 1 + part) / (WINDOW - 1);
  }
  return { stops: shown, progress: Math.min(1, Math.max(0, progress)), passed, next: nextIndex < 0 ? null : stops[nextIndex] };
}

/** 발달 체크의 단계 — 지금 개월 다음의 CDC 이정표(2 · 4 · 6 · 9 · 12개월) */
export const CHECKPOINTS = [2, 4, 6, 9, 12] as const;
/** 단계마다 체크 항목 수 — L1 `k-dev-MM11` 부터 */
const CHECK_COUNTS: Record<number, number> = { 2: 11, 4: 13, 6: 12, 9: 13, 12: 10 };

export function checkpointFor(month: number): number {
  return CHECKPOINTS.find((cp) => month < cp) ?? 12;
}

export function nextCheckpoint(cp: number): number | null {
  const i = CHECKPOINTS.indexOf(cp as (typeof CHECKPOINTS)[number]);
  return i >= 0 && i < CHECKPOINTS.length - 1 ? CHECKPOINTS[i + 1] : null;
}

/** 그 단계의 체크 항목 L1 id */
export function checklistIds(cp: number): string[] {
  return Array.from({ length: CHECK_COUNTS[cp] ?? 0 }, (_, i) => `k-dev-${pad2(cp)}${pad2(11 + i)}`);
}

/** 그 단계의 「해 주면 좋아요」 L1 id — 터미타임(0~5개월)과 단계마다 다섯 */
export function tipIds(cp: number): string[] {
  return ['k-life-0001', ...Array.from({ length: 5 }, (_, i) => `k-life-${pad2(cp)}${pad2(11 + i)}`)];
}

/** 「알아 두면 좋아요」 — 흔한 것 · 꼭 지킬 것. 개월이 맞는 것만 보인다 */
export const KNOW_COMMON = ['k-life-0003', 'k-sleep-0006', 'k-sleep-0401', 'k-feed-0001', 'k-parent-0001'];
export const KNOW_MUST = ['k-sleep-0001', 'k-safe-0001', 'k-safe-0003', 'k-feed-0004'];

/** L1 제목 「깨어 있을 때 터미타임 — 지켜보는 가운데 엎드려 놀기」 → 앞뒤 둘로 */
export function splitTitle(title: string): { head: string; tail: string | null } {
  const i = title.indexOf(' — ');
  return i < 0 ? { head: title, tail: null } : { head: title.slice(0, i), tail: title.slice(i + 3) };
}

/** 개월이 맞는 것만 — L1 항목의 `months` */
export function forMonth<T extends { months: number[] }>(items: T[], month: number): T[] {
  return items.filter((i) => i.months.includes(month));
}

/** 우리 아기 메모 (SPEC-STAGE-03) — 가족과 함께 보기를 켜면 가족 폰과 맞춘다(task common/024). 발달 체크로 남긴 메모는 `ref` 에 그 L1 id */
export type Memo = { id: string; at: string; text: string; ref: string | null; createdAt: string; updatedAt: string };

/** 발달 체크 메모는 id 를 항목으로 정한다 — 가족의 두 폰에서 같은 것을 눌러도 한 줄이고, 지우면 함께 지워진다 */
export function makeMemo(text: string, now = new Date(), ref: string | null = null): Memo {
  const iso = now.toISOString();
  return {
    id: ref ? `mm-${ref}` : `mm-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: iso,
    text: text.trim(),
    ref,
    createdAt: iso,
    updatedAt: iso,
  };
}

/** 최근 것이 위로 */
export function sortMemos(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => b.at.localeCompare(a.at));
}
