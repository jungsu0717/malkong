/**
 * 주제 만들기 · 이름 바꾸기 · 숨기기 (SPEC-TOPIC-01). 숨겨도 지우지 않는다 — 할 일 탭 아래 「숨긴 주제」에서 다시 보인다.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import type { Topic } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function TopicSheet({
  open,
  topic,
  onClose,
  onSave,
  onHide,
}: {
  open: boolean;
  /** 고칠 주제 — 없으면 새로 만들기 */
  topic: Topic | null;
  onClose: () => void;
  onSave: (title: string) => void;
  onHide?: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(topic?.title ?? '');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">{topic ? '주제 편집' : '새 주제'}</ThemedText>
          <TextInput
            style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
            value={title}
            onChangeText={setTitle}
            placeholder="예: 어린이집 준비"
            placeholderTextColor={c.textTertiary}
            maxLength={30}
            autoFocus
          />
          <Button size="lg" label={topic ? '저장' : '추가'} disabled={!title.trim()} onPress={() => onSave(title.trim())} />
          {topic && onHide && <Button variant="ghost" size="sm" label="이 주제 숨기기" onPress={onHide} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.two },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
});
