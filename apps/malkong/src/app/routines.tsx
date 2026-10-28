/**
 * 루틴 화면 — 홈 「오늘 할 루틴 · 전체 ›」로 들어온다 (SPEC-MAIN-01~04, task today/001 · 002 · 003 · 004 · 007, decisions/028 · 029 · 034).
 *
 * 「했나?」에 바로 답하고 루틴을 고치는 곳이다. 위쪽 먹색 머리(routine-hero)에 뒤로 단추 · 진행 고리 · 남은 개수 · 다음 루틴과 그것을 바로 하는 큰 단추,
 * 그 아래 오늘 할 루틴을 버튼 보기(routine-grid)나 시간순 보기(routine-timeline)로 보인다. 보기는 머리 오른쪽에서 바꾸고 마지막 것을 기억한다.
 * 오늘 할 날이 아닌 루틴은 맨 아래 한 줄로 접는다. 다가오는 일은 홈, 할 일은 할 일 탭에 있다.
 * 누를 때의 흐름(단계 시트 SPEC-MAIN-05, 재고 확인 시트 SPEC-MAIN-06)은 홈과 같이 쓰는 use-routine-actions 에 있다.
 * 추가는 추천 시트(routine-add-sheet), 직접 만들기 · 편집은 routine-form 화면이다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoutineAddSheet } from '@/components/routine/routine-add-sheet';
import { RoutineGrid } from '@/components/routine/routine-grid';
import { RoutineHero, type RoutineView } from '@/components/routine/routine-hero';
import { RoutineTimeline } from '@/components/routine/routine-timeline';
import { useRoutineActions } from '@/components/routine/use-routine-actions';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { monthStart } from '@/data/briefing';
import { readSetting, writeSetting } from '@/data/db';
import { gridSuggestions, routineRecommend } from '@/data/recommend';
import {
  dateLabel,
  hasSteps,
  nextDayLabel,
  scheduleLabel,
  templateInput,
  timeLabel,
  todayPlan,
  type Routine,
  type RoutineTemplate,
} from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/** 마지막으로 고른 보기 — 다음에도 그 보기로 연다(SPEC-MAIN-01) */
const VIEW_KEY = 'routine_view';
/** 길게 눌러 숨긴 추천 버튼의 이름(SPEC-MAIN-03) */
const HIDDEN_SUGGESTIONS_KEY = 'routine.hiddenSuggestions';

/** 큰 단추의 이름표 — 단계 · 재고 확인은 시트를 열고, 그 밖에는 바로 완료 */
function actionLabel(r: Routine): string {
  if (hasSteps(r) || r.kind === 'stock') return `${r.title} 시작하기`;
  return `${r.title} 완료`;
}

