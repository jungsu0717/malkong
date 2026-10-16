/**
 * 오늘 — 육아비서 첫 화면 (SPEC-MAIN-01~04, task today/001, decisions/028).
 *
 * 「했나?」에 바로 답하는 곳이다. 루틴을 알림 시각으로 아침 · 낮 · 저녁 · 하루 중으로 묶어 보이고, 체크 루틴은 한 번 눌러 했어요(몇 시에 했는지),
 * 시간 재기 루틴은 +5분 · 타이머로 오늘 누적. 오늘 차례가 아닌 N일마다 루틴은 아래에 접어 둔다. 그 아래 오늘 할 일과 다가오는 날 한 줄,
 * 바닥 칸에 적으면 내 할 일 · 오늘.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { RoutineSheet } from '@/components/routine/routine-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TodoRow } from '@/components/todo-row';
import { Card, Chip, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { birthOf, milestoneDays, upcomingAuto } from '@/data/auto-todos';
import { useBaby } from '@/data/baby-context';
import { monthStart, todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import {
  ROUTINE_TEMPLATES,
  SLOT_LABELS,
  everyLabel,
  slotOf,
  timeLabel,
  todayState,
  type Routine,
  type Slot,
  type TodayState,
} from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { todayTodos, visibleTopics, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const SLOTS: Slot[] = ['morning', 'day', 'evening', 'any'];
const DAY_MS = 86_400_000;

/** 「08:10」 */
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 오늘 0시 기준 며칠 남았나 */
function daysUntil(date: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - today) / DAY_MS);
}

