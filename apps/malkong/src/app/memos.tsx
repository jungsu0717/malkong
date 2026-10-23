/**
 * 성장 일기 (SPEC-STAGE-03 · 05, task growth/004 · 007) — 성장 탭 「성장 일기」 줄에서 들어온다.
 * 메모 · 발달 체크 · 오늘의 놀이(달마다 「놀이 N번」) · 막대 칸(1개월 · 50일 · 100일 …) · 아기 일정 완료 기록을
 * 아기 개월별로 한 줄씩, 최근 것이 위로. 메모 줄을 누르면 고치기 · 삭제, 오른쪽 위 「추가」. 가족 공유를 켜면 가족 폰과 맞춘다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MemoSheet } from '@/components/growth/memo-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip, tap, type IconName } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { diaryMonths, type DiaryEntry, type DiaryKind } from '@/data/growth-plus';
import { itemById } from '@/data/l1';
import { useMemos } from '@/data/memos-context';
import { useRecords } from '@/data/records-context';
import { dayNumber, splitTitle, weekOf, type Memo } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'all' | 'memo' | 'check' | 'play';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'memo', label: '메모' },
  { key: 'check', label: '발달 체크' },
  { key: 'play', label: '놀이' },
];

const ICON: Record<DiaryKind, IconName> = {
  memo: 'create-outline',
  check: 'checkbox-outline',
  play: 'star-outline',
  stop: 'gift-outline',
  schedule: 'calendar-outline',
};

export default function DiaryScreen() {
  const c = useTheme();
  const { baby } = useBaby();
  const { memos, loading, addMemo, updateMemo, removeMemo } = useMemos();
  const { records } = useRecords();
  const [filter, setFilter] = useState<Filter>('all');
  /** 연 시트 — 새 메모면 memo 가 null */
  const [sheet, setSheet] = useState<{ memo: Memo | null } | null>(null);
  if (!baby || loading) return <ScreenLoading />;

  const dayText = (at: Date) => {
    const n = dayNumber(baby.birthDate, at);
    return `D+${n} · ${weekOf(n - 1)}주차`;
  };
  const months = diaryMonths({
    birthDate: baby.birthDate,
    memos,
    records: records.filter((r) => r.kind === '기록').map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt })),
    playName: (id) => {
      const item = itemById(id);
      return item ? splitTitle(item.title).head : '놀이';
    },
  })
    .map((m) => ({ ...m, entries: m.entries.filter((e) => filter === 'all' || e.kind === filter) }))
    .filter((m) => m.entries.length > 0);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: '성장 일기',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="메모 추가"
              hitSlop={8}
              onPress={() => {
                tap();
                setSheet({ memo: null });
              }}
              style={styles.headerButton}>
              <ThemedText type="body" style={{ color: c.accentText, fontWeight: 700 }}>
                추가
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>
        {months.length === 0 ? (
          <ThemedText type="body" style={[styles.empty, { color: c.textSecondary }]}>
            처음 웃은 날, 처음 뒤집은 날처럼{'\n'}이 시기 우리 아기 모습을 적어 두세요
          </ThemedText>
        ) : (
          months.map((m) => (
            <View key={m.month} style={styles.month}>
              <ThemedText type="label" style={[styles.monthTitle, { color: c.textSecondary }]}>
                {m.title}
              </ThemedText>
              <View style={styles.timeline}>
                <View style={[styles.line, { backgroundColor: c.surface }]} />
                {m.entries.map((e) => (
                  <Entry key={e.key} entry={e} onPress={e.memo ? () => setSheet({ memo: e.memo! }) : undefined} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <MemoSheet
        key={sheet ? `memo-${sheet.memo?.id ?? 'new'}` : 'memo-closed'}
        open={sheet !== null}
        memo={sheet?.memo ?? null}
        dayText={dayText(sheet?.memo ? new Date(sheet.memo.at) : new Date())}
        onSave={(text) => {
          const target = sheet?.memo;
          setSheet(null);
          void (target ? updateMemo(target.id, text) : addMemo(text));
        }}
        onDelete={() => {
          const target = sheet?.memo;
          setSheet(null);
          if (target) void removeMemo(target.id);
        }}
        onClose={() => setSheet(null)}
      />
    </ThemedView>
  );
}

function Entry({ entry, onPress }: { entry: DiaryEntry; onPress?: () => void }) {
  const c = useTheme();
  const soft = entry.kind === 'stop';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.entry, pressed && { opacity: 0.6 }]}>
      <View style={[styles.mark, { backgroundColor: soft ? c.accentSoft : c.surface }]}>
        <Ionicons name={ICON[entry.kind]} size={16} color={soft ? c.accentText : c.text} />
      </View>
      <View style={styles.text}>
        <ThemedText type="body" style={{ fontWeight: 600 }}>
          {entry.title}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textTertiary }}>
          {entry.sub}
        </ThemedText>
      </View>
      <ThemedText type="caption" style={[styles.day, { color: c.textSecondary }]}>
        {entry.day}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  /** 웹 머리줄은 오른쪽 여백이 없어 글자가 잘린다 */
  headerButton: { paddingHorizontal: Platform.OS === 'web' ? 16 : 0 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: 22,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { textAlign: 'center', marginTop: Spacing.five, lineHeight: 24 },
  month: { gap: 12 },
  monthTitle: { fontWeight: 700, paddingHorizontal: 2 },
  timeline: { gap: 16 },
  line: { position: 'absolute', left: 15, top: 10, bottom: 10, width: 2 },
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1, paddingTop: 2 },
  day: { fontWeight: 700, paddingTop: 5 },
});