export default function RoutinesScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { baby, age } = useBaby();
  const { routines, logs, loading, addRoutine, removeRoutine, restoreRoutine } = useRoutines();
  const [adding, setAdding] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [view, setViewState] = useState<RoutineView>('grid');
  useEffect(() => {
    void readSetting(VIEW_KEY)
      .then((v) => {
        if (v === 'timeline') setViewState('timeline');
      })
      .catch(() => undefined);
  }, []);
  const [hiddenSuggestions, setHiddenSuggestions] = useState<string[]>([]);
  useEffect(() => {
    void readSetting(HIDDEN_SUGGESTIONS_KEY)
      .then((v) => {
        const list: unknown = v ? JSON.parse(v) : [];
        if (Array.isArray(list)) setHiddenSuggestions(list.filter((x): x is string => typeof x === 'string'));
      })
      .catch(() => undefined);
  }, []);
  const hideSuggestion = (t: RoutineTemplate) => {
    tap();
    const next = [...hiddenSuggestions, t.title];
    setHiddenSuggestions(next);
    void writeSetting(HIDDEN_SUGGESTIONS_KEY, JSON.stringify(next)).catch(() => undefined);
  };
  const setView = (v: RoutineView) => {
    tap();
    setViewState(v);
    setArranging(false);
    void writeSetting(VIEW_KEY, v).catch(() => undefined);
  };

  // 30초마다 — 자정을 넘기거나 앱으로 돌아오면 「오늘」이 따라온다
  const now = useNow(false);
  const { onCheck, edit, sheets } = useRoutineActions(now);

  if (!baby || !age || loading) return <ScreenLoading />;
  const plan = todayPlan(routines, logs, now);
  const rec = routineRecommend(age.month, 'home');
  const templates = rec.templates;
  // 그리드 뒤의 점선 추천 — 지금 시기 추천 중 아직 안 넣은 것 전부. 하나 넣으면 그 버튼만 빠진다
  const suggestions = arranging ? [] : gridSuggestions(age.month, routines.map((r) => r.title), hiddenSuggestions);
  const onAction = (r: Routine) => onCheck(r.id);
  const first = plan.later[0];
  const laterText = first ? `${nextDayLabel(first.s.nextInDays, now)} ${first.r.title}` : null;

  // 머리 글 — 남은 개수와 다음 루틴. 오늘 할 루틴이 없으면 고리 없이 한 줄
  const left = plan.total - plan.done;
  const headline =
    routines.length === 0
      ? '자주 챙기는 일을 추가해 보세요'
      : plan.total === 0
        ? '오늘 할 루틴이 없어요'
        : left > 0
          ? `${left}개 남았어요`
          : '모두 완료했어요';
  const sub =
    routines.length === 0
      ? '정한 시간에 알려 드려요'
      : plan.next
        ? `다음 · ${plan.next.r.title}${plan.next.r.time ? ` ${timeLabel(plan.next.r.time)}` : ''}`
        : plan.total === 0 && laterText
          ? `다음 · ${laterText}`
          : null;
  const nextDate = rec.next ? monthStart(baby.birthDate, rec.next.fromMonth) : null;
  const moreDetail =
    rec.next && nextDate
      ? `${nextDate.getMonth() + 1}월 ${nextDate.getDate()}일부터 ${rec.next.templates
          .slice(0, 2)
          .map((t) => t.title)
          .join(' · ')} 추천`
      : '병원 · 산후조리원에서 쓸 추천도 있어요';

  return (
    <ThemedView style={styles.container}>
      {focused && <StatusBar style="light" />}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: Spacing.four + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        <RoutineHero
          topInset={insets.top}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          dateText={`${dateLabel(now)} · 태어난 지 ${age.days + 1}일`}
          view={view}
          onView={setView}
          ring={plan.total > 0 ? { done: plan.done, total: plan.total } : null}
          headline={headline}
          sub={sub}
          action={plan.next ? { routine: plan.next.r, label: actionLabel(plan.next.r) } : null}
          onAction={onAction}
        />

        <View style={styles.body}>
          {/* 오늘 할 루틴 (SPEC-MAIN-01 · 02 · 03) */}
          <View style={styles.section}>
            <View style={styles.headRow}>
              <ThemedText type="body" style={{ fontWeight: 700 }}>
                {routines.length === 0 ? '추천 루틴' : '오늘 할 루틴'}
              </ThemedText>
              {routines.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => (view === 'grid' ? setArranging((v) => !v) : setAdding(true))}>
                  <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                    {view === 'timeline' ? '추가' : arranging ? '완료' : '편집'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {view === 'timeline' && routines.length > 0 ? (
              plan.total > 0 && (
                <RoutineTimeline
                  items={plan.today}
                  nextId={plan.next?.r.id ?? null}
                  onCheck={onCheck}
                  onEdit={edit}
                />
              )
            ) : (
              <RoutineGrid
                items={plan.today}
                templates={suggestions}
                editing={arranging}
                onCheck={onCheck}
                onEdit={edit}
                onAdd={() => setAdding(true)}
                onQuickAdd={(t) => void addRoutine(templateInput(t))}
                onHideSuggestion={hideSuggestion}
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
                  {` · ${laterText}`}
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
                    onPress={() => edit(r)}
                    style={[styles.laterRow, { borderTopColor: c.divider }]}>
                    <ThemedText type="body" style={styles.flex}>
                      {r.title}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: c.textSecondary }}>
                      {scheduleLabel(r)} · {nextDayLabel(s.nextInDays, now)}
                    </ThemedText>
                  </Pressable>
                ))}
            </View>
          )}
        </View>
      </ScrollView>
      {/* 아래로 넘긴 글이 상태 표시줄 밑으로 들어가도 시계가 보이게 */}
      <View style={[styles.statusStrip, { height: insets.top, backgroundColor: c.hero }]} />

      <RoutineAddSheet
        key={adding ? 'add-open' : 'add-closed'}
        open={adding}
        caption={`${rec.label} · 누르면 추가, 다시 누르면 빼요`}
        moreDetail={moreDetail}
        templates={templates}
        routines={routines}
        onAdd={(t) => void addRoutine(templateInput(t))}
        onRemove={(r) => void removeRoutine(r.id)}
        onUndo={(r) => void restoreRoutine(r.id)}
        onCustom={() => {
          setAdding(false);
          router.push('/routine-form');
        }}
        onMore={() => {
          setAdding(false);
          router.push('/routine-recommend');
        }}
        onClose={() => setAdding(false)}
      />
      {sheets}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: Gutter,
    paddingTop: 20,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0 },
  section: { gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  later: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 16 },
  laterHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  laterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth * 2 },
});
