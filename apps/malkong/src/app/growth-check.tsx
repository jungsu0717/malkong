/**
 * 발달 체크 (SPEC-STAGE-02, task growth/005) — 지금 개월 다음 CDC 이정표(2 · 4 · 6 · 9 · 12개월)까지 대부분의 아기가 하는 것.
 * 줄을 누르면 「했어요」 — 그날 날짜(D+)와 함께 우리 아기 메모에 남는다. 다시 누르면 지운다.
 * 아래에 다음 단계 미리 보기, 맨 아래에 이정표가 늦을 때의 고정 안내(승인된 L1 `k-dev-0202`).
 * 「늦어요」 같은 판정은 하지 않는다(헌장 5).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DraftTag } from '@/components/growth/knowledge-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { itemById, itemsByIds } from '@/data/l1';
import { useMemos } from '@/data/memos-context';
import { checklistIds, checkpointFor, daysSince, monthDate, nextCheckpoint } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

export default function GrowthCheckScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { memos, toggleCheck } = useMemos();
  if (!baby || !age) return <ScreenLoading />;

  const cp = checkpointFor(age.month);
  const checks = itemsByIds(checklistIds(cp));
  const doneAt = new Map(memos.filter((m) => m.ref).map((m) => [m.ref as string, m.at]));
  const next = nextCheckpoint(cp);
  const preview = next ? itemsByIds(checklistIds(next)).slice(0, 3) : [];
  const nextDate = monthDate(baby.birthDate, cp);
  const summary = itemById(`k-dev-${String(cp).padStart(2, '0')}01`);
  const actEarly = itemById('k-dev-0202');

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <ThemedText type="title">{cp}개월까지 대부분 하는 것</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {checks.length > 0 ? '했으면 눌러 두세요. 그날이 메모에 남아요' : '아기마다 빠르고 느려요'}
          </ThemedText>
        </View>

        {checks.length > 0 ? (
          <View style={[styles.card, { borderColor: c.border }]}>
            {checks.map((item, i) => {
              const at = doneAt.get(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!at }}
                  onPress={() => {
                    tap(at ? 'light' : 'success');
                    void toggleCheck(item.id, item.title);
                  }}
                  style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }, pressed && { opacity: 0.6 }]}>
                  {at ? (
                    <View style={[styles.done, { backgroundColor: c.accent }]}>
                      <Ionicons name="checkmark" size={15} color={c.onInk} />
                    </View>
                  ) : (
                    <View style={[styles.open, { borderColor: c.textTertiary }]} />
                  )}
                  <View style={styles.text}>
                    <ThemedText type="body">{item.title}</ThemedText>
                    {!item.approved && <DraftTag />}
                  </View>
                  <ThemedText type="label" style={at ? { color: c.accentText, fontWeight: 700 } : { color: c.textSecondary }}>
                    {at ? `D+${daysSince(baby.birthDate, new Date(at))}` : '했어요'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          summary && (
            <View style={[styles.card, styles.pad, { borderColor: c.border }]}>
              {summary.body
                .split('\n')
                .filter((l) => l.trim())
                .map((l, i) => (
                  <ThemedText key={i} type="body" style={styles.line}>
                    {l}
                  </ThemedText>
                ))}
            </View>
          )
        )}

        {next && preview.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText type="body" style={{ color: c.textSecondary, fontWeight: 700 }}>
                다음 · {next}개월까지
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textTertiary }}>
                {`${nextDate.getMonth() + 1}월 ${nextDate.getDate()}일부터`}
              </ThemedText>
            </View>
            <View style={[styles.preview, { backgroundColor: c.surface }]}>
              {preview.map((p) => (
                <ThemedText key={p.id} type="small" style={{ color: c.textSecondary }}>
                  {p.title}
                </ThemedText>
              ))}
            </View>
          </View>
        )}

        {actEarly && (
          <View style={[styles.preview, { backgroundColor: c.surface }]}>
            <ThemedText type="label" style={{ fontWeight: 700 }}>
              {actEarly.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary, lineHeight: 18 }}>
              {actEarly.body}
            </ThemedText>
          </View>
        )}
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
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  head: { gap: 2, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 18 },
  pad: { padding: Spacing.three, gap: 8 },
  line: { lineHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 14 },
  open: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  done: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
  section: { gap: 8, marginTop: Spacing.two },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  preview: { borderRadius: Radius.lg, padding: 14, gap: 6 },
});
