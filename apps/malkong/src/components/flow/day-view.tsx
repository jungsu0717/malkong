/**
 * 하루 보기 (SPEC-MAIN-08, task today/014, decisions/038) — 맨 위 합계 칸 넷, 그 아래 하루가 n8n 처럼 노드와 선으로 이어진다.
 *
 * 잠은 먹색 네모, 잠과 잠 사이는 넓은 노드이고 그 사이 기록이 아래로 갈라진다. 오늘이면 마지막이 지금 노드이고,
 * 그 뒤로 흐린 점선 네모(다음 수유 예상 · 오늘 할 루틴과 할 일 · 그날 아기 일정 · 오늘 소식 · 가족과 함께 보기)가 이어진다.
 * 노드를 누르면 그 시간의 기록 화면(`/records`)이 열린다. 자리와 선은 flow-layout.ts 가 계산한다.
 * 기록 단추는 화면 바닥의 기록 줄(index.tsx)에 있다 — 지금 노드에는 모유를 재는 중일 때의 종료 · 반대쪽만 둔다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { BottleIcon } from '@/components/baby-icons';
import { careWarnings, WarnCard } from '@/components/flow/care-warn';
import { DayTotalsCard } from '@/components/flow/day-totals';
import {
  ChipNode,
  FlowCanvas,
  FutureSquare,
  NodeLabel,
  NowNode,
  Port,
  SleepSquare,
  SubNode,
  WakeNode,
  type SubKind,
} from '@/components/flow/flow-graph';
import { DayNewsSheet } from '@/components/log/day-news-card';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { useRoutineActions } from '@/components/routine/use-routine-actions';
import { ThemedText } from '@/components/themed-text';
import { useBabyRows } from '@/components/todo/baby-schedule';
import { Button, Card, tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import { dayNews } from '@/data/day-news';
import {
  awakeMinutes,
  dayRows,
  dayTotals,
  feedTitle,
  hhmm,
  nextFeedGuess,
  sleepTitle,
  spanRange,
  type DayRow,
  type RoutineDone,
  type SubItem,
  type TodoDone,
} from '@/data/day-flow';
import { readSetting, writeSetting } from '@/data/db';
import { agoLabel, durationLabel, lastFeedStart, startOfDay } from '@/data/event-summary';
import { runningOf, type CareEvent, type EventKind, type Side } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { useFamily } from '@/data/family-context';
import { flowLayout, SQ, type LayoutRow } from '@/data/flow-layout';
import { useMemos } from '@/data/memos-context';
import { logsOn, todayPlan } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { poseOf } from '@/data/stage';
import { useTodos } from '@/data/todos-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
/** 가족 노드를 숨겼는지 — 'yes' 면 이 폰에서 다시 보이지 않는다(예전 홈 가족 초대 카드와 같은 설정값) */
const FAMILY_HIDDEN_KEY = 'home.familyCardHidden';

/** 갈라진 기록의 묶음 — 포트 하나씩: 수유, 기저귀와 그 밖, 루틴과 할 일 */
const groupOf = (it: SubItem) => (it.type === 'feed' ? 0 : it.type === 'side' ? 1 : 2);

function subKind(it: SubItem): SubKind {
  if (it.type === 'feed') return it.session.kind;
  if (it.type === 'routine') return 'routine';
  if (it.type === 'todo') return 'todo';
  const e = it.event;
  if (e.kind === 'diaper') return e.diaper === 'pee' ? 'pee' : 'poo';
  return e.kind as SubKind;
}

