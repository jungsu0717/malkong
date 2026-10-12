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

import { KIND_UI } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Segmented, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { cleanNumber } from '@/data/daily-log';
import { clockLabel, durationLabel, minutesOf } from '@/data/event-summary';
import { AMOUNT_RANGE, type CareEvent, type DiaperKind, type EventInput, type EventKind, type Side } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

/** 열 시트 — 새로 적기(editing 없음) · 고치기(editing 있음) */
export type SheetTarget = { kind: EventKind; editing: CareEvent | null };

const MIN = 60 * 1000;

/**
 * 기록 하나를 적거나 고치는 시트 (SPEC-LOG-01 · 02 · 03).
 *
 * 때는 「지금」이 기본이고 칩과 ±5분으로 옮긴다. 기저귀는 고르면 바로 저장(두 번 눌러 끝),
 * 모유 · 잠은 「시작」으로 재기 시작하거나 걸린 시간만 적는다. 숫자는 범위 밖이면 저장 단추가 꺼진다.
 * 부르는 쪽에서 `key` 를 열 때마다 바꿔 안의 값이 처음부터 시작하게 한다.
 */
export function LogSheet({
  target,
  lastAmount,
  onClose,
  onSave,
  onStart,
  onDelete,
}: {
  target: SheetTarget | null;
  /** 같은 종류의 마지막 값 — 분유 ml · 몸무게 · 키를 거기서 시작한다 */
  lastAmount: number | null;
  onClose: () => void;
  /** 새로 적기면 editingId 가 없다 */
  onSave: (input: EventInput, editingId: string | null) => void;
  /** 모유 · 잠 재기 시작 */
  onStart: (kind: EventKind, side: Side | null) => void;
  onDelete: (id: string) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const editing = target?.editing ?? null;
  const kind = target?.kind ?? 'formula';

  const [at, setAt] = useState<Date>(() => (editing ? new Date(editing.startAt) : new Date()));
  const [side, setSide] = useState<Side>(editing?.side ?? 'left');
  const [minutes, setMinutes] = useState<number>(() =>
    editing?.endAt ? Math.round(minutesOf(editing)) : kind === 'sleep' ? 60 : 15,
  );
  const [ml, setMl] = useState<number>(() => editing?.amount ?? lastAmount ?? 120);
  const [text, setText] = useState<string>(() =>
    editing?.amount != null ? String(editing.amount) : kind !== 'temp' && lastAmount != null ? String(lastAmount) : '',
  );

  const running = editing !== null && editing.endAt === null;
  const range = AMOUNT_RANGE[kind];
  const number = Number(cleanNumber(text));
  const numberOk = range ? number >= range.min && number <= range.max : false;

  const save = (input: Omit<EventInput, 'kind'>) => {
    tap('success');
    onSave({ kind, ...input }, editing?.id ?? null);
  };

  const timed = (start: Date, mins: number) => ({
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + mins * MIN).toISOString(),
  });

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">
            {KIND_UI[kind].label}
            {editing ? ' 고치기' : ''}
          </ThemedText>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* 모유 — 시작으로 재거나, 걸린 시간만 */}
            {kind === 'breast' && (
              <>
                {!editing && (
                  <View style={styles.row}>
                    <Button label="왼쪽 시작" icon="play" size="lg" style={styles.flex} onPress={() => onStart('breast', 'left')} />
                    <Button label="오른쪽 시작" icon="play" size="lg" style={styles.flex} onPress={() => onStart('breast', 'right')} />
                  </View>
                )}
                {!editing && <Divider label="또는 먹인 시간만 적기" />}
                <Segmented
                  options={[
                    { value: 'left', label: '왼쪽' },
                    { value: 'right', label: '오른쪽' },
                  ]}
                  value={side}
                  onChange={(v) => setSide(v as Side)}
                />
                {!running && (
                  <Stepper
                    label="먹인 시간"
                    value={minutes}
                    step={1}
                    min={1}
                    max={120}
                    format={(m) => durationLabel(m)}
                    onChange={setMinutes}
                    chips={[5, 10, 15, 20, 30]}
                  />
                )}
                <TimeRow label="시작한 때" value={at} onChange={setAt} />
                <Button
                  size="lg"
                  label={editing ? '고쳤어요' : '기록할게요'}
                  onPress={() => save({ side, ...(running ? { startAt: at.toISOString(), endAt: null } : timed(at, minutes)) })}
                />
              </>
            )}

            {/* 분유 — ml */}
            {kind === 'formula' && (
              <>
                <Stepper
                  label="먹은 양"
                  value={ml}
                  step={10}
                  min={10}
                  max={400}
                  format={(v) => `${v}ml`}
                  onChange={setMl}
                  chips={[60, 90, 120, 150, 180, 200]}
                />
                <TimeRow label="먹인 때" value={at} onChange={setAt} />
                <Button size="lg" label={editing ? '고쳤어요' : '기록할게요'} onPress={() => save({ amount: ml, startAt: at.toISOString() })} />
              </>
            )}

            {/* 기저귀 — 고르면 바로 저장 */}
            {kind === 'diaper' && (
              <>
                <TimeRow label="갈아 준 때" value={at} onChange={setAt} />
                <View style={styles.row}>
                  {(
                    [
                      ['pee', '소변'],
                      ['poo', '대변'],
                      ['both', '둘 다'],
                    ] as [DiaperKind, string][]
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      onPress={() => save({ diaper: value, startAt: at.toISOString() })}
                      style={({ pressed }) => [
                        styles.big,
                        {
                          backgroundColor: editing?.diaper === value ? c.ink : pressed ? c.surfaceStrong : c.surface,
                        },
                      ]}>
                      <ThemedText type="heading" style={{ color: editing?.diaper === value ? c.onInk : c.text }}>
                        {label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* 잠 — 지금 잠들었으면 재기, 지난 잠은 시간만 */}
            {kind === 'sleep' && (
              <>
                {!editing && <Button label="지금 잠들었어요" icon="moon" size="lg" onPress={() => onStart('sleep', null)} />}
                {!editing && <Divider label="또는 지난 잠 적기" />}
                <TimeRow label="잠든 때" value={at} onChange={setAt} />
                {!running && (
                  <Stepper
                    label="잔 시간"
                    value={minutes}
                    step={15}
                    min={5}
                    max={16 * 60}
                    format={(m) => durationLabel(m)}
                    onChange={setMinutes}
                    chips={[30, 60, 90, 120, 180]}
                  />
                )}
                <Button
                  size="lg"
                  label={editing ? '고쳤어요' : '기록할게요'}
                  onPress={() => save(running ? { startAt: at.toISOString(), endAt: null } : timed(at, minutes))}
                />
              </>
            )}

            {/* 체온 · 몸무게 · 키 — 숫자 하나 */}
            {(kind === 'temp' || kind === 'weight' || kind === 'height') && range && (
              <>
                <View style={[styles.field, { backgroundColor: c.surface }]}>
                  <TextInput
                    autoFocus={!editing}
                    value={text}
                    onChangeText={(t) => setText(cleanNumber(t))}
                    placeholder={kind === 'temp' ? '36.8' : kind === 'weight' ? '6.4' : '62'}
                    placeholderTextColor={c.textTertiary}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    maxLength={5}
                    style={[styles.input, { color: c.text }]}
                    accessibilityLabel={KIND_UI[kind].label}
                  />
                  <ThemedText type="heading" style={{ color: c.textSecondary }}>
                    {range.unit}
                  </ThemedText>
                </View>
                {kind === 'temp' && (
                  <View style={styles.chips}>
                    {['36.5', '37.0', '37.5', '38.0', '38.5'].map((v) => (
                      <Chip key={v} label={`${v}℃`} selected={text === v} onPress={() => setText(v)} />
                    ))}
                  </View>
                )}
                <TimeRow label={kind === 'temp' ? '잰 때' : '잰 날'} value={at} onChange={setAt} />
                <Button
                  size="lg"
                  label={editing ? '고쳤어요' : '기록할게요'}
                  disabled={!numberOk}
                  onPress={() => save({ amount: number, startAt: at.toISOString() })}
                />
              </>
            )}
          </ScrollView>

          {editing && (
            <Button
              variant="ghost"
              size="sm"
              icon="trash-outline"
              label="이 기록 지우기"
              onPress={() => {
                tap();
                onDelete(editing.id);
              }}
            />
          )}
          <Button variant="ghost" size="sm" label="닫기" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Divider({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: c.divider }]} />
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        {label}
      </ThemedText>
      <View style={[styles.line, { backgroundColor: c.divider }]} />
    </View>
  );
}

/** 때 고르기 — 지금 · 몇 분 전 칩과 ±5분. 앞으로의 때는 고를 수 없다 */
function TimeRow({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const c = useTheme();
  const now = Date.now();
  const ago = Math.round((now - value.getTime()) / MIN);
  const set = (minutesAgo: number) => onChange(new Date(now - minutesAgo * MIN));
  const shift = (delta: number) => onChange(new Date(Math.min(now, value.getTime() + delta * MIN)));
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) / (24 * 60 * MIN));
  const dayWord = days === 0 ? '' : days === 1 ? '어제 ' : `${value.getMonth() + 1}월 ${value.getDate()}일 `;
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
          {label}
        </ThemedText>
        <View style={styles.stepper}>
          <StepButton icon="remove" label="5분 이르게" onPress={() => shift(-5)} />
          <ThemedText type="heading" style={styles.stepValue}>
            {dayWord}
            {clockLabel(value)}
          </ThemedText>
          <StepButton icon="add" label="5분 늦게" onPress={() => shift(5)} disabled={ago <= 0} />
        </View>
      </View>
      <View style={styles.chips}>
        {[
          [0, '지금'],
          [10, '10분 전'],
          [30, '30분 전'],
          [60, '1시간 전'],
          [180, '3시간 전'],
        ].map(([m, l]) => (
          <Chip key={l} label={l as string} selected={Math.abs(ago - (m as number)) < 1} onPress={() => set(m as number)} />
        ))}
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  step,
  min,
  max,
  format,
  onChange,
  chips,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  chips: number[];
}) {
  const c = useTheme();
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
          {label}
        </ThemedText>
        <View style={styles.stepper}>
          <StepButton icon="remove" label={`${label} 줄이기`} onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min} />
          <ThemedText type="title" style={styles.stepValue}>
            {format(value)}
          </ThemedText>
          <StepButton icon="add" label={`${label} 늘리기`} onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max} />
        </View>
      </View>
      <View style={styles.chips}>
        {chips.map((v) => (
          <Chip key={v} label={format(v)} selected={value === v} onPress={() => onChange(v)} />
        ))}
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'add' | 'remove';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.stepButton, { backgroundColor: pressed ? c.surfaceStrong : c.surface, opacity: disabled ? 0.4 : 1 }]}>
      <ThemedText type="heading" style={{ color: c.text, fontSize: 20, lineHeight: 22 }}>
        {icon === 'add' ? '+' : '−'}
      </ThemedText>
    </Pressable>
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
  body: { flexGrow: 0 },
  bodyContent: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  big: { flex: 1, minHeight: 64, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { flex: 1, height: 1 },
  group: { gap: Spacing.two },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepValue: { minWidth: 92, textAlign: 'center' },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    minHeight: 58,
  },
  input: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 26, paddingVertical: 12 },
});
