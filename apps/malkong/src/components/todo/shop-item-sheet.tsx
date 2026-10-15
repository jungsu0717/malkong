/**
 * 살 것 편집 (SPEC-SHOP-01) — 이름, 살 곳(칩 또는 새로 적기), 삭제. 살 것을 길게 누르면 열린다.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import type { Todo } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function ShopItemSheet({
  todo,
  places,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo | null;
  places: string[];
  onClose: () => void;
  onSave: (patch: Pick<Todo, 'title' | 'store'>) => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [place, setPlace] = useState(todo?.store ?? '');

  return (
    <Modal visible={todo !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              살 것
            </ThemedText>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder="살 것"
              placeholderTextColor={c.textTertiary}
              maxLength={100}
            />
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              살 곳
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="선택 안 함" selected={!place.trim()} onPress={() => setPlace('')} />
              {places.map((p) => (
                <Chip key={p} label={p} selected={place.trim() === p} onPress={() => setPlace(p)} />
              ))}
            </View>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={places.includes(place.trim()) ? '' : place}
              onChangeText={setPlace}
              placeholder="다른 곳 (예: 동네 약국)"
              placeholderTextColor={c.textTertiary}
              maxLength={20}
            />
          </ScrollView>
          <Button size="lg" label="저장" disabled={!title.trim()} onPress={() => onSave({ title: title.trim(), store: place.trim() || null })} />
          <Button variant="danger" size="sm" label="삭제" onPress={onDelete} />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
