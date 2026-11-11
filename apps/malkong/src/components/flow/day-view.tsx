/**
 * 하루 보기 (SPEC-MAIN-08, task today/017, decisions/038) — 하루가 n8n 처럼 노드와 선으로 이어진다.
 *
 * 잇달아 남긴 기록은 한 묶음 틀 안에 시간순으로 놓이고, 1시간 넘게 기록이 없으면 새 묶음이다. 묶음 사이 선에는 기록이 없던 시간이나 그 사이에 적은 잠이 놓인다.
 * 오늘이면 마지막이 지금 묶음(코랄 틀)이고, 그 뒤로 흐린 점선 네모(다음 수유 예상 · 오늘 할 루틴과 할 일 · 그날 아기 일정 · 오늘 소식 · 가족과 함께 보기)가 이어진다.
 * 틀이나 노드를 누르면 그 시간의 기록 화면(`/records`)이 열린다. 자리와 선은 flow-layout.ts 가 계산한다.
 * 기록 단추와 합계는 위쪽 기록 칸(index.tsx)에 있다 — 지금 묶음에는 모유를 재는 중일 때의 종료 · 반대쪽만 둔다.
 * 하루 초안의 빈칸은 앞으로 올 것 줄에 점선 노드로 놓이고, 누르면 작은 창에서 시각을 골라 기록한다(task today/029). 맨 위에 어느 날을 복사했는지 보인다.
 * 변경 카드가 열린 기록은 바뀔 값을 먼저 보인다(SPEC-MAIN-16).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { BottleIcon } from '@/components/baby-icons';
import { careWarnings, WarnCard } from '@/components/flow/care-warn';
import { DayList, ViewToggle } from '@/components/flow/day-list';
import {
  BlockFrame,
  ChipNode,
  FlowCanvas,
  GapPill,
  GhostNode,
  ItemNode,
  NowDot,
  ShellNode,
  SleepNode,
  SleepNowNode,
  type ItemKind,
} from '@/components/flow/flow-graph';
import { ShellPopover, shellItemKind } from '@/components/flow/shell-popover';
import { DayNewsSheet } from '@/components/log/day-news-card';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { useRoutineActions } from '@/components/routine/use-routine-actions';
import { ThemedText } from '@/components/themed-text';
import { useBabyRows } from '@/components/todo/baby-schedule';
import { Button, Card, tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import { dateOfYmd, shellAt, shellHint, type Shell, type ShellSet } from '@/data/day-draft';
import { dayNews } from '@/data/day-news';
import {
  awakeLabel,
  awakeMinutes,
  dayFlow,
  feedTitle,
  gapLabel,
  hhmm,
  itemGaps,
  nextFeedGuess,
  sleepTitle,
  spanRange,
  type Block,
  type DayMemo,
  type RoutineDone,
  type SleepSpan,
  type SubItem,
  type TodoDone,
} from '@/data/day-flow';
import { readSetting, writeSetting } from '@/data/db';
import { STOOL_COLOR_LABEL, durationLabel, lastFeedStart, startOfDay } from '@/data/event-summary';
import { runningOf, type CareEvent, type EventKind, type Side } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { useFamily } from '@/data/family-context';
import { flowLayout, ITEM, type LinkSpec, type PartSpec, type Shape } from '@/data/flow-layout';
import { useMemos } from '@/data/memos-context';
import { usePreferences } from '@/data/preferences-context';
import { isTimed, logsOn, todayPlan } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { randomPose, type BuddyPose } from '@/data/stage';
import { useTodos } from '@/data/todos-context';
import type { ShellPatch } from '@/hooks/use-day-shells';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
/** 가족 노드를 숨겼는지 — 'yes' 면 이 폰에서 다시 보이지 않는다(예전 홈 가족 초대 카드와 같은 설정값) */
const FAMILY_HIDDEN_KEY = 'home.familyCardHidden';

const MIN = 60 * 1000;
/** 빈칸 채우기 창의 높이쯤 — 창이 노드 위에 뜨니 그만큼 위가 보이게 스크롤한다 */
const POP_H = 280;

function subKind(it: SubItem): ItemKind {
  if (it.type === 'feed') return it.session.kind;
  if (it.type === 'routine') return 'routine';
  if (it.type === 'todo') return 'todo';
  if (it.type === 'memo') return 'memo';
  const e = it.event;
  if (e.kind === 'diaper') return e.diaper === 'pee' ? 'pee' : e.diaper === 'both' ? 'both' : 'poo';
  return e.kind as ItemKind;
}

const shapeOf = (it: SubItem): Shape => (it.type === 'side' && it.event.kind === 'diaper' ? 'circle' : 'square');

