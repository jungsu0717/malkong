/**
 * 루틴 추천 (SPEC-MAIN-07, task today/003) — 「지금 아기와 있는 곳」과 개월 수에 맞춘 추천, 다음 범위 미리 보기.
 * 줄마다 「추가」(이미 있으면 「추가됨」). 우리가 고른 고정 목록이고, 영양제 · 약은 추천하지 않는다(헌장 5).
 * 같은 이름의 루틴이 있지만 시기에 맞는 단계가 바뀌었으면(신생아 때 넣은 밤잠 준비의 속싸개) 「단계 바꾸기」(task today/005).
 */

import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PlacePicker } from '@/components/place-picker';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { monthStart } from '@/data/briefing';
import { routineRecommend, stepsDiffer } from '@/data/recommend';
import { templateDetail, templateInput, titleKey, type RoutineTemplate } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { usePlace } from '@/hooks/use-place';
import { useTheme } from '@/hooks/use-theme';

export default function RoutineRecommendScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { routines, addRoutine, updateRoutine } = useRoutines();
  const [place, setPlace] = usePlace();

  if (!baby || !age) return <ScreenLoading />;
  const rec = routineRecommend(age.month, place);
  const byKey = new Map(routines.map((r) => [titleKey(r.title), r]));
  const add = (t: RoutineTemplate) => {
    tap('success');
    void addRoutine(templateInput(t));
  };
  const nextDate = rec.next ? monthStart(baby.birthDate, rec.next.fromMonth) : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PlacePicker place={place} onChange={setPlace} caption={`생후 ${age.days + 1}일 · 있는 곳과 개월 수에 맞춰 추천이 바뀌어요`} />

        <View style={styles.section}>
          <SectionHeader title={rec.label} />
          {rec.note && (
            <ThemedText type="small" style={[styles.pad, { color: c.textSecondary }]}>
              {rec.note}
            </ThemedText>
          )}
          {rec.templates.length > 0 && (
            <Card style={styles.rows}>
              {rec.templates.map((t, i) => {
                const mine = byKey.get(titleKey(t.title));
                const restep = mine && stepsDiffer(t, mine.items);
                return (
                  <View key={t.title} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
                    <View style={[styles.icon, { backgroundColor: c.surface }]}>
                      <RoutineIcon title={t.title} size={20} color={c.text} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="body" style={{ fontWeight: 600 }}>
                        {t.title}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
                        {templateDetail(t)}
                      </ThemedText>
                    </View>
                    {restep ? (
                      <Button
                        label="단계 바꾸기"
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          tap('success');
                          void updateRoutine(mine.id, { items: t.items ?? null });
                        }}
                      />
                    ) : mine ? (
                      <View style={styles.added}>
                        <Ionicons name="checkmark" size={14} color={c.textSecondary} />
                        <ThemedText type="label" style={{ color: c.textSecondary }}>
                          추가됨
                        </ThemedText>
                      </View>
                    ) : (
                      <Button label="추가" size="sm" onPress={() => add(t)} />
                    )}
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        {rec.next && nextDate && (
          <View style={styles.section}>
            <SectionHeader title={rec.next.label} aside={`${nextDate.getMonth() + 1}월 ${nextDate.getDate()}일부터 추천`} />
            <View style={styles.chips}>
              {rec.next.templates.map((t) => (
                <View key={t.title} style={[styles.chip, { borderColor: c.border }]}>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    {t.title}
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
  pad: { paddingHorizontal: 4 },
  rows: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 8 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  added: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center' },
});
