/**
 * 루틴 — 육아비서 첫 화면 (SPEC-MAIN-01~04, task today/001 · 002 · 003 · 004, decisions/028 · 029).
 *
 * 「했나?」에 바로 답하는 곳이다. 위쪽 먹색 머리(routine-hero)에 진행 고리 · 남은 개수 · 다음 루틴과 그것을 바로 하는 큰 단추,
 * 그 아래 오늘 할 루틴을 버튼 보기(routine-grid)나 시간순 보기(routine-timeline)로 보인다. 보기는 머리 오른쪽에서 바꾸고 마지막 것을 기억한다.
 * 오늘 할 날이 아닌 루틴은 맨 아래 한 줄로 접는다. 할 일과 다가오는 날은 할 일 탭에 있다.
 * 단계가 있는 루틴은 누르면 단계 시트(SPEC-MAIN-05), 재고 확인은 재고 확인 시트(SPEC-MAIN-06)가 열린다.
 * 추가는 추천 시트(routine-add-sheet), 직접 만들기 · 편집은 routine-form 화면이다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { RoutineAddSheet } from '@/components/routine/routine-add-sheet';
import { RoutineGrid } from '@/components/routine/routine-grid';
import { RoutineHero, type RoutineView } from '@/components/routine/routine-hero';
import { RoutineStepsSheet } from '@/components/routine/routine-steps-sheet';
import { RoutineTimeline } from '@/components/routine/routine-timeline';
import { StockSheet } from '@/components/routine/stock-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { monthStart } from '@/data/briefing';
import { readSetting, writeSetting } from '@/data/db';
import { routineRecommend } from '@/data/recommend';
import {
  dateLabel,
  hasSteps,
  nextDayLabel,
  scheduleLabel,
  templateInput,
  timeLabel,
  titleKey,
  todayPlan,
  type Routine,
} from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/** 마지막으로 고른 보기 — 다음에도 그 보기로 연다(SPEC-MAIN-01) */
const VIEW_KEY = 'routine_view';

/** 큰 단추의 이름표 — 단계 · 재고 확인은 시트를 열고, 타이머는 켜고 끄고, 그 밖에는 바로 완료 */
function actionLabel(r: Routine): string {
  if (hasSteps(r) || r.kind === 'stock') return `${r.title} 시작하기`;
  if (r.kind === 'minutes') return r.runningSince ? `${r.title} 타이머 멈추기` : `${r.title} 타이머 시작`;
  return `${r.title} 완료`;
}

export default function RoutineScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { baby, age } = useBaby();
  const {
    routines,
    logs,
    loading,
    addRoutine,
    updateRoutine,
    removeRoutine,
    restoreRoutine,
    check,
    toggleStep,
    completeAll,
    skipToday,
    completeStock,
    addMinutes,
    startTimer,
    stopTimer,
  } = useRoutines();
  const [adding, setAdding] = useState(false);
  /** 단계 시트 · 재고 확인 시트로 연 루틴 id */
  const [stepsId, setStepsId] = useState<string | null>(null);
  const [stockId, setStockId] = useState<string | null>(null);
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
  const setView = (v: RoutineView) => {
    tap();
    setViewState(v);
    setArranging(false);
    void writeSetting(VIEW_KEY, v).catch(() => undefined);
  };

  // 타이머가 켜져 있으면 1초마다, 아니면 30초마다 — 자정을 넘기거나 앱으로 돌아오면 「오늘」이 따라온다
  const now = useNow(routines.some((r) => r.kind === 'minutes' && r.runningSince));

  if (!baby || !age || loading) return <ScreenLoading />;
  const plan = todayPlan(routines, logs, now);
  const rec = routineRecommend(age.month, 'home');
  const templates = rec.templates;
  // 루틴이 세 개가 안 되면 아직 안 넣은 추천을 그리드 뒤에 함께 보인다 — 하나 넣어도 나머지가 사라지지 않게
  const have = new Set(routines.map((r) => titleKey(r.title)));
  const suggestions = routines.length < 3 && !arranging ? templates.filter((t) => !have.has(titleKey(t.title))) : [];
  const edit = (r: Routine) => router.push({ pathname: '/routine-form', params: { id: r.id } });
  const onTimer = (r: Routine) => void (r.runningSince ? stopTimer(r.id) : startTimer(r.id));
  // 단계가 있으면 단계 시트, 재고 확인은 재고 확인 시트, 그 밖의 체크는 바로 완료 ↔ 되돌림
  const onCheck = (id: string) => {
    const r = routines.find((x) => x.id === id);
    if (r && hasSteps(r)) setStepsId(id);
    else if (r?.kind === 'stock') setStockId(id);
    else void check(id);
  };
  const onAction = (r: Routine) => (r.kind === 'minutes' ? onTimer(r) : onCheck(r.id));
  const stepsRoutine = routines.find((r) => r.id === stepsId) ?? null;
  const stockRoutine = routines.find((r) => r.id === stockId) ?? null;
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
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <RoutineHero
          topInset={insets.top}
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
                  now={now}
                  onCheck={onCheck}
                  onAddMinutes={(id, m) => void addMinutes(id, m)}
                  onTimer={onTimer}
                  onEdit={edit}
                />
              )
            ) : (
              <RoutineGrid
                items={plan.today}
                templates={suggestions}
                now={now}
                editing={arranging}
                onCheck={onCheck}
                onAddMinutes={(id) => void addMinutes(id, 1)}
                onTimer={onTimer}
                onEdit={edit}
                onAdd={() => setAdding(true)}
                onQuickAdd={(t) => void addRoutine(templateInput(t))}
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
      {/* 배너는 바닥에 고정 — 넘겨도 가려지지 않는다 */}
      <AdBanner anchored />
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
      <RoutineStepsSheet
        routine={stepsRoutine}
        logs={logs}
        now={now}
        onToggleStep={(i) => stepsRoutine && void toggleStep(stepsRoutine.id, i)}
        onCompleteAll={() => stepsRoutine && void completeAll(stepsRoutine.id)}
        onEdit={() => {
          setStepsId(null);
          if (stepsRoutine) edit(stepsRoutine);
        }}
        onSkip={() => {
          if (stepsRoutine) void skipToday(stepsRoutine.id);
          setStepsId(null);
        }}
        onClose={() => setStepsId(null)}
      />
      <StockSheet
        key={stockId ?? 'stock-closed'}
        routine={stockRoutine}
        onDone={(short) => {
          const id = stockId;
          setStockId(null);
          if (id) void completeStock(id, short);
        }}
        onAddItem={(name) => stockRoutine && void updateRoutine(stockRoutine.id, { items: [...(stockRoutine.items ?? []), name] })}
        onSkip={() => {
          if (stockRoutine) void skipToday(stockRoutine.id);
          setStockId(null);
        }}
        onClose={() => setStockId(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.four },
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
