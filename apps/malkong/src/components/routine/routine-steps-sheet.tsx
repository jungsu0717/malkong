/**
 * 단계가 있는 루틴 시트 (SPEC-MAIN-05, task today/003) — 밤잠 준비처럼 순서대로 하는 루틴.
 * 단계를 누르면 완료(시각) ↔ 되돌림, 「모두 완료」로 한 번에, 「단계 편집」은 루틴 편집 시트로.
 * 다음에 할 단계(아직 안 한 것 중 맨 앞)는 테두리로 보인다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { clockLabel, logsOn, scheduleLabel, timeLabel, type Routine, type RoutineLog } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

export function RoutineStepsSheet({
  routine,
  logs,
  now,
  onToggleStep,
  onCompleteAll,
  onEdit,
  onSkip,
  onClose,
}: {
  /** 열 루틴 — 없으면 닫힘 */
  routine: Routine | null;
  logs: RoutineLog[];
  now: Date;
  onToggleStep: (step: number) => void;
  onCompleteAll: () => void;
  onEdit: () => void;
  /** 「오늘은 건너뛰기」 */
  onSkip: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const steps = routine?.items ?? [];
  const today = routine ? logsOn(routine.id, logs, now) : [];
  const doneAt = new Map(today.filter((l) => l.step != null).map((l) => [l.step as number, l.at]));
  const allDone = today.some((l) => l.step == null && !l.skip);
  const doneCount = steps.filter((_, i) => doneAt.has(i)).length;
  const nextStep = allDone ? -1 : steps.findIndex((_, i) => !doneAt.has(i));

  return (
    <Modal visible={routine !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        {routine && (
          <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
            <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: c.surface }]}>
                <RoutineIcon title={routine.title} kind={routine.kind} size={22} color={c.text} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="title">{routine.title}</ThemedText>
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  {[scheduleLabel(routine), routine.time ? timeLabel(routine.time) : null].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                <ThemedText type="heading">{allDone ? steps.length : doneCount}</ThemedText> / {steps.length}
              </ThemedText>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {steps.map((name, i) => {
                const on = allDone || doneAt.has(i);
                const at = doneAt.get(i);
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={name}
                    onPress={() => {
                      tap(on ? 'light' : 'success');
                      onToggleStep(i);
                    }}
                    style={({ pressed }) => [
                      styles.step,
                      i === nextStep
                        ? { borderWidth: 1.5, borderColor: c.text, backgroundColor: c.background }
                        : { backgroundColor: pressed ? c.surfaceStrong : c.surface },
                    ]}>
                    <View style={[styles.dot, on ? { backgroundColor: c.ink } : { borderWidth: 2, borderColor: i === nextStep ? c.text : c.textTertiary }]}>
                      {on && <Ionicons name="checkmark" size={14} color={c.onInk} />}
                    </View>
                    <ThemedText
                      type="body"
                      style={[styles.flex, { color: on ? c.textSecondary : c.text, fontWeight: i === nextStep ? 600 : 400 }]}>
                      {name}
                    </ThemedText>
                    {at && (
                      <ThemedText type="caption" style={{ color: c.textSecondary }}>
                        {clockLabel(at)}
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Button
              size="lg"
              label={allDone ? '닫기' : '모두 완료'}
              onPress={() => {
                if (!allDone) {
                  tap('success');
                  onCompleteAll();
                }
                onClose();
              }}
            />
            <View style={styles.links}>
              {!allDone && doneCount === 0 && <Button variant="ghost" size="sm" label="오늘은 건너뛰기" onPress={onSkip} />}
              <Button variant="ghost" size="sm" label="단계 편집" onPress={onEdit} />
            </View>
          </View>
        )}
      </View>
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
    gap: Spacing.three,
    maxHeight: '85%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.two },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: Radius.md, paddingHorizontal: 16 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
});
