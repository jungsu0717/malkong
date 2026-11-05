/**
 * 하루 흐름 — 탭 없는 첫 화면 (SPEC-MAIN-08 · 10 · 11 · 12 · 13, task today/012 · 013 · 014, decisions/037 · 038).
 *
 * 위쪽에 날짜 · 함께한 지 며칠 · 돋보기(기록 찾기) · 마이 버튼(곰돌이), 그 아래 「하루 · 일주일 · 1년」 바꾸기. 화면을 두 손가락으로 오므리면 한 단계 물러나고
 * (하루 → 일주일 → 1년), 벌리면 다가간다. 일주일 보기에서 막대를 누르면 그날 하루 보기, 「오늘 보기」를 누르면 돌아온다.
 * 알림을 누르고 들어오면 `view` 로 보기를 고른다(성장 소식 · 아기 일정 알림은 1년).
 * 바닥에는 기록 줄(모유 · 분유 · 기저귀 · 잠 · 추가)이 늘 보이고, 그 아래 배너 광고를 고정한다(app-design 「광고 자리」).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { AdBanner } from '@/components/ad-banner';
import { TeddyIcon } from '@/components/baby-icons';
import { AddSheet } from '@/components/flow/add-sheet';
import { DayView } from '@/components/flow/day-view';
import { FindSheet } from '@/components/flow/find-sheet';
import { RecordDock } from '@/components/flow/record-dock';
import { WeekView } from '@/components/flow/week-view';
import { YearView } from '@/components/flow/year-view';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLogActions } from '@/components/log/use-log-actions';
import { tap } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { birthOf } from '@/data/auto-todos';
import { startOfDay } from '@/data/event-summary';
import { runningOf } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { dateLabel } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useTodos } from '@/data/todos-context';
import { useGrowthAlerts } from '@/hooks/use-growth';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

type View3 = 'day' | 'week' | 'year';
const ORDER: View3[] = ['day', 'week', 'year'];
const LABELS: Record<View3, string> = { day: '하루', week: '일주일', year: '1년' };
/** 두 손가락으로 이만큼 오므리거나 벌리면 한 단계 */
const PINCH_OUT = 0.8;
const PINCH_IN = 1.25;

const isView = (v: unknown): v is View3 => v === 'day' || v === 'week' || v === 'year';

export default function FlowScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string; at?: string }>();
  const { baby, age } = useBaby();
  const { loading } = useRoutines();
  const { loading: todosLoading } = useTodos();
  const { events, loading: eventsLoading } = useEvents();
  const log = useLogActions();
  const [adding, setAdding] = useState(false);
  const [finding, setFinding] = useState(false);
  // 30초마다 — 자정을 넘기거나 앱으로 돌아오면 「오늘」이 따라온다. 재는 중 시계는 지금 노드가 따로 센다
  const now = useNow(false);
  const [view, setView] = useState<View3>(isView(params.view) ? params.view : 'day');
  /** 하루 보기의 날 — null 이면 오늘 */
  const [picked, setPicked] = useState<Date | null>(null);
  const scroll = useRef<ScrollView>(null);
  // 성장 소식(주차 · 달이 바뀌는 날 아침) — 앱을 열 때마다 다시 건다
  useGrowthAlerts();

  // 알림으로 들어오면 그 보기로 — 같은 보기 알림을 또 눌러도 따라오게 `at` 이 바뀔 때마다
  const [seenAt, setSeenAt] = useState(params.at);
  if (params.at !== seenAt) {
    setSeenAt(params.at);
    if (isView(params.view)) {
      setView(params.view);
      setPicked(null);
    }
  }
  // 보기를 바꾸면 맨 위부터
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [view, picked]);

  const go = (next: View3, day: Date | null = null) => {
    if (next !== view) tap();
    setView(next);
    setPicked(day);
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onEnd((e) => {
      const i = ORDER.indexOf(view);
      if (e.scale < PINCH_OUT && i < ORDER.length - 1) go(ORDER[i + 1]);
      else if (e.scale > PINCH_IN && i > 0) go(ORDER[i - 1]);
    });
  const gesture = Gesture.Simultaneous(pinch, Gesture.Native());

  if (!baby || !age || loading || todosLoading || eventsLoading) return <ScreenLoading />;

  const day = picked && startOfDay(picked).getTime() !== startOfDay(now).getTime() ? picked : null;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const birth = birthOf(baby.birthDate);
  const title =
    view === 'week'
      ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${now.getMonth() + 1}월 ${now.getDate()}일`
      : view === 'year'
        ? '첫 1년'
        : dateLabel(day ?? now);
  const sub = view === 'year' ? `${birth.getMonth() + 1}월 ${birth.getDate()}일에 태어났어요` : `함께한 지 ${age.days + 1}일`;

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.page }]}>
      <StatusBar style="auto" />
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headRow}>
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <ThemedText type="title" style={styles.title}>
                {title}
              </ThemedText>
              {day && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="오늘로 돌아가기"
                  hitSlop={8}
                  onPress={() => go('day')}
                  style={[styles.today, { borderColor: c.border, backgroundColor: c.card }]}>
                  <ThemedText type="caption" style={{ fontWeight: 700 }}>
                    오늘 보기
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 400 }}>
              {sub}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기록 찾기"
            hitSlop={6}
            onPress={() => {
              tap();
              setFinding(true);
            }}
            style={({ pressed }) => [styles.my, { borderColor: c.border, backgroundColor: pressed ? c.surfaceStrong : c.card }]}>
            <Ionicons name="search" size={20} color={c.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마이"
            hitSlop={6}
            onPress={() => {
              tap();
              router.push('/my');
            }}
            style={({ pressed }) => [styles.my, { borderColor: c.border, backgroundColor: pressed ? c.surfaceStrong : c.card }]}>
            <TeddyIcon size={22} color={c.text} />
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceStrong }]}>
          {ORDER.map((v) => {
            const on = v === view;
            return (
              <Pressable
                key={v}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => go(v)}
                style={[styles.seg, on && { backgroundColor: c.card }]}>
                <ThemedText type="label" style={{ fontWeight: on ? 700 : 500, color: on ? c.text : c.textSecondary, fontSize: 14 }}>
                  {LABELS[v]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.body}>
            {view === 'day' && (
              <DayView key={(day ?? now).toDateString()} date={day ?? now} now={now} onStart={(kind, side) => void log.start(kind, side)} onStop={(e) => void log.stop(e)} />
            )}
            {view === 'week' && <WeekView now={now} onPickDay={(d) => go('day', d)} />}
            {view === 'year' && <YearView now={now} />}
          </View>
        </ScrollView>
      </GestureDetector>
      <RecordDock sleeping={!!runningOf(events, 'sleep')} onRecord={log.press} onAdd={() => setAdding(true)} />
      <AdBanner anchored />
      {log.sheets}
      <AddSheet open={adding} onClose={() => setAdding(false)} onOpenKind={(kind) => log.open(kind)} />
      <FindSheet open={finding} onClose={() => setFinding(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  top: { paddingHorizontal: 16, paddingBottom: 12, gap: 12, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  today: { height: 26, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, justifyContent: 'center' },
  my: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12 },
  seg: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 24 },
  body: { paddingHorizontal: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
