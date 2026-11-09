import { useEffect, useState } from 'react';
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
import { TimeRuler, ValueRuler } from '@/components/log/ruler';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Segmented, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { hhmm } from '@/data/day-flow';
import { readSetting, writeSetting } from '@/data/db';
import { STOOL_COLOR_LABEL, durationLabel, minutesOf } from '@/data/event-summary';
import {
  AMOUNT_RANGE,
  cleanNumber,
  type CareEvent,
  type DiaperKind,
  type EventInput,
  type EventKind,
  type Side,
  type StoolColor,
} from '@/data/events';
import { useRoutines } from '@/data/routines-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/** 열 시트 — 새로 적기(editing 없음) · 고치기(editing 있음) */
export type SheetTarget = { kind: EventKind; editing: CareEvent | null };

const MIN = 60 * 1000;
const STOOL_COLORS: StoolColor[] = ['yellow', 'brown', 'green', 'black', 'red', 'white'];
/** 눈금 숫자 — 함수가 매번 새로 생기지 않게 밖에 둔다 */
const mlText = (v: number) => String(v);
const hourText = (v: number) => `${v / 60}시간`;

/**
 * 기록 하나를 적거나 고치는 시트 (SPEC-LOG-01 · 02 · 03).
 *
 * 분유 양, 모유 먹인 시간, 기록의 때, 잔 시간은 눈금을 좌우로 끌어 고른다(task log/007). 때는 「지금」이 기본이고, 때 글자를 누르면 날짜와 시간 바퀴.
 * 기저귀 소변은 고르면 바로 저장, 대변 · 둘 다는 변 색을 고르면 저장(색 없이도). 모유는 「시작」으로 재기 시작하거나 지난 것의 시작과 끝을 눈금으로(task log/008),
 * 모유와 분유는 「같이 먹인 것」(비타민D 같은 것을 그 수유 시각에 루틴 완료로)과 메모를 함께 적는다.
 * 잠은 「지금 잠들었어요」나 잠든 때와 잔 시간을 적는다. 체온 · 몸무게 · 키는 숫자를 적고, 범위 밖이면 저장 단추가 꺼진다.
 * 부르는 쪽에서 `key` 를 열 때마다 바꿔 처음부터 시작하게 한다.
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

  // 지난 모유는 15분 전에 시작해 지금 끝난 것으로, 지난 잠은 한 시간 전에 잠든 것으로 시작한다
  const [at, setAt] = useState<Date>(() =>
    editing ? new Date(editing.startAt) : kind === 'sleep' ? new Date(Date.now() - 60 * MIN) : kind === 'breast' ? new Date(Date.now() - 15 * MIN) : new Date(),
  );
  const [side, setSide] = useState<Side>(editing?.side ?? 'left');
  // 모유 끝(task log/008) — 시작과 끝 두 눈금
  const [end, setEnd] = useState<Date>(() => (editing?.endAt ? new Date(editing.endAt) : new Date()));
  // 수유 메모와 같이 먹인 것(비타민D 같은 것 — 그 수유 시각에 루틴 완료로 남긴다)
  const [note, setNote] = useState<string>(editing?.note ?? '');
  const [withSel, setWithSel] = useState<string[]>([]);
  const { logTitle } = useRoutines();
  // 잠 — 잔 시간(분). 새로 적을 때는 한 시간 전에 잠들어 지금 깬 것으로
  const [slept, setSlept] = useState<number>(() => (editing?.endAt ? Math.max(5, Math.round(minutesOf(editing) / 5) * 5) : 60));
  const now = useNow(false);
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
    const feed = kind === 'breast' || kind === 'formula';
    onSave({ kind, ...input, ...(feed ? { note: note.trim() || null } : {}) }, editing?.id ?? null);
    if (feed && !editing) {
      const when = input.startAt ? new Date(input.startAt) : new Date();
      for (const title of withSel) void logTitle(title, when);
    }
  };
  // 모유 — 끝은 시작보다 뒤, 지금보다 앞
  const feedMin = Math.round((end.getTime() - at.getTime()) / MIN);
  const endOk = feedMin >= 1 && end.getTime() <= now.getTime() + MIN;

  // 잔 시간은 5분 단위, 잠든 때부터 지금까지(16시간까지)
  const sleepMax = Math.max(5, Math.min(16 * 60, Math.floor((now.getTime() - at.getTime()) / MIN / 5) * 5));
  const sleptMin = Math.min(slept, sleepMax);
  const woke = new Date(at.getTime() + sleptMin * MIN);
  const wokeOk = woke.getTime() <= now.getTime() + MIN && woke > at;

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
                {!editing && <Divider label="또는 지난 수유 적기" />}
                <Segmented
                  options={[
                    { value: 'left', label: '왼쪽' },
                    { value: 'right', label: '오른쪽' },
                  ]}
                  value={side}
                  onChange={(v) => setSide(v as Side)}
                />
                <TimeRuler label="시작" value={at} onChange={setAt} caption={null} />
                {!running && (
                  <TimeRuler
                    label="끝"
                    value={end}
                    onChange={setEnd}
                    caption={endOk ? `${durationLabel(feedMin)} 먹였어요` : '끝이 시작보다 앞이에요'}
                    danger={!endOk}
                  />
                )}
                {!editing && <WithChips selected={withSel} onChange={setWithSel} />}
                <NoteField value={note} onChange={setNote} />
                <Button
                  size="lg"
                  label="저장"
                  disabled={!running && !endOk}
                  onPress={() => save({ side, startAt: at.toISOString(), endAt: running ? null : end.toISOString() })}
                />
              </>
            )}

            {/* 분유 — 5ml 단위 */}
            {kind === 'formula' && (
              <>
                <ValueRuler
                  label="수유량"
                  value={ml}
                  onChange={setMl}
                  big={String(ml)}
                  unit="ml"
                  min={5}
                  max={400}
                  step={5}
                  px={1.4}
                  tick={5}
                  mid={25}
                  every={50}
                  text={mlText}
                />
                <TimeRuler label="수유 시간" value={at} onChange={setAt} />
                {!editing && <WithChips selected={withSel} onChange={setWithSel} />}
                <NoteField value={note} onChange={setNote} />
                <Button size="lg" label="저장" onPress={() => save({ amount: ml, startAt: at.toISOString() })} />
              </>
            )}

            {/* 기저귀 — 소변은 바로 저장, 대변 · 둘 다는 변 색까지 */}
            {kind === 'diaper' && (
              <>
                <TimeRuler label="갈아 준 때" value={at} onChange={setAt} />
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
                <TimeRuler label="잠든 때" value={at} onChange={setAt} caption={null} />
                {!running && (
                  <ValueRuler
                    label="잔 시간"
                    value={sleptMin}
                    onChange={setSlept}
                    big={durationLabel(sleptMin)}
                    min={5}
                    max={sleepMax}
                    step={5}
                    px={1.6}
                    tick={5}
                    mid={30}
                    every={60}
                    text={hourText}
                    skipZero
                    caption={wokeOk ? `${hhmm(woke)}에 깼어요` : '깬 때가 지금보다 뒤예요'}
                    danger={!wokeOk}
                  />
                )}
                <Button
                  size="lg"
                  label="저장"
                  disabled={!running && !wokeOk}
                  onPress={() => save(running ? { startAt: at.toISOString(), endAt: null } : { startAt: at.toISOString(), endAt: woke.toISOString() })}
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
                <TimeRuler label={kind === 'temp' ? '잰 때' : '잰 날'} value={at} onChange={setAt} />
                <Button
                  size="lg"
                  label="저장"
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

/** 같이 먹인 것 — 비타민D, 유산균, 이 폰에서 더한 이름. 고르면 그 수유 시각에 루틴 완료로 남는다(SPEC-LOG-01) */
const WITH_KEY = 'feed.with';
const WITH_DEFAULT = ['비타민D', '유산균'];

function WithChips({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const c = useTheme();
  const [names, setNames] = useState<string[]>(WITH_DEFAULT);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    void readSetting(WITH_KEY).then((v) => {
      try {
        const saved = v ? (JSON.parse(v) as string[]) : [];
        setNames([...WITH_DEFAULT, ...saved.filter((x) => !WITH_DEFAULT.includes(x))]);
      } catch {
        // 깨진 값이면 기본만
      }
    });
  }, []);
  const toggle = (name: string) => {
    tap();
    onChange(selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name]);
  };
  const addName = () => {
    const name = draft.trim().slice(0, 20);
    setAdding(false);
    setDraft('');
    if (!name) return;
    if (!names.includes(name)) {
      const next = [...names, name];
      setNames(next);
      void writeSetting(WITH_KEY, JSON.stringify(next.filter((x) => !WITH_DEFAULT.includes(x))));
    }
    if (!selected.includes(name)) onChange([...selected, name]);
  };
  return (
    <View style={styles.group}>
      <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
        같이 먹인 것
      </ThemedText>
      <View style={styles.chips}>
        {names.map((n) => (
          <Chip key={n} label={n} icon={selected.includes(n) ? 'checkmark' : undefined} selected={selected.includes(n)} onPress={() => toggle(n)} />
        ))}
        {adding ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addName}
            onBlur={addName}
            placeholder="예: 철분"
            placeholderTextColor={c.textTertiary}
            returnKeyType="done"
            accessibilityLabel="같이 먹인 것 이름"
            style={[styles.withInput, { borderColor: c.border, color: c.text }]}
          />
        ) : (
          <Chip label="추가" icon="add" onPress={() => setAdding(true)} />
        )}
      </View>
    </View>
  );
}

/** 수유 메모 — 기록 화면에 함께 보인다 */
function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
        메모
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="예: 트림을 두 번 했어요"
        placeholderTextColor={c.textTertiary}
        maxLength={200}
        accessibilityLabel="메모"
        style={[styles.note, { backgroundColor: c.surface, color: c.text }]}
      />
    </View>
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
  withInput: { minWidth: 110, height: 36, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, fontFamily: FontFamily.semibold, fontSize: 14 },
  note: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontFamily: FontFamily.regular, fontSize: 15 },
});
