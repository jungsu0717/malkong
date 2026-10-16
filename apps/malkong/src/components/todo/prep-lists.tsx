/**
 * 할 일 탭 「준비 목록」 (SPEC-TOPIC-02 · 12, task today/003) — 외출 가방 · 여행 짐 같은 직접 만든 목록을 2열 카드로.
 * 카드에는 아이콘 · 이름 · 「남은 3개」(다 했으면 「모두 완료 · 5개」). 마지막은 「새 목록」(홀수 자리면 한 줄을 다 쓴다).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap, type IconName } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PrepList = { id: string; title: string; icon: IconName; left: number; done: number };

export function PrepLists({ lists, onOpen, onAdd }: { lists: PrepList[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.grid}>
      {lists.map((l) => {
        const detail = l.left === 0 && l.done > 0 ? `모두 완료 · ${l.done}개` : `남은 ${l.left}개`;
        return (
          <Pressable
            key={l.id}
            accessibilityRole="button"
            accessibilityLabel={`${l.title}, ${detail}`}
            onPress={() => {
              tap();
              onOpen(l.id);
            }}
            style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
            <Ionicons name={l.icon} size={22} color={c.text} />
            <View>
              <ThemedText type="body" numberOfLines={1} style={{ fontWeight: 600 }}>
                {l.title}
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {detail}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [styles.card, styles.add, { borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' }]}>
        <Ionicons name="add" size={20} color={c.text} />
        <ThemedText type="label" style={{ fontWeight: 600 }}>
          새 목록
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexBasis: '45%', flexGrow: 1, minHeight: 92, borderRadius: Radius.lg, padding: 14, gap: 8, justifyContent: 'space-between' },
  add: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed' },
});
