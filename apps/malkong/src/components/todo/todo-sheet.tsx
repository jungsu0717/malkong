/**
 * 할 일 편집 (SPEC-TOPIC-02 · 03 · 06) — 제목, 기한(「내일 오전 10시」처럼 말로), 반복, 살 것, 주제 바꾸기, 삭제.
 * 반복을 정하고 기한이 없으면 오늘부터 맞는 첫날이 기한이 된다(todos-context 가 저장할 때 채운다).
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Toggle } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { dueLabel, parseDue } from '@/data/due-parse';
import { WEEKDAY_NAMES, type Repeat } from '@/data/repeat';
import { repeatStart, type Todo, type Topic } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export type TodoPatch = Pick<Todo, 'title' | 'dueAt' | 'hasTime' | 'buy' | 'topicId' | 'repeat'>;

type RepeatKind = 'none' | Repeat['kind'];
const REPEAT_CHOICES: { kind: RepeatKind; label: string }[] = [
  { kind: 'none', label: '안 함' },
  { kind: 'daily', label: '매일' },
  { kind: 'weekly', label: '매주' },
  { kind: 'monthly', label: '매달' },
  { kind: 'every', label: '며칠마다' },
];
/** 월요일부터 — Date.getDay 값 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 고른 값으로 규칙을 만든다. 숫자가 맞지 않거나 요일을 하나도 안 골랐으면 undefined(저장 못 함) */
function buildRepeat(kind: RepeatKind, days: number[], monthDay: string, everyDays: string): Repeat | null | undefined {
  if (kind === 'none') return null;
  if (kind === 'daily') return { kind: 'daily' };
  if (kind === 'weekly') return days.length > 0 ? { kind: 'weekly', days } : undefined;
  const n = Number(kind === 'monthly' ? monthDay : everyDays);
  if (!Number.isInteger(n)) return undefined;
  if (kind === 'monthly') return n >= 1 && n <= 31 ? { kind: 'monthly', day: n } : undefined;
  return n >= 1 && n <= 365 ? { kind: 'every', days: n } : undefined;
}

export function TodoSheet({
  todo,
  topics,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo | null;
  topics: Topic[];
  onClose: () => void;
  onSave: (patch: TodoPatch) => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [dueText, setDueText] = useState('');
  const [cleared, setCleared] = useState(false);
  const [buy, setBuy] = useState(todo?.buy ?? false);
  const [topicId, setTopicId] = useState(todo?.topicId ?? null);
  // 반복 — 처음 값은 지금 규칙, 없으면 기한(없으면 오늘)의 요일 · 날짜
  const base = todo?.dueAt ? new Date(todo.dueAt) : new Date();
  const rule0 = todo?.repeat ?? null;
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(rule0?.kind ?? 'none');
  const [weekDays, setWeekDays] = useState<number[]>(rule0?.kind === 'weekly' ? rule0.days : [base.getDay()]);
  const [monthDay, setMonthDay] = useState(String(rule0?.kind === 'monthly' ? rule0.day : base.getDate()));
  const [everyDays, setEveryDays] = useState(String(rule0?.kind === 'every' ? rule0.days : 7));
  const repeat = buildRepeat(repeatKind, weekDays, monthDay, everyDays);

  // 기한 칸에 새로 적은 말이 있으면 그것, 없으면 원래 기한(지웠으면 없음)
  const typed = dueText.trim() ? parseDue(dueText) : null;
  const due = typed?.dueAt ? { at: typed.dueAt, hasTime: typed.hasTime } : !cleared && todo?.dueAt ? { at: new Date(todo.dueAt), hasTime: todo.hasTime } : null;
  const dueUnread = !!dueText.trim() && !typed?.dueAt;
  // 기한 없이 반복만 정했으면 저장할 때 들어갈 첫날을 미리 보여 준다
  const shownDue = due ?? (repeat ? { at: repeatStart(repeat, null), hasTime: false } : null);

  return (
    <Modal visible={todo !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              할 일
            </ThemedText>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder="할 일"
              placeholderTextColor={c.textTertiary}
              maxLength={200}
            />

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              기한
            </ThemedText>
            <View style={styles.dueRow}>
              <ThemedText type="body" style={{ flex: 1, color: shownDue ? c.text : c.textTertiary }}>
                {shownDue ? dueLabel(shownDue.at, shownDue.hasTime) + (shownDue.hasTime ? ' · 알림' : '') : '없음'}
              </ThemedText>
              {due && (
                <Button
                  label="기한 삭제"
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setDueText('');
                    setCleared(true);
                  }}
                />
              )}
            </View>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={dueText}
              onChangeText={setDueText}
              placeholder="예: 내일 오전 10시 · 금요일 · 10/20"
              placeholderTextColor={c.textTertiary}
              maxLength={40}
            />
            {dueUnread && (
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                날짜나 시각을 읽지 못했어요
              </ThemedText>
            )}

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              반복
            </ThemedText>
            <View style={styles.chips}>
              {REPEAT_CHOICES.map((r) => (
                <Chip key={r.kind} label={r.label} selected={repeatKind === r.kind} onPress={() => setRepeatKind(r.kind)} />
              ))}
            </View>
            {repeatKind === 'weekly' && (
              <View style={styles.chips}>
                {WEEK_ORDER.map((d) => (
                  <Chip
                    key={d}
                    label={WEEKDAY_NAMES[d]}
                    selected={weekDays.includes(d)}
                    onPress={() => setWeekDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                  />
                ))}
              </View>
            )}
            {(repeatKind === 'monthly' || repeatKind === 'every') && (
              <View style={styles.numberRow}>
                {repeatKind === 'monthly' && <ThemedText type="body">매달</ThemedText>}
                <TextInput
                  style={[styles.field, styles.number, { color: c.text, backgroundColor: c.surface }]}
                  value={repeatKind === 'monthly' ? monthDay : everyDays}
                  onChangeText={(v) => (repeatKind === 'monthly' ? setMonthDay(v) : setEveryDays(v))}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel={repeatKind === 'monthly' ? '반복할 날짜' : '반복할 간격(일)'}
                />
                <ThemedText type="body">{repeatKind === 'monthly' ? '일' : '일마다'}</ThemedText>
              </View>
            )}
            {repeat === undefined && (
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {repeatKind === 'weekly' ? '요일을 골라 주세요' : repeatKind === 'monthly' ? '1에서 31 사이로 적어 주세요' : '1에서 365 사이로 적어 주세요'}
              </ThemedText>
            )}

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body">살 것</ThemedText>
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  장보기에도 함께 보여요
                </ThemedText>
              </View>
              <Toggle label="살 것" value={buy} onChange={setBuy} />
            </View>

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              주제
            </ThemedText>
            <View style={styles.chips}>
              {topics.map((t) => (
                <Chip key={t.id} label={t.title} selected={topicId === t.id} onPress={() => setTopicId(t.id)} />
              ))}
            </View>
          </ScrollView>

          <Button
            size="lg"
            label="저장"
            disabled={!title.trim() || !topicId || repeat === undefined}
            onPress={() =>
              onSave({
                title: title.trim(),
                dueAt: due ? due.at.toISOString() : null,
                hasTime: due?.hasTime ?? false,
                buy,
                topicId: topicId ?? todo?.topicId ?? '',
                repeat: repeat ?? null,
              })
            }
          />
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
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  number: { width: 72, textAlign: 'center' },
});
