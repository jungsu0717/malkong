/**
 * 루틴 — 육아비서 첫 화면 (SPEC-MAIN-01~04, task today/001 · 002 · 003, decisions/028 · 029).
 *
 * 「했나?」에 바로 답하는 곳이다. 위에 진행 카드(오늘 루틴 몇 개 중 몇 개 완료 · 다음 루틴), 그 아래 오늘 할 루틴을
 * 버튼 보기(routine-grid)나 시간순 보기(routine-timeline)로 보인다. 보기는 제목 오른쪽에서 바꾸고 마지막 것을 기억한다.
 * 오늘 할 날이 아닌 루틴은 맨 아래 한 줄로 접는다. 할 일과 다가오는 날은 할 일 탭에 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { RoutineGrid } from '@/components/routine/routine-grid';
import { RoutineSheet } from '@/components/routine/routine-sheet';
import { RoutineTimeline } from '@/components/routine/routine-timeline';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { readSetting, writeSetting } from '@/data/db';
import { dateLabel, everyLabel, nextDayLabel, timeLabel, todayPlan, type Routine, type RoutineTemplate } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

type ViewMode = 'grid' | 'timeline';
/** 마지막으로 고른 보기 — 다음에도 그 보기로 연다(SPEC-MAIN-01) */
const VIEW_KEY = 'routine_view';

