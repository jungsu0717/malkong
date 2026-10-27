/**
 * 루틴 (SPEC-MAIN-01~07, task today/001 · 003, decisions/028 · 029) — 목욕 · 터미타임 · 젖병 소독처럼 날마다(또는 N일마다) 챙기는 일.
 *
 * 루틴은 정의(`Routine`)와 한 번 할 때마다 한 줄(`RoutineLog`)로 나눠 저장한다. 오늘 했는지, 지난번부터 며칠은
 * 저장하지 않고 볼 때마다 센다(헌장 3). 알림은 알림 시각이 있는 루틴만, 그날 할 차례이고 아직 안 했을 때.
 * 단계가 있는 루틴(밤잠 준비)은 단계마다 한 줄(`step` 번호)을 남기고, 루틴 전체를 끝내면 `step` 이 빈 줄을 하나 더 남긴다.
 * 오늘 했는지 · 지난번부터 며칠은 `step` 이 빈 줄로만 센다.
 *
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/routine.test.ts`).
 */

/**
 * 체크(누르면 완료, 단계를 둘 수 있다) · 재고 확인(물건마다 충분 · 부족, SPEC-MAIN-06).
 * 타이머(분을 쌓는 루틴)는 2026-10-27 에 뺐다(task today/006) — 예전에 만든 것은 읽을 때 체크로 바꾼다
 */
export type RoutineKind = 'check' | 'stock';

/** 저장된 종류를 읽을 때 — 재고 확인이 아니면 모두 체크(옛 타이머 루틴 포함) */
export function routineKindOf(value: unknown): RoutineKind {
  return value === 'stock' ? 'stock' : 'check';
}