export default function TodayScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove } = useTodos();
  const { routines, logs, loading: routinesLoading, addRoutine, updateRoutine, removeRoutine, check, addMinutes, startTimer, stopTimer } =
    useRoutines();
  const markDone = useMarkDone();
  const typing = useKeyboardVisible();
  const [editing, setEditing] = useState<Todo | null>(null);
  const [sheet, setSheet] = useState<{ routine: Routine | null } | null>(null);
  const [showLater, setShowLater] = useState(false);

  // 타이머가 켜져 있으면 1초마다, 아니면 30초마다 — 자정을 넘기거나 앱으로 돌아오면 「오늘」이 따라온다
  const now = useNow(routines.some((r) => r.runningSince));

  const month = age?.month ?? 0;
  const shown = useMemo(() => visibleTopics(topics).filter((t) => t.kind !== 'shopping'), [topics]);
  const groups = useMemo(() => checkupGroups(records, month), [records, month]);
  const dueGroups = useMemo(() => groups.filter((g) => g.status === 'open'), [groups]);

  if (!baby || !age || loading || routinesLoading) return <ScreenLoading />;
  const general = shown.find((t) => t.kind === 'general');
  const visibleIds = new Set(shown.map((t) => t.id));
  const { open, doneToday } = todayTodos(todos.filter((t) => visibleIds.has(t.topicId)));
  const nameOf = (topicId: string) => (topicId === general?.id ? null : (topics.find((t) => t.id === topicId)?.title ?? null));

  // 루틴 — 오늘 차례인 것은 시간대별로, 아닌 것은 아래에 접어 둔다
  const states = routines.map((r) => ({ r, s: todayState(r, logs, now) }));
  const dueToday = states.filter((x) => x.s.due);
  const later = states.filter((x) => !x.s.due).sort((a, b) => a.s.nextInDays - b.s.nextInDays);
  const bySlot = SLOTS.map((slot) => ({
    slot,
    items: dueToday.filter((x) => slotOf(x.r.time) === slot).sort((a, b) => (a.r.time ?? '').localeCompare(b.r.time ?? '')),
  })).filter((g) => g.items.length > 0);

  // 다가오는 날 — 접종 · 검진, 50일 · 100일 · 돌, 사이즈 확인 중 가까운 둘
  const birth = birthOf(baby.birthDate);
  const have = new Set(todos.map((t) => t.ref).filter((r): r is string => !!r));
  const soonDays = [
    ...groups.filter((g) => g.status === 'soon').map((g) => ({ label: g.label, date: monthStart(baby.birthDate, g.month), kind: 'checkup' })),
    ...milestoneDays(birth).map((d) => ({ label: d.label, date: d.date, kind: 'milestone' })),
    ...upcomingAuto('size', birth, now, have).map((u) => ({ label: u.rule.title, date: u.due, kind: 'size' })),
  ]
    .filter((d) => daysUntil(d.date, now) > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 2);
  const soonTopic = soonDays[0] ? shown.find((t) => t.kind === soonDays[0].kind) : undefined;

  const quickAdd = (t: (typeof ROUTINE_TEMPLATES)[number]) =>
    void addRoutine({ title: t.title, kind: t.kind, everyDays: t.everyDays, time: t.time, goalMinutes: null });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            <View style={styles.title}>
              <ThemedText type="display">오늘</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {now.getMonth() + 1}월 {now.getDate()}일 · 태어난 지 {age.days + 1}일
              </ThemedText>
            </View>

            {/* 루틴 (SPEC-MAIN-01 · 02) */}
            <View style={styles.section}>
              <View style={styles.headRow}>
                <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                  루틴
                </ThemedText>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSheet({ routine: null })} style={styles.addLink}>
                  <Ionicons name="add" size={16} color={c.accentText} />
                  <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                    루틴 추가
                  </ThemedText>
                </Pressable>
              </View>

              {routines.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    목욕 · 터미타임처럼 날마다 챙기는 일을 추가해 두면, 했는지 한눈에 보이고 정한 시각에 알려 드려요
                  </ThemedText>
                  <View style={styles.chips}>
                    {ROUTINE_TEMPLATES.slice(0, 5).map((t) => (
                      <Chip key={t.title} label={t.title} icon="add" onPress={() => quickAdd(t)} />
                    ))}
                  </View>
                </Card>
              ) : (
                <Card style={styles.rows}>
                  {bySlot.length === 0 && (
                    <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                      오늘 차례인 루틴이 없어요
                    </ThemedText>
                  )}
                  {bySlot.map((g, gi) => (
                    <View key={g.slot}>
                      <ThemedText type="caption" style={[styles.slot, gi > 0 && styles.slotGap, { color: c.textSecondary }]}>
                        {SLOT_LABELS[g.slot]}
                      </ThemedText>
                      {g.items.map(({ r, s }) =>
                        r.kind === 'check' ? (
                          <CheckRow key={r.id} routine={r} state={s} onPress={() => void check(r.id)} onEdit={() => setSheet({ routine: r })} />
                        ) : (
                          <MinutesRow
                            key={r.id}
                            routine={r}
                            state={s}
                            now={now}
                            onAdd={() => void addMinutes(r.id, 5)}
                            onTimer={() => void (r.runningSince ? stopTimer(r.id) : startTimer(r.id))}
                            onEdit={() => setSheet({ routine: r })}
                          />
                        ),
                      )}
                    </View>
                  ))}
                  {later.length > 0 && (
                    <Pressable accessibilityRole="button" onPress={() => setShowLater((v) => !v)} style={styles.laterToggle}>
                      <ThemedText type="caption" style={{ color: c.textSecondary }}>
                        다른 날 루틴 {later.length}개
                      </ThemedText>
                      <Ionicons name={showLater ? 'chevron-up' : 'chevron-down'} size={14} color={c.textSecondary} />
                    </Pressable>
                  )}
                  {showLater &&
                    later.map(({ r, s }) => (
                      <Pressable key={r.id} accessibilityRole="button" onPress={() => setSheet({ routine: r })} style={styles.laterRow}>
                        <ThemedText type="body" style={{ flex: 1, color: c.textSecondary }}>
                          {r.title}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: c.textSecondary }}>
                          {everyLabel(r.everyDays)} · {s.nextInDays === 1 ? '내일' : `${s.nextInDays}일 뒤`}
                        </ThemedText>
                      </Pressable>
                    ))}
                </Card>
              )}
            </View>

            {/* 오늘 할 일 (SPEC-TOPIC-02) */}
            <View style={styles.section}>
              <SectionHeader title="오늘 할 일" />
              <Card style={styles.rows}>
                {open.length === 0 && dueGroups.length === 0 && doneToday.length === 0 ? (
                  <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                    오늘 할 일이 없어요
                  </ThemedText>
                ) : (
                  <>
                    {dueGroups.map((g, i) => (
                      <TodoRow
                        key={g.key}
                        todo={todoOf(g)}
                        birthDate={baby.birthDate}
                        currentMonth={month}
                        divider={i > 0}
                        onPick={() => markDone.pick(g)}
                      />
                    ))}
                    {[...open, ...doneToday].map((t, i) => (
                      <TodoItem
                        key={t.id}
                        todo={t}
                        topicName={nameOf(t.topicId)}
                        divider={dueGroups.length + i > 0}
                        onToggle={() => void toggleDone(t.id)}
                        onEdit={() => setEditing(t)}
                      />
                    ))}
                  </>
                )}
              </Card>
            </View>

            {/* 다가오는 날 한 줄 */}
            {soonDays.length > 0 && (
              <Card style={styles.rows}>
                <ListRow
                  icon="calendar-outline"
                  title={soonDays.map((d) => `${d.label} D-${daysUntil(d.date, now)}`).join(' · ')}
                  onPress={() =>
                    soonTopic ? router.push({ pathname: '/topic/[id]', params: { id: soonTopic.id } }) : router.navigate('/todo')
                  }
                />
              </Card>
            )}

            {!typing && <AdBanner />}
          </ScrollView>

          <TodoInput
            placeholder="오늘 할 일 추가 (예: 택배 반품)"
            onAdd={(p) => {
              const today = new Date();
              const dueAt = p.dueAt ?? new Date(today.getFullYear(), today.getMonth(), today.getDate());
              void add({ title: p.title, dueAt: dueAt.toISOString(), hasTime: p.hasTime, repeat: p.repeat });
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {markDone.sheet}
      <TodoSheet
        key={editing?.id ?? 'none'}
        todo={editing}
        topics={shown}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) void update(editing.id, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) void remove(editing.id);
          setEditing(null);
        }}
      />
      <RoutineSheet
        key={sheet ? (sheet.routine?.id ?? 'new') : 'closed'}
        open={sheet !== null}
        routine={sheet?.routine ?? null}
        existingTitles={routines.map((r) => r.title)}
        onClose={() => setSheet(null)}
        onSave={(input) => {
          const target = sheet?.routine;
          setSheet(null);
          void (target ? updateRoutine(target.id, input) : addRoutine(input));
        }}
        onDelete={() => {
          const target = sheet?.routine;
          setSheet(null);
          if (target) void removeRoutine(target.id);
        }}
      />
    </ThemedView>
  );
}