export default function RoutineScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { routines, logs, loading, addRoutine, updateRoutine, removeRoutine, check, addMinutes, startTimer, stopTimer } = useRoutines();
  const [sheet, setSheet] = useState<{ routine: Routine | null } | null>(null);
  const [arranging, setArranging] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [view, setViewState] = useState<ViewMode>('grid');
  useEffect(() => {
    void readSetting(VIEW_KEY)
      .then((v) => {
        if (v === 'timeline') setViewState('timeline');
      })
      .catch(() => undefined);
  }, []);
  const setView = (v: ViewMode) => {
    tap();
    setViewState(v);
    setArranging(false);
    void writeSetting(VIEW_KEY, v).catch(() => undefined);
  };

  // 타이머가 켜져 있으면 1초마다, 아니면 30초마다 — 자정을 넘기거나 앱으로 돌아오면 「오늘」이 따라온다
  const now = useNow(routines.some((r) => r.runningSince));

  if (!baby || !age || loading) return <ScreenLoading />;
  const plan = todayPlan(routines, logs, now);
  const quickAdd = (t: RoutineTemplate) =>
    void addRoutine({ title: t.title, kind: t.kind, everyDays: t.everyDays, time: t.time, goalMinutes: null });
  const onTimer = (r: Routine) => void (r.runningSince ? stopTimer(r.id) : startTimer(r.id));
  const nextText = plan.next ? [plan.next.r.title, plan.next.r.time ? timeLabel(plan.next.r.time) : null].filter(Boolean).join(' · ') : null;
  const first = plan.later[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.title}>
            <View style={styles.titleRow}>
              <ThemedText type="display">루틴</ThemedText>
              <View style={[styles.toggle, { backgroundColor: c.surface }]} accessibilityLabel="보기 전환">
                {(['grid', 'timeline'] as ViewMode[]).map((v) => {
                  const on = view === v;
                  return (
                    <Pressable
                      key={v}
                      accessibilityRole="button"
                      accessibilityLabel={v === 'grid' ? '버튼 보기' : '시간순 보기'}
                      accessibilityState={{ selected: on }}
                      onPress={() => setView(v)}
                      style={[styles.toggleItem, on && { backgroundColor: c.background }]}>
                      <Ionicons name={v === 'grid' ? 'grid-outline' : 'list-outline'} size={17} color={on ? c.text : c.textSecondary} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              {dateLabel(now)} · 태어난 지 {age.days + 1}일
            </ThemedText>
          </View>

          {/* 진행 카드 (SPEC-MAIN-01) */}
          {plan.total > 0 && (
            <View style={[styles.progress, { backgroundColor: c.surface }]}>
              <View style={styles.progressHead}>
                <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                  오늘 루틴
                </ThemedText>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  <ThemedText type="title" style={{ fontSize: 26, lineHeight: 30 }}>
                    {plan.done}
                  </ThemedText>{' '}
                  / {plan.total} 완료
                </ThemedText>
              </View>
              <View style={[styles.bar, { backgroundColor: c.surfaceStrong }]}>
                <View style={[styles.barFill, { backgroundColor: c.accent, width: `${(plan.done / plan.total) * 100}%` }]} />
              </View>
              <View style={styles.nextRow}>
                <Ionicons name={nextText ? 'time-outline' : 'checkmark-circle-outline'} size={16} color={c.textSecondary} />
                {nextText ? (
                  <ThemedText type="small">
                    <ThemedText type="small" style={{ color: c.textSecondary }}>
                      다음
                    </ThemedText>{' '}
                    <ThemedText type="small" style={{ fontWeight: 600 }}>
                      {nextText}
                    </ThemedText>
                  </ThemedText>
                ) : (
                  <ThemedText type="small" style={{ fontWeight: 600 }}>
                    오늘 루틴을 모두 완료했어요
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* 오늘 할 루틴 (SPEC-MAIN-01 · 02 · 03) */}
          <View style={styles.section}>
            <View style={styles.headRow}>
              <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                오늘 할 루틴
              </ThemedText>
              {routines.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => (view === 'grid' ? setArranging((v) => !v) : setSheet({ routine: null }))}>
                  <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                    {view === 'timeline' ? '추가' : arranging ? '완료' : '편집'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {routines.length === 0 && (
              <ThemedText type="small" style={[styles.hint, { color: c.textSecondary }]}>
                자주 챙기는 일을 눌러 추가해 보세요. 정한 시간에 알려 드려요
              </ThemedText>
            )}
            {routines.length > 0 && plan.total === 0 && (
              <ThemedText type="small" style={[styles.hint, { color: c.textSecondary }]}>
                오늘 할 루틴이 없어요
              </ThemedText>
            )}
            {view === 'timeline' && routines.length > 0 ? (
              plan.total > 0 && (
                <RoutineTimeline
                  items={plan.today}
                  nextId={plan.next?.r.id ?? null}
                  now={now}
                  onCheck={(id) => void check(id)}
                  onAddMinutes={(id, m) => void addMinutes(id, m)}
                  onTimer={onTimer}
                  onEdit={(r) => setSheet({ routine: r })}
                />
              )
            ) : (
              <RoutineGrid
                items={plan.today}
                showTemplates={routines.length === 0}
                now={now}
                editing={arranging}
                onCheck={(id) => void check(id)}
                onAddMinutes={(id) => void addMinutes(id, 1)}
                onTimer={onTimer}
                onEdit={(r) => setSheet({ routine: r })}
                onAdd={() => setSheet({ routine: null })}
                onQuickAdd={quickAdd}
              />
            )}
          </View>

          {/* 다른 날 루틴 한 줄 (SPEC-MAIN-01) */}
          {first && (
            <View style={[styles.later, { borderColor: c.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showLater }}
                onPress={() => setShowLater((v) => !v)}
                style={styles.laterHead}>
                <Ionicons name="calendar-clear-outline" size={18} color={c.textSecondary} />
                <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    다른 날
                  </ThemedText>
                  {` · ${first.r.title} ${nextDayLabel(first.s.nextInDays, now)}`}
                  {plan.later.length > 1 ? ` 외 ${plan.later.length - 1}개` : ''}
                </ThemedText>
                <Ionicons name={showLater ? 'chevron-up' : 'chevron-down'} size={16} color={c.textTertiary} />
              </Pressable>
              {showLater &&
                plan.later.map(({ r, s }) => (
                  <Pressable
                    key={r.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.title} 편집`}
                    onPress={() => setSheet({ routine: r })}
                    style={[styles.laterRow, { borderTopColor: c.divider }]}>
                    <ThemedText type="body" style={styles.flex}>
                      {r.title}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: c.textSecondary }}>
                      {everyLabel(r.everyDays)} · {nextDayLabel(s.nextInDays, now)}
                    </ThemedText>
                  </Pressable>
                ))}
            </View>
          )}

          <AdBanner />
        </ScrollView>
      </SafeAreaView>

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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12 },
  toggleItem: { width: 38, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  progress: { borderRadius: Radius.xl, padding: 18, gap: 12 },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  section: { gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  hint: { paddingHorizontal: 4 },
  later: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 16 },
  laterHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  laterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth * 2 },
});
