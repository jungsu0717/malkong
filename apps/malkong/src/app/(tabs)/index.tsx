/**
 * 홈 — 한눈에 보는 우리 집 육아 할 일 (SPEC-MAIN-01, task topic/004, decisions/026).
 *
 * 아기 이름과 태어난 지 며칠, 행성 그림(주제마다 행성, 이번 달 할 일 점, 반복 할 일 위성), 그 아래 네 줄 —
 * 오늘 · 장보기 · 다가오는 날 · 루틴. 줄과 행성을 누르면 그 탭이나 주제로 간다(Julian 「화면은 한눈 요약 + 상세」).
 * 그림 위 숫자(이번 주 완료 · 오늘 남은 수)는 아래 줄에서 다시 쓰지 않는다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopicGalaxy, type GalaxyPlanet } from '@/components/todo/topic-galaxy';
import { topicColor } from '@/components/todo/topic-icons';
import { Card, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { birthOf, milestoneDays, upcomingAuto } from '@/data/auto-todos';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { monthStart } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { dueLabel } from '@/data/due-parse';
import { useRecords } from '@/data/records-context';
import {
  monthTodos,
  shopLists,
  sortDone,
  sortOpen,
  titleKey,
  todayTodos,
  todosOfTopic,
  visibleTopics,
  weekDoneCount,
  type Todo,
} from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

const GALAXY_HEIGHT = 300;
/** 행성 하나에 그리는 할 일 점 수 */
const MAX_DOTS = 10;
const DAY_MS = 86_400_000;

/** 제목 여럿을 한 줄로 — 세 개까지, 나머지는 「외 N개」 */
function joinTitles(titles: string[], max = 3): string {
  const rest = titles.length - max;
  return titles.slice(0, max).join(', ') + (rest > 0 ? ` 외 ${rest}개` : '');
}

/** 오늘 0시 기준 며칠 남았나 */
function daysUntil(date: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - today) / DAY_MS);
}