function subTitle(it: SubItem, now: Date): string {
  if (it.type === 'feed') return feedTitle(it.session, now);
  if (it.type === 'routine' || it.type === 'todo') return it.title;
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

type Future = { key: string; at: number; icon: React.ReactNode; accent?: boolean; title: string; sub: string; aria: string; onPress?: () => void; onLongPress?: () => void };

export function DayView({
  date,
  now,
  onStart,
  onStop,
}: {
  date: Date;
  now: Date;
  /** 모유 재기 시작(반대쪽) */
  onStart: (kind: EventKind, side: Side | null) => void;
  onStop: (e: CareEvent) => void;
}) {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { events } = useEvents();
  const { routines, logs } = useRoutines();
  const { todos, topics, toggleDone } = useTodos();
  const family = useFamily();
  const { memos } = useMemos();
  const routine = useRoutineActions(now);
  const schedule = useBabyRows(now);
  const [width, setWidth] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [familyHidden, setFamilyHidden] = useState(true);
  useEffect(() => {
    void readSetting(FAMILY_HIDDEN_KEY).then((v) => setFamilyHidden(v === 'yes'));
  }, []);
  const breast = runningOf(events, 'breast');
  // 모유를 재는 중이면 1초마다 — 지금 노드의 시계만
  const tick = useNow(!!breast || !!runningOf(events, 'sleep'));

  const dayStart = startOfDay(date).getTime();
  const isToday = dayStart === startOfDay(now).getTime();
  const generalTopic = topics.find((t) => t.kind === 'general')?.id ?? null;

  // 그날 완료한 루틴 — 단계 줄과 건너뛴 줄은 빼고 루틴 전체를 끝낸 줄
  const dones = useMemo<RoutineDone[]>(
    () =>
      routines.flatMap((r) => {
        const first = logsOn(r.id, logs, date).find((l) => l.step == null && !l.skip);
        return first ? [{ routineId: r.id, logId: first.id, title: r.title, at: first.at, by: first.by }] : [];
      }),
    [routines, logs, date],
  );
  const doneTodos = useMemo<TodoDone[]>(
    () => todos.filter((t) => t.topicId === generalTopic && t.doneAt).map((t) => ({ todoId: t.id, title: t.title, at: t.doneAt as string, by: t.doneBy })),
    [todos, generalTopic],
  );
  const rows = useMemo(() => dayRows(events, dones, doneTodos, date, now), [events, dones, doneTodos, date, now]);
  const totals = useMemo(() => dayTotals(events, date, now), [events, date, now]);
  const news = baby ? dayNews(events, memos, baby.birthDate, date, now) : null;

  if (!baby || !age) return null;

  // 오늘은 지금 앞의 한 줄과 지금만 — 그 앞은 접는다
  const hiddenRows = isToday && !showAll && rows.length > 2 ? rows.slice(0, rows.length - 2) : [];
  const shown = rows.slice(hiddenRows.length);
  const hiddenCount = hiddenRows.reduce((n, r) => n + (r.sleep ? 1 : 0) + (r.wake?.items.length ?? 0), 0);
  const lastRow = shown[shown.length - 1];
  const sleepingNow = isToday && lastRow?.sleep?.to === null;
  const awakeNow = isToday && !sleepingNow && lastRow?.wake?.to === null;

  const sortedItems = (r: DayRow) => [...(r.wake?.items ?? [])].sort((a, b) => groupOf(a) - groupOf(b) || a.at - b.at);
  const layoutRows: LayoutRow[] = shown.map((r, i) => {
    const isLast = i === shown.length - 1;
    const items = sortedItems(r);
    const groups = [0, 1, 2].map((g) => items.filter((it) => groupOf(it) === g).length).filter((n) => n > 0);
    return {
      sleep: r.sleep ? (isLast && sleepingNow ? 'now' : 'past') : null,
      wake: r.wake ? (isLast && awakeNow ? 'now' : 'past') : null,
      tall: isLast && awakeNow && !!breast,
      groups,
    };
  });

  // 앞으로 올 것 — 오늘만. 시각이 있는 것끼리 시간순, 그다음 시각 없는 것
  const future: Future[] = [];
  if (isToday) {
    const guess = breast ? null : nextFeedGuess(events, now);
    if (guess) {
      future.push({
        key: 'next-feed',
        at: guess.at.getTime(),
        icon: <BottleIcon size={24} color={c.accent} />,
        accent: true,
        title: '다음 수유',
        sub: `${hhmm(guess.at)}쯤`,
        aria: `다음 수유 ${hhmm(guess.at)}쯤, 기록 알림`,
        onPress: () => router.push('/notifications'),
      });
    }
    const plan = todayPlan(routines, logs, now);
    for (const x of plan.today.filter((y) => !y.s.done && !y.s.skipped)) {
      const [h, m] = (x.r.time ?? '').split(':').map(Number);
      future.push({
        key: `routine-${x.r.id}`,
        at: x.r.time ? dayStart + (h * 60 + m) * 60 * 1000 : Number.MAX_SAFE_INTEGER - 4,
        icon: <RoutineIcon title={x.r.title} size={24} color={c.text} />,
        title: x.r.title,
        sub: x.r.time ?? '하루 중',
        aria: `${x.r.title}${x.r.time ? ` ${x.r.time}` : ''}, 누르면 완료`,
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
        icon: <RoutineIcon title={t.title} size={24} color={c.text} />,
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
        icon: <Ionicons name="calendar-clear-outline" size={24} color={c.text} />,
        title: r.title,
        sub: timed ? hhmm(timed) : (r.tag ?? '오늘'),
        aria: r.title,
        onPress: () => schedule.open(r),
      });
    }
    future.sort((a, b) => a.at - b.at);
  }
  if (news) {
    future.push({
      key: 'news',
      at: Number.MAX_SAFE_INTEGER - 1,
      icon: <Ionicons name="share-outline" size={24} color={c.text} />,
      title: isToday ? '오늘 소식 보내기' : '이날 소식 보내기',
      sub: '',
      aria: isToday ? '오늘 소식 보내기' : '이날 소식 보내기',
      onPress: () => {
        tap();
        setSharing(true);
      },
    });
  }
  if (isToday && family.status === 'none' && !familyHidden) {
    future.push({
      key: 'family',
      at: Number.MAX_SAFE_INTEGER,
      icon: <Ionicons name="people-outline" size={24} color={c.text} />,
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

  const geo = width > 0 ? flowLayout({ width, chip: hiddenRows.length > 0, rows: layoutRows, future: future.length }) : null;
  const openRecords = (params: Record<string, string>) => {
    tap();
    router.push({ pathname: '/records', params });
  };
  const wakeParams = (r: DayRow, open?: string) => ({ from: String(r.wake!.from), to: r.wake!.to === null ? '' : String(r.wake!.to), ...(open ? { open } : {}) });

  // 지금 노드의 글
  const lastStart = lastFeedStart(events);
  const feedAgo = lastStart ? `마지막 수유 ${agoLabel(lastStart, now)}` : null;
  const nowSleepTitle = sleepingNow && lastRow?.sleep ? sleepTitle(lastRow.sleep, tick) : '';
  const awake = awakeMinutes(events, now);
  const awakeTitle = breast
    ? `모유 ${breast.side === 'right' ? '오른쪽' : '왼쪽'} ${stopwatch(breast.startAt, tick)}`
    : awake !== null
      ? `일어난 지 ${durationLabel(Math.max(1, awake))}`
      : (feedAgo ?? '첫 기록을 남겨 보세요');
  const awakeSub = breast ? `${hhmm(breast.startAt)}부터` : awakeTitle === feedAgo ? null : feedAgo;

  const warns = isToday ? careWarnings(events, age.month, now) : [];
  const weekday = WEEKDAYS[date.getDay()];

  return (
    <View style={styles.wrap}>
      <DayTotalsCard totals={totals} date={date} />

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

      <View style={styles.canvas} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        <DotGrid />
        {!isToday && rows.length === 0 && (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            {`${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}에는 남긴 기록이 없어요`}
          </ThemedText>
        )}
        {geo && (
          <FlowCanvas geo={geo} width={width}>
            {geo.chip && <ChipNode rect={geo.chip} label={`이전 기록 ${hiddenCount}개`} onPress={() => setShowAll(true)} />}
            {geo.chip && <Port x={geo.chip.x} y={geo.chip.y + 16} />}
            {shown.map((r, i) => {
              const g = geo.rows[i];
              const layout = layoutRows[i];
              const items = sortedItems(r);
              const nowRow = layout.sleep === 'now' || layout.wake === 'now';
              return (
                <View key={r.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {r.sleep && g.sleep && layout.sleep === 'past' && (
                    <>
                      <SleepSquare rect={g.sleep} label={sleepTitle(r.sleep, now)} onPress={() => openRecords({ sleep: r.sleep!.event.id })} />
                      <NodeLabel cx={g.sleep.x + SQ / 2} top={g.sleep.y + SQ + 6} title={sleepTitle(r.sleep, now)} sub={spanRange(r.sleep.from, r.sleep.to, dayStart)} width={128} />
                    </>
                  )}
                  {r.sleep && g.sleep && layout.sleep === 'now' && (
                    <NowNode rect={g.sleep} sleeping title={nowSleepTitle} sub={`${hhmm(r.sleep.from)}부터`} onPress={() => openRecords({ sleep: r.sleep!.event.id })} />
                  )}
                  {r.wake && g.wake && layout.wake === 'past' && (
                    <WakeNode rect={g.wake} title={spanRange(r.wake.from, r.wake.to, dayStart)} sub={durationLabel(((r.wake.to ?? now.getTime()) - r.wake.from) / 60000)} onPress={() => openRecords(wakeParams(r))} />
                  )}
                  {r.wake && g.wake && layout.wake === 'now' && (
                    <NowNode rect={g.wake} sleeping={false} title={awakeTitle} sub={awakeSub} onPress={() => openRecords(wakeParams(r))}>
                      {breast && (
                        <View style={styles.runRow}>
                          <Button label="종료" variant="accent" size="sm" style={styles.flex} onPress={() => onStop(breast)} />
                          <Button label="반대쪽" variant="secondary" size="sm" style={styles.flex} onPress={() => onStart('breast', breast.side === 'right' ? 'left' : 'right')} />
                        </View>
                      )}
                    </NowNode>
                  )}
                  {g.sleep && <Port x={g.sleep.x} y={g.sleep.y + Math.min(g.sleep.h, 64) / 2} accent={layout.sleep === 'now'} />}
                  {g.sleep && <Port x={g.sleep.x + g.sleep.w} y={g.sleep.y + Math.min(g.sleep.h, 64) / 2} />}
                  {g.wake && <Port x={g.wake.x} y={g.sleep ? g.sleep.y + 28 : g.wake.y + Math.min(g.wake.h, 64) / 2} accent={layout.wake === 'now'} />}
                  {g.wake && <Port x={g.wake.x + g.wake.w} y={g.sleep ? g.sleep.y + 28 : g.wake.y + Math.min(g.wake.h, 64) / 2} accent={layout.wake === 'now'} />}
                  {g.ports.map((p, k) => (
                    <Port key={`p${k}`} x={p.x} y={p.y} accent={nowRow} />
                  ))}
                  {items.map((it, k) => {
                    const s = g.subs[k];
                    if (!s) return null;
                    const title = subTitle(it, now);
                    return (
                      <SubNode
                        key={it.key}
                        cx={s.cx}
                        cy={s.cy}
                        kind={subKind(it)}
                        title={title}
                        sub={hhmm(it.at)}
                        aria={`${hhmm(it.at)} ${title}${'by' in it && it.by ? `, ${it.by}` : it.type === 'feed' && it.session.by ? `, ${it.session.by}` : it.type === 'side' && it.event.by ? `, ${it.event.by}` : ''}`}
                        onPress={() => openRecords(wakeParams(r, it.key))}
                      />
                    );
                  })}
                </View>
              );
            })}
            {future.map((f, k) => {
              const rect = geo.future[k];
              return (
                <View key={f.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  <FutureSquare rect={rect} icon={f.icon} accent={f.accent} aria={f.aria} onPress={f.onPress} onLongPress={f.onLongPress} />
                  <NodeLabel cx={rect.x + SQ / 2} top={rect.y + SQ + 6} title={f.title} sub={f.sub} width={104} dim />
                </View>
              );
            })}
          </FlowCanvas>
        )}
      </View>

      {routine.sheets}
      {schedule.sheets}
      <DayNewsSheet
        news={sharing ? news : null}
        title={isToday ? '오늘 소식' : `${date.getMonth() + 1}월 ${date.getDate()}일 소식`}
        pose={poseOf(age.month)}
        onClose={() => setSharing(false)}
      />
    </View>
  );
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
  runRow: { flexDirection: 'row', gap: 8 },
});