export type Routine = {
  id: string;
  title: string;
  kind: RoutineKind;
  /** 1 이면 매일, 7 이면 지난번에 한 날부터 7일마다. 요일을 정했으면(`weekdays`) 쓰지 않는다 */
  everyDays: number;
  /** 요일 반복(0 일요일 ~ 6 토요일) — 「매주 일요일」. 없으면 null(task common/022) */
  weekdays: number[] | null;
  /** 알림 시각 `HH:MM` — 없으면 알리지 않고 「하루 중」에 묶인다 */
  time: string | null;
  /** 체크는 단계(없으면 null), 재고 확인은 확인할 물건 */
  items: string[] | null;
  /** 지운 루틴 — 지난 기록은 남긴다 */
  hidden: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

export type RoutineLog = {
  id: string;
  routineId: string;
  /** 한 때 */
  at: string;
  /** 누가 했나 — 가족 공유를 켠 폰에서 「가족에게 보일 이름」(task my/009) */
  by: string | null;
  /** 단계 번호(0부터) — 루틴 전체를 한 줄이면 null */
  step: number | null;
  /** 「오늘은 건너뛰기」 줄 — 한 것으로 세지 않고, 그날 알림과 진행에서 뺀다(task common/022) */
  skip: boolean;
  createdAt: string;
};

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

/** 그 루틴을 그날 한 기록들 */
export function logsOn(routineId: string, logs: RoutineLog[], day: Date): RoutineLog[] {
  const from = startOfDay(day).toISOString();
  const to = addDays(day, 1).toISOString();
  return logs.filter((l) => l.routineId === routineId && l.at >= from && l.at < to).sort((a, b) => a.at.localeCompare(b.at));
}

/** 루틴을 끝낸 줄인가 — 단계 줄과 건너뛴 줄은 아니다 */
const isWhole = (l: RoutineLog) => l.step == null && !l.skip;

/** 그날 전(그날은 빼고)에 마지막으로 루틴을 끝낸 기록 */
function lastBefore(routineId: string, logs: RoutineLog[], day: Date): RoutineLog | undefined {
  const from = startOfDay(day).toISOString();
  return logs
    .filter((l) => l.routineId === routineId && isWhole(l) && l.at < from)
    .sort((a, b) => a.at.localeCompare(b.at))
    .pop();
}

const hasWeekdays = (r: Pick<Routine, 'weekdays'>) => !!r.weekdays && r.weekdays.length > 0;

/**
 * 그날이 할 차례인가 — 요일을 정했으면 그 요일, 매일이면 늘,
 * N일마다면 그날 전 마지막 기록부터 N일이 지났을 때(한 적이 없으면 차례)
 */
export function isDueOn(routine: Routine, logs: RoutineLog[], day: Date): boolean {
  if (hasWeekdays(routine)) return routine.weekdays!.includes(day.getDay());
  if (routine.everyDays <= 1) return true;
  const last = lastBefore(routine.id, logs, day);
  return !last || daysBetween(new Date(last.at), day) >= routine.everyDays;
}

export type TodayState = {
  /** 오늘 할 차례인가(오늘 이미 했으면 차례였던 것으로 본다) */
  due: boolean;
  /** 오늘 완료했나 */
  done: boolean;
  /** 오늘 처음 한 때 */
  firstAt: string | null;
  /** 오늘 처음 한 사람(가족 공유 이름) */
  firstBy: string | null;
  /** 지난번(오늘 전)에 한 지 며칠 — 한 적이 없으면 null */
  sinceDays: number | null;
  /** 다음 차례까지 며칠(오늘이 차례면 0) */
  nextInDays: number;
  /** 오늘 끝낸 단계 번호(단계가 있는 루틴) */
  stepsDone: number[];
  /** 오늘은 건너뛰었나 */
  skipped: boolean;
};

export function todayState(routine: Routine, logs: RoutineLog[], now = new Date()): TodayState {
  const all = logsOn(routine.id, logs, now);
  const today = all.filter(isWhole);
  const skipped = all.some((l) => l.skip);
  const stepsDone = [...new Set(all.filter((l) => l.step != null).map((l) => l.step as number))].sort((a, b) => a - b);
  const last = lastBefore(routine.id, logs, now);
  const sinceDays = last ? daysBetween(new Date(last.at), now) : null;
  const done = today.length > 0;
  const due = today.length > 0 || skipped || isDueOn(routine, logs, now);
  let nextInDays = 0;
  if (!due && hasWeekdays(routine)) {
    nextInDays = [1, 2, 3, 4, 5, 6, 7].find((n) => routine.weekdays!.includes(addDays(now, n).getDay())) ?? 7;
  } else if (!due && sinceDays !== null) {
    nextInDays = Math.max(0, routine.everyDays - sinceDays);
  }
  return { due, done, firstAt: today[0]?.at ?? null, firstBy: today[0]?.by ?? null, sinceDays, nextInDays, stepsDone, skipped };
}

/** 단계가 있는 체크 루틴인가 */
export function hasSteps(routine: Routine): boolean {
  return routine.kind === 'check' && !!routine.items && routine.items.length > 0;
}

export type Slot = 'morning' | 'day' | 'evening' | 'any';
export const SLOT_LABELS: Record<Slot, string> = { morning: '아침', day: '낮', evening: '저녁', any: '하루 중' };

/** 알림 시각으로 시간대를 나눈다 — 11시 전 아침, 17시 전 낮, 그 뒤 저녁, 시각이 없으면 하루 중 */
export function slotOf(time: string | null): Slot {
  if (!time) return 'any';
  const hour = Number(time.split(':')[0]);
  return hour < 11 ? 'morning' : hour < 17 ? 'day' : 'evening';
}

/** `HH:MM` 인가 */
export function isTime(text: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** `HH:MM` → 자정부터 몇 분 */
function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 「오후 7:00」 */
export function timeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}

/** 「매일」 「2일마다」 「매주」 */
export function everyLabel(days: number): string {
  if (days <= 1) return '매일';
  if (days === 7) return '매주';
  return `${days}일마다`;
}

const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

/** 반복 이름 — 요일을 정했으면 「매주 일요일」 「매주 월 · 수 · 금」(일곱 요일 다면 「매일」), 아니면 everyLabel */
export function scheduleLabel(r: { everyDays: number; weekdays?: number[] | null }): string {
  const days = [...new Set(r.weekdays ?? [])].sort((a, b) => a - b);
  if (days.length === 0) return everyLabel(r.everyDays);
  if (days.length === 7) return '매일';
  if (days.length === 1) return `매주 ${DAY_SHORT[days[0]]}요일`;
  return `매주 ${days.map((d) => DAY_SHORT[d]).join(' · ')}`;
}

/** 「08:10」 */
export function clockLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 오늘 탭 루틴 버튼의 상태 한 줄(SPEC-MAIN-02, task today/002) — 완료했으면 「08:10 완료」(가족 이름이 있으면 「엄마 · 08:10」),
 * 오늘 할 날이 아니면 「내일」 「3일 뒤」, N일마다는 「마지막 7일 전」, 그 밖에는 알림 시각이나 「매일」.
 */
export function statusLine(routine: Routine, state: TodayState): { text: string; done: boolean } {
  if (!state.due) return { text: state.nextInDays === 1 ? '내일' : `${state.nextInDays}일 뒤`, done: false };
  if (state.skipped && !state.firstAt) return { text: '오늘은 건너뜀', done: false };
  if (state.firstAt) {
    const at = clockLabel(state.firstAt);
    return { text: state.firstBy ? `${state.firstBy} · ${at}` : `${at} 완료`, done: true };
  }
  // 단계가 있으면 하는 중엔 「1 / 4단계」, 시작 전엔 「오후 8:30 · 4단계」
  if (hasSteps(routine)) {
    const total = routine.items!.length;
    if (state.stepsDone.length > 0) return { text: `${state.stepsDone.length} / ${total}단계`, done: false };
    return { text: `${routine.time ? timeLabel(routine.time) : scheduleLabel(routine)} · ${total}단계`, done: false };
  }
  if (!hasWeekdays(routine) && routine.everyDays > 1 && state.sinceDays) return { text: `마지막 ${state.sinceDays}일 전`, done: false };
  if (routine.time) return { text: timeLabel(routine.time), done: false };
  return { text: scheduleLabel(routine), done: false };
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** 다른 날 루틴의 「언제」 — 「내일」, 이번 주 안이면 「일요일」, 그 뒤는 「9일 뒤」 */
export function nextDayLabel(nextInDays: number, now = new Date()): string {
  if (nextInDays <= 1) return '내일';
  if (nextInDays <= 6) return WEEKDAYS[addDays(now, nextInDays).getDay()];
  return `${nextInDays}일 뒤`;
}

/** 「10월 16일 금요일」 */
export function dateLabel(now: Date): string {
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}`;
}

export type TodayItem = { r: Routine; s: TodayState };

/**
 * 루틴 탭에 보일 것(SPEC-MAIN-01) — 오늘 할 루틴(알림 시각 순, 시각 없는 것은 뒤에), 다른 날 루틴(가까운 순), 진행(완료 수 · 다음 루틴).
 * 누를 때마다 자리가 바뀌지 않게 완료 여부로는 순서를 바꾸지 않는다.
 * 다음 루틴은 아직 안 한 것 중 시각이 지났거나 한 시간 안에 올 것, 없으면 시각 없는 것, 그것도 없으면 가장 가까운 시각의 것.
 * 오후 3시에 밤 8시 반 루틴보다 아직 안 한 터미타임을 먼저 권한다.
 */
export function todayPlan(routines: Routine[], logs: RoutineLog[], now = new Date()) {
  const states = routines.map((r) => ({ r, s: todayState(r, logs, now) }));
  const today = states
    .filter((x) => x.s.due)
    .sort((a, b) => (a.r.time ?? '99').localeCompare(b.r.time ?? '99') || a.r.sort - b.r.sort);
  const later = states.filter((x) => !x.s.due).sort((a, b) => a.s.nextInDays - b.s.nextInDays || a.r.sort - b.r.sort);
  // 건너뛴 것은 진행에서 뺀다 — 화면에는 남겨 되돌릴 수 있게 한다
  const counted = today.filter((x) => !(x.s.skipped && !x.s.done));
  const done = counted.filter((x) => x.s.done).length;
  const open = counted.filter((x) => !x.s.done);
  const soon = now.getHours() * 60 + now.getMinutes() + 60;
  const next =
    open.find((x) => x.r.time && isTime(x.r.time) && minutesOfDay(x.r.time) <= soon) ?? open.find((x) => !x.r.time) ?? open[0] ?? null;
  return { today, later, done, total: counted.length, next };
}

export type RoutineReminder = { id: string; routineId: string; at: Date; title: string; body: string };

/**
 * 루틴 알림(SPEC-MAIN-04) — 알림 시각이 있는 루틴마다 오늘부터 `days` 일, 그날 할 차례이고 아직 안 했을 때.
 * 앞날은 그 사이 하지 않았다고 보고 센다(했으면 앱이 다시 걸어 지운다). 이미 지난 때는 뺀다.
 */
export function routineReminders(routines: Routine[], logs: RoutineLog[], now = new Date(), days = 3): RoutineReminder[] {
  const out: RoutineReminder[] = [];
  for (const r of routines) {
    if (r.hidden || !r.time || !isTime(r.time)) continue;
    const [h, m] = r.time.split(':').map(Number);
    for (let i = 0; i < days; i++) {
      const day = addDays(now, i);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      if (at.getTime() <= now.getTime()) continue;
      if (!isDueOn(r, logs, day)) continue;
      if (i === 0) {
        const state = todayState(r, logs, now);
        if (state.skipped || state.done) continue;
      }
      let body = `${SLOT_LABELS[slotOf(r.time)]}에 챙길 루틴이에요`;
      if (!hasWeekdays(r) && r.everyDays > 1) {
        const last = lastBefore(r.id, logs, day);
        if (last) body = `마지막으로 한 지 ${daysBetween(new Date(last.at), day)}일 지났어요`;
      }
      out.push({ id: `${r.id}-${i}`, routineId: r.id, at, title: `${r.title} 시간이에요`, body });
    }
  }
  return out;
}

/**
 * 루틴 추천(SPEC-MAIN-03) — 한 번 만들어 두고 자주 고치지 않는다(헌장 8). 며칠마다 해서 까먹기 쉬운 일 중심이고,
 * 놀이는 성장 탭 「오늘의 놀이」에 맡긴다(task today/006). 영양제 · 약은 넣지 않는다(헌장 5)
 */
export type RoutineTemplate = {
  title: string;
  kind: RoutineKind;
  everyDays: number;
  time: string | null;
  items?: string[];
  weekdays?: number[];
};

/** 같은 루틴인지 볼 때의 이름 — 띄어쓰기는 보지 않는다(「밤잠 준비」 = 「밤잠준비」) */
export function titleKey(title: string): string {
  return title.replace(/\s+/g, '');
}

/** 추천을 그대로 추가할 때의 값 */
export function templateInput(t: RoutineTemplate): RoutineInput {
  return { title: t.title, kind: t.kind, everyDays: t.everyDays, weekdays: t.weekdays ?? null, time: t.time, items: t.items ?? null };
}

/** 추천 줄의 설명 — 「2일마다 · 목욕 → 보습」 「매주 일요일 · 분유 · 기저귀 · 물티슈」 「매일 · 오후 8:00」 */
export function templateDetail(t: RoutineTemplate): string {
  const every = scheduleLabel(t);
  if (t.kind === 'stock') return [every, ...(t.items ?? []).slice(0, 3)].join(' · ');
  if (t.items?.length) return `${every} · ${t.items.join(' → ')}`;
  return t.time ? `${every} · ${timeLabel(t.time)}` : every;
}

/** 재고 확인의 처음 물건(SPEC-MAIN-06) */
export const STOCK_ITEMS = ['분유', '기저귀', '물티슈', '아기 바디워시', '보습 로션'];

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  { title: '목욕', kind: 'check', everyDays: 2, time: '20:00', items: ['목욕', '보습'] },
  { title: '밤잠 준비', kind: 'check', everyDays: 1, time: '20:30', items: ['스와들 입히기', '수유', '트림', '자장가 부르며 재우기'] },
  { title: '손발톱 깎기', kind: 'check', everyDays: 3, time: null },
  { title: '아기 빨래', kind: 'check', everyDays: 2, time: null },
  { title: '가제수건 삶기', kind: 'check', everyDays: 2, time: null },
  { title: '젖병 소독', kind: 'check', everyDays: 1, time: null },
  { title: '터미타임', kind: 'check', everyDays: 1, time: null },
  { title: '재고 확인', kind: 'stock', everyDays: 7, time: null, items: STOCK_ITEMS, weekdays: [0] },
  { title: '기저귀 휴지통 비우기', kind: 'check', everyDays: 2, time: null },
  { title: '아기 침구 빨래', kind: 'check', everyDays: 7, time: null },
  { title: '분유포트 세척', kind: 'check', everyDays: 7, time: null },
  { title: '가습기 청소', kind: 'check', everyDays: 7, time: null },
  { title: '산책', kind: 'check', everyDays: 1, time: null },
  { title: '장난감 소독', kind: 'check', everyDays: 7, time: null },
  { title: '쪽쪽이 바꾸기', kind: 'check', everyDays: 60, time: null },
  { title: '모자동실', kind: 'check', everyDays: 1, time: null },
  // 6개월부터 · 12개월부터(task today/005) — 시기마다 다른 단계는 recommend.ts 가 바꿔 넣는다
  { title: '이유식', kind: 'check', everyDays: 1, time: '10:00' },
  { title: '양치', kind: 'check', everyDays: 1, time: null, items: ['아침 양치', '자기 전 양치'] },
  { title: '유아식', kind: 'check', everyDays: 1, time: null, items: ['아침', '점심', '저녁'] },
  { title: '간식', kind: 'check', everyDays: 1, time: '15:00' },
];

export function newRoutineId(): string {
  return `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newRoutineLogId(): string {
  return `rl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type RoutineInput = Pick<Routine, 'title' | 'kind' | 'everyDays' | 'weekdays' | 'time' | 'items'>;

export function makeRoutine(input: RoutineInput, sort: number, now = new Date()): Routine {
  const at = now.toISOString();
  return { ...input, id: newRoutineId(), hidden: false, sort, createdAt: at, updatedAt: at };
}

export function makeRoutineLog(
  routineId: string,
  at: Date,
  by: string | null = null,
  step: number | null = null,
  skip = false,
): RoutineLog {
  return { id: newRoutineLogId(), routineId, at: at.toISOString(), by, step, skip, createdAt: new Date().toISOString() };
}

/** 같은 물건인가 — 띄어쓰기를 빼고 본다 */
const sameName = (a: string, b: string) => titleKey(a) === titleKey(b);

/**
 * 재고 확인에서 「부족」을 고른 것 중 장보기에 새로 넣을 것(SPEC-MAIN-06) — 살 것 · 배송 중(`open`)에 같은 이름이 있으면 뺀다.
 * 살 곳은 그 물건을 지난번에 산 곳(`bought` 의 마지막), 없으면 null.
 */
export function stockToBuy(
  short: string[],
  open: string[],
  bought: { title: string; store: string | null; doneAt: string }[],
): { title: string; store: string | null }[] {
  return short
    .filter((name) => !open.some((o) => sameName(o, name)))
    .map((name) => {
      const last = bought.filter((b) => sameName(b.title, name)).sort((a, b) => a.doneAt.localeCompare(b.doneAt)).pop();
      return { title: name, store: last?.store ?? null };
    });
}
