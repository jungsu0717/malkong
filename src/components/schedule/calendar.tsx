import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { addDays, sameDay, weekStart } from '@/data/schedule';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 날마다 찍는 작은 점 셋 — 일정 무렵 · 한 일 · 주간·월간 브리핑 */
export type DayMarks = { due: boolean; done: boolean; briefing: boolean };

/**
 * 일정 탭 위의 달력 (SPEC-GROW-01) — 처음엔 이번 주 한 줄, 「펼치기」로 한 달. 앞뒤 주·달로 넘긴다.
 * 고른 날은 먹색 동그라미, 오늘은 포인트 색 테두리. 라이브러리 없이 7칸 표로 그린다(decisions/017).
 */
export function ScheduleCalendar({
  selected,
  today,
  onSelect,
  marksOf,
}: {
  selected: Date;
  today: Date;
  onSelect: (day: Date) => void;
  marksOf: (day: Date) => DayMarks;
}) {
  const c = useTheme();
  const [expanded, setExpanded] = useState(false);
  /** 보이는 주 · 달을 정하는 날 */
  const [cursor, setCursor] = useState(selected);

  // 밖에서 날을 바꾸면(「오늘」 · 알림함에서 그날로) 그 주 · 달이 보이게 — 그리는 중에 맞춘다
  const [shown, setShown] = useState(selected);
  if (!sameDay(shown, selected)) {
    setShown(selected);
    setCursor(selected);
  }

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const days = expanded
    ? Array.from(
        { length: Math.ceil((first.getDay() + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7) * 7 },
        (_, i) => addDays(weekStart(first), i),
      )
    : Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i));
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));

  const move = (step: number) => {
    tap();
    setCursor((d) => (expanded ? new Date(d.getFullYear(), d.getMonth() + step, 1) : addDays(d, step * 7)));
  };

  return (
    <View style={[styles.card, { borderColor: c.border }]}>
      <View style={styles.head}>
        <ThemedText type="heading" style={styles.flex}>
          {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '지난달' : '지난주'} hitSlop={8} onPress={() => move(-1)} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '다음 달' : '다음 주'} hitSlop={8} onPress={() => move(1)} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((w, i) => (
          <ThemedText key={w} type="caption" style={[styles.weekday, { color: i === 0 ? c.accentText : c.textSecondary }]}>
            {w}
          </ThemedText>
        ))}
      </View>

      <Animated.View layout={LinearTransition.duration(220)}>
        {weeks.map((week) => (
          <Animated.View key={week[0].toDateString()} entering={FadeIn.duration(200)} style={styles.row}>
            {week.map((day) => {
              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, today);
              const outside = expanded && day.getMonth() !== cursor.getMonth();
              const marks = marksOf(day);
              return (
                <Pressable
                  key={day.toDateString()}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${day.getMonth() + 1}월 ${day.getDate()}일${isToday ? ' 오늘' : ''}${marks.due ? ' 일정 있음' : ''}`}
                  onPress={() => {
                    tap();
                    onSelect(day);
                  }}
                  style={styles.cell}>
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && { backgroundColor: c.ink },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: c.accent },
                    ]}>
                    <ThemedText
                      type="body"
                      style={{
                        fontWeight: isSelected || isToday ? 700 : 500,
                        color: isSelected ? c.onInk : outside ? c.textTertiary : isToday ? c.accentText : c.text,
                      }}>
                      {day.getDate()}
                    </ThemedText>
                  </View>
                  <View style={styles.dots}>
                    {marks.due && <View style={[styles.dot, { backgroundColor: c.accent }]} />}
                    {marks.done && <View style={[styles.dot, { backgroundColor: c.text }]} />}
                    {marks.briefing && <View style={[styles.dot, styles.ring, { borderColor: c.textSecondary }]} />}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        ))}
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? '달력 접기' : '달력 펼치기'}
        onPress={() => {
          tap();
          setExpanded((e) => !e);
          setCursor(selected);
        }}
        style={styles.toggle}>
        <View style={[styles.grip, { backgroundColor: c.surfaceStrong }]} />
        <View style={styles.toggleLabel}>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {expanded ? '접기' : '한 달 보기'}
          </ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.xl, paddingHorizontal: 10, paddingTop: 12, gap: 4 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6, gap: 4 },
  arrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: 600 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  ring: { backgroundColor: 'transparent', borderWidth: 1 },
  toggle: { alignItems: 'center', paddingTop: 4, paddingBottom: Spacing.two, gap: 4 },
  grip: { width: 32, height: 4, borderRadius: 2 },
  toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