function subTitle(it: SubItem, now: Date): string {
  if (it.type === 'feed') return feedTitle(it.session, now);
  // 시간을 잰 루틴은 걸린 시간까지 — 「터미타임 10분」
  if (it.type === 'routine' && it.end !== null && it.end > it.at) return `${it.title} ${durationLabel((it.end - it.at) / MIN)}`;
  if (it.type === 'routine' || it.type === 'todo') return it.title;
  // 노드 이름은 짧게 「메모」 — 내용은 목록 보기와 기록 화면에서
  if (it.type === 'memo') return '메모';
  const e = it.event;
  if (e.kind === 'diaper') return e.diaper === 'pee' ? '소변' : e.diaper === 'poo' ? '대변' : '소변, 대변';
  if (e.kind === 'temp') return e.amount !== null ? `${e.amount}℃` : '체온';
  if (e.kind === 'weight') return e.amount !== null ? `${e.amount}kg` : '몸무게';
  return e.amount !== null ? `${e.amount}cm` : '키';
}

/** 재는 중 시계 — 「12:05」 · 「1:02:05」 */
function stopwatch(from: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

type Future = {
  key: string;
  at: number;
  icon: React.ReactNode;
  accent?: boolean;
  title: string;
  sub: string;
  aria: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** 하루 초안의 빈칸 — 점선 노드로 따로 그린다 */
  shell?: Shell;
};

/** 화면에 놓는 토막 — 묶음(지금 묶음 포함), 틀 없는 잠 줄, 기록 없이 지금만 있는 묶음, 자는 중 */
type Disp =
  | { type: 'block'; key: string; block: Block; now: boolean }
  | { type: 'nowEmpty'; key: string }
  | { type: 'sleeps'; key: string; sleeps: SleepSpan[] }
  | { type: 'sleepNow'; key: string; sleep: SleepSpan };
/** 토막 사이 — 기록 없던 시간 알약이나 잠 하나 */
type Link = { kind: LinkSpec; label?: string; sleep?: SleepSpan };

/** 묶음과 잠을 화면 토막으로 — 묶음 사이 잠 하나는 선 위로, 첫머리나 잇달은 잠은 한 줄로 */
function displayParts(flow: ReturnType<typeof dayFlow>, isToday: boolean, now: Date): { parts: Disp[]; links: Link[] } {
  const raw: Disp[] = [];
  for (const p of flow.parts) {
    if (p.type === 'block') raw.push({ type: 'block', key: p.block.key, block: p.block, now: p.block === flow.live });
    else {
      const last = raw[raw.length - 1];
      if (last?.type === 'sleeps') last.sleeps.push(p.sleep);
      else raw.push({ type: 'sleeps', key: `sleeps-${p.sleep.event.id}`, sleeps: [p.sleep] });
    }
  }
  if (isToday) {
    if (flow.sleeping) raw.push({ type: 'sleepNow', key: `sleep-now-${flow.sleeping.event.id}`, sleep: flow.sleeping });
    else if (!flow.live) raw.push({ type: 'nowEmpty', key: 'now' });
  }
  const blockish = (d: Disp | undefined) => d?.type === 'block' || d?.type === 'nowEmpty';
  const parts: Disp[] = [];
  const links: Link[] = [];
  const endOf = (d: Disp) => (d.type === 'block' ? d.block.to : null);
  const startOf = (d: Disp) => (d.type === 'block' ? d.block.from : d.type === 'nowEmpty' ? now.getTime() : null);
  raw.forEach((d, i) => {
    const prev = parts[parts.length - 1];
    // 묶음과 묶음 사이 잠 하나 — 선 위의 잠 노드
    if (d.type === 'sleeps' && d.sleeps.length === 1 && blockish(prev) && blockish(raw[i + 1])) {
      links.push({ kind: 'sleep', sleep: d.sleeps[0] });
      return;
    }
    if (prev) {
      const linked = links.length === parts.length;
      if (!linked) {
        const a = endOf(prev);
        const b = startOf(d);
        links.push(a !== null && b !== null ? { kind: 'pill', label: durationLabel(Math.max(1, (b - a) / MIN)) } : { kind: 'plain' });
      }
    }
    parts.push(d);
  });
  return { parts, links };
}

/** 물어보기가 답한 기록 — 흐름 · 목록에서 코랄 테두리와 짧은 표시(SPEC-MAIN-13). keys 는 SubItem key 나 잠 기록 id */
export type Highlight = { keys: string[]; label: string };
/** 변경 카드가 열려 있는 동안 흐름에 먼저 보이는 것 — 「초안」 표시와 「~~13:50~~ 13:40」, 지울 기록은 「삭제」와 줄 긋기(SPEC-MAIN-16) */
export type Preview = { key: string; badge: string; tone?: 'accent' | 'danger'; subFrom?: string | null; sub?: string | null; strike?: boolean };

const NO_SHELLS: Shell[] = [];
const NO_PREVIEWS: Preview[] = [];

export function DayView({
  date,
  now,
  highlight = null,
  selected = null,
  shellSet = null,
  shells = NO_SHELLS,
  previews = NO_PREVIEWS,
  onPick,
  onFillShell,
  onRemoveShell,
  onDropShells,
  onFocus,
  onStart,
  onStop,
}: {
  date: Date;
  now: Date;
  highlight?: Highlight | null;
  /** 물어보기 창을 연 채 누른 기록의 key — 「선택」으로 비춘다(task today/022) */
  selected?: string | null;
  /** 그날의 하루 초안과 아직 채우지 않은 빈칸 — 앞으로 올 것 줄에 점선 노드로 놓는다(task today/029) */
  shellSet?: ShellSet | null;
  shells?: Shell[];
  previews?: Preview[];
  /** 물어보기 창이 열려 있으면 기록을 누를 때 입력 시트 대신 이것을 부른다 */
  onPick?: (key: string) => void;
  onFillShell?: (shell: Shell, at: Date, patch: ShellPatch) => void;
  onRemoveShell?: (id: string) => void;
  onDropShells?: () => void;
  /** 비춘 기록이 있는 높이(이 화면 맨 위에서) — 물어보기 창에 가리지 않게 부르는 쪽이 스크롤한다 */
  onFocus?: (y: number) => void;
  /** 모유 재기 시작(반대쪽) */
  onStart: (kind: EventKind, side: Side | null) => void;
  onStop: (e: CareEvent) => void;
}) {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { events } = useEvents();
  const { routines, logs, timers: routineTimers } = useRoutines();
  const { todos, topics, toggleDone } = useTodos();
  const family = useFamily();
  const { memos } = useMemos();
  const routine = useRoutineActions(now);
  const schedule = useBabyRows(now);
  const [width, setWidth] = useState(0);
  const [canvasY, setCanvasY] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** 소식 그림의 버디 자세 — 열 때마다 셋 중 하나(decisions/042) */
  const [sharePose, setSharePose] = useState<BuddyPose>('lie');
  const [familyHidden, setFamilyHidden] = useState(true);
  // 「흐름 | 목록」은 마지막으로 고른 것 — 앱을 켤 때 한 번 읽어 두어서 날짜를 넘겨도 흐름으로 먼저 그리지 않는다
  const { dayView: mode, setDayView } = usePreferences();
  /** 채우는 중인 빈칸의 id — 작은 창이 그 노드 옆에 뜬다 */
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    void readSetting(FAMILY_HIDDEN_KEY).then((v) => setFamilyHidden(v === 'yes'));
  }, []);
  const changeMode = (m: 'flow' | 'list') => void setDayView(m).catch(() => undefined);
  const breast = runningOf(events, 'breast');
  // 모유를 재는 중이면 1초마다 — 지금 노드의 시계만
  const tick = useNow(!!breast || !!runningOf(events, 'sleep'), events);

  const dayStart = startOfDay(date).getTime();
  const isToday = dayStart === startOfDay(now).getTime();
  const generalTopic = topics.find((t) => t.kind === 'general')?.id ?? null;

  // 그날 완료한 루틴 — 단계 줄과 건너뛴 줄은 빼고 루틴 전체를 끝낸 줄
  const dones = useMemo<RoutineDone[]>(
    () =>
      routines.flatMap((r) => {
        const done = logsOn(r.id, logs, date).filter((l) => l.step == null && !l.skip);
        // 그날 한 것 모두 — 기록 단추로 하루에 여러 번 누를 수 있다(task today/020 · 029)
        return done.map((l) => ({ routineId: r.id, logId: l.id, title: r.title, at: l.at, by: l.by, endAt: l.endAt ?? null }));
      }),
    [routines, logs, date],
  );
  const doneTodos = useMemo<TodoDone[]>(
    () => todos.filter((t) => t.topicId === generalTopic && t.doneAt).map((t) => ({ todoId: t.id, title: t.title, at: t.doneAt as string, by: t.doneBy })),
    [todos, generalTopic],
  );
  // 그날 쓴 메모 — 발달 체크에서 남긴 줄(ref)은 빼고 사람이 쓴 것만
  const dayMemos = useMemo<DayMemo[]>(() => memos.filter((m) => m.ref === null).map((m) => ({ memoId: m.id, text: m.text, at: m.at })), [memos]);
  const flow = useMemo(() => dayFlow(events, dones, doneTodos, date, now, dayMemos), [events, dones, doneTodos, date, now, dayMemos]);
  // 같은 기록끼리 간격 — 루틴은 그날 한 줄 모두로 센다
  const gaps = useMemo(() => {
    const all: RoutineDone[] = logs
      .filter((l) => l.step == null && !l.skip)
      .flatMap((l) => {
        const r = routines.find((x) => x.id === l.routineId);
        return r ? [{ routineId: r.id, logId: l.id, title: r.title, at: l.at, by: l.by }] : [];
      });
    return itemGaps(events, all);
  }, [events, logs, routines]);
  const lit = (key: string) => (selected === key ? '선택' : highlight && highlight.keys.includes(key) ? highlight.label : null);
  const previewOf = (key: string): Preview | null => previews.find((x) => x.key === key) ?? null;
  /** 변경 카드의 표시 — 노드에 그대로 펼친다 */
  const decor = (key: string) => {
    const pv = previewOf(key);
    return { badge: pv?.badge ?? null, badgeTone: pv?.tone ?? ('accent' as const), subFrom: pv?.subFrom ?? null, strike: pv?.strike ?? false };
  };
  const pressShell = (id: string) => {
    tap();
    setEditing((prev) => (prev === id ? null : id));
  };
  const editingShell = editing ? (shells.find((x) => x.id === editing) ?? null) : null;
  const gapOf = (key: string) => {
    const m = gaps.get(key);
    return m === undefined ? null : gapLabel(m);
  };
  const awakeOf = (id: string) => {
    const m = gaps.get(id);
    return m === undefined ? null : awakeLabel(m);
  };
  const news = baby ? dayNews(events, memos, baby.birthDate, date, now) : null;

  if (!baby || !age) return null;

  const all = displayParts(flow, isToday, now);
  // 오늘은 지난 묶음 둘과 지금만 — 그 앞은 접는다
  const pastBlocks = all.parts.flatMap((d, i) => (d.type === 'block' && !d.now ? [i] : []));
  const cut = isToday && !showAll && pastBlocks.length > 2 ? pastBlocks[pastBlocks.length - 2] : 0;
  const shown = all.parts.slice(cut);
  const shownLinks = all.links.slice(cut);

  // 앞으로 올 것 — 오늘만. 시각이 있는 것끼리 시간순, 그다음 시각 없는 것
  const future: Future[] = [];
  if (isToday) {
    const guess = breast ? null : nextFeedGuess(events, now);
    if (guess) {
      future.push({
        key: 'next-feed',
        at: guess.at.getTime(),
        icon: <BottleIcon size={20} color={c.accent} />,
        accent: true,
        title: '다음 수유',
        sub: `${hhmm(guess.at)}쯤`,
        aria: `다음 수유 ${hhmm(guess.at)}쯤, 기록 알림`,
        onPress: () => router.push('/notifications'),
      });
    }
    const plan = todayPlan(routines, logs, now);
    // 시간을 재는 루틴은 한 뒤에도 「한 번 더」로 남는다
    for (const x of plan.today.filter((y) => (!y.s.done || isTimed(y.r)) && !y.s.skipped)) {
      const [h, m] = (x.r.time ?? '').split(':').map(Number);
      const again = x.s.done && isTimed(x.r);
      const runningFrom = routineTimers[x.r.id];
      future.push({
        key: `routine-${x.r.id}`,
        at: x.r.time && !again ? dayStart + (h * 60 + m) * 60 * 1000 : Number.MAX_SAFE_INTEGER - 4,
        icon: <RoutineIcon title={x.r.title} size={20} color={runningFrom ? c.accent : c.text} />,
        accent: !!runningFrom,
        title: x.r.title,
        sub: runningFrom ? `${hhmm(runningFrom)}부터 재는 중` : again ? '한 번 더' : (x.r.time ?? '하루 중'),
        aria: isTimed(x.r) ? `${x.r.title}${again ? ' 한 번 더' : ''}, 누르면 시작하거나 지난 것 적기` : `${x.r.title}${x.r.time ? ` ${x.r.time}` : ''}, 누르면 완료`,
        onPress: () => {
          tap();
          routine.onCheck(x.r.id);
        },
        onLongPress: () => routine.edit(x.r),
      });
    }
    for (const t of todos) {
      if (t.topicId !== generalTopic || t.doneAt || !t.dueAt) continue;
      const due = new Date(t.dueAt).getTime();
      if (due < dayStart || due >= dayStart + DAY) continue;
      future.push({
        key: `todo-${t.id}`,
        at: t.hasTime ? due : Number.MAX_SAFE_INTEGER - 4,
        icon: <RoutineIcon title={t.title} size={20} color={c.text} />,
        title: t.title,
        sub: t.hasTime ? hhmm(t.dueAt) : '오늘',
        aria: `${t.title}${t.hasTime ? ` ${hhmm(t.dueAt)}` : ''}, 누르면 완료`,
        onPress: () => {
          tap('success');
          void toggleDone(t.id);
        },
      });
    }
    for (const r of schedule.rows.filter((row) => row.at >= dayStart && row.at < dayStart + DAY)) {
      const timed = r.appt?.hasTime ? r.appt.dueAt : r.todo?.hasTime ? r.todo.dueAt : null;
      future.push({
        key: `baby-${r.key}`,
        at: timed ? new Date(timed).getTime() : Number.MAX_SAFE_INTEGER - 3,
        icon: <Ionicons name="calendar-clear-outline" size={20} color={c.text} />,
        title: r.title,
        sub: timed ? hhmm(timed) : (r.tag ?? '오늘'),
        aria: r.title,
        onPress: () => schedule.open(r),
      });
    }
  }
  // 하루 초안의 빈칸 — 오늘 할 루틴으로 이미 보이는 루틴은 한 번만
  if (shellSet) {
    for (const sh of shells) {
      if (sh.kind === 'routine' && future.some((f) => f.key === `routine-${sh.routineId}`)) continue;
      const hint = shellHint(shellSet, sh);
      future.push({ key: `shell-${sh.id}`, at: shellAt(shellSet, sh), icon: null, title: sh.title, sub: hint, aria: `초안 ${sh.title}, ${hint}. 누르면 시각을 골라 기록`, shell: sh });
    }
  }
  future.sort((a, b) => a.at - b.at);
  if (news) {
    future.push({
      key: 'news',
      at: Number.MAX_SAFE_INTEGER - 1,
      icon: <Ionicons name="share-outline" size={20} color={c.text} />,
      title: isToday ? '오늘 소식 보내기' : '이날 소식 보내기',
      sub: '',
      aria: isToday ? '오늘 소식 보내기' : '이날 소식 보내기',
      onPress: () => {
        tap();
        setSharePose(randomPose());
        setSharing(true);
      },
    });
  }
  if (isToday && family.status === 'none' && !familyHidden) {
    future.push({
      key: 'family',
      at: Number.MAX_SAFE_INTEGER,
      icon: <Ionicons name="people-outline" size={20} color={c.text} />,
      title: '가족과 함께 보기',
      sub: '',
      aria: '가족과 함께 보기, 길게 누르면 숨김',
      onPress: () => router.push('/family'),
      onLongPress: () => {
        tap();
        setFamilyHidden(true);
        void writeSetting(FAMILY_HIDDEN_KEY, 'yes');
      },
    });
  }

  const specs: PartSpec[] = shown.map((d) =>
    d.type === 'block'
      ? { type: 'box', shapes: [...d.block.items.map(shapeOf), ...(d.now ? (['dot'] as Shape[]) : [])], now: d.now, buttons: d.now && !!breast }
      : d.type === 'nowEmpty'
        ? { type: 'box', shapes: ['dot'], now: true, buttons: !!breast }
        : d.type === 'sleeps'
          ? { type: 'sleeps', count: d.sleeps.length }
          : { type: 'sleepNow' },
  );
  const geo = width > 0 ? flowLayout({ width, chip: cut > 0, parts: specs, links: shownLinks.map((l) => l.kind), future: future.length }) : null;
  const openRecords = (params: Record<string, string>) => {
    tap();
    router.push({ pathname: '/records', params });
  };
  const blockParams = (b: Block, live: boolean, open?: string) => ({ from: String(b.from), to: live ? '' : String(b.to), ...(open ? { open } : {}) });
  const openSleep = (s: SleepSpan) => openRecords({ sleep: s.event.id });

  // 지금 묶음 위의 글 — 모유를 재는 중이면 시계, 아니면 먹은 지(하루 안), 일어난 지
  const lastStart = lastFeedStart(events);
  const feedMin = lastStart ? (now.getTime() - new Date(lastStart).getTime()) / MIN : null;
  const awake = awakeMinutes(events, now);
  const nowTitle = breast
    ? `모유 ${breast.side === 'right' ? '오른쪽' : '왼쪽'} ${stopwatch(breast.startAt, tick)}`
    : feedMin !== null && feedMin >= 0 && feedMin < 24 * 60
      ? `먹은 지 ${durationLabel(Math.max(1, feedMin))}`
      : awake !== null
        ? `일어난 지 ${durationLabel(Math.max(1, awake))}`
        : events.length === 0
          ? '첫 기록을 남겨 보세요'
          : '지금';
  const nowRight = breast ? `${hhmm(breast.startAt)}부터` : null;
  const runButtons = breast ? (
    <View style={styles.runRow}>
      <Button label="종료" variant="accent" size="sm" style={styles.flex} onPress={() => onStop(breast)} />
      <Button label="반대쪽" variant="secondary" size="sm" style={styles.flex} onPress={() => onStart('breast', breast.side === 'right' ? 'left' : 'right')} />
    </View>
  ) : null;

  /** 맞는 key 가운데 처음 보이는 노드의 가운데 — 비춘 기록으로 스크롤하거나 초안 고치기 창을 붙일 때 */
  const nodeAt = (match: (key: string) => boolean): { cx: number; cy: number } | null => {
    if (!geo) return null;
    for (let i = 0; i < shown.length; i++) {
      const d = shown[i];
      if (d.type === 'block') {
        const k = d.block.items.findIndex((it) => match(it.key));
        if (k >= 0) return geo.parts[i].nodes[k];
      }
      if (d.type === 'sleeps') {
        const k = d.sleeps.findIndex((s) => match(s.event.id));
        if (k >= 0) return geo.parts[i].nodes[k];
      }
    }
    const li = shownLinks.findIndex((l) => l.kind === 'sleep' && l.sleep && match(l.sleep.event.id));
    return li >= 0 && geo.links[li] ? { cx: geo.links[li].cx, cy: geo.links[li].cy } : null;
  };
  const futureAt = (id: string) => {
    const k = future.findIndex((f) => f.shell?.id === id);
    return geo && k >= 0 ? (geo.future[k] ?? null) : null;
  };
  const editAnchor = editingShell ? futureAt(editingShell.id) : null;
  const litAt = highlight && highlight.keys.length > 0 ? nodeAt((key) => highlight.keys.includes(key)) : null;
  // 채우기 창은 노드 위에 뜨면 창 위쪽이 화면 위에 오게, 아니면 비춘 기록으로
  // 창이 노드 아래에 뜨면(위가 모자라면) 노드가 화면 위쪽에 오게 — 창 아래까지 보이게
  const popAbove = editAnchor !== null && editAnchor.cy - ITEM / 2 - POP_H - 12 >= 0;
  const focusY = editAnchor
    ? popAbove
      ? canvasY + Math.max(0, editAnchor.cy - ITEM / 2 - POP_H - 12) + 82
      : canvasY + editAnchor.cy - ITEM / 2 + 70
    : litAt
      ? canvasY + litAt.cy
      : null;
  // 초안이 처음 생기면 첫 빈칸으로 한 번 스크롤한다(DraftFocus)
  const firstShell = future.find((f) => f.shell);
  const firstShellAt = firstShell?.shell ? futureAt(firstShell.shell.id) : null;
  const firstDraftY = firstShellAt ? canvasY + firstShellAt.cy : null;
  const popover =
    editingShell && shellSet ? (
      <ShellPopover
        key={editingShell.id}
        set={shellSet}
        shell={editingShell}
        anchor={mode === 'flow' ? editAnchor : null}
        above={popAbove}
        width={width}
        height={geo?.height ?? 0}
        now={now}
        onRecord={(at, patch) => {
          onFillShell?.(editingShell, at, patch);
          setEditing(null);
        }}
        onRemove={() => {
          onRemoveShell?.(editingShell.id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    ) : null;
  const warns = isToday ? careWarnings(events, age.month, now) : [];
  const nextFeed = future.find((x) => x.key === 'next-feed') ?? null;
  const weekday = WEEKDAYS[date.getDay()];

  return (
    <View style={styles.wrap}>
      {warns.map((id) => (
        <WarnCard key={id} id={id} />
      ))}

      {/* 가족에 2026-10-30 전에 들어간 폰 — 동의 문장에 기록이 없어서 따로 묻는다(SPEC-LOG-07) */}
      {family.status === 'member' && !family.eventsOk && (
        <Card tone="raised" style={styles.consent}>
          <ThemedText type="heading">가족과 기록도 함께 볼까요?</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            이 폰의 수유 · 기저귀 · 잠 · 체온 · 키 · 몸무게 기록을 육아버디 서버에 저장하고, 가족 폰에서도 보여요.
          </ThemedText>
          <Button label="동의하고 함께 보기" size="md" onPress={() => void family.allowEvents()} />
        </Card>
      )}

      {shellSet && shells.length > 0 && <ShellBanner set={shellSet} count={shells.length} onDrop={onDropShells} />}

      {mode === 'list' ? (
        <View style={styles.listWrap} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
          {popover}
          <View style={styles.toggleRow}>
            <ViewToggle mode={mode} onChange={changeMode} />
          </View>
          <DayList
            flow={flow}
            dayStart={dayStart}
            now={tick}
            isToday={isToday}
            nowTitle={nowTitle}
            nowExtra={
              breast ? (
                <View style={styles.listRun}>
                  <Button label="종료" variant="accent" size="sm" style={styles.flex} onPress={() => onStop(breast)} />
                  <Button label="반대쪽" variant="secondary" size="sm" style={styles.flex} onPress={() => onStart('breast', breast.side === 'right' ? 'left' : 'right')} />
                </View>
              ) : null
            }
            nextFeed={nextFeed ? { title: nextFeed.title, sub: nextFeed.sub, onPress: nextFeed.onPress } : null}
            info={(it) => ({
              kind: subKind(it),
              title: it.type === 'memo' ? it.text : subTitle(it, now),
              stool: it.type === 'side' && it.event.kind === 'diaper' && it.event.diaper !== 'pee' ? it.event.color : null,
              by: it.type === 'feed' ? it.session.by : it.type === 'side' ? it.event.by : it.type === 'memo' ? null : it.by,
            })}
            gapOf={gapOf}
            awakeOf={awakeOf}
            lit={lit}
            shells={
              shellSet
                ? shells.map((sh) => ({ key: sh.id, kind: shellItemKind(sh), title: sh.title, hint: shellHint(shellSet, sh), onPress: () => pressShell(sh.id) }))
                : []
            }
            onOpenItem={(b, key) => (onPick && !key.startsWith('todo-') ? onPick(key) : openRecords(blockParams(b, flow.live?.key === b.key, key)))}
            onOpenSleep={(s) => (onPick ? onPick(s.event.id) : openSleep(s))}
          />
        </View>
      ) : (
      <View
        style={styles.canvas}
        onLayout={(e: LayoutChangeEvent) => {
          setWidth(Math.round(e.nativeEvent.layout.width));
          setCanvasY(e.nativeEvent.layout.y);
        }}>
        <DotGrid />
        <View style={styles.toggleAbs}>
          <ViewToggle mode={mode} onChange={changeMode} />
        </View>
        {!isToday && shown.length === 0 && (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            {`${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}에는 남긴 기록이 없어요`}
          </ThemedText>
        )}
        {geo && (
          <FlowCanvas
            geo={geo}
            width={width}
            frames={shown.map((d, i) => {
              const rect = geo.parts[i].frame;
              if (d.type === 'block') {
                const b = d.block;
                const range = spanRange(b.from, b.to, dayStart);
                const right = b.to > b.from ? durationLabel((b.to - b.from) / MIN) : null;
                return (
                  <BlockFrame
                    key={d.key}
                    rect={rect}
                    now={d.now}
                    title={d.now ? nowTitle : range}
                    right={d.now ? nowRight : right}
                    aria={d.now ? `${nowTitle}, ${range}부터 기록 자세히` : `${range}${right ? `, ${right}` : ''} 자세히`}
                    onPress={() => openRecords(blockParams(b, d.now))}>
                    {d.now && runButtons}
                  </BlockFrame>
                );
              }
              if (d.type === 'nowEmpty') {
                return (
                  <BlockFrame key={d.key} rect={rect} now title={nowTitle} right={nowRight} aria={nowTitle}>
                    {runButtons}
                  </BlockFrame>
                );
              }
              return null;
            })}>
            {geo.chip && <ChipNode rect={geo.chip} label="이전 기록 보기" onPress={() => setShowAll(true)} />}
            {shown.map((d, i) => {
              const g = geo.parts[i];
              if (d.type === 'sleepNow') {
                return <SleepNowNode key={d.key} rect={g.frame} title={sleepTitle(d.sleep, tick)} sub={`${hhmm(d.sleep.from)}부터`} onPress={() => openSleep(d.sleep)} />;
              }
              if (d.type === 'sleeps') {
                return (
                  <View key={d.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    {d.sleeps.map((s, k) => (
                      <SleepNode
                        key={s.event.id}
                        cx={g.nodes[k].cx}
                        cy={g.nodes[k].cy}
                        title={sleepTitle(s, now)}
                        sub={previewOf(s.event.id)?.sub ?? spanRange(s.from, s.to, dayStart)}
                        gap={awakeOf(s.event.id)}
                        highlight={lit(s.event.id)}
                        {...decor(s.event.id)}
                        onPress={() => (onPick ? onPick(s.event.id) : openSleep(s))}
                      />
                    ))}
                  </View>
                );
              }
              const items = d.type === 'block' ? d.block.items : [];
              const dot = g.nodes[g.nodes.length - 1];
              const live = d.type === 'nowEmpty' || d.now;
              return (
                <View key={d.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {items.map((it, k) => {
                    const n = g.nodes[k];
                    const title = subTitle(it, now);
                    const by = it.type === 'feed' ? it.session.by : it.type === 'side' ? it.event.by : it.type === 'memo' ? null : it.by;
                    const stool = it.type === 'side' && it.event.kind === 'diaper' && it.event.diaper !== 'pee' ? it.event.color : null;
                    return (
                      <ItemNode
                        key={it.key}
                        cx={n.cx}
                        cy={n.cy}
                        kind={subKind(it)}
                        title={title}
                        sub={previewOf(it.key)?.sub ?? (it.type === 'routine' && it.end !== null && it.end > it.at ? spanRange(it.at, it.end, dayStart) : hhmm(it.at))}
                        aria={`${hhmm(it.at)} ${title}${it.type === 'memo' ? ` ${it.text}` : ''}${stool ? ` ${STOOL_COLOR_LABEL[stool]}` : ''}${by ? `, ${by}` : ''}`}
                        stool={stool}
                        gap={gapOf(it.key)}
                        highlight={lit(it.key)}
                        {...decor(it.key)}
                        onPress={() => (onPick && it.type !== 'todo' ? onPick(it.key) : d.type === 'block' && openRecords(blockParams(d.block, d.now, it.key)))}
                      />
                    );
                  })}
                  {live && dot && <NowDot cx={dot.cx} cy={dot.cy} time={hhmm(now)} />}
                </View>
              );
            })}
            {shownLinks.map((l, i) => {
              const at = geo.links[i];
              if (!at) return null;
              if (l.kind === 'pill' && l.label) return <GapPill key={`gap-${i}`} cx={at.cx} cy={at.cy} label={l.label} />;
              if (l.kind === 'sleep' && l.sleep) {
                const s = l.sleep;
                return (
                  <SleepNode
                    key={`link-${s.event.id}`}
                    small
                    cx={at.cx}
                    cy={at.cy}
                    title={sleepTitle(s, now)}
                    sub={previewOf(s.event.id)?.sub ?? spanRange(s.from, s.to, dayStart)}
                    gap={awakeOf(s.event.id)}
                    highlight={lit(s.event.id)}
                    {...decor(s.event.id)}
                    onPress={() => (onPick ? onPick(s.event.id) : openSleep(s))}
                  />
                );
              }
              return null;
            })}
            {future.map((f, k) => {
              const n = geo.future[k];
              if (f.shell) {
                const sh = f.shell;
                return <ShellNode key={f.key} cx={n.cx} cy={n.cy} kind={shellItemKind(sh)} title={f.title} hint={f.sub} aria={f.aria} onPress={() => pressShell(sh.id)} />;
              }
              return (
                <GhostNode
                  key={f.key}
                  cx={n.cx}
                  cy={n.cy}
                  icon={f.icon}
                  accent={f.accent}
                  title={f.title}
                  sub={f.sub}
                  aria={f.aria}
                  onPress={f.onPress}
                  onLongPress={f.onLongPress}
                />
              );
            })}
          </FlowCanvas>
        )}
        {geo && popover}
      </View>
      )}

      {mode === 'flow' && onFocus && focusY !== null && <FocusReporter y={focusY} onFocus={onFocus} />}
      {mode === 'flow' && onFocus && <DraftFocus count={shells.length} y={firstDraftY} onFocus={onFocus} />}
      {routine.sheets}
      {schedule.sheets}
      <DayNewsSheet
        news={sharing ? news : null}
        title={isToday ? '오늘 소식' : `${date.getMonth() + 1}월 ${date.getDate()}일 소식`}
        pose={sharePose}
        onClose={() => setSharing(false)}
      />
    </View>
  );
}

/** 하루 초안의 머리 — 어느 날을 복사했는지, 「버리기」 */
function ShellBanner({ set, count, onDrop }: { set: ShellSet; count: number; onDrop?: () => void }) {
  const c = useTheme();
  const src = dateOfYmd(set.source);
  return (
    <View style={[styles.banner, { backgroundColor: c.card, borderColor: c.accent }]}>
      <View style={styles.flex}>
        <ThemedText type="heading" style={styles.bannerTitle}>
          {`${src.getMonth() + 1}월 ${src.getDate()}일 기록으로 만든 초안 ${count}개`}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          시간은 비워 뒀어요. 누르거나 말해서 채워요
        </ThemedText>
      </View>
      {onDrop && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="초안 버리기"
          onPress={() => {
            tap();
            onDrop();
          }}
          style={({ pressed }) => [styles.bannerBtn, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card }]}>
          <ThemedText type="label" style={{ fontWeight: 700 }}>
            버리기
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** 비춘 기록의 높이가 바뀌면 한 번 알린다 — 계산은 그리는 중에, 알림은 그린 뒤에 */
function FocusReporter({ y, onFocus }: { y: number; onFocus: (y: number) => void }) {
  useEffect(() => {
    onFocus(y);
  }, [y, onFocus]);
  return null;
}

/** 초안이 없다가 생기면 첫 초안으로 한 번만 스크롤한다 — 뒤에 초안을 고쳐도 다시 뛰지 않는다 */
function DraftFocus({ count, y, onFocus }: { count: number; y: number | null; onFocus: (y: number) => void }) {
  const had = useRef(count > 0);
  useEffect(() => {
    const was = had.current;
    had.current = count > 0;
    if (!was && count > 0 && y !== null) onFocus(y);
  }, [count, y, onFocus]);
  return null;
}

/** 흐름 바탕의 점 모눈 — n8n 캔버스처럼 */
function DotGrid() {
  const c = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="flowDots" width={16} height={16} patternUnits="userSpaceOnUse">
            <Rect width={16} height={16} fill={c.page} />
            <Circle cx={8} cy={8} r={1} fill={c.flowDot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#flowDots)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  consent: { gap: 8 },
  canvas: { marginHorizontal: -16, paddingBottom: 8, minHeight: 120 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  runRow: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', gap: 8 },
  listWrap: { marginHorizontal: -16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 11 },
  toggleAbs: { position: 'absolute', top: 11, right: 16, zIndex: 5 },
  listRun: { flexDirection: 'row', gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 11, paddingHorizontal: 14 },
  bannerTitle: { fontSize: 14.5, lineHeight: 20 },
  bannerBtn: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
});
