/**
 * 그날 합계 칸 넷 (SPEC-MAIN-08, task today/014) — 분유 · 모유 · 기저귀 · 잠. 칸을 누르면 그 기록의 그래프 화면(SPEC-LOG-04)이 열린다.
 * 큰 숫자는 총량, 그 아래 작은 줄은 횟수(기저귀는 대변 횟수, 잠은 낮잠 횟수). 칸 이름은 기록 이름 그대로다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import type { DayTotals } from '@/data/day-flow';
import { durationLabel } from '@/data/event-summary';
import { useTheme } from '@/hooks/use-theme';

export type GraphMetric = 'formula' | 'breast' | 'diaper' | 'sleep';

export function DayTotalsCard({ totals, date }: { totals: DayTotals; date: Date }) {
  const c = useTheme();
  const cols: { metric: GraphMetric; name: string; value: string; sub: string; aria: string }[] = [
    { metric: 'formula', name: '분유', value: `${Math.round(totals.formulaMl)}ml`, sub: `${totals.formulaCount}번`, aria: `분유 ${Math.round(totals.formulaMl)}ml, ${totals.formulaCount}번` },
    { metric: 'breast', name: '모유', value: durationLabel(totals.breastMin), sub: `${totals.breastCount}번`, aria: `모유 ${durationLabel(totals.breastMin)}, ${totals.breastCount}번` },
    { metric: 'diaper', name: '기저귀', value: `${totals.diapers}번`, sub: `대변 ${totals.poo}번`, aria: `기저귀 ${totals.diapers}번, 대변 ${totals.poo}번` },
    { metric: 'sleep', name: '잠', value: durationLabel(totals.sleepMin), sub: `낮잠 ${totals.naps}번`, aria: `잠 ${durationLabel(totals.sleepMin)}, 낮잠 ${totals.naps}번` },
  ];
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      {cols.map((col, i) => (
        <Pressable
          key={col.metric}
          accessibilityRole="button"
          accessibilityLabel={`${col.aria}. 그래프 보기`}
          onPress={() => {
            tap();
            router.push({ pathname: '/graphs', params: { metric: col.metric, day } });
          }}
          style={({ pressed }) => [styles.col, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.divider, paddingLeft: 8 }, i === 2 && styles.narrow, i === 3 && styles.wide, pressed && { opacity: 0.6 }]}>
          <View style={styles.nameRow}>
            <ThemedText type="caption" style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 15 }}>
              {col.name}
            </ThemedText>
            <Ionicons name="chevron-forward" size={11} color={c.textTertiary} />
          </View>
          <ThemedText type="heading" numberOfLines={1} style={styles.value}>
            {col.value}
          </ThemedText>
          <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15 }}>
            {col.sub}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', gap: 8 },
  col: { flex: 1, minWidth: 0, paddingVertical: 10, gap: 1 },
  narrow: { flex: 0.85 },
  wide: { flex: 1.55 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  value: { fontWeight: 700, fontSize: 15, lineHeight: 21, letterSpacing: -0.4 },
});
