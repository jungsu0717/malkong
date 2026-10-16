/**
 * 루틴 추가 · 편집 (SPEC-MAIN-03, task today/002) — 이름, 종류(체크 / 타이머), 반복(매일 / N일마다), 알림 시각, 목표 분, 삭제.
 * 추가할 때는 위에 추천(목욕 · 터미타임 …)이 버튼으로 다 보이고, 누르면 바로 추가된다(이미 있는 것은 체크 표시).
 * 아래 「직접 추가」 칸에 이름을 적지 않았으면 아래 단추는 「완료」(닫기)다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { ROUTINE_TEMPLATES, isTime, timeLabel, type Routine, type RoutineInput, type RoutineKind, type RoutineTemplate } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const EVERY: { days: number; label: string }[] = [
  { days: 1, label: '매일' },
  { days: 2, label: '2일마다' },
  { days: 3, label: '3일마다' },
  { days: 7, label: '매주' },
];
const TEMPLATE_COLUMNS = 4;
const TEMPLATE_GAP = 8;
const TIMES = ['08:00', '13:00', '19:00'];

export function RoutineSheet({
  open,
  routine,
  existingTitles,
  onClose,
  onSave,
  onQuickAdd,
  onDelete,
}: {
  open: boolean;
  /** 편집할 루틴 — 없으면 추가 */
  routine: Routine | null;
  existingTitles: string[];
  onClose: () => void;
  onSave: (input: RoutineInput) => void;
  /** 추천 버튼 — 누르면 바로 추가(시트는 열린 채로) */
  onQuickAdd: (t: RoutineTemplate) => void;
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
  const added = (t: RoutineTemplate) => have.has(t.title.replace(/\s+/g, ''));
  const canSave = !!title.trim() && everyOk && timeOk && goalOk;
  // 추가 화면에서 이름을 비워 두면 아래 단추는 닫기
  const closeOnly = !routine && !title.trim();
  const [gridWidth, setGridWidth] = useState(0);
  const templateWidth = gridWidth ? Math.floor((gridWidth - TEMPLATE_GAP * (TEMPLATE_COLUMNS - 1)) / TEMPLATE_COLUMNS) : 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="title">{routine ? '루틴 편집' : '루틴 추가'}</ThemedText>

            {!routine && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  추천
                </ThemedText>
                <View style={styles.templates} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
                  {templateWidth > 0 &&
                    ROUTINE_TEMPLATES.map((t) => {
                      const on = added(t);
                      return (
                        <Pressable
                          key={t.title}
                          accessibilityRole="button"
                          accessibilityLabel={on ? `${t.title}, 추가됨` : `${t.title} 추가`}
                          accessibilityState={{ disabled: on }}
                          disabled={on}
                          onPress={() => {
                            tap('success');
                            onQuickAdd(t);
                          }}
                          style={({ pressed }) => [styles.template, { width: templateWidth, opacity: pressed ? 0.6 : 1 }]}>
                          <View>
                            <View style={[styles.templateCircle, { backgroundColor: on ? c.ink : c.surface }]}>
                              <RoutineIcon title={t.title} kind={t.kind} size={24} color={on ? c.onInk : c.text} />
                            </View>
                            <View style={[styles.badge, { backgroundColor: on ? c.accent : c.ink, borderColor: c.background }]}>
                              <Ionicons name={on ? 'checkmark' : 'add'} size={12} color={c.onInk} />
                            </View>
                          </View>
                          <ThemedText type="caption" numberOfLines={2} style={[styles.templateName, { color: on ? c.textSecondary : c.text }]}>
                            {t.title}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                </View>
                <ThemedText type="label" style={[styles.directHead, { color: c.textSecondary }]}>
                  직접 추가
                </ThemedText>
              </>
            )}

            {routine && (
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                이름
              </ThemedText>
            )}
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder={routine ? '예: 목욕' : '이름 (예: 로션 바르기)'}
              placeholderTextColor={c.textTertiary}
              maxLength={30}
            />

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              종류
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="체크" selected={kind === 'check'} onPress={() => setKind('check')} />
              <Chip label="타이머" selected={kind === 'minutes'} onPress={() => setKind('minutes')} />
            </View>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {kind === 'check' ? '누르면 완료로 바뀌고, 완료한 시각이 기록돼요' : '타이머나 +5분 단추로 오늘 한 시간이 기록돼요'}
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
              placeholder="직접 입력 (예: 20:30)"
              placeholderTextColor={c.textTertiary}
              maxLength={5}
            />
            {!timeOk && (
              <ThemedText type="caption" style={{ color: c.accentText }}>
                20:30 형식으로 입력해 주세요
              </ThemedText>
            )}

            {kind === 'minutes' && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  하루 목표 (선택)
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
            label={routine ? '저장' : closeOnly ? '완료' : '추가'}
            disabled={!closeOnly && !canSave}
            onPress={() =>
              closeOnly
                ? onClose()
                : onSave({
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
  templates: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: TEMPLATE_GAP },
  template: { alignItems: 'center', gap: 6 },
  templateCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  templateName: { textAlign: 'center' },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directHead: { marginTop: Spacing.three },
});
