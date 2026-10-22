/**
 * 알아 두면 좋아요 (SPEC-STAGE-02, task growth/005) — 「이맘때 흔해요」(울음 · 잠 · 수유 · 화가 날 때)와 「꼭 지켜요」(안전한 잠 · 흔들지 않기).
 * 승인된 공공 지식(L1)을 지금 개월에 맞는 것만 보인다.
 */

import { ScrollView, StyleSheet, View } from 'react-native';

import { DraftTag } from '@/components/growth/knowledge-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { itemsByIds, type KnowledgeItem } from '@/data/l1';
import { KNOW_COMMON, KNOW_MUST, forMonth, splitTitle } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

export default function GrowthKnowScreen() {
  const c = useTheme();
  const { age } = useBaby();
  if (!age) return <ScreenLoading />;

  const common = forMonth(itemsByIds(KNOW_COMMON), age.month);
  const must = forMonth(itemsByIds(KNOW_MUST), age.month);
  const section = (title: string, items: (KnowledgeItem & { approved: boolean })[]) =>
    items.length > 0 && (
      <View style={styles.section}>
        <ThemedText type="body" style={[styles.pad, { fontWeight: 700 }]}>
          {title}
        </ThemedText>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {items.map((t, i) => (
            <View key={t.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.surfaceStrong }]}>
              <ThemedText type="body" style={{ fontWeight: 700 }}>
                {splitTitle(t.title).head}
              </ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {t.body}
              </ThemedText>
              {!t.approved && <DraftTag />}
            </View>
          ))}
        </View>
      </View>
    );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {section('이맘때 흔해요', common)}
        {section('꼭 지켜요', must)}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: 10 },
  pad: { paddingHorizontal: 4 },
  card: { borderRadius: 18 },
  row: { paddingVertical: 14, paddingHorizontal: 16, gap: 3 },
});
