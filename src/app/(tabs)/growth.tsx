import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { AskFab } from '@/components/ask-fab';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { TIMELINE, type L1Item, type L2Item } from '@/data/timeline';

const COLUMN_WIDTH = 264;
const COLUMN_STEP = COLUMN_WIDTH + Spacing.three;
/** 바닥에 고정된 배너(최소 64) + 위아래 여백 — 플로팅 버튼을 이 위로 올려 광고를 가리지 않게 한다 */
const AD_FOOTER_HEIGHT = 64 + Spacing.four * 2;

/**
 * 성장 타임라인 — 0개월부터 가로로 흐르는 월령 시퀀스.
 * 월마다 위 트랙 = L1(공공 지식, 표준), 아래 트랙 = L2(우리 아기 지식)를 교차해 보여준다.
 * 지금은 View 기반 뼈대이고, 연결 곡선·스크롤 연동 애니메이션은 Skia 로 업그레이드 예정.
 */
export default function GrowthScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { age } = useBaby();
  const scrollRef = useRef<ScrollView>(null);
  const [startedAtCurrentMonth, setStartedAtCurrentMonth] = useState(false);

  if (!age) return <ScreenLoading />;

  // 목업 범위를 넘는 월령이면 마지막 컬럼에서 시작한다
  const lastMonth = TIMELINE[TIMELINE.length - 1]?.month ?? 0;
  const startMonth = Math.min(age.month, lastMonth);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">성장 타임라인</ThemedText>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.textSecondary }]} />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              표준 지식
            </ThemedText>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              우리 아기
            </ThemedText>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COLUMN_STEP}
          decelerationRate="fast"
          // contentOffset 은 iOS 에서만 먹는다. 웹·안드로이드까지 현재 월에서 시작하려면
          // 내용이 깔린 뒤 한 번 옮겨 줘야 한다 (SPEC-GROW-01)
          contentOffset={{ x: COLUMN_STEP * startMonth, y: 0 }}
          onContentSizeChange={() => {
            if (startedAtCurrentMonth) return;
            scrollRef.current?.scrollTo({ x: COLUMN_STEP * startMonth, animated: false });
            setStartedAtCurrentMonth(true);
          }}
          contentContainerStyle={styles.track}>
          {TIMELINE.map((m) => {
            const isNow = m.month === age.month;
            const isFuture = m.month > age.month;
            return (
              <View
                key={m.month}
                style={[
                  styles.column,
                  // 달마다 하나의 카드로 묶여 보이게 — 현재 월만 포인트 색으로 두드러진다
                  { borderColor: isNow ? colors.accent : colors.backgroundElement },
                  isFuture && styles.futureColumn,
                ]}>
                {/* 월 헤더 */}
                <View style={styles.monthHeader}>
                  <View
                    style={[
                      styles.monthBadge,
                      { backgroundColor: isNow ? colors.accent : colors.backgroundElement },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={isNow ? styles.monthBadgeTextNow : undefined}>
                      {m.month}개월
                    </ThemedText>
                  </View>
                  {isNow && (
                    <ThemedText type="small" style={{ color: colors.accent }}>
                      지금 · D+{age.days}
                    </ThemedText>
                  )}
                </View>
                <ThemedText type="subtitle">{m.headline}</ThemedText>

                {/* L1 트랙 — 표준 지식 */}
                <ThemedView type="backgroundElement" style={styles.layerCard}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    표준
                  </ThemedText>
                  {m.l1.map((item: L1Item) => (
                    <View key={item.label} style={styles.itemRow}>
                      <View style={[styles.kindTag, { backgroundColor: colors.backgroundSelected }]}>
                        <ThemedText type="small">{item.kind}</ThemedText>
                      </View>
                      <ThemedText type="small" style={styles.itemLabel}>
                        {item.label}
                      </ThemedText>
                    </View>
                  ))}
                </ThemedView>

                {/* L2 트랙 — 우리 아기 지식 */}
                <View style={[styles.layerCard, { backgroundColor: colors.accentSoft }]}>
                  <ThemedText type="small" style={{ color: colors.accent }}>
                    우리 아기
                  </ThemedText>
                  {m.l2.length === 0 ? (
                    <ThemedText type="small" style={{ color: colors.textSecondary }}>
                      {isFuture ? '앞으로 채워질 기록' : '기록 없음'}
                    </ThemedText>
                  ) : (
                    m.l2.map((item: L2Item) => (
                      <View key={item.label} style={styles.itemRow}>
                        <View style={[styles.kindTag, { backgroundColor: colors.accent }]}>
                          <ThemedText type="small" style={styles.kindTagTextOnAccent}>
                            {item.kind}
                          </ThemedText>
                        </View>
                        <View style={styles.itemLabel}>
                          <ThemedText type="small">{item.label}</ThemedText>
                          {item.when && (
                            <ThemedText type="small" style={{ color: colors.textSecondary }}>
                              {item.when}
                            </ThemedText>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <AdBanner />
        </View>
      </SafeAreaView>
      <AskFab bottom={AD_FOOTER_HEIGHT + Spacing.three} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  track: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  column: {
    width: COLUMN_WIDTH,
    gap: Spacing.two,
    borderWidth: 2,
    borderRadius: 24,
    padding: Spacing.three,
  },
  futureColumn: { opacity: 0.75 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  monthBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  monthBadgeTextNow: { color: '#ffffff' },
  layerCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 1,
  },
  itemRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  kindTag: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.one + Spacing.half,
    paddingVertical: 1,
  },
  kindTagTextOnAccent: { color: '#ffffff' },
  itemLabel: { flex: 1 },
  footer: { padding: Spacing.four },
});
