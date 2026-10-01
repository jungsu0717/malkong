import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { formatDate, validateBirthDate } from '@/data/baby';
import { useBaby } from '@/data/baby-context';

/**
 * 온보딩 — 생일 하나로 시작한다 (SPEC-MY-01).
 * 이름은 선택이고, 그 밖의 정보는 요구하지 않는다. 나머지는 대화에서 쌓인다.
 * `?edit=1` 로 들어오면 마이 탭의 프로필 수정으로 쓰인다 (SPEC-MY-02).
 */
export default function OnboardingScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { baby, save } = useBaby();

  const isEdit = edit === '1';
  const stored = isEdit && baby ? baby.birthDate.split('-') : null;

  const [year, setYear] = useState(stored?.[0] ?? '');
  const [month, setMonth] = useState(stored?.[1] ?? '');
  const [day, setDay] = useState(stored?.[2] ?? '');
  const [name, setName] = useState(isEdit ? (baby?.name ?? '') : '');
  const [saving, setSaving] = useState(false);

  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  const filled = year.length === 4 && month.length >= 1 && day.length >= 1;
  const birthDate = filled ? formatDate(Number(year), Number(month), Number(day)) : null;
  const error = birthDate ? validateBirthDate(birthDate) : null;
  const canSubmit = Boolean(birthDate) && !error && !saving;

  const onlyDigits = (text: string, max: number) => text.replace(/[^0-9]/g, '').slice(0, max);

  const submit = async () => {
    if (!birthDate || error) return;
    setSaving(true);
    try {
      await save({ name: name || null, birthDate });
      if (isEdit) router.back();
      else router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <View style={styles.heading}>
              <ThemedText type="title">
                {isEdit ? '아기 프로필' : '말콩을 시작할게요'}
              </ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>
                {isEdit
                  ? '생일을 고치면 모든 화면이 따라 바뀌어요'
                  : '아기 생일만 알려주시면 돼요. 나머지는 대화하면서 채울게요'}
              </ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                생일
              </ThemedText>
              <View style={styles.dateRow}>
                <View style={[styles.dateBox, { backgroundColor: colors.backgroundElement }]}>
                  <TextInput
                    style={[styles.dateInput, { color: colors.text }]}
                    value={year}
                    onChangeText={(t) => {
                      const v = onlyDigits(t, 4);
                      setYear(v);
                      if (v.length === 4) monthRef.current?.focus();
                    }}
                    placeholder="2026"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
                <ThemedText style={{ color: colors.textSecondary }}>년</ThemedText>

                <View style={[styles.dateBoxSmall, { backgroundColor: colors.backgroundElement }]}>
                  <TextInput
                    ref={monthRef}
                    style={[styles.dateInput, { color: colors.text }]}
                    value={month}
                    onChangeText={(t) => {
                      const v = onlyDigits(t, 2);
                      setMonth(v);
                      if (v.length === 2) dayRef.current?.focus();
                    }}
                    placeholder="07"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <ThemedText style={{ color: colors.textSecondary }}>월</ThemedText>

                <View style={[styles.dateBoxSmall, { backgroundColor: colors.backgroundElement }]}>
                  <TextInput
                    ref={dayRef}
                    style={[styles.dateInput, { color: colors.text }]}
                    value={day}
                    onChangeText={(t) => setDay(onlyDigits(t, 2))}
                    placeholder="06"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <ThemedText style={{ color: colors.textSecondary }}>일</ThemedText>
              </View>
              {error && (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              )}
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                이름 (선택)
              </ThemedText>
              <View style={[styles.nameBox, { backgroundColor: colors.backgroundElement }]}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="태명도 좋아요"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" style={[styles.notice, { color: colors.textSecondary }]}>
              입력한 내용은 이 기기 안에만 저장돼요
            </ThemedText>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: canSubmit ? colors.accent : colors.backgroundSelected },
              ]}
              disabled={!canSubmit}
              onPress={submit}>
              <ThemedText
                style={[styles.buttonText, { color: canSubmit ? '#ffffff' : colors.textSecondary }]}>
                {isEdit ? '저장' : '시작하기'}
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.five,
    paddingTop: Spacing.six,
  },
  heading: { gap: Spacing.two },
  field: { gap: Spacing.two },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateBox: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minWidth: 92,
  },
  dateBoxSmall: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minWidth: 60,
  },
  dateInput: { fontSize: 18, textAlign: 'center', padding: 0 },
  nameBox: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  nameInput: { fontSize: 16, padding: 0 },
  error: { color: '#F04452' },
  footer: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  notice: { textAlign: 'center' },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600', fontSize: 16 },
});
