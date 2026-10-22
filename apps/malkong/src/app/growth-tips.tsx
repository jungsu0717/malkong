/**
 * 해 주면 좋아요 (SPEC-STAGE-02, task growth/005) — 지금 시기에 해 줄 수 있는 놀이 · 말 걸기(CDC 「아기에게 해 줄 수 있는 것」을 우리 말로).
 * 터미타임 · 그림책 읽어 주기는 루틴에 없으면 그 자리에서 「루틴에 추가」.
 */

import { ScrollView, StyleSheet, View } from 'react-native';

import { DraftTag } from '@/components/growth/knowledge-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { itemsByIds } from '@/data/l1';
import { ROUTINE_TEMPLATES, templateInput, titleKey } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { checkpointFor, forMonth, splitTitle, tipIds } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

/** 루틴으로 만들 수 있는 것 — L1 항목 → 루틴 추천 이름 */
const ROUTINE_OF: Record<string, string> = {
  'k-life-0001': '터미타임',
  'k-life-0612': '책 읽어 주기',
};

export default function GrowthTipsScreen() {
  const c = useTheme();
  const { age } = useBaby();
  const { routines, addRoutine } = useRoutines();
  if (!age) return <ScreenLoading />;

  const tips = forMonth(itemsByIds(tipIds(checkpointFor(age.month))), age.month);
  const have = new Set(routines.map((r) => titleKey(r.title)));

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="small" style={[styles.pad, { color: c.textSecondary }]}>
          생후 {age.month}개월
        </ThemedText>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {tips.map((t, i) => {
            const { head } = splitTitle(t.title);
            const name = ROUTINE_OF[t.id];
            const template = name ? ROUTINE_TEMPLATES.find((r) => r.title === name) : undefined;
            const canAdd = template && !have.has(titleKey(template.title));
            return (
              <View key={t.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.surfaceStrong }]}>
                <View style={styles.text}>
                  <ThemedText type="body" style={{ fontWeight: 700 }}>
                    {head}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    {t.body}
                  </ThemedText>
                  {!t.approved && <DraftTag />}
                </View>
                {canAdd && template && (
                  <Button
                    size="sm"
                    label="루틴에 추가"
                    onPress={() => {
                      tap('success');
                      void addRoutine(templateInput(template));
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>
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
    gap: 10,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  pad: { paddingHorizontal: 4 },
  card: { borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  text: { flex: 1, gap: 3 },
});
