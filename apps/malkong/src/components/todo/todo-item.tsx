/**
 * 할 일 한 줄 (SPEC-TOPIC-02) — 누르면 끝냄 ↔ 되돌림, 오른쪽 단추나 길게 누르기로 고치기.
 * 작은 글씨는 기한 · 주제 · 살 것만 짧게. 끝낸 줄은 흐리게 긋는다(지우지 않는다).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { dueLabel } from '@/data/due-parse';
import type { Todo } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function TodoItem({
  todo,
  topicName,
  divider = false,
  onToggle,
  onEdit,
}: {
  todo: Todo;
  /** 다른 주제에서 모여 온 줄이면 그 주제 이름 */
  topicName?: string | null;
  divider?: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const c = useTheme();
  const done = !!todo.doneAt;
  const now = new Date();
  const due = todo.dueAt ? new Date(todo.dueAt) : null;
  const overdue = !done && due !== null && (todo.hasTime ? due < now : due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  const detail = [due ? dueLabel(due, todo.hasTime, now) : null, topicName ?? null, todo.buy ? '살 것' : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={todo.title}
        onPress={() => {
          tap(done ? 'light' : 'success');
          onToggle();
        }}
        onLongPress={onEdit}
        delayLongPress={350}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}>
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? c.textTertiary : c.text} />
        <View style={styles.text}>
          <ThemedText
            type="body"
            style={{ color: done ? c.textTertiary : c.text, textDecorationLine: done ? 'line-through' : 'none' }}>
            {todo.title}
          </ThemedText>
          {detail ? (
            <ThemedText type="caption" style={{ color: overdue ? c.accentText : c.textSecondary }}>
              {detail}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${todo.title} 편집`} hitSlop={8} onPress={onEdit} style={styles.edit}>
        <Ionicons name="ellipsis-horizontal" size={18} color={c.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  edit: { paddingHorizontal: 6, paddingVertical: 10 },
});
