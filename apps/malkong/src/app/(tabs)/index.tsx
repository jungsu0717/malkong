/**
 * 홈 — 첫 화면 (SPEC-MAIN-08, task today/007, decisions/034).
 *
 * 사용자가 아무것도 넣지 않아도 채워진 것이 먼저 보이는 곳이다. 위쪽 먹색 머리(home-hero)에 「이번 주 챙길 일 N개」,
 * 그 아래 다가오는 일(앱이 생일로 채운 접종 · 검진 · 기념일 · 사이즈 — 할 일 탭 아기 일정 칸과 같은 줄), 오늘 할 루틴 작은 버튼, 장보기 한 줄.
 * 칸마다 「전체 ›」나 줄을 눌러 상세(아기 일정 칸 · 루틴 화면 · 장보기 칸)로 들어간다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { HomeHero } from '@/components/home/home-hero';
import { RoutineMini } from '@/components/home/routine-mini';
import { useRoutineActions } from '@/components/routine/use-routine-actions';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BabyRow, useBabyRows } from '@/components/todo/baby-schedule';
import { Card, ListRow } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { dateLabel, nextDayLabel, todayPlan } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { shopLists } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { homeRows, thisWeek } from '@/data/upcoming';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/** 할 일 탭의 칸을 연다 — `at` 이 바뀌어야 다른 칸을 골라 둔 뒤에도 이 칸이 열린다(todo.tsx) */
const openTodo = (cat: 'baby' | 'shop') => router.push({ pathname: '/todo', params: { cat, at: String(Date.now()) } });

export default function HomeScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { baby, age } = useBaby();
  const { routines, logs, loading } = useRoutines();
  const { topics, todos, loading: todosLoading } = useTodos();
  // 30초마다 — 자정을 넘기거나 앱으로 돌아오면 「오늘」이 따라온다
  const now = useNow(false);
  const routine = useRoutineActions(now);
  const schedule = useBabyRows(now);

  if (!baby || !age || loading || todosLoading) return <ScreenLoading />;

  // 머리 — 이번 주 챙길 일 수. 없을 때 그다음 것은 바로 아래 카드가 보인다
  const { rows, today } = schedule;
  const week = thisWeek(rows, today).length;
  const headline = week > 0 ? `이번 주 챙길 일 ${week}개` : '이번 주는 챙길 일이 없어요';

  const plan = todayPlan(routines, logs, now);
  const first = plan.later[0];
  const { toBuy, shipping } = shopLists(
    topics.find((t) => t.kind === 'shopping'),
    todos,
  );
  const shopText =
    toBuy.length + shipping.length === 0
      ? '살 것이 없어요'
      : [toBuy.length > 0 ? `살 것 ${toBuy.length}개` : null, shipping.length > 0 ? `배송 중 ${shipping.length}개` : null]
          .filter(Boolean)
          .join(' · ');

  return (
    <ThemedView style={styles.container}>
      {focused && <StatusBar style="light" />}
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HomeHero topInset={insets.top} dateText={`${dateLabel(now)} · 태어난 지 ${age.days + 1}일`} headline={headline} />

        <View style={styles.body}>
          {/* 다가오는 일 — 앱이 채운 아기 일정 */}
          <View style={styles.section}>
            <Head title="다가오는 일" onMore={() => openTodo('baby')} />
            <Card style={styles.rows}>
              {rows.length === 0 ? (
                <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                  다가오는 아기 일정이 없어요
                </ThemedText>
              ) : (
                homeRows(rows, today).map((r, i) => (
                  <BabyRow key={r.key} row={r} divider={i > 0} onCheck={() => schedule.check(r)} onOpen={() => schedule.open(r)} />
                ))
              )}
            </Card>
          </View>

          {/* 오늘 할 루틴 */}
          <View style={styles.section}>
            <Head title="오늘 할 루틴" onMore={() => router.push('/routines')} />
            {routines.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/routines')}
                style={({ pressed }) => [styles.add, { borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' }]}>
                <Ionicons name="add" size={20} color={c.text} />
                <ThemedText type="label" style={{ fontWeight: 600 }}>
                  루틴 추가
                </ThemedText>
              </Pressable>
            ) : plan.today.length === 0 ? (
              <Card style={styles.rows}>
                <ListRow
                  icon="calendar-clear-outline"
                  title="오늘 할 루틴이 없어요"
                  detail={first ? `다음 · ${nextDayLabel(first.s.nextInDays, now)} ${first.r.title}` : null}
                  onPress={() => router.push('/routines')}
                />
              </Card>
            ) : (
              <RoutineMini items={plan.today} onCheck={routine.onCheck} onEdit={routine.edit} />
            )}
          </View>

          {/* 장보기 한 줄 */}
          <Card style={styles.rows}>
            <ListRow icon="cart-outline" title="장보기" detail={shopText} onPress={() => openTodo('shop')} />
          </Card>
        </View>
      </ScrollView>
      {/* 배너는 바닥에 고정 — 넘겨도 가려지지 않는다 */}
      <AdBanner anchored />
      {/* 아래로 넘긴 글이 상태 표시줄 밑으로 들어가도 시계가 보이게 */}
      <View style={[styles.statusStrip, { height: insets.top, backgroundColor: c.hero }]} />

      {schedule.sheets}
      {routine.sheets}
    </ThemedView>
  );
}

/** 칸 머리 — 굵은 이름과 오른쪽 「전체 ›」 */
function Head({ title, onMore }: { title: string; onMore: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.headRow}>
      <ThemedText type="body" style={{ fontWeight: 700 }}>
        {title}
      </ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title} 전체`} hitSlop={8} onPress={onMore} style={styles.more}>
        <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
          전체
        </ThemedText>
        <Ionicons name="chevron-forward" size={14} color={c.accentText} />
      </Pressable>
    </View>
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
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rows: { paddingVertical: 2 },
  empty: { paddingVertical: Spacing.three },
  add: {
    minHeight: 56,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
