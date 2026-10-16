/**
 * 루틴 (SPEC-MAIN-01~04, task today/001, decisions/028) — 목욕 · 터미타임 · 젖병 소독처럼 날마다(또는 N일마다) 챙기는 일.
 *
 * 루틴은 정의(`Routine`)와 한 번 할 때마다 한 줄(`RoutineLog`)로 나눠 저장한다. 오늘 했는지, 오늘 몇 분, 지난번부터 며칠은
 * 저장하지 않고 볼 때마다 센다(헌장 3). 알림은 알림 시각이 있는 루틴만, 그날 할 차례이고 아직 안 했을 때.
 *
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/routine.test.ts`).
 */

/** 체크(누르면 완료) · 타이머(분을 쌓는다) */
export type RoutineKind = 'check' | 'minutes';

export type Routine = {
  id: string;
  title: string;
  kind: RoutineKind;
  /** 1 이면 매일, 7 이면 지난번에 한 날부터 7일마다 */
  everyDays: number;
  /** 알림 시각 `HH:MM` — 없으면 알리지 않고 「하루 중」에 묶인다 */
  time: string | null;
  /** 타이머 루틴의 하루 목표(분) — 없어도 된다 */
  goalMinutes: number | null;
  /** 지운 루틴 — 지난 기록은 남긴다 */
  hidden: boolean;
  sort: number;
  /** 타이머를 켠 때 — 멈추면 걸린 분을 기록으로 남기고 비운다 */
  runningSince: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoutineLog = {
  id: string;
  routineId: string;
  /** 한 때 */
  at: string;
  /** 타이머 루틴의 분. 체크는 null */
  minutes: number | null;
  /** 누가 했나 — 가족 공유를 켠 폰에서 「가족에게 보일 이름」(task my/009) */
  by: string | null;
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

/** 그날 전(그날은 빼고)에 마지막으로 한 기록 */
function lastBefore(routineId: string, logs: RoutineLog[], day: Date): RoutineLog | undefined {
  const from = startOfDay(day).toISOString();
  return logs
    .filter((l) => l.routineId === routineId && l.at < from)
    .sort((a, b) => a.at.localeCompare(b.at))
    .pop();
}

/** 그날이 할 차례인가 — 매일이면 늘, N일마다면 그날 전 마지막 기록부터 N일이 지났을 때(한 적이 없으면 차례) */
export function isDueOn(routine: Routine, logs: RoutineLog[], day: Date): boolean {
  if (routine.everyDays <= 1) return true;
  const last = lastBefore(routine.id, logs, day);
  return !last || daysBetween(new Date(last.at), day) >= routine.everyDays;
}

export type TodayState = {
  /** 오늘 할 차례인가(오늘 이미 했으면 차례였던 것으로 본다) */
  due: boolean;
  /** 체크: 오늘 완료했나. 타이머: 목표가 있으면 채웠나 */
  done: boolean;
  /** 오늘 처음 한 때 */
  firstAt: string | null;
  /** 오늘 처음 한 사람(가족 공유 이름) */
  firstBy: string | null;
  /** 오늘 쌓은 분 */
  minutes: number;
  /** 지난번(오늘 전)에 한 지 며칠 — 한 적이 없으면 null */
  sinceDays: number | null;
  /** 다음 차례까지 며칠(오늘이 차례면 0) */
  nextInDays: number;
};

export function todayState(routine: Routine, logs: RoutineLog[], now = new Date()): TodayState {
  const today = logsOn(routine.id, logs, now);
  const last = lastBefore(routine.id, logs, now);
  const sinceDays = last ? daysBetween(new Date(last.at), now) : null;
  const minutes = today.reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  const done = routine.kind === 'check' ? today.length > 0 : routine.goalMinutes ? minutes >= routine.goalMinutes : false;
  const due = today.length > 0 || isDueOn(routine, logs, now);
  const nextInDays = due || sinceDays === null ? 0 : Math.max(0, routine.everyDays - sinceDays);
  return { due, done, firstAt: today[0]?.at ?? null, firstBy: today[0]?.by ?? null, minutes, sinceDays, nextInDays };
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

/** 「08:10」 */
export function clockLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 오늘 탭 루틴 버튼의 상태 한 줄(SPEC-MAIN-02, task today/002) — 완료했으면 「08:10 완료」(가족 이름이 있으면 「엄마 · 08:10」),
 * 오늘 할 날이 아니면 「내일」 「3일 뒤」, 타이머는 「15분 / 30분」 「오늘 15분」, N일마다는 「마지막 7일 전」, 그 밖에는 알림 시각이나 「매일」.
 * 타이머가 켜져 있을 때의 시계는 화면이 따로 그린다.
 */
export function statusLine(routine: Routine, state: TodayState): { text: string; done: boolean } {
  if (!state.due) return { text: state.nextInDays === 1 ? '내일' : `${state.nextInDays}일 뒤`, done: false };
  if (routine.kind === 'minutes') {
    if (routine.goalMinutes) return { text: `${state.minutes}분 / ${routine.goalMinutes}분`, done: state.done };
    if (state.minutes > 0) return { text: `오늘 ${state.minutes}분`, done: false };
  } else if (state.firstAt) {
    const at = clockLabel(state.firstAt);
    return { text: state.firstBy ? `${state.firstBy} · ${at}` : `${at} 완료`, done: true };
  }
  if (routine.everyDays > 1 && state.sinceDays) return { text: `마지막 ${state.sinceDays}일 전`, done: false };
  if (routine.time) return { text: timeLabel(routine.time), done: false };
  return { text: routine.kind === 'minutes' ? '오늘 0분' : everyLabel(routine.everyDays), done: false };
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
        if (state.done || (r.kind === 'check' && state.firstAt)) continue;
      }
      let body = `${SLOT_LABELS[slotOf(r.time)]}에 챙길 루틴이에요`;
      if (i === 0 && r.kind === 'minutes') {
        const minutes = todayState(r, logs, now).minutes;
        if (minutes > 0) body = `오늘 지금까지 ${minutes}분`;
      } else if (r.everyDays > 1) {
        const last = lastBefore(r.id, logs, day);
        if (last) body = `마지막으로 한 지 ${daysBetween(new Date(last.at), day)}일 지났어요`;
      }
      out.push({ id: `${r.id}-${i}`, routineId: r.id, at, title: `${r.title} 시간이에요`, body });
    }
  }
  return out;
}

