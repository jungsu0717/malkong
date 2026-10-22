/**
 * 할 일 한 줄 (SPEC-TOPIC-02 · 11, task topic/009) — 동그라미를 누르면 끝냄 ↔ 되돌림, 이름을 누르면 편집.
 * 작은 글씨는 기한 · 반복 · 주제만 짧게. 주제 화면에서는 앱이 채운 할 일의 안내 한 줄도 보인다.
 * 끝낸 줄은 흐리게 긋는다(지우지 않는다).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { dueLabel } from '@/data/due-parse';
import { repeatLabel } from '@/data/repeat';
import type { Todo } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function TodoItem({
  todo,
  topicName,
  note,
  divider = false,
  onToggle,
  onEdit,
}: {
  todo: Todo;
  /** 오늘 · 예정에 모여 보일 때 그 주제 이름 */
  topicName?: string | null;
  /** 안내 한 줄 — 앱이 채운 할 일의 설명 */
  note?: string | null;
  divider?: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const c = useTheme();
  const done = !!todo.doneAt;
  const now = new Date();
  const due = todo.dueAt ? new Date(todo.dueAt) : null;
  const overdue = !done && due !== null && (todo.hasTime ? due < now : due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  const detail = [
    due ? dueLabel(due, todo.hasTime, now) : null,
    todo.repeat && !done ? `${repeatLabel(todo.repeat)} 반복` : null,
    topicName ?? null,
    // 누가 완료했나 — 가족 공유를 켠 폰에서만 이름이 있다(task my/009)
    done && todo.doneBy ? `${todo.doneBy} 완료` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={todo.title}
        hitSlop={8}
        onPress={() => {
          tap(done ? 'light' : 'success');
          onToggle();
        }}
        style={({ pressed }) => [styles.check, pressed && { opacity: 0.6 }]}>
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? c.textTertiary : c.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${todo.title} 편집`}
        onPress={onEdit}
        style={({ pressed }) => [styles.text, pressed && { opacity: 0.6 }]}>
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
        {note && !done ? (
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {note}
          </ThemedText>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12 },
  check: { paddingVertical: 10 },
  text: { flex: 1, gap: 2, paddingVertical: 10 },
});
