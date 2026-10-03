/**
 * 우리 아기 · 일정 — 아기의 지금 (SPEC-HOME-01·02·03·05, task growth/001).
 * 챙길 것(표준과 기록의 차집합) → 배너 → 이번 달 발달 포인트 → 고지.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Button, Card, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { itemsForMonth, itemsOfKind } from '@/data/l1';
import { usePreferences } from '@/data/preferences-context';
import { useRecords } from '@/data/records-context';
import { getGaps, groupGaps } from '@/data/timeline';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 한 번에 보여주는 「챙길 것」 수 — 빨간 표시가 한꺼번에 쏟아지면 불안만 준다(SPEC-HOME-02 분량) */
const VISIBLE_TODOS = 3;

/** 발달 포인트가 비었을 때 — 첫 이정표보다 어리면 그게 언제인지 알려준다 (SPEC-HOME-03 조건) */
function emptyPointsText(currentMonth: number): string {
  const starts = itemsOfKind('발달').map((i) => i.months[0]);
  const first = starts.length > 0 ? Math.min(...starts) : null;
  if (first !== null && currentMonth < first) return `첫 발달 이정표는 ${first}개월이에요`;
  return '이 월령의 표준 지식은 아직 준비 중이에요';
}

export function ScheduleView({ onShowGrowth }: { onShowGrowth: () => void }) {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { scheduleOnly } = usePreferences();
  const { pick, justSaved, undo, sheet } = useMarkDone();
  const [showAll, setShowAll] = useState(false);
  if (!baby || !age) return null;

  // 놓친 것 → 지금 → 다음 달 순서로, 같은 날 챙길 것은 한 줄로. 길면 접어 두고 눌러서 펼친다
  const groups = groupGaps(getGaps(age.month, records, { scheduleOnly }));
  const shown = showAll ? groups : groups.slice(0, VISIBLE_TODOS);
  const hidden = groups.length - shown.length;
  // 이정표 요약과 조기 상담 안내 (SPEC-HOME-03). 생활 팁은 「챙길 것」의 몫이라 여기 넣지 않는다
  const points = itemsForMonth(age.month).filter((i) => i.kind === '발달');

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SectionHeader title="챙길 것" aside={groups.length > 0 ? `${groups.length}건` : undefined} />
          <Card style={styles.listCard}>
            {justSaved && (
              <View style={[styles.saved, { backgroundColor: c.surface }]}>
                <ThemedText type="caption" style={styles.flex}>
                  「{justSaved.label}」로 기록했어요
                </ThemedText>
                <Pressable onPress={undo} hitSlop={8} accessibilityRole="button">
                  <ThemedText type="label" style={{ fontWeight: 700 }}>
                    되돌리기
                  </ThemedText>
                </Pressable>
              </View>
            )}
            {shown.map((g, i) => (
              <TodoRow
                key={g.key}
                todo={todoOf(g)}
                birthDate={baby.birthDate}
                currentMonth={age.month}
                divider={i > 0}
                onPick={() => pick(g)}
              />
            ))}
            {groups.length === 0 && (
              <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                지금은 챙길 게 없어요. 다음 달 일정이 다가오면 여기 먼저 보여 드릴게요
              </ThemedText>
            )}
            {hidden > 0 && (
              <Pressable
                accessibilityRole="button"
                style={[styles.more, { borderTopColor: c.divider }]}
                onPress={() => setShowAll(true)}>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  {hidden}건 더 보기
                </ThemedText>
              </Pressable>
            )}
          </Card>
        </View>

        {/* 배너는 핵심 카드 바로 뒤 — 아기 카드와 「챙길 것」보다 위로는 올리지 않는다(SPEC-HOME-05) */}
        <AdBanner />

        <View style={styles.section}>
          <SectionHeader title="이번 달 발달 포인트" aside={`만 ${age.month}개월`} />
          <Card tone="filled" style={styles.points}>
            {points.length > 0 ? (
              points.map((item) => (
                <View key={item.id} style={styles.point}>
                  <View style={[styles.dot, { backgroundColor: c.accent }]} />
                  <ThemedText type="body" style={styles.flex}>
                    {item.title}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {emptyPointsText(age.month)}
              </ThemedText>
            )}
            <Button label="성장 흐름 보기" icon="git-commit-outline" variant="ghost" size="sm" onPress={onShowGrowth} style={styles.link} />
          </Card>
        </View>

        <ThemedText type="caption" style={[styles.disclaimer, { color: c.textSecondary }]}>
          육아버디의 정보는 공공 의료·육아 지식을 근거로 한 참고 자료예요
        </ThemedText>
      </ScrollView>
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: 10 },
  listCard: { paddingVertical: 4 },
  flex: { flex: 1 },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  empty: { paddingVertical: 14 },
  more: { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1 },
  points: { gap: 10 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  link: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: -4 },
  disclaimer: { textAlign: 'center' },
});
