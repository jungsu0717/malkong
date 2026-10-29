/**
 * 할 일 추천 (SPEC-TOPIC-13, task today/003 · 005) — 「지금 아기와 있는 곳」과 개월 수에 맞는 할 일 묶음, 다음 시기 미리 보기.
 * 줄마다 「추가」(내 할 일 · 날짜 없음으로), 이미 같은 이름이 있으면 「추가됨」, 묶음 머리의 「모두 추가」.
 * 신청 · 서류와 약 · 처치는 넣지 않는다(decisions/026 · 029, 헌장 5).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PlacePicker } from '@/components/place-picker';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { monthStart } from '@/data/briefing';
import { todoRecommend, type TodoGroup } from '@/data/recommend';
import { titleKey } from '@/data/routine';
import { useTodos } from '@/data/todos-context';
import { usePlace } from '@/hooks/use-place';
import { useTheme } from '@/hooks/use-theme';

export default function TodoRecommendScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { topics, todos, loading, add } = useTodos();
  const [place, setPlace] = usePlace();

  const general = topics.find((t) => t.kind === 'general');
  if (loading || !general || !baby || !age) return <ScreenLoading />;
  const rec = todoRecommend(place, age.month);
  const have = new Set(todos.filter((t) => t.topicId === general.id).map((t) => titleKey(t.title)));
  const addOne = (title: string) => add({ title, topicId: general.id });
  const nextDate = rec.next ? monthStart(baby.birthDate, rec.next.fromMonth) : null;

  const group = (g: TodoGroup) => {
    const left = g.items.filter((title) => !have.has(titleKey(title)));
    return (
      <View key={g.title} style={styles.section}>
        <View style={styles.head}>
          <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
            {g.title}
          </ThemedText>
          {left.length > 0 && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                tap('success');
                void (async () => {
                  for (const title of left) await addOne(title);
                })();
              }}>
              <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                모두 추가
              </ThemedText>
            </Pressable>
          )}
        </View>
        <Card style={styles.rows}>
          {g.items.map((title, i) => {
            const added = have.has(titleKey(title));
            return (
              <View key={title} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
                <ThemedText type="body" style={styles.flex}>
                  {title}
                </ThemedText>
                {added ? (
                  <View style={styles.added}>
                    <Ionicons name="checkmark" size={14} color={c.textSecondary} />
                    <ThemedText type="label" style={{ color: c.textSecondary }}>
                      추가됨
                    </ThemedText>
                  </View>
                ) : (
                  <Button
                    label="추가"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      tap('success');
                      void addOne(title);
                    }}
                  />
                )}
              </View>
            );
          })}
        </Card>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PlacePicker place={place} onChange={setPlace} caption="있는 곳과 개월 수에 맞춰 추천이 바뀌어요" />

        {rec.groups.map(group)}

        {rec.next && nextDate && (
          <View style={styles.section}>
            <SectionHeader title={rec.next.label} aside={`${nextDate.getMonth() + 1}월 ${nextDate.getDate()}일부터 추천`} />
            <View style={styles.chips}>
              {rec.next.groups.map((g) => (
                <View key={g.title} style={[styles.chip, { borderColor: c.border }]}>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    {g.title}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  rows: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  added: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center' },
});
