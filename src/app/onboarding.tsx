import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MalkongAvatar } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Chip } from '@/components/ui';
import { FontFamily, Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatDate, validateBirthDate } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { BRIEFING_TIMES, timeLabel } from '@/data/briefing';
import { askNotifications, notificationsSupported } from '@/data/notifications';
import { DEFAULT_BRIEFING_TIME, usePreferences } from '@/data/preferences-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * 온보딩 — 생일 하나로 시작하고(SPEC-MY-01), 아침 브리핑 알림 시각을 묻는다(SPEC-HOME-06).
 * 이름은 선택이고, 그 밖의 정보는 요구하지 않는다. 나머지는 대화에서 쌓인다.
 * `?edit=1` 로 들어오면 마이의 프로필 수정으로 쓰인다(SPEC-MY-02) — 그때는 알림을 묻지 않는다.
 */
export default function OnboardingScreen() {
  const c = useTheme();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { baby, save } = useBaby();
  const { setBriefingTime } = usePreferences();

  const isEdit = edit === '1';
  const stored = isEdit && baby ? baby.birthDate.split('-') : null;

  const [step, setStep] = useState<'birthday' | 'briefing'>('birthday');
  const [year, setYear] = useState(stored?.[0] ?? '');
  const [month, setMonth] = useState(stored?.[1] ?? '');
  const [day, setDay] = useState(stored?.[2] ?? '');
  const [name, setName] = useState(isEdit ? (baby?.name ?? '') : '');
  const [time, setTime] = useState(DEFAULT_BRIEFING_TIME);
  const [saving, setSaving] = useState(false);

  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  const filled = year.length === 4 && month.length >= 1 && day.length >= 1;
  const birthDate = filled ? formatDate(Number(year), Number(month), Number(day)) : null;
  const error = birthDate ? validateBirthDate(birthDate) : null;
  const canSubmit = Boolean(birthDate) && !error && !saving;

  const onlyDigits = (text: string, max: number) => text.replace(/[^0-9]/g, '').slice(0, max);

  const saveBirthday = async () => {
    if (!birthDate || error) return;
    setSaving(true);
    try {
      await save({ name: name || null, birthDate });
      if (isEdit) router.back();
      // 알림이 없는 곳(웹 미리보기)은 묻지 않고 바로 시작한다
      else if (notificationsSupported()) setStep('briefing');
      else router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  /** 알림을 받든 안 받든 시각은 남긴다 — 나중에 마이에서 켜면 그 시각으로(SPEC-HOME-06 기본 8시) */
  const finish = async (notify: boolean) => {
    setSaving(true);
    try {
      if (notify) await askNotifications();
      await setBriefingTime(time);
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'briefing') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.content}>
            <MalkongAvatar size={64} />
            <View style={styles.heading}>
              <ThemedText type="display">매일 아침,{'\n'}버디가 먼저 챙길게요</ThemedText>
              <ThemedText type="body" style={{ color: c.textSecondary }}>
                오늘 챙길 접종·검진과 기록할 것을 정리해서, 정한 시각에 알려 드려요. 알림에는 아기 정보를 쓰지 않아요.
              </ThemedText>
            </View>
            <View style={styles.field}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                알림 시각
              </ThemedText>
              <View style={styles.times}>
                {BRIEFING_TIMES.map((t) => (
                  <Chip key={t} label={timeLabel(t)} selected={t === time} onPress={() => setTime(t)} />
                ))}
              </View>
            </View>
          </View>
          <View style={styles.footer}>
            <Button label="알림 받기" size="lg" busy={saving} onPress={() => void finish(true)} />
            <Button label="나중에 할게요" variant="ghost" disabled={saving} onPress={() => void finish(false)} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            {!isEdit && <MalkongAvatar size={64} />}
            <View style={styles.heading}>
              <ThemedText type="display">{isEdit ? '아기 프로필' : '육아버디를\n시작할게요'}</ThemedText>
              <ThemedText type="body" style={{ color: c.textSecondary }}>
                {isEdit
                  ? '생일을 고치면 모든 화면이 따라 바뀌어요'
                  : '아기 생일만 알려 주시면 돼요. 나머지는 대화하면서 채울게요'}
              </ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                생일
              </ThemedText>
              <View style={styles.dateRow}>
                <View style={[styles.dateBox, { backgroundColor: c.surface }]}>
                  <TextInput
                    accessibilityLabel="태어난 해"
                    style={[styles.dateInput, { color: c.text }]}
                    value={year}
                    onChangeText={(t) => {
                      const v = onlyDigits(t, 4);
                      setYear(v);
                      if (v.length === 4) monthRef.current?.focus();
                    }}
                    placeholder="2026"
                    placeholderTextColor={c.textTertiary}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
                <ThemedText style={{ color: c.textSecondary }}>년</ThemedText>
                <View style={[styles.dateBoxSmall, { backgroundColor: c.surface }]}>
                  <TextInput
                    ref={monthRef}
                    accessibilityLabel="태어난 달"
                    style={[styles.dateInput, { color: c.text }]}
                    value={month}
                    onChangeText={(t) => {
                      const v = onlyDigits(t, 2);
                      setMonth(v);
                      if (v.length === 2) dayRef.current?.focus();
                    }}
                    placeholder="07"
                    placeholderTextColor={c.textTertiary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <ThemedText style={{ color: c.textSecondary }}>월</ThemedText>
                <View style={[styles.dateBoxSmall, { backgroundColor: c.surface }]}>
                  <TextInput
                    ref={dayRef}
                    accessibilityLabel="태어난 날"
                    style={[styles.dateInput, { color: c.text }]}
                    value={day}
                    onChangeText={(t) => setDay(onlyDigits(t, 2))}
                    placeholder="06"
                    placeholderTextColor={c.textTertiary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <ThemedText style={{ color: c.textSecondary }}>일</ThemedText>
              </View>
              {error && (
                <ThemedText type="caption" style={{ color: c.danger }}>
                  {error}
                </ThemedText>
              )}
            </View>

            <View style={styles.field}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                이름 (선택)
              </ThemedText>
              <View style={[styles.nameBox, { backgroundColor: c.surface }]}>
                <TextInput
                  accessibilityLabel="아기 이름"
                  style={[styles.nameInput, { color: c.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="태명도 좋아요"
                  placeholderTextColor={c.textTertiary}
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={saveBirthday}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <ThemedText type="caption" style={[styles.notice, { color: c.textSecondary }]}>
              입력한 내용은 이 기기 안에만 저장돼요
            </ThemedText>
            <Button
              label={isEdit ? '저장' : '다음'}
              size="lg"
              disabled={!canSubmit}
              busy={saving}
              onPress={saveBirthday}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Gutter,
    paddingTop: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  heading: { gap: Spacing.two },
  field: { gap: Spacing.two },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // 칸 너비는 줄을 비율로 나눠 정한다 — 고정 폭이면 좁은 화면에서 월·일 칸이 밀려난다
  dateBox: { flex: 3, borderRadius: Radius.md, paddingHorizontal: Spacing.two, paddingVertical: 14 },
  dateBoxSmall: { flex: 2, borderRadius: Radius.md, paddingHorizontal: Spacing.two, paddingVertical: 14 },
  // 웹의 <input> 은 기본 폭(약 20자)을 가지므로 칸에 맞춰 줄인다
  dateInput: { fontSize: 18, fontFamily: FontFamily.semibold, textAlign: 'center', padding: 0, width: '100%' },
  nameBox: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  nameInput: { fontSize: 16, fontFamily: FontFamily.regular, padding: 0 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: {
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  notice: { textAlign: 'center' },
});
