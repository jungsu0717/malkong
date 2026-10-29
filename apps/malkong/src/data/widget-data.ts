/**
 * 폰 홈 화면 위젯에 보일 것 (SPEC-MAIN-09, task today/008) — 날짜마다 한 벌씩 계산해 일주일 치를 미리 넣는다.
 *
 * 위젯은 앱이 꺼져 있어도 그려지므로 글은 여기서 다 만들어 보낸다(위젯 쪽은 글을 그리기만 한다).
 * 위젯에서 누른 루틴은 `pending` 에 모아 두고, 앱이 앞으로 오면 그때 완료로 반영한다.
 * 순수 함수만 둔다(`node --test src/data/widget-data.test.ts`).
 */

import { hasSteps, type Routine, type TodayState } from './routine.ts';
import { dayNumber } from './stage.ts';
import { thisWeek } from './upcoming.ts';

/** 위젯에 보이는 루틴 수 */
export const WIDGET_ROUTINES = 3;
/** 미리 넣는 날수 — 오늘부터 */
export const WIDGET_DAYS = 7;
/** 설정값 열쇠 — 안드로이드 위젯이 앱 없이 읽는 일주일 치와, 위젯에서 누른 루틴 */
export const WIDGET_DATA_KEY = 'widget_entries';
export const WIDGET_PENDING_KEY = 'widget_pending';

export type WidgetRoutine = {
  id: string;
  title: string;
  done: boolean;
  /** 위젯에서 바로 완료할 수 있는가 — 단계 · 재고 확인 루틴은 앱의 시트가 필요하다 */
  tap: boolean;
};

export type WidgetProps = {
  /** 이 벌이 맞는 날 — YYYY-MM-DD */
  date: string;
  /** 「태어난 지 58일」 — 생일이 없으면 빈 글 */
  days: string;
  /** 「이번 주 챙길 일 3개」 */
  headline: string;
  /** 「D-3 · BCG 접종」 — 없으면 빈 글 */
  next: string;
  routines: WidgetRoutine[];
  /** 오늘 남은 루틴 수(건너뛴 것은 뺀다) */
  left: number;
  /** 위젯에서 눌렀지만 앱이 아직 모르는 루틴 id — 앱이 앞으로 오면 토글한다 */
  pending: string[];
  /** 누르면 열 곳 */
  home: string;
  routinesUrl: string;
  /** 버디 얼굴 그림의 파일 주소 — 아이폰 위젯만(없으면 빈 글) */
  face: string;
};

export type WidgetEntry = { date: number; props: WidgetProps };

type Row = { title: string; at: number; right: string | null };
type Plan = { today: { r: Routine; s: TodayState }[]; done: number; total: number };

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 「D-3 · BCG 접종」 — 디데이를 앞에. 지금 기간인 접종 · 검진은 「이번 달」, 기한이 지난 앱 할 일은 「지남」 */
export function nextLine(row: Row | undefined): string {
  if (!row) return '';
  const when = row.right === '지금' ? '이번 달' : (row.right ?? '지남');
  return `${when} · ${row.title}`;
}

export function widgetRoutines(plan: Plan): WidgetRoutine[] {
  return plan.today
    .filter((x) => !(x.s.skipped && !x.s.done))
    .sort((a, b) => Number(a.s.done) - Number(b.s.done))
    .slice(0, WIDGET_ROUTINES)
    .map(({ r, s }) => ({ id: r.id, title: r.title, done: s.done, tap: !hasSteps(r) && r.kind !== 'stock' }));
}

export function widgetProps(
  input: { birthDate: string; rows: Row[]; plan: Plan; home: string; routinesUrl: string; face: string },
  now: Date,
): WidgetProps {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const week = thisWeek(input.rows, today).length;
  return {
    date: ymd(now),
    days: `태어난 지 ${dayNumber(input.birthDate, now)}일`,
    headline: week > 0 ? `이번 주 챙길 일 ${week}개` : '이번 주는 챙길 일이 없어요',
    next: nextLine(input.rows[0]),
    routines: widgetRoutines(input.plan),
    left: input.plan.total - input.plan.done,
    pending: [],
    home: input.home,
    routinesUrl: input.routinesUrl,
    face: input.face,
  };
}

/** 생일을 아직 넣지 않았을 때 */
export function emptyWidgetProps(home: string, face: string, now = new Date()): WidgetProps {
  return { date: ymd(now), days: '', headline: '아기 생일을 넣으면 채워져요', next: '', routines: [], left: 0, pending: [], home, routinesUrl: home, face };
}

/** 오늘(지금)과 다음 날들의 자정 — 타임라인의 날짜 */
export function widgetDays(now: Date, days = WIDGET_DAYS): Date[] {
  return Array.from({ length: days }, (_, i) => (i === 0 ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)));
}

/** 지금 보여야 할 벌 — 날짜가 지금보다 늦지 않은 것 중 마지막, 없으면 첫 벌 */
export function pickEntry(entries: WidgetEntry[], now: Date): WidgetProps | null {
  if (entries.length === 0) return null;
  const t = now.getTime();
  let picked = entries[0];
  for (const e of entries) if (e.date <= t) picked = e;
  return picked.props;
}

/** 위젯에서 루틴 줄을 눌렀을 때 — 그 벌의 루틴을 토글하고 `pending` 에 적는다(두 번 누르면 빠진다) */
export function toggleInWidget(props: WidgetProps, id: string): WidgetProps {
  const target = props.routines.find((r) => r.id === id);
  if (!target || !target.tap) return props;
  return {
    ...props,
    routines: props.routines.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
    left: Math.max(0, props.left + (target.done ? 1 : -1)),
    pending: props.pending.includes(id) ? props.pending.filter((p) => p !== id) : [...props.pending, id],
  };
}
