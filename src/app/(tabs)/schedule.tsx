import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScheduleCalendar, type DayMarks } from '@/components/schedule/calendar';
import { DayView } from '@/components/schedule/day-view';
import { Journey } from '@/components/schedule/journey';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { dayKey, type MalkongMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useRecords } from '@/data/records-context';
import { coveredIds, dayIndex, fromDayKey, sameDay } from '@/data/schedule';
import { headlineOf } from '@/data/timeline';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 완료를 알린 뒤 「되돌리기」 띠가 떠 있는 시간 */
const SAVED_MS = 6000;

/**
 * 일정 탭 (SPEC-GROW-01~04 · SPEC-HOME-01·02, decisions/017, task growth/002).
 * 머리(태어난 지 · 월령) → 달력(이번 주 한 줄 / 한 달) → 고른 날 → 챙길 것 여정 → 배너.
 * `?day=2026-10-4&t=…` 로 열면 그날을 고른 채 연다(알림함 · 대화의 「확인하러 가기」). t 는 같은 날을 다시 보낼 때의 구분값.
 */
export default function ScheduleScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { messages } = useChat();
  const { pick, justSaved, undo, dismissSaved, sheet } = useMarkDone();
  const { day, t } = useLocalSearchParams<{ day?: string; t?: string }>();
  const [today, setToday] = useState(() => new Date());
  const [selected, setSelected] = useState(() => (day && fromDayKey(day)) || new Date());
  const [replay, setReplay] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      setReplay((r) => r + 1);
    }, []),
  );

  // 다른 화면에서 날을 정해 넘어오면 그날로 — 그리는 중에 맞춘다
  const [request, setRequest] = useState(`${day}-${t}`);
  if (request !== `${day}-${t}`) {
    setRequest(`${day}-${t}`);
    const target = day ? fromDayKey(day) : null;
    if (target) setSelected(target);
  }

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(dismissSaved, SAVED_MS);
    return () => clearTimeout(timer);
  }, [justSaved, dismissSaved]);

  const index = useMemo(() => (baby ? dayIndex(baby.birthDate, records) : null), [baby, records]);
  const covered = useMemo(() => coveredIds(records), [records]);
  const briefings = useMemo(() => {
    const byDay = new Map<string, MalkongMessage>();
    for (const m of messages) {
      if (m.role === 'malkong' && m.meta.type === 'briefing') byDay.set(m.meta.day, m);
    }
    return byDay;
  }, [messages]);

  if (!baby || !age || !index) return <ScreenLoading />;
  const name = baby.name ?? DEFAULT_BABY_NAME;
  const headline = headlineOf(age.month);

  const marksOf = (d: Date): DayMarks => {
    const key = dayKey(d.toISOString());
    return {
      due: (index.due.get(key) ?? []).some((i) => !covered.has(i.id)),
      done: (index.records.get(key) ?? []).length > 0,
      briefing: false,
    };
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <ThemedText type="display">일정</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                태어난 지 {age.days}일 · 만 {age.month}개월{headline ? ` · ${headline}` : ''}
              </ThemedText>
            </View>
            {!sameDay(selected, today) && <Chip label="오늘" onPress={() => setSelected(today)} />}
          </View>

          <ScheduleCalendar selected={selected} today={today} onSelect={setSelected} marksOf={marksOf} />
          <View style={styles.legend}>
            <View style={[styles.dot, { backgroundColor: c.accent }]} />
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              접종 · 검진 무렵
            </ThemedText>
            <View style={[styles.dot, { backgroundColor: c.text }]} />
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              남긴 기록
            </ThemedText>
          </View>

          <DayView
            date={selected}
            today={today}
            birthDate={baby.birthDate}
            currentMonth={age.month}
            index={index}
            records={records}
            briefing={briefings.get(dayKey(selected.toISOString())) ?? null}
            onPick={pick}
          />

          <View style={styles.section}>
            <SectionHeader title="챙길 것 여정" aside="0개월부터" />
            <Journey
              birthDate={baby.birthDate}
              records={records}
              currentMonth={age.month}
              name={name}
              replay={replay}
              onPick={pick}
            />
          </View>

          <AdBanner />

          <ThemedText type="caption" style={[styles.disclaimer, { color: c.textSecondary }]}>
            날짜는 생일로 계산한 무렵이에요. 정확한 접종일은 병원과 함께 정해요
          </ThemedText>
        </ScrollView>

        {justSaved && (
          <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={[styles.saved, { backgroundColor: c.ink }]}>
            <ThemedText type="small" style={[styles.flex, { color: c.onInk }]} numberOfLines={2}>
              「{justSaved.label}」로 기록했어요
            </ThemedText>
            <Pressable onPress={undo} hitSlop={8} accessibilityRole="button">
              <ThemedText type="label" style={{ color: c.onInk, fontWeight: 700 }}>
                되돌리기
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}
      </SafeAreaView>
      {sheet}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -Spacing.three, paddingHorizontal: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  section: { gap: 10 },
  disclaimer: { textAlign: 'center' },
  saved: {
    position: 'absolute',
    left: Gutter,
    right: Gutter,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
