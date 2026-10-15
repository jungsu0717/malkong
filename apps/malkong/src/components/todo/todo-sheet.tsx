/**
 * 할 일 고치기 (SPEC-TOPIC-02 · 03) — 제목, 기한(「내일 오전 10시」처럼 말로), 살 것, 주제 옮기기, 지우기.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Toggle } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { dueLabel, parseDue } from '@/data/due-parse';
import type { Todo, Topic } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export type TodoPatch = Pick<Todo, 'title' | 'dueAt' | 'hasTime' | 'buy' | 'topicId'>;

export function TodoSheet({
  todo,
  topics,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo | null;
  topics: Topic[];
  onClose: () => void;
  onSave: (patch: TodoPatch) => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [dueText, setDueText] = useState('');
  const [cleared, setCleared] = useState(false);
  const [buy, setBuy] = useState(todo?.buy ?? false);
  const [topicId, setTopicId] = useState(todo?.topicId ?? null);

  // 기한 칸에 새로 적은 말이 있으면 그것, 없으면 원래 기한(지웠으면 없음)
  const typed = dueText.trim() ? parseDue(dueText) : null;
  const due = typed?.dueAt ? { at: typed.dueAt, hasTime: typed.hasTime } : !cleared && todo?.dueAt ? { at: new Date(todo.dueAt), hasTime: todo.hasTime } : null;
  const dueUnread = !!dueText.trim() && !typed?.dueAt;

  return (
    <Modal visible={todo !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              할 일
            </ThemedText>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder="할 일"
              placeholderTextColor={c.textTertiary}
              maxLength={200}
            />

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              기한
            </ThemedText>
            <View style={styles.dueRow}>
              <ThemedText type="body" style={{ flex: 1, color: due ? c.text : c.textTertiary }}>
                {due ? dueLabel(due.at, due.hasTime) + (due.hasTime ? ' · 알림' : '') : '없음'}
              </ThemedText>
              {due && (
                <Button
                  label="지우기"
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setDueText('');
                    setCleared(true);
                  }}
                />
              )}
            </View>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={dueText}
              onChangeText={setDueText}
              placeholder="예: 내일 오전 10시 · 금요일 · 10/20"
              placeholderTextColor={c.textTertiary}
              maxLength={40}
            />
            {dueUnread && (
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                날짜나 시각을 읽지 못했어요
              </ThemedText>
            )}

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body">살 것</ThemedText>
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  장보기에도 함께 보여요
                </ThemedText>
              </View>
              <Toggle label="살 것" value={buy} onChange={setBuy} />
            </View>

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              주제
            </ThemedText>
            <View style={styles.chips}>
              {topics.map((t) => (
                <Chip key={t.id} label={t.title} selected={topicId === t.id} onPress={() => setTopicId(t.id)} />
              ))}
            </View>
          </ScrollView>

          <Button
            size="lg"
            label="저장"
            disabled={!title.trim() || !topicId}
            onPress={() =>
              onSave({
                title: title.trim(),
                dueAt: due ? due.at.toISOString() : null,
                hasTime: due?.hasTime ?? false,
                buy,
                topicId: topicId ?? todo?.topicId ?? '',
              })
            }
          />
          <Button variant="danger" size="sm" label="지우기" onPress={onDelete} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
    gap: Spacing.two,
    maxHeight: '90%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  content: { gap: Spacing.two, paddingBottom: Spacing.two },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
