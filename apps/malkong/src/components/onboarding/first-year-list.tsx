/**
 * 첫 실행 「앞으로 1년」의 일정 줄 (SPEC-MY-10, task my/011) — 날짜 · 이름 · 분류 칩이 0.1초 간격으로 아래에서 떠오른다.
 * 일곱 줄 뒤에는 「외 16개」. 누를 수 없다 — 보여 주는 화면이다.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { FIRST_YEAR_ROWS, dayLabel, type FirstYearItem } from '@/data/first-year';
import { useTheme } from '@/hooks/use-theme';

/** 첫 줄이 뜨기까지 · 줄 사이 (ms) */
const FIRST = 150;
const STEP = 100;

export function FirstYearList({ items, total }: { items: FirstYearItem[]; total: number }) {
  const c = useTheme();
  const shown = items.slice(0, FIRST_YEAR_ROWS);
  const rest = total - shown.length;
  return (
    <Card style={styles.card}>
      {shown.map((it, i) => (
        <Animated.View
          key={it.key}
          entering={FadeInDown.delay(FIRST + i * STEP).duration(360)}
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
          <ThemedText type="small" style={[styles.date, { color: c.textSecondary }]}>
            {it.open ? '이번 달' : dayLabel(it.at)}
          </ThemedText>
          <ThemedText type="body" numberOfLines={1} lineBreakStrategyIOS="hangul-word" style={styles.title}>
            {it.title}
          </ThemedText>
          <View style={[styles.tag, { backgroundColor: c.surface }]}>
            <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600, fontSize: 11 }}>
              {it.tag}
            </ThemedText>
          </View>
        </Animated.View>
      ))}
      {rest > 0 && (
        <Animated.View entering={FadeInDown.delay(FIRST + shown.length * STEP).duration(360)} style={[styles.row, styles.more, { borderTopColor: c.divider }]}>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            외 {rest}개
          </ThemedText>
        </Animated.View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 10 },
  date: { width: 64 },
  title: { flex: 1 },
  tag: { height: 18, paddingHorizontal: 6, borderRadius: 9, justifyContent: 'center' },
  more: { borderTopWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center' },
});
