/**
 * 루틴 추가 · 편집 (SPEC-MAIN-03) — 이름, 종류(체크 / 시간 재기), 반복(매일 / N일마다), 알림 시각, 목표 분, 삭제.
 * 추가할 때는 위에 추천(목욕 · 터미타임 …)이 있어 누르면 칸이 채워진다. 이미 있는 이름은 추천에서 뺀다.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { ROUTINE_TEMPLATES, isTime, timeLabel, type Routine, type RoutineInput, type RoutineKind } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const EVERY: { days: number; label: string }[] = [
  { days: 1, label: '매일' },
  { days: 2, label: '이틀마다' },
  { days: 3, label: '사흘마다' },
  { days: 7, label: '일주일마다' },
];
const TIMES = ['08:00', '13:00', '19:00'];

export function RoutineSheet({
  open,
  routine,
  existingTitles,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** 편집할 루틴 — 없으면 추가 */
  routine: Routine | null;
  existingTitles: string[];
  onClose: () => void;
  onSave: (input: RoutineInput) => void;
  onDelete?: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(routine?.title ?? '');
  const [kind, setKind] = useState<RoutineKind>(routine?.kind ?? 'check');
  const [everyText, setEveryText] = useState(String(routine?.everyDays ?? 1));
  const [timeText, setTimeText] = useState(routine?.time ?? '');
  const [goalText, setGoalText] = useState(routine?.goalMinutes ? String(routine.goalMinutes) : '');

  const everyDays = Number(everyText);
  const everyOk = Number.isInteger(everyDays) && everyDays >= 1 && everyDays <= 365;
  const timeOk = !timeText.trim() || isTime(timeText);
  const goal = Number(goalText);
  const goalOk = !goalText.trim() || (Number.isInteger(goal) && goal >= 1 && goal <= 600);
  const have = new Set(existingTitles.map((t) => t.replace(/\s+/g, '')));
  const templates = routine ? [] : ROUTINE_TEMPLATES.filter((t) => !have.has(t.title.replace(/\s+/g, '')));
  const canSave = !!title.trim() && everyOk && timeOk && goalOk;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="title">{routine ? '루틴 편집' : '루틴 추가'}</ThemedText>

            {templates.length > 0 && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  추천
                </ThemedText>
                <View style={styles.chips}>
                  {templates.map((t) => (
                    <Chip
                      key={t.title}
                      label={t.title}
                      selected={title.trim() === t.title}
                      onPress={() => {
                        setTitle(t.title);
                        setKind(t.kind);
                        setEveryText(String(t.everyDays));
                        setTimeText(t.time ?? '');
                      }}
                    />
                  ))}
                </View>
              </>
            )}

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              이름
            </ThemedText>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 목욕"
              placeholderTextColor={c.textTertiary}
              maxLength={30}
            />

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              종류
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="체크" selected={kind === 'check'} onPress={() => setKind('check')} />
              <Chip label="시간 재기" selected={kind === 'minutes'} onPress={() => setKind('minutes')} />
            </View>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {kind === 'check' ? '한 번 누르면 했어요 — 몇 시에 했는지 남아요' : '+5분이나 타이머로 오늘 몇 분 했는지 쌓여요'}
            </ThemedText>

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              반복
            </ThemedText>
            <View style={styles.chips}>
              {EVERY.map((e) => (
                <Chip key={e.days} label={e.label} selected={everyDays === e.days} onPress={() => setEveryText(String(e.days))} />
              ))}
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.field, styles.number, { color: c.text, backgroundColor: c.surface }]}
                value={everyText}
                onChangeText={setEveryText}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="며칠마다"
              />
              <ThemedText type="body">일마다</ThemedText>
            </View>

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              알림
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="없음" selected={!timeText.trim()} onPress={() => setTimeText('')} />
              {TIMES.map((t) => (
                <Chip key={t} label={timeLabel(t)} selected={timeText.trim() === t} onPress={() => setTimeText(t)} />
              ))}
            </View>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={timeText}
              onChangeText={setTimeText}
              placeholder="다른 시각: 20:30"
              placeholderTextColor={c.textTertiary}
              maxLength={5}
            />
            {!timeOk && (
              <ThemedText type="caption" style={{ color: c.accentText }}>
                시각은 20:30 처럼 적어 주세요
              </ThemedText>
            )}

            {kind === 'minutes' && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  하루 목표 (안 정해도 돼요)
                </ThemedText>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.field, styles.number, { color: c.text, backgroundColor: c.surface }]}
                    value={goalText}
                    onChangeText={setGoalText}
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="하루 목표 분"
                  />
                  <ThemedText type="body">분</ThemedText>
                </View>
              </>
            )}
          </ScrollView>
          <Button
            size="lg"
            label={routine ? '저장' : '추가'}
            disabled={!canSave}
            onPress={() =>
              onSave({
                title: title.trim(),
                kind,
                everyDays,
                time: timeText.trim() || null,
                goalMinutes: kind === 'minutes' && goalText.trim() ? goal : null,
              })
            }
          />
          {routine && onDelete && <Button variant="danger" size="sm" label="삭제" onPress={onDelete} />}
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
    maxHeight: '92%',
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
  number: { width: 72, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
