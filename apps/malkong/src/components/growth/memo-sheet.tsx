/**
 * 우리 아기 메모 쓰기 · 고치기 (SPEC-STAGE-03, task growth/004) — 「D+32 · 5주차」와 한 칸, 저장. 고칠 때는 삭제도.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import type { Memo } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

const MAX = 500;

export function MemoSheet({
  open,
  memo,
  dayText,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  /** 고칠 메모 — 없으면 새로 */
  memo: Memo | null;
  /** 「D+32 · 5주차」 */
  dayText: string;
  onSave: (text: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(memo?.text ?? '');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <View style={styles.head}>
            <ThemedText type="title">우리 아기 메모</ThemedText>
            <View style={[styles.day, { backgroundColor: c.accentSoft }]}>
              <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
                {dayText}
              </ThemedText>
            </View>
          </View>
          <TextInput
            style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
            value={text}
            onChangeText={setText}
            placeholder="예: 처음으로 소리 내어 웃었어요"
            placeholderTextColor={c.textTertiary}
            multiline
            maxLength={MAX}
            autoFocus={!memo}
            accessibilityLabel="메모"
          />
          <Button size="lg" label="저장" disabled={!text.trim()} onPress={() => onSave(text)} />
          {memo && onDelete && <Button size="sm" variant="ghost" label="삭제" onPress={onDelete} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.three },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  field: {
    minHeight: 132,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FontFamily.regular,
    textAlignVertical: 'top',
  },
});