/** 루틴 추천(SPEC-MAIN-03) — 한 번 만들어 두고 자주 고치지 않는다(헌장 8). 영양제 · 약은 넣지 않는다(헌장 5). 터미타임에 목표 분을 미리 넣지 않는다 */
export type RoutineTemplate = { title: string; kind: RoutineKind; everyDays: number; time: string | null };

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  { title: '목욕', kind: 'check', everyDays: 1, time: '19:00' },
  { title: '터미타임', kind: 'minutes', everyDays: 1, time: null },
  { title: '젖병 소독', kind: 'check', everyDays: 1, time: null },
  { title: '산책', kind: 'check', everyDays: 1, time: null },
  { title: '손톱 깎기', kind: 'check', everyDays: 7, time: null },
  { title: '장난감 소독', kind: 'check', everyDays: 7, time: null },
  { title: '아기 침구 빨래', kind: 'check', everyDays: 7, time: null },
  { title: '가습기 청소', kind: 'check', everyDays: 7, time: null },
  { title: '쪽쪽이 바꾸기', kind: 'check', everyDays: 60, time: null },
];

export function newRoutineId(): string {
  return `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newRoutineLogId(): string {
  return `rl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type RoutineInput = Pick<Routine, 'title' | 'kind' | 'everyDays' | 'time' | 'goalMinutes'>;

export function makeRoutine(input: RoutineInput, sort: number, now = new Date()): Routine {
  const at = now.toISOString();
  return { ...input, id: newRoutineId(), hidden: false, sort, runningSince: null, createdAt: at, updatedAt: at };
}

export function makeRoutineLog(routineId: string, at: Date, minutes: number | null = null, by: string | null = null): RoutineLog {
  return { id: newRoutineLogId(), routineId, at: at.toISOString(), minutes, by, createdAt: new Date().toISOString() };
}
