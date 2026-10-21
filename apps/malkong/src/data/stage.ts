/**
 * 성장 탭의 계산 (SPEC-STAGE-01~03, task growth/004, decisions/031) — 화면 코드를 가져오지 않는 순수 함수만(`node --test src/data/stage.test.ts`).
 *
 * - 막대의 발달 단계는 승인된 CDC 발달 이정표(L1 `k-dev-*`)의 개월과 같다 — 「대부분(75% 이상)의 아기가 그때까지 하는 것」
 * - 막대에는 당근 걷기처럼 네 칸만 보인다 — 지난 단계 하나와 앞으로 올 단계. 아기가 크면 칸이 앞으로 넘어간다
 * - 버디 자세는 개월로 고른다 — 누워서 바둥(0~5) · 기기(6~11) · 걷기(12~)
 */

export type StageStop = {
  /** 이 개월까지 대부분의 아기가 한다(태어남은 0) */
  month: number;
  /** 막대 아래 짧은 이름 */
  short: string;
  /** 카드 · 상세의 이름 */
  name: string;
  /** 승인된 L1 발달 항목 — 태어남은 없다 */
  l1Id: string | null;
};

export const STAGE_STOPS: StageStop[] = [
  { month: 0, short: '태어남', name: '태어남', l1Id: null },
  { month: 2, short: '미소', name: '사회적 미소', l1Id: 'k-dev-0201' },
  { month: 4, short: '옹알이', name: '옹알이', l1Id: 'k-dev-0401' },
  { month: 6, short: '뒤집기', name: '뒤집기', l1Id: 'k-dev-0601' },
  { month: 9, short: '혼자 앉기', name: '혼자 앉기', l1Id: 'k-dev-0901' },
  { month: 12, short: '잡고 서기', name: '잡고 서기', l1Id: 'k-dev-1201' },
];

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
  /** 지난 단계 수(보이는 칸 기준) */
  passed: number;
  /** 다음 단계 — 다 지났으면 null */
  next: StageStop | null;
};

/** 막대에 보일 네 칸과 지금 자리 */
export function stageWindow(birthDate: string, now = new Date(), stops = STAGE_STOPS): StageWindow {
  const today = dayStart(now);
  const at = (s: StageStop) => monthDate(birthDate, s.month).getTime();
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

/** L1 제목 「깨어 있을 때 터미타임 — 지켜보는 가운데 엎드려 놀기」 → 앞뒤 둘로 */
export function splitTitle(title: string): { head: string; tail: string | null } {
  const i = title.indexOf(' — ');
  return i < 0 ? { head: title, tail: null } : { head: title.slice(0, i), tail: title.slice(i + 3) };
}

/** 이맘때 보일 분류와 그 이름표 — 이 순서로, 모두 합쳐 `limit` 개까지 */
export const NOW_KINDS: { kind: string; label: string }[] = [
  { kind: '생활', label: '해 주면 좋아요' },
  { kind: '수면', label: '잠' },
  { kind: '수유', label: '먹기' },
];

export function nowItems<T extends { kind: string }>(items: T[], limit = 3): (T & { label: string })[] {
  const out: (T & { label: string })[] = [];
  for (const k of NOW_KINDS) {
    for (const item of items) {
      if (item.kind === k.kind && out.length < limit) out.push({ ...item, label: k.label });
    }
  }
  return out;
}

/** 우리 아기 메모 (SPEC-STAGE-03) — 이 폰에만 있다(가족 공유는 서버가 받게 된 뒤) */
export type Memo = { id: string; at: string; text: string; createdAt: string; updatedAt: string };

export function makeMemo(text: string, now = new Date()): Memo {
  const iso = now.toISOString();
  return { id: `mm-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at: iso, text: text.trim(), createdAt: iso, updatedAt: iso };
}

/** 최근 것이 위로 */
export function sortMemos(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => b.at.localeCompare(a.at));
}
