import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { cleanNumber } from '@/data/daily-log';
import type { QuickAsk } from '@/data/quick-ask';
import { useTheme } from '@/hooks/use-theme';

/**
 * 버디가 묻는 짧은 질문 하나 (`quick-ask.ts`) — 우리 아기 탭의 「하루 기록」과 「알려 주기」가 같이 쓴다.
 *
 * 글로 답하는 질문은 답을 줄로 늘어놓고 **누르면 바로 저장**한다. 맞는 답이 없으면 아래 「직접 입력」에 적는다.
 * 숫자로 답하는 질문은 단위를 붙인 칸 하나와 자주 쓰는 값 칩. 대화 탭으로 넘어가지 않고 그 자리에서 끝난다
 * (constitution 3·5 — 한 번 누르는 것 이상을 요구하지 않는다).
 * 이미 아는 것을 다시 열면 고친다. 줄마다 처음부터 다시 쓰게 하려면 부르는 쪽에서 `key` 를 그 질문으로 준다.
 */
export function AskSheet({
  ask,
  editing,
  onClose,
  onSave,
}: {
  ask: QuickAsk | null;
  /** 이미 아는 값을 고치는 중이면 그 값 */
  editing: string | null;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');

  const numeric = ask?.unit != null;
  const choices = !numeric && ask ? ask.options : [];
  const clean = numeric ? cleanNumber(value) : value.trim();
  const ok = numeric ? Number(clean) > 0 : clean.length > 0;

  return (
    <Modal visible={ask !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">{ask?.title}</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {editing ? `지금은 「${editing}」로 알고 있어요. 바뀌었으면 새로 알려 주세요` : ask?.hint}
          </ThemedText>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {choices.map((choice, i) => (
              <Pressable
                key={choice}
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  onSave(choice);
                }}
                style={({ pressed }) => [
                  styles.choice,
                  { borderColor: c.border, backgroundColor: pressed ? c.surface : c.background },
                ]}>
                <View style={[styles.choiceNo, { backgroundColor: c.surface }]}>
                  <ThemedText type="caption" style={{ fontWeight: 700, color: c.textSecondary }}>
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={styles.choiceText}>
                  {choice}
                </ThemedText>
              </Pressable>
            ))}

            {choices.length > 0 && (
              <ThemedText type="caption" style={[styles.ownLabel, { color: c.textSecondary }]}>
                맞는 답이 없으면 직접 적어 주세요
              </ThemedText>
            )}
            <View style={[styles.field, { backgroundColor: c.surface }]}>
              <TextInput
                // 고를 답이 있으면 키보드가 답을 가리지 않게 먼저 열지 않는다
                autoFocus={choices.length === 0}
                value={value}
                onChangeText={(t) => setValue(numeric ? cleanNumber(t) : t)}
                placeholder={choices.length > 0 ? '직접 입력' : ask?.placeholder}
                placeholderTextColor={c.textTertiary}
                keyboardType={numeric ? 'decimal-pad' : 'default'}
                returnKeyType="done"
                maxLength={numeric ? 6 : 80}
                onSubmitEditing={() => ok && onSave(clean)}
                style={[styles.input, numeric && styles.number, { color: c.text }]}
                accessibilityLabel={choices.length > 0 ? '직접 입력' : ask?.title}
              />
              {numeric && (
                <ThemedText type="heading" style={{ color: c.textSecondary }}>
                  {ask?.unit}
                </ThemedText>
              )}
            </View>

            {numeric && ask && ask.options.length > 0 && (
              <View style={styles.quick}>
                {ask.options.map((q) => (
                  <Chip key={q} label={`${q}${ask.unit}`} selected={clean === q} onPress={() => setValue(q)} />
                ))}
              </View>
            )}
          </ScrollView>

          {(numeric || value.length > 0 || choices.length === 0) && (
            <Button
              size="lg"
              style={styles.button}
              label={editing ? '고쳤어요' : '기록할게요'}
              disabled={!ok}
              onPress={() => onSave(clean)}
            />
          )}
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
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  body: { flexGrow: 0 },
  bodyContent: { gap: Spacing.two, paddingTop: Spacing.two },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  choiceNo: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, fontWeight: 600 },
  ownLabel: { marginTop: Spacing.one },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  input: { flex: 1, fontFamily: FontFamily.regular, fontSize: 17, paddingVertical: 14 },
  number: { fontFamily: FontFamily.semibold, fontSize: 24 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { marginTop: Spacing.one },
});
