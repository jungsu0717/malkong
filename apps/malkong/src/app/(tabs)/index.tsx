/**
 * 오늘 — 육아비서 첫 화면 (SPEC-MAIN-01~04, task today/001 · 002, decisions/028).
 *
 * 「했나?」에 바로 답하는 곳이다. 루틴은 버튼 모음으로 한눈에 다 보인다(routine-grid) — 체크 루틴은 누르면 완료(완료한 시각),
 * 타이머 루틴은 누르면 타이머, +5분. 그 아래 오늘 할 일과 다가오는 날 한 줄, 바닥 칸에 적으면 내 할 일 · 오늘.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { RoutineGrid } from '@/components/routine/routine-grid';
import { RoutineSheet } from '@/components/routine/routine-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TodoRow } from '@/components/todo-row';
import { Card, ListRow, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { birthOf, milestoneDays, upcomingAuto } from '@/data/auto-todos';
import { useBaby } from '@/data/baby-context';
import { monthStart, todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { todayState, type Routine, type RoutineTemplate } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { todayTodos, visibleTopics, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const DAY_MS = 86_400_000;

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
  const [arranging, setArranging] = useState(false);

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

  // 루틴 — 오늘 할 것을 알림 시각 순으로 먼저(시각이 없으면 뒤에), 다른 날 것은 가까운 순으로 뒤에.
  // 누를 때마다 자리가 바뀌지 않게 완료 여부로는 옮기지 않는다
  const states = routines.map((r) => ({ r, s: todayState(r, logs, now) }));
  const routineItems = [
    ...states.filter((x) => x.s.due).sort((a, b) => (a.r.time ?? '99').localeCompare(b.r.time ?? '99') || a.r.sort - b.r.sort),
    ...states.filter((x) => !x.s.due).sort((a, b) => a.s.nextInDays - b.s.nextInDays || a.r.sort - b.r.sort),
  ];

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

  const quickAdd = (t: RoutineTemplate) =>
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

            {/* 루틴 (SPEC-MAIN-01 · 02 · 03) */}
            <View style={styles.section}>
              <View style={styles.headRow}>
                <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                  루틴
                </ThemedText>
                {routines.length > 0 && (
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setArranging((v) => !v)}>
                    <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                      {arranging ? '완료' : '편집'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {routines.length === 0 && (
                <ThemedText type="small" style={[styles.hint, { color: c.textSecondary }]}>
                  자주 챙기는 일을 눌러 추가해 보세요. 정한 시간에 알려 드려요
                </ThemedText>
              )}
              <RoutineGrid
                items={routineItems}
                now={now}
                editing={arranging}
                onCheck={(id) => void check(id)}
                onAddMinutes={(id) => void addMinutes(id, 5)}
                onTimer={(r) => void (r.runningSince ? stopTimer(r.id) : startTimer(r.id))}
                onEdit={(r) => setSheet({ routine: r })}
                onAdd={() => setSheet({ routine: null })}
                onQuickAdd={quickAdd}
              />
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
        key={sheet ? `routine-${sheet.routine?.id ?? 'new'}` : 'routine-closed'}
        open={sheet !== null}
        routine={sheet?.routine ?? null}
        existingTitles={routines.map((r) => r.title)}
        onClose={() => setSheet(null)}
        onSave={(input) => {
          const target = sheet?.routine;
          setSheet(null);
          void (target ? updateRoutine(target.id, input) : addRoutine(input));
        }}
        onQuickAdd={quickAdd}
        onDelete={() => {
          const target = sheet?.routine;
          setSheet(null);
          if (target) void removeRoutine(target.id);
        }}
      />
    </ThemedView>
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
  hint: { paddingHorizontal: 4 },
  rows: { paddingVertical: 6 },
  empty: { paddingVertical: Spacing.three },
});
