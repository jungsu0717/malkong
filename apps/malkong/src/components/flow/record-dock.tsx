/**
 * 바닥 기록 줄 (SPEC-MAIN-08, task today/014) — 모유 · 분유 · 기저귀 · 잠 · 추가. 하루 흐름 어느 보기에서나 화면 바닥에 고정한다.
 * 자는 중이면 「잠」이 「수면 종료」다(SPEC-LOG-02). 「추가」는 한 줄로 적는 시트(SPEC-MAIN-12).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottleIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import type { EventKind } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

export function RecordDock({ sleeping, onRecord, onAdd }: { sleeping: boolean; onRecord: (kind: EventKind) => void; onAdd: () => void }) {
  const c = useTheme();
  const item = (kind: EventKind, label: string, icon: React.ReactNode) => (
    <Pressable
      key={kind}
      accessibilityRole="button"
      accessibilityLabel={kind === 'sleep' && sleeping ? '수면 종료' : `${label} 기록`}
      onPress={() => onRecord(kind)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: kind === 'sleep' && sleeping ? c.accentSoft : pressed ? c.surfaceStrong : c.surface, borderColor: c.border },
      ]}>
      {icon}
      <ThemedText type="caption" style={{ fontWeight: 600, color: kind === 'sleep' && sleeping ? c.accentText : c.text }}>
        {kind === 'sleep' && sleeping ? '수면 종료' : label}
      </ThemedText>
    </Pressable>
  );
  return (
    <View style={[styles.dock, { backgroundColor: c.card, borderTopColor: c.border }]}>
      {item('breast', '모유', <Ionicons name="heart-outline" size={20} color={c.accent} />)}
      {item('formula', '분유', <BottleIcon size={20} color={c.accent} />)}
      {item('diaper', '기저귀', <Ionicons name="water-outline" size={20} color={c.text} />)}
      {item('sleep', '잠', <Ionicons name={sleeping ? 'sunny-outline' : 'moon-outline'} size={20} color={sleeping ? c.accent : c.text} />)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="추가"
        onPress={() => {
          tap();
          onAdd();
        }}
        style={({ pressed }) => [styles.button, styles.add, { backgroundColor: c.ink, opacity: pressed ? 0.85 : 1 }]}>
        <Ionicons name="add" size={22} color={c.onInk} />
        <ThemedText type="caption" style={{ fontWeight: 600, color: c.onInk }}>
          추가
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: 1 },
  button: { flex: 1, height: 54, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  add: { borderWidth: 0 },
});
