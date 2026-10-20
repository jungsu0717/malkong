/**
 * 반복 고르기 (SPEC-MAIN-03, task today/004) — 매일 · 2일마다 · 3일마다 · 요일 지정(동그라미 일곱) · 며칠마다(− 7일마다 +).
 * 「완료」를 눌러야 바뀌고, 바깥을 누르면 그대로 닫힌다. 요일을 일곱 개 다 고르면 「매일」로 저장한다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { scheduleLabel, type Routine } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

export type RepeatValue = Pick<Routine, 'everyDays' | 'weekdays'>;
type Choice = 1 | 2 | 3 | 'weekdays' | 'custom';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const FIXED: { days: 1 | 2 | 3; label: string }[] = [
  { days: 1, label: '매일' },
  { days: 2, label: '2일마다' },
  { days: 3, label: '3일마다' },
];
const CUSTOM_MIN = 2;
const CUSTOM_MAX = 99;

function initialChoice(v: RepeatValue): Choice {
  if (v.weekdays?.length) return 'weekdays';
  return v.everyDays === 1 || v.everyDays === 2 || v.everyDays === 3 ? v.everyDays : 'custom';
}

export function RepeatPicker({
  open,
  value,
  today,
  onDone,
  onClose,
}: {
  open: boolean;
  value: RepeatValue;
  /** 요일 지정을 처음 고를 때 먼저 켜 둘 요일 */
  today: number;
  onDone: (value: RepeatValue) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<Choice>(() => initialChoice(value));
  const [days, setDays] = useState<number[]>(() => (value.weekdays?.length ? value.weekdays : [today]));
  const [custom, setCustom] = useState(() => (value.everyDays > 3 ? Math.min(value.everyDays, CUSTOM_MAX) : 7));

  const result: RepeatValue =
    choice === 'weekdays'
      ? days.length === 7
        ? { everyDays: 1, weekdays: null }
        : { everyDays: 7, weekdays: [...days].sort((a, b) => a - b) }
      : { everyDays: choice === 'custom' ? custom : choice, weekdays: null };
  const caption = result.weekdays ? `${scheduleLabel(result)}에 할 루틴이 돼요` : `${scheduleLabel(result)} 할 루틴이 돼요`;

  const pick = (next: Choice) => {
    if (next !== choice) tap();
    setChoice(next);
  };
  const toggleDay = (d: number) => {
    tap();
    setChoice('weekdays');
    // 하나는 남긴다 — 다 빼고 싶으면 「매일」 같은 반복을 고른다
    setDays((prev) => (prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d]));
  };
  const step = (by: number) => {
    tap();
    setChoice('custom');
    setCustom((n) => Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, n + by)));
  };

  const check = <Ionicons name="checkmark" size={20} color={c.accent} />;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title" style={styles.pad}>
            반복
          </ThemedText>

          <View accessibilityRole="radiogroup" style={[styles.card, { backgroundColor: c.background }]}>
            {FIXED.map((f, i) => (
              <View key={f.days}>
                {i > 0 && <View style={[styles.line, { backgroundColor: c.divider }]} />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: choice === f.days }}
                  onPress={() => pick(f.days)}
                  style={styles.row}>
                  <ThemedText type="body" style={[styles.flex, choice === f.days && styles.on]}>
                    {f.label}
                  </ThemedText>
                  {choice === f.days && check}
                </Pressable>
              </View>
            ))}

            <View style={[styles.line, { backgroundColor: c.divider }]} />
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: choice === 'weekdays' }}
              onPress={() => pick('weekdays')}
              style={styles.row}>
              <ThemedText type="body" style={[styles.flex, choice === 'weekdays' && styles.on]}>
                요일 지정
              </ThemedText>
              {choice === 'weekdays' && check}
            </Pressable>
            {choice === 'weekdays' && (
              <View style={styles.days}>
                {DAY_NAMES.map((name, d) => {
                  const on = days.includes(d);
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${name}요일`}
                      onPress={() => toggleDay(d)}
                      style={[styles.day, { backgroundColor: on ? c.ink : c.surface }]}>
                      <ThemedText type="label" style={{ color: on ? c.onInk : c.text, fontWeight: on ? 700 : 400 }}>
                        {name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={[styles.line, { backgroundColor: c.divider }]} />
            <View accessibilityRole="radio" accessibilityState={{ checked: choice === 'custom' }} style={styles.row}>
              <Pressable onPress={() => pick('custom')} style={styles.flex} accessibilityLabel="며칠마다">
                <ThemedText type="body" style={choice === 'custom' && styles.on}>
                  며칠마다
                </ThemedText>
              </Pressable>
              <StepButton icon="remove" label="하루 줄이기" disabled={custom <= CUSTOM_MIN} onPress={() => step(-1)} />
              <ThemedText type="body" style={[styles.count, { color: choice === 'custom' ? c.text : c.textSecondary }, styles.on]}>
                {custom}일마다
              </ThemedText>
              <StepButton icon="add" label="하루 늘리기" disabled={custom >= CUSTOM_MAX} onPress={() => step(1)} />
            </View>
          </View>

          <ThemedText type="caption" style={[styles.pad, { color: c.textSecondary }]}>
            {caption}
          </ThemedText>
          <Button size="lg" label="완료" onPress={() => onDone(result)} style={styles.done} />
        </View>
      </View>
    </Modal>
  );
}

export function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.step, { backgroundColor: pressed ? c.surfaceStrong : c.surface, opacity: disabled ? 0.4 : 1 }]}>
      <Ionicons name={icon} size={18} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  pad: { paddingHorizontal: 4 },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { height: StyleSheet.hairlineWidth * 2, marginLeft: 16 },
  flex: { flex: 1 },
  on: { fontWeight: 700 },
  days: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  day: { flex: 1, aspectRatio: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 64, textAlign: 'center' },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  done: { marginTop: Spacing.one },
});
