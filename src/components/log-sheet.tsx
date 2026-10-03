import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { cleanNumber, type LogDef } from '@/data/daily-log';
import { useTheme } from '@/hooks/use-theme';

/**
 * 하루 기록 한 줄 적기 (SPEC-HOME-06 ② 하루 기록, task home/005).
 *
 * 숫자 하나 또는 짧은 글 하나만 받는다 — 단위는 붙여 두고, 자주 쓰는 값은 눌러서 넣는다(constitution 3·5).
 * 이미 적은 줄을 다시 열면 고친다. 줄마다 처음부터 다시 쓰게 하려면 부르는 쪽에서 `key` 를 그 줄로 준다.
 */
export function LogSheet({
  def,
  editing,
  onClose,
  onSave,
}: {
  def: LogDef | null;
  /** 이미 적은 값을 고치는 중이면 그 값 */
  editing: string | null;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');

  const numeric = def?.unit != null;
  const clean = numeric ? cleanNumber(value) : value.trim();
  const ok = numeric ? Number(clean) > 0 : clean.length > 0;

  return (
    <Modal visible={def !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">{def?.title}</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {editing ? `지금 적힌 값은 ${editing}이에요. 고칠 값을 적어 주세요` : def?.hint}
          </ThemedText>

          <View style={[styles.field, { backgroundColor: c.surface }]}>
            <TextInput
              autoFocus
              value={value}
              onChangeText={(t) => setValue(numeric ? cleanNumber(t) : t)}
              placeholder={def?.placeholder}
              placeholderTextColor={c.textTertiary}
              keyboardType={numeric ? 'decimal-pad' : 'default'}
              returnKeyType="done"
              maxLength={numeric ? 6 : 80}
              onSubmitEditing={() => ok && onSave(clean)}
              style={[styles.input, numeric && styles.number, { color: c.text }]}
              accessibilityLabel={def?.title}
            />
            {numeric && (
              <ThemedText type="heading" style={{ color: c.textSecondary }}>
                {def?.unit}
              </ThemedText>
            )}
          </View>

          {def && def.quick.length > 0 && (
            <View style={styles.quick}>
              {def.quick.map((q) => (
                <Chip
                  key={q}
                  label={numeric ? `${q}${def.unit}` : q}
                  selected={clean === q}
                  onPress={() => setValue(q)}
                />
              ))}
            </View>
          )}

          <Button
            size="lg"
            style={styles.button}
            label={editing ? '고쳤어요' : '기록할게요'}
            disabled={!ok}
            onPress={() => onSave(clean)}
          />
          <Button variant="ghost" size="sm" label="취소" onPress={onClose} />
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
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    marginTop: Spacing.two,
    minHeight: 56,
  },
  input: { flex: 1, fontFamily: FontFamily.regular, fontSize: 17, paddingVertical: 14 },
  number: { fontFamily: FontFamily.semibold, fontSize: 24 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { marginTop: Spacing.two },
});
