/**
 * 할 일 한 줄 (SPEC-TOPIC-02 · 11) — 누르면 끝냄 ↔ 되돌림, 오른쪽 단추나 길게 누르기로 편집.
 * 작은 글씨는 기한 · 반복 · 주제만 짧게. 주제 화면에서는 앱이 채운 할 일의 안내 한 줄과 링크(정부24 · 복지로)도 보인다.
 * 끝낸 줄은 흐리게 긋는다(지우지 않는다).
 */

import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import type { AutoLink } from '@/data/auto-todos';
import { dueLabel } from '@/data/due-parse';
import { repeatLabel } from '@/data/repeat';
import type { Todo } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function TodoItem({
  todo,
  topicName,
  note,
  link,
  divider = false,
  onToggle,
  onEdit,
}: {
  todo: Todo;
  /** 오늘 · 예정에 모여 보일 때 그 주제 이름 */
  topicName?: string | null;
  /** 안내 한 줄 — 앱이 채운 할 일의 기한 설명 */
  note?: string | null;
  link?: AutoLink | null;
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
  ]
    .filter(Boolean)
    .join(' · ');

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
          {note && !done ? (
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {note}
            </ThemedText>
          ) : null}
          {link && !done ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${link.label} 열기`}
              hitSlop={6}
              onPress={() => void (Platform.OS === 'web' ? Linking.openURL(link.url) : openBrowserAsync(link.url))}
              style={styles.link}>
              <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
                {link.label} 열기
              </ThemedText>
              <Ionicons name="open-outline" size={12} color={c.accentText} />
            </Pressable>
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
  link: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingTop: 2 },
});