export default function HomeScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading } = useTodos();
  // 탭에 들어올 때마다 그림 등장 모션을 다시, 안 보일 때는 멈춘다
  const [visit, setVisit] = useState(0);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisit((v) => v + 1);
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const month = age?.month ?? 0;
  const shown = useMemo(() => visibleTopics(topics), [topics]);
  const visibleTodos = useMemo(() => {
    const ids = new Set(shown.map((t) => t.id));
    return todos.filter((t) => ids.has(t.topicId));
  }, [shown, todos]);
  const groups = useMemo(() => checkupGroups(records, month), [records, month]);
  const dueGroups = useMemo(() => groups.filter((g) => g.status === 'open'), [groups]);

  // 행성 그림 — 주제마다 이번 달 할 일 점(10개까지, 넘으면 완료와 남은 것의 비율을 지켜 줄인다)과 반복 할 일 위성(SPEC-TOPIC-10)
  const planets = useMemo<GalaxyPlanet[]>(() => {
    const raw = shown.map((t, i) => {
      const list = monthTodos(t, todos);
      const done = list.filter((d) => d.doneAt).map((d) => ({ key: d.id, done: true }));
      const open = list.filter((d) => !d.doneAt).map((d) => ({ key: d.id, done: false }));
      // 접종 · 검진은 지금 기간인 일정도 남은 할 일로
      if (t.kind === 'checkup') open.push(...dueGroups.map((g) => ({ key: g.key, done: false })));
      const total = done.length + open.length;
      const cap = Math.min(MAX_DOTS, total);
      const doneDots = total > 0 ? Math.round((cap * done.length) / total) : 0;
      return {
        id: t.id,
        name: t.title,
        color: topicColor(t.kind, i),
        total,
        dots: [...done.slice(0, doneDots), ...open.slice(0, cap - doneDots)],
        moons: todosOfTopic(t, todos).filter((d) => !d.doneAt && d.repeat).length,
      };
    });
    const most = Math.max(1, ...raw.map((p) => p.total));
    return raw.map(({ total, ...p }) => ({ ...p, size: total / most }));
  }, [shown, todos, dueGroups]);

  if (!baby || !age || loading) return <ScreenLoading />;
  const now = new Date();
  const topicOf = (kind: string) => shown.find((t) => t.kind === kind);
  const openTopic = (id: string) => {
    const topic = shown.find((t) => t.id === id);
    if (topic?.kind === 'shopping') router.navigate('/shop');
    else router.push({ pathname: '/topic/[id]', params: { id } });
  };

  // 그림 위 요약
  const { open } = todayTodos(visibleTodos);
  const left = open.length + dueGroups.length;
  const weekDone = weekDoneCount(visibleTodos);
  const summary =
    [weekDone > 0 ? `이번 주 ${weekDone}개 완료` : null, left > 0 ? `오늘 ${left}개 남았어요` : null].filter(Boolean).join(' · ') ||
    '오늘 남은 할 일이 없어요';

  // 오늘 — 접종 · 검진 이름과 할 일 제목
  const todayText = left > 0 ? joinTitles([...dueGroups.map((g) => g.label), ...open.map((t) => t.title)]) : '오늘 할 일이 없어요';

  // 장보기 — 배송 중이 있으면 그것, 없으면 살 것
  const { toBuy, shipping } = shopLists(topicOf('shopping'), todos);
  const first = shipping[0];
  const shopText = first
    ? `${first.title} ${first.arriveAt ? `${dueLabel(new Date(first.arriveAt), false, now)} 도착 예정` : '배송 중'}` +
      (shipping.length > 1 ? ` 외 ${shipping.length - 1}개` : '')
    : toBuy.length > 0
      ? `살 것: ${joinTitles(toBuy.map((t) => t.title))}`
      : '살 것이 없어요';

  // 다가오는 날 — 접종 · 검진, 50일 · 100일 · 돌, 사이즈 확인 중 가까운 둘
  const birth = birthOf(baby.birthDate);
  const have = new Set(todos.map((t) => t.ref).filter((r): r is string => !!r));
  const soonDays = [
    ...groups
      .filter((g) => g.status === 'soon')
      .map((g) => ({ label: g.label, date: monthStart(baby.birthDate, g.month), kind: 'checkup' })),
    ...milestoneDays(birth).map((d) => ({ label: d.label, date: d.date, kind: 'milestone' })),
    ...upcomingAuto('size', birth, now, have).map((u) => ({ label: u.rule.title, date: u.due, kind: 'size' })),
  ]
    .filter((d) => daysUntil(d.date, now) > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 2);
  const soonText = soonDays.length > 0 ? soonDays.map((d) => `${d.label} D-${daysUntil(d.date, now)}`).join(' · ') : '다가오는 날이 없어요';

  // 루틴 — 반복 할 일과 지난번 완료한 날(없으면 다음 날짜), 가까운 둘
  const lastDone = (t: Todo) =>
    sortDone(todos.filter((d) => d.doneAt && d.topicId === t.topicId && titleKey(d.title) === titleKey(t.title)))[0]?.doneAt ?? null;
  const routines = sortOpen(visibleTodos.filter((t) => !t.doneAt && t.repeat)).slice(0, 2);
  const routineText =
    routines.length > 0
      ? routines
          .map((t) => {
            const last = lastDone(t);
            if (last) {
              const ago = -daysUntil(new Date(last), now);
              return `${t.title} ${ago === 0 ? '오늘 했어요' : `${ago}일 전`}`;
            }
            return `${t.title} ${t.dueAt ? dueLabel(new Date(t.dueAt), false, now) : ''}`.trim();
          })
          .join(' · ')
      : '손톱 깎기 같은 반복 할 일을 추가해 보세요';

  const routineTopic = topicOf('routine');
  const soonTopic = soonDays[0] ? topicOf(soonDays[0].kind) : undefined;
  const rows: { label: string; text: string; go: () => void }[] = [
    { label: '오늘', text: todayText, go: () => router.navigate('/todo') },
    { label: '장보기', text: shopText, go: () => router.navigate('/shop') },
    { label: '다가오는 날', text: soonText, go: () => (soonTopic ? openTopic(soonTopic.id) : router.navigate('/todo')) },
    { label: '루틴', text: routineText, go: () => (routineTopic ? openTopic(routineTopic.id) : router.navigate('/todo')) },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View>
            <ThemedText type="display">{baby.name ?? DEFAULT_BABY_NAME}</ThemedText>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              태어난 지 {age.days}일 · {age.month}개월
            </ThemedText>
          </View>

          {/* 행성 그림 (SPEC-TOPIC-10) */}
          <View style={[styles.galaxy, { backgroundColor: c.space }]}>
            <TopicGalaxy
              planets={planets}
              replay={visit}
              active={focused}
              onSelect={openTopic}
              height={GALAXY_HEIGHT}
              coreColor={c.accent}
            />
            {/* 요약과 점 설명은 위에 — 앞쪽 행성이 카드 아래로 지나간다 */}
            <View pointerEvents="none" style={styles.overlayTop}>
              <ThemedText type="label" style={{ color: c.onSpace, fontWeight: 600 }}>
                {summary}
              </ThemedText>
              <View style={styles.legend}>
                <View style={[styles.dotFilled, { backgroundColor: c.onSpaceDim }]} />
                <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                  완료
                </ThemedText>
                <View style={[styles.dotHollow, { borderColor: c.onSpaceDim }]} />
                <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                  남은 할 일
                </ThemedText>
                <View style={[styles.dotMoon, { backgroundColor: c.onSpaceDim }]} />
                <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                  반복
                </ThemedText>
              </View>
            </View>
          </View>

          {/* 한 줄씩 — 누르면 그 탭이나 주제로 (SPEC-MAIN-01) */}
          <Card style={styles.rows}>
            {rows.map((r, i) => (
              <Pressable
                key={r.label}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}, ${r.text}`}
                onPress={() => {
                  tap();
                  r.go();
                }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider },
                  pressed && { opacity: 0.6 },
                ]}>
                <ThemedText type="label" style={[styles.rowLabel, { color: c.textSecondary }]}>
                  {r.label}
                </ThemedText>
                <ThemedText type="body" numberOfLines={2} style={styles.rowText}>
                  {r.text}
                </ThemedText>
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
              </Pressable>
            ))}
          </Card>

          <AdBanner />
        </ScrollView>
      </SafeAreaView>
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
  galaxy: { borderRadius: Radius.lg, overflow: 'hidden', height: GALAXY_HEIGHT },
  overlayTop: { position: 'absolute', top: 14, left: 16, right: 16, gap: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dotFilled: { width: 7, height: 7, borderRadius: 4 },
  dotHollow: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.2, marginLeft: 8 },
  dotMoon: { width: 5, height: 5, borderRadius: 3, marginLeft: 8 },
  rows: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  rowLabel: { width: 76, fontWeight: 600 },
  rowText: { flex: 1 },
});
