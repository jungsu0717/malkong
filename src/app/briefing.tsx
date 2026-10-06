import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { BriefingCard } from '@/components/briefing-card';
import { MonthlyCard, WeeklyCard } from '@/components/schedule/period-cards';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { dayKey, type MalkongMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useInbox } from '@/data/inbox-context';
import { fromDayKey } from '@/data/schedule';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 완료를 알린 뒤 「되돌리기」 띠가 떠 있는 시간 */
const SAVED_MS = 6000;

/**
 * 브리핑 상세 (SPEC-HOME-06 · 08, task growth/003) — `?day=<날짜>&kind=daily|weekly|monthly[&month=N]`.
 * 홈 요약 카드 · 알림함 · 일정 탭의 고른 날 줄이 모두 여기로 온다. 열면 알림함의 그날 줄은 읽은 것(SPEC-HOME-07).
 */
export default function BriefingScreen() {
  const c = useTheme();
  const { day, kind, month } = useLocalSearchParams<{ day?: string; kind?: string; month?: string }>();
  const { messages } = useChat();
  const { markDayRead } = useInbox();
  const { pick, justSaved, undo, dismissSaved, sheet } = useMarkDone();
  const today = dayKey(new Date().toISOString());
  const briefing = useMemo(
    () => messages.find((m): m is MalkongMessage => m.role === 'malkong' && m.meta.type === 'briefing' && m.meta.day === day) ?? null,
    [messages, day],
  );

  useEffect(() => {
    if (day) void markDayRead(day);
  }, [day, markDayRead]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(dismissSaved, SAVED_MS);
    return () => clearTimeout(timer);
  }, [justSaved, dismissSaved]);

  const date = day ? fromDayKey(day) : null;
  const title =
    kind === 'weekly'
      ? '주간 브리핑'
      : kind === 'monthly'
        ? '월간 브리핑'
        : day === today
          ? '오늘 브리핑'
          : date
            ? `${date.getMonth() + 1}월 ${date.getDate()}일 브리핑`
            : '브리핑';

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {kind === 'weekly' && date && <WeeklyCard monday={date} onPick={pick} />}
        {kind === 'monthly' && month !== undefined && <MonthlyCard month={Number(month)} onPick={pick} />}
        {(!kind || kind === 'daily') &&
          (briefing ? (
            <BriefingCard message={briefing} today={day === today} onPick={pick} />
          ) : (
            <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
              이날은 브리핑이 없어요
            </ThemedText>
          ))}
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
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
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
