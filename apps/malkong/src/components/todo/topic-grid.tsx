/**
 * 주제 그리드 (SPEC-TOPIC-01, task topic/002) — 한 줄에 4개, 동그라미 아이콘 아래 이름, 오른쪽 위에 지금 할 것의 수.
 * `onAdd` 를 주면 끝에 「주제 추가」. 아이콘은 먹색 한 가지, 숫자 표시만 코랄.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap, type IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export type GridTopic = { id: string; title: string; icon: IconName; count: number };

const CIRCLE = 56;

export function TopicGrid({
  topics,
  onOpen,
  onAdd,
}: {
  topics: GridTopic[];
  onOpen: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    <View style={styles.grid}>
      {topics.map((t) => (
        <Cell
          key={t.id}
          icon={t.icon}
          title={t.title}
          count={t.count}
          label={t.count > 0 ? `${t.title}, 할 일 ${t.count}개` : t.title}
          onPress={() => onOpen(t.id)}
        />
      ))}
      {onAdd && <Cell icon="add" title="주제 추가" count={0} label="주제 추가" onPress={onAdd} dashed />}
    </View>
  );
}

function Cell({
  icon,
  title,
  count,
  label,
  onPress,
  dashed = false,
}: {
  icon: IconName;
  title: string;
  count: number;
  label: string;
  onPress: () => void;
  dashed?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}>
      <View
        style={[
          styles.circle,
          dashed ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border } : { backgroundColor: c.surface },
        ]}>
        <Ionicons name={icon} size={24} color={dashed ? c.textSecondary : c.text} />
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.background }]}>
            <ThemedText style={[styles.badgeText, { color: c.onDanger }]}>{count > 99 ? '99+' : count}</ThemedText>
          </View>
        )}
      </View>
      <ThemedText type="caption" numberOfLines={1} style={[styles.title, { color: dashed ? c.textSecondary : c.text }]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  cell: { width: '25%', alignItems: 'center', gap: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: 700 },
  title: { textAlign: 'center', paddingHorizontal: 2 },
});
