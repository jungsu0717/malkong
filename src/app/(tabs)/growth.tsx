import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GrowthView } from '@/components/baby/growth-view';
import { ScheduleView } from '@/components/baby/schedule-view';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Segmented } from '@/components/ui';
import { Gutter, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { headlineOf } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

type GrowthTab = 'month' | 'timeline';

const VIEWS: { value: GrowthTab; label: string }[] = [
  { value: 'month', label: '이번 달' },
  { value: 'timeline', label: '타임라인' },
];

/**
 * 성장 탭 — 지금과 흐름 (decisions/013). 「이번 달」은 챙길 것 · 배너 · 발달 포인트(SPEC-HOME-01·02·03·05),
 * 「타임라인」은 0개월부터의 가로 월령 시퀀스(SPEC-GROW-01~04).
 */
export default function GrowthScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const [view, setView] = useState<GrowthTab>('month');

  if (!baby || !age) return <ScreenLoading />;
  const headline = headlineOf(age.month);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="display">성장</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            태어난 지 {age.days}일 · 만 {age.month}개월{headline ? ` · ${headline}` : ''}
          </ThemedText>
          <Segmented options={VIEWS} value={view} onChange={setView} />
        </View>
        <View style={styles.flex}>
          {view === 'month' ? <ScheduleView onShowGrowth={() => setView('timeline')} /> : <GrowthView />}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: Gutter, paddingTop: Spacing.three, gap: 10 },
});
