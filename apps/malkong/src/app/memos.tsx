/**
 * 우리 아기 메모 목록 (SPEC-STAGE-03, task growth/004) — 성장 탭 카드에서 들어온다.
 * 최근 것이 위로, 줄마다 「D+30」과 메모, 날짜. 누르면 고치기 · 삭제, 오른쪽 위 「추가」. 가족 공유를 켜면 가족 폰과 맞춘다.
 */

import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MemoSheet } from '@/components/growth/memo-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { useMemos } from '@/data/memos-context';
import { dayNumber, weekOf, type Memo } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

export default function MemosScreen() {
  const c = useTheme();
  const { baby } = useBaby();
  const { memos, loading, addMemo, updateMemo, removeMemo } = useMemos();
  /** 연 시트 — 새 메모면 memo 가 null */
  const [sheet, setSheet] = useState<{ memo: Memo | null } | null>(null);
  if (!baby || loading) return <ScreenLoading />;

  const dayOf = (at: Date) => dayNumber(baby.birthDate, at);
  const dayText = (at: Date) => `D+${dayOf(at)} · ${weekOf(dayOf(at) - 1)}주차`;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
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
        {memos.length === 0 ? (
          <ThemedText type="body" style={[styles.empty, { color: c.textSecondary }]}>
            처음 웃은 날, 처음 뒤집은 날처럼{'\n'}이 시기 우리 아기 모습을 적어 두세요
          </ThemedText>
        ) : (
          <View style={[styles.card, { borderColor: c.border }]}>
            {memos.map((m, i) => {
              const at = new Date(m.at);
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  onPress={() => setSheet({ memo: m })}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View style={[styles.day, { backgroundColor: i === 0 ? c.accentSoft : c.surface }]}>
                    <ThemedText type="caption" style={{ color: i === 0 ? c.accentText : c.textSecondary, fontWeight: 700 }}>
                      D+{dayOf(at)}
                    </ThemedText>
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="body">{m.text}</ThemedText>
                    <ThemedText type="caption" style={{ color: c.textSecondary }}>
                      {`${at.getFullYear()}년 ${at.getMonth() + 1}월 ${at.getDate()}일`}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  /** 웹 머리줄은 오른쪽 여백이 없어 글자가 잘린다 */
  headerButton: { paddingHorizontal: Platform.OS === 'web' ? 16 : 0 },
  flex: { flex: 1, gap: 2 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: { textAlign: 'center', marginTop: Spacing.six, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  day: { minWidth: 48, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