/** 체크 루틴 한 줄 — 누르면 했어요 ↔ 되돌림, 길게 누르면 편집 */
function CheckRow({ routine, state, onPress, onEdit }: { routine: Routine; state: TodayState; onPress: () => void; onEdit: () => void }) {
  const c = useTheme();
  const done = !!state.firstAt;
  const sub = [
    routine.everyDays > 1 ? everyLabel(routine.everyDays) : null,
    !done && routine.everyDays > 1 && state.sinceDays ? `${state.sinceDays}일 만` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={routine.title}
      onPress={() => {
        tap(done ? 'light' : 'success');
        onPress();
      }}
      onLongPress={onEdit}
      delayLongPress={350}
      style={({ pressed }) => [styles.routineRow, pressed && { opacity: 0.6 }]}>
      <View style={[styles.check, done ? { backgroundColor: c.ink } : { borderWidth: 2.2, borderColor: c.text }]}>
        {done && <Ionicons name="checkmark" size={16} color={c.onInk} />}
      </View>
      <View style={styles.flex}>
        <ThemedText type="body" style={{ fontWeight: 600 }}>
          {routine.title}
        </ThemedText>
        {sub ? (
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" style={{ color: done ? c.text : c.textSecondary, fontWeight: done ? 600 : 400 }}>
        {done && state.firstAt ? `${hhmm(state.firstAt)} 했어요` : routine.time ? timeLabel(routine.time) : ''}
      </ThemedText>
    </Pressable>
  );
}

/** 시간 재기 루틴 한 줄 — 오늘 누적, +5분, 타이머. 길게 누르면 편집 */
function MinutesRow({
  routine,
  state,
  now,
  onAdd,
  onTimer,
  onEdit,
}: {
  routine: Routine;
  state: TodayState;
  now: Date;
  onAdd: () => void;
  onTimer: () => void;
  onEdit: () => void;
}) {
  const c = useTheme();
  const elapsed = routine.runningSince ? Math.max(0, Math.floor((now.getTime() - new Date(routine.runningSince).getTime()) / 1000)) : 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const total = `오늘 ${state.minutes}분${routine.goalMinutes ? ` / ${routine.goalMinutes}분` : ''}`;
  return (
    <Pressable onLongPress={onEdit} delayLongPress={350} style={styles.routineRow} accessibilityLabel={`${routine.title}, ${total}`}>
      <View style={[styles.check, state.done ? { backgroundColor: c.ink } : { borderWidth: 2.2, borderColor: c.text }]}>
        {state.done ? <Ionicons name="checkmark" size={16} color={c.onInk} /> : <Ionicons name="time-outline" size={14} color={c.text} />}
      </View>
      <View style={styles.flex}>
        <ThemedText type="body" style={{ fontWeight: 600 }}>
          {routine.title}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {total}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${routine.title} 5분 더하기`}
        hitSlop={6}
        onPress={() => {
          tap('success');
          onAdd();
        }}
        style={[styles.pill, { backgroundColor: c.surfaceStrong }]}>
        <ThemedText type="caption" style={{ fontWeight: 700 }}>
          +5분
        </ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={routine.runningSince ? `${routine.title} 타이머 멈추기` : `${routine.title} 타이머 시작`}
        hitSlop={6}
        onPress={() => {
          tap();
          onTimer();
        }}
        style={[styles.pill, { backgroundColor: routine.runningSince ? c.ink : c.surfaceStrong }]}>
        <Ionicons name={routine.runningSince ? 'stop' : 'play'} size={12} color={routine.runningSince ? c.onInk : c.text} />
        {routine.runningSince ? (
          <ThemedText type="caption" style={{ fontWeight: 700, color: c.onInk }}>
            {clock}
          </ThemedText>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: { gap: 2 },
  section: { gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rows: { paddingVertical: 6 },
  emptyCard: { gap: Spacing.two },
  empty: { paddingVertical: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { paddingTop: 4, fontWeight: 600 },
  slotGap: { paddingTop: Spacing.two },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16 },
  laterToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: Spacing.two },
  laterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
