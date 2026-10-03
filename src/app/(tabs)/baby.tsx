import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GrowthView } from '@/components/baby/growth-view';
import { RecordsView } from '@/components/baby/records-view';
import { ScheduleView } from '@/components/baby/schedule-view';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton, Segmented } from '@/components/ui';
import { Gutter, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { headlineOf } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

type BabyView = 'schedule' | 'growth' | 'records';

const VIEWS: { value: BabyView; label: string }[] = [
  { value: 'schedule', label: '일정' },
  { value: 'growth', label: '성장' },
  { value: 'records', label: '기록' },
];

/**
 * 우리 아기 탭 — 아기의 지금과 흐름 (decisions/012, task growth/001).
 * 머리에 아기 카드(SPEC-HOME-01), 아래는 일정 · 성장 · 기록 보기. `?view=records` 로 바로 열 수 있다.
 */
export default function BabyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { view: param } = useLocalSearchParams<{ view?: BabyView }>();
  const [chosen, setChosen] = useState<BabyView>('schedule');
  // 마이의 「우리 아기 기록」처럼 밖에서 보기를 정해 들어오면 그것을 따르고, 고르면 주소에서 지운다
  const view = param ?? chosen;
  const show = (v: BabyView) => {
    setChosen(v);
    if (param) router.setParams({ view: undefined });
  };

  if (!baby || !age) return <ScreenLoading />;
  const headline = headlineOf(age.month);
  const [y, m, d] = baby.birthDate.split('-').map(Number);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <ThemedText type="display">{baby.name ?? DEFAULT_BABY_NAME}</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                태어난 지 {age.days}일 · 만 {age.month}개월 · {y}년 {m}월 {d}일생
              </ThemedText>
            </View>
            <IconButton icon="create-outline" label="아기 정보 고치기" onPress={() => router.push('/onboarding?edit=1')} />
          </View>
          {headline && (
            <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
              {age.month}개월 · {headline}
            </ThemedText>
          )}
          <Segmented
            options={VIEWS}
            value={view}
            onChange={show}
          />
        </View>
        <View style={styles.flex}>
          {view === 'schedule' && <ScheduleView onShowGrowth={() => show('growth')} />}
          {view === 'growth' && <GrowthView />}
          {view === 'records' && <RecordsView />}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: Gutter, paddingTop: Spacing.three, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
});
