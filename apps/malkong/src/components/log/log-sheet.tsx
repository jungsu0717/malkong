import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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

import { KIND_UI, STOOL_SWATCH } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Segmented, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { cleanNumber } from '@/data/daily-log';
import { STOOL_COLOR_LABEL, clockLabel, durationLabel, minutesOf } from '@/data/event-summary';
import {
  AMOUNT_RANGE,
  type CareEvent,
  type DiaperKind,
  type EventInput,
  type EventKind,
  type Side,
  type StoolColor,
} from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

/** 열 시트 — 새로 적기(editing 없음) · 고치기(editing 있음) */
export type SheetTarget = { kind: EventKind; editing: CareEvent | null };

const MIN = 60 * 1000;
const STOOL_COLORS: StoolColor[] = ['yellow', 'brown', 'green', 'black', 'red', 'white'];

/**
 * 기록 하나를 적거나 고치는 시트 (SPEC-LOG-01 · 02 · 03).
 *
 * 때는 「지금」이 기본이고, 칩으로 크게 옮기고 ±1분으로 맞춘다(꾹 누르면 빨라진다). 기저귀 소변은 고르면 바로 저장,
 * 대변 · 둘 다는 변 색을 고르면 저장(색 없이도). 모유 · 잠은 「시작」으로 재기 시작하거나 걸린 시간만 적는다.
 * 분유는 5ml 단위. 숫자는 범위 밖이면 저장 단추가 꺼진다. 부르는 쪽에서 `key` 를 열 때마다 바꿔 처음부터 시작하게 한다.
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
  // 기저귀 — 대변 · 둘 다를 고르면 변 색을 묻는다
  const [stool, setStool] = useState<DiaperKind | null>(() => (editing?.diaper && editing.diaper !== 'pee' ? editing.diaper : null));

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
            {editing ? ' 수정' : ''}
          </ThemedText>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* 모유 — 시작으로 재거나, 먹인 시간만 */}
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
                <TimeRow label="수유 시간" value={at} onChange={setAt} />
                <Button
                  size="lg"
                  label={editing ? '고쳤어요' : '기록할게요'}
                  onPress={() => save({ side, ...(running ? { startAt: at.toISOString(), endAt: null } : timed(at, minutes)) })}
                />
              </>
            )}

            {/* 분유 — 5ml 단위 */}
            {kind === 'formula' && (
              <>
                <Stepper
                  label="수유량"
                  value={ml}
                  step={5}
                  min={5}
                  max={400}
                  format={(v) => `${v}ml`}
                  onChange={setMl}
                  chips={[60, 90, 120, 150, 180, 200]}
                />
                <TimeRow label="수유 시간" value={at} onChange={setAt} />
                <Button size="lg" label={editing ? '고쳤어요' : '기록할게요'} onPress={() => save({ amount: ml, startAt: at.toISOString() })} />
              </>
            )}

            {/* 기저귀 — 소변은 바로 저장, 대변 · 둘 다는 변 색까지 */}
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
                  ).map(([value, label]) => {
                    const on = stool === value || (stool === null && editing?.diaper === value);
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          if (value === 'pee') save({ diaper: 'pee', color: null, startAt: at.toISOString() });
                          else {
                            tap();
                            setStool(value);
                          }
                        }}
                        style={({ pressed }) => [styles.big, { backgroundColor: on ? c.ink : pressed ? c.surfaceStrong : c.surface }]}>
                        <ThemedText type="heading" style={{ color: on ? c.onInk : c.text }}>
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                {stool && (
                  <View style={styles.group}>
                    <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                      변 색
                    </ThemedText>
                    <View style={styles.swatches}>
                      {STOOL_COLORS.map((color) => {
                        const on = editing?.color === color;
                        return (
                          <Pressable
                            key={color}
                            accessibilityRole="button"
                            accessibilityLabel={`변 색 ${STOOL_COLOR_LABEL[color]}`}
                            onPress={() => save({ diaper: stool, color, startAt: at.toISOString() })}
                            style={({ pressed }) => [
                              styles.swatch,
                              { borderColor: on ? c.ink : c.border, backgroundColor: pressed ? c.surface : c.background },
                            ]}>
                            <View style={[styles.dot, { backgroundColor: STOOL_SWATCH[color], borderColor: c.border }]} />
                            <ThemedText type="caption" style={{ fontWeight: 600 }}>
                              {STOOL_COLOR_LABEL[color]}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Button
                      variant="secondary"
                      label="색 없이 기록"
                      onPress={() => save({ diaper: stool, color: null, startAt: at.toISOString() })}
                    />
                  </View>
                )}
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
                    step={1}
                    min={1}
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
                <TimeRow label={kind === 'temp' ? '잰 때' : '잰 날'} value={at} onChange={setAt} days />
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

/**
 * 때 고르기 — 지금 · 몇 분 전 칩으로 크게, ±1분으로 맞춘다(꾹 누르면 빨라진다). 앞으로의 때는 고를 수 없다.
 * `days` 면 「어제」 칩도 — 몸무게 · 키처럼 지난날을 적을 때
 */
function TimeRow({
  label,
  value,
  onChange,
  days = false,
}: {
  label: string;
  value: Date;
  onChange: Dispatch<SetStateAction<Date>>;
  days?: boolean;
}) {
  const c = useTheme();
  const now = Date.now();
  const ago = Math.round((now - value.getTime()) / MIN);
  const set = (minutesAgo: number) => onChange(new Date(Date.now() - minutesAgo * MIN));
  const shift = (delta: number) => onChange((prev) => new Date(Math.min(Date.now(), prev.getTime() + delta * MIN)));
  const dayDiff = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) / (24 * 60 * MIN));
  const dayWord = dayDiff === 0 ? '' : dayDiff === 1 ? '어제 ' : `${value.getMonth() + 1}월 ${value.getDate()}일 `;
  const chips: [number, string][] = [
    [0, '지금'],
    [10, '10분 전'],
    [30, '30분 전'],
    [60, '1시간 전'],
    [180, '3시간 전'],
    ...(days ? ([[24 * 60, '어제']] as [number, string][]) : []),
  ];
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
          {label}
        </ThemedText>
        <View style={styles.stepper}>
          <StepButton icon="remove" label="1분 이르게" onStep={() => shift(-1)} />
          <ThemedText type="heading" style={styles.stepValue}>
            {dayWord}
            {clockLabel(value)}
          </ThemedText>
          <StepButton icon="add" label="1분 늦게" onStep={() => shift(1)} disabled={ago <= 0} />
        </View>
      </View>
      <View style={styles.chips}>
        {chips.map(([m, l]) => (
          <Chip key={l} label={l} selected={Math.abs(ago - m) < 1} onPress={() => set(m)} />
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
  onChange: Dispatch<SetStateAction<number>>;
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
          <StepButton
            icon="remove"
            label={`${label} 줄이기`}
            onStep={() => onChange((v) => Math.max(min, v - step))}
            disabled={value <= min}
          />
          <ThemedText type="title" style={styles.stepValue}>
            {format(value)}
          </ThemedText>
          <StepButton
            icon="add"
            label={`${label} 늘리기`}
            onStep={() => onChange((v) => Math.min(max, v + step))}
            disabled={value >= max}
          />
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

/** −/+ 단추 — 한 번 누르면 한 칸, 꾹 누르고 있으면 점점 빨리 움직인다 */
function StepButton({
  icon,
  label,
  onStep,
  disabled = false,
}: {
  icon: 'add' | 'remove';
  label: string;
  onStep: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  }, [onStep]);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const repeat = (count: number) => {
    timer.current = setTimeout(
      () => {
        step.current();
        repeat(count + 1);
      },
      count < 8 ? 120 : count < 30 ? 60 : 25,
    );
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      // 한 번 누르면 한 칸(화면 읽기 프로그램의 두 번 탭도 이 길), 꾹 누르면 손을 뗄 때까지 이어서
      onPress={() => {
        tap();
        onStep();
      }}
      delayLongPress={380}
      onLongPress={() => {
        stop();
        repeat(0);
      }}
      onPressOut={stop}
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
  stepButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: '31%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
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
