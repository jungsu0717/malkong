/**
 * 우리 아기 · 성장 — 0개월부터 가로로 흐르는 월령 시퀀스 (SPEC-GROW-01~04, task growth/001).
 * 월마다 위 트랙 = L1(공공 지식, 표준), 아래 트랙 = L2(우리 아기 지식)를 교차해 보여준다.
 * View 기반이고, 연결 곡선·스크롤 연동 애니메이션은 Skia 로 업그레이드 예정.
 */

import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { useRecords } from '@/data/records-context';
import { buildTimeline, type L1Item, type L2Item } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

const COLUMN_WIDTH = 264;
const COLUMN_STEP = COLUMN_WIDTH + 12;

export function GrowthView() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const scrollRef = useRef<ScrollView>(null);
  const [startedAtCurrentMonth, setStartedAtCurrentMonth] = useState(false);
  if (!age || !baby) return null;

  const timeline = buildTimeline(records, baby.birthDate);
  // 타임라인 범위를 넘는 월령이면 마지막 컬럼에서 시작한다
  const lastMonth = timeline[timeline.length - 1]?.month ?? 0;
  const startMonth = Math.min(age.month, lastMonth);

  return (
    <View style={styles.container}>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: c.textTertiary }]} />
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          표준 지식
        </ThemedText>
        <View style={[styles.legendDot, { backgroundColor: c.accent }]} />
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          우리 아기
        </ThemedText>
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
        {timeline.map((m) => {
          const isNow = m.month === age.month;
          const isFuture = m.month > age.month;
          return (
            <View
              key={m.month}
              style={[
                styles.column,
                { borderColor: isNow ? c.text : c.border, borderWidth: isNow ? 1.5 : 1 },
                isFuture && styles.futureColumn,
              ]}>
              <View style={styles.monthHeader}>
                <View style={[styles.monthBadge, { backgroundColor: isNow ? c.ink : c.surface }]}>
                  <ThemedText type="label" style={{ color: isNow ? c.onInk : c.text, fontWeight: 700 }}>
                    {m.month}개월
                  </ThemedText>
                </View>
                {isNow && (
                  <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
                    지금 · D+{age.days}
                  </ThemedText>
                )}
              </View>
              {m.headline && <ThemedText type="heading">{m.headline}</ThemedText>}

              {/* L1 트랙 — 표준 지식 */}
              <View style={[styles.layer, { backgroundColor: c.surface }]}>
                <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600 }}>
                  표준
                </ThemedText>
                {m.l1.length === 0 ? (
                  <ThemedText type="caption" style={{ color: c.textSecondary }}>
                    이 달에 새로 시작하는 항목은 없어요
                  </ThemedText>
                ) : (
                  m.l1.map((item: L1Item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={[styles.kindTag, { borderColor: c.border }]}>
                        <ThemedText type="caption" style={{ color: c.textSecondary }}>
                          {item.kind}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" style={styles.itemLabel}>
                        {item.title}
                      </ThemedText>
                    </View>
                  ))
                )}
              </View>

              {/* L2 트랙 — 우리 아기 지식 */}
              <View style={[styles.layer, { backgroundColor: c.accentSoft }]}>
                <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
                  우리 아기
                </ThemedText>
                {m.l2.length === 0 ? (
                  <ThemedText type="caption" style={{ color: c.textSecondary }}>
                    {isFuture ? '앞으로 채워질 기록' : '기록 없음'}
                  </ThemedText>
                ) : (
                  m.l2.map((item: L2Item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={[styles.kindTag, { backgroundColor: c.accent, borderColor: c.accent }]}>
                        <ThemedText type="caption" style={{ color: '#FFFFFF' }}>
                          {item.kind}
                        </ThemedText>
                      </View>
                      <View style={styles.itemLabel}>
                        <ThemedText type="small">{item.label}</ThemedText>
                        {item.whenLabel && (
                          <ThemedText type="caption" style={{ color: c.textSecondary }}>
                            {item.whenLabel}
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

      {/* 가로 타임라인이 화면을 채우는 것이 이 보기의 값이라 배너는 바닥에(SPEC-GROW-04) */}
      <View style={styles.footer}>
        <AdBanner anchored />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  track: { paddingHorizontal: Gutter, paddingVertical: Spacing.two, gap: 12 },
  column: { width: COLUMN_WIDTH, gap: 10, borderRadius: Radius.xl, padding: 14 },
  futureColumn: { opacity: 0.7 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  monthBadge: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  layer: { borderRadius: Radius.md, padding: 12, gap: Spacing.two, flexGrow: 1 },
  itemRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  kindTag: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  itemLabel: { flex: 1 },
  footer: { paddingHorizontal: Gutter, paddingBottom: Spacing.three },
});
