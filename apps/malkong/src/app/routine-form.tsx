/**
 * 루틴 직접 만들기 · 편집 (SPEC-MAIN-03 · 05 · 06, task today/004) — 목록형 한 화면.
 *
 * 이름, 종류(체크 / 타이머 / 재고 확인), 반복(반복 고르기 창), 알림(스위치와 시각 — iOS 는 바퀴를 바로 아래에 펼치고
 * 안드로이드는 시계 창), 하루 목표(타이머), 단계(체크) · 확인할 물건(재고 확인). 편집이면 아래에 「오늘은 건너뛰기」와 「삭제」.
 * `id` 가 있으면 편집, 없으면 새 루틴이다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RepeatPicker, StepButton, type RepeatValue } from '@/components/routine/repeat-picker';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { INLINE_WHEEL, TimeWheel, pickTime } from '@/components/time-picker';
import { Button, Toggle, tap, type IconName } from '@/components/ui';
import { FontFamily, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { STOCK_ITEMS, scheduleLabel, timeLabel, todayState, type Routine, type RoutineKind } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useTheme } from '@/hooks/use-theme';

const KINDS: { kind: RoutineKind; label: string; hint: string }[] = [
  { kind: 'check', label: '체크', hint: '누르면 완료로 바뀌고, 완료한 시각이 기록돼요' },
  { kind: 'minutes', label: '타이머', hint: '타이머나 +1분 단추로 오늘 한 시간이 기록돼요' },
  { kind: 'stock', label: '재고 확인', hint: '물건마다 충분 · 부족을 고르면 부족한 것이 장보기에 추가돼요' },
];
/** 단계는 여덟 개, 확인할 물건은 스무 개까지 */
const MAX_ITEMS: Record<RoutineKind, number> = { check: 8, stock: 20, minutes: 0 };
const GOAL_STEP = 5;
const GOAL_MAX = 180;

export default function RoutineFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { routines, loading } = useRoutines();
  if (loading) return <ScreenLoading />;
  const routine = id ? (routines.find((r) => r.id === id) ?? null) : null;
  return <RoutineForm key={routine?.id ?? 'new'} routine={routine} />;
}

function RoutineForm({ routine }: { routine: Routine | null }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { logs, addRoutine, updateRoutine, removeRoutine, skipToday } = useRoutines();
  const [title, setTitle] = useState(routine?.title ?? '');
  const [kind, setKind] = useState<RoutineKind>(routine?.kind ?? 'check');
  const [repeat, setRepeat] = useState<RepeatValue>({ everyDays: routine?.everyDays ?? 1, weekdays: routine?.weekdays ?? null });
  const [time, setTime] = useState<string | null>(routine?.time ?? null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [goal, setGoal] = useState<number | null>(routine?.goalMinutes ?? null);
  const [items, setItems] = useState<string[]>(routine?.items ?? []);
  const [sheet, setSheet] = useState<'repeat' | 'items' | null>(null);
  const [today] = useState(() => new Date().getDay());
  const skipped = routine ? todayState(routine, logs).skipped : false;

  // 종류를 바꾸면 단계 · 물건 목록도 그 종류의 처음 것으로 — 원래 종류로 돌아오면 원래 목록
  const changeKind = (k: RoutineKind) => {
    if (k === kind) return;
    tap();
    setKind(k);
    if (routine && routine.kind === k) setItems(routine.items ?? []);
    else setItems(k === 'stock' ? STOCK_ITEMS : []);
  };
  const setAlarm = (on: boolean) => {
    if (!on) {
      setTime(null);
      setWheelOpen(false);
      return;
    }
    // 다음 정시로 켜 두고 바로 고르게 한다
    const next = `${String((new Date().getHours() + 1) % 24).padStart(2, '0')}:00`;
    setTime(next);
    if (INLINE_WHEEL) setWheelOpen(true);
    else pickTime(next, setTime);
  };
  const openTime = () => {
    if (!time) return;
    tap();
    if (INLINE_WHEEL) setWheelOpen((v) => !v);
    else pickTime(time, setTime);
  };

  const cleaned = items.map((x) => x.trim()).filter(Boolean).slice(0, MAX_ITEMS[kind]);
  const canSave = !!title.trim() && (kind !== 'stock' || cleaned.length > 0);
  const save = () => {
    const input = {
      title: title.trim(),
      kind,
      everyDays: repeat.everyDays,
      weekdays: repeat.weekdays,
      time,
      goalMinutes: kind === 'minutes' ? goal : null,
      items: kind === 'minutes' || cleaned.length === 0 ? null : cleaned,
    };
    void (routine ? updateRoutine(routine.id, input) : addRoutine(input));
    router.back();
  };
  const hint = KINDS.find((k) => k.kind === kind)!.hint;
  const itemsLabel = kind === 'check' ? '단계' : '확인할 물건';
  const itemsValue = cleaned.length === 0 ? '없음' : kind === 'check' ? `${cleaned.length}단계` : `${cleaned.length}개`;

  return (
    <View style={[styles.screen, { backgroundColor: c.surface }]}>
      <SafeAreaView style={styles.flex} edges={Platform.OS === 'ios' ? [] : ['top']}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.headerSide}>
            <ThemedText type="body">취소</ThemedText>
          </Pressable>
          <ThemedText type="heading" style={styles.headerTitle}>
            {routine ? '루틴 편집' : '새 루틴'}
          </ThemedText>
          <View style={styles.headerSide} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[styles.name, { color: c.text, backgroundColor: c.background }]}
              value={title}
              onChangeText={setTitle}
              placeholder="이름 (예: 로션 바르기)"
              placeholderTextColor={c.textTertiary}
              maxLength={30}
              accessibilityLabel="이름"
            />

            <View style={styles.kindBlock}>
              <View accessibilityRole="radiogroup" accessibilityLabel="종류" style={[styles.segment, { backgroundColor: c.surfaceStrong }]}>
                {KINDS.map((k) => {
                  const on = k.kind === kind;
                  return (
                    <Pressable
                      key={k.kind}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => changeKind(k.kind)}
                      style={[styles.segmentItem, on && [styles.segmentOn, { backgroundColor: c.background }]]}>
                      <ThemedText type="label" style={{ color: on ? c.text : c.textSecondary, fontWeight: on ? 700 : 400 }}>
                        {k.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="caption" style={[styles.pad, { color: c.textSecondary }]}>
                {hint}
              </ThemedText>
            </View>

            <View style={[styles.card, { backgroundColor: c.background }]}>
              <Row icon="repeat" label="반복" value={scheduleLabel(repeat)} onPress={() => setSheet('repeat')} />
              <Line />
              <View style={styles.row}>
                <Ionicons name="notifications-outline" size={20} color={c.textSecondary} />
                <ThemedText type="body" style={styles.flex}>
                  알림
                </ThemedText>
                {time && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`알림 시각 ${timeLabel(time)}, 바꾸기`}
                    onPress={openTime}
                    style={[styles.timePill, { backgroundColor: c.accentSoft }]}>
                    <ThemedText type="body" style={{ color: c.accentText, fontWeight: 700 }}>
                      {timeLabel(time)}
                    </ThemedText>
                  </Pressable>
                )}
                <Toggle value={!!time} onChange={setAlarm} label="알림" />
              </View>
              {time && wheelOpen && (
                <View style={styles.wheel}>
                  <TimeWheel value={time} onChange={setTime} />
                </View>
              )}
              {kind === 'minutes' ? (
                <>
                  <Line />
                  <View style={styles.row}>
                    <Ionicons name="timer-outline" size={20} color={c.textSecondary} />
                    <ThemedText type="body" style={styles.flex}>
                      하루 목표
                    </ThemedText>
                    <StepButton
                      icon="remove"
                      label="5분 줄이기"
                      disabled={!goal}
                      onPress={() => {
                        tap();
                        setGoal((g) => (g && g > GOAL_STEP ? g - GOAL_STEP : null));
                      }}
                    />
                    <ThemedText type="body" style={[styles.goal, { color: goal ? c.text : c.textSecondary }]}>
                      {goal ? `${goal}분` : '없음'}
                    </ThemedText>
                    <StepButton
                      icon="add"
                      label="5분 늘리기"
                      disabled={(goal ?? 0) >= GOAL_MAX}
                      onPress={() => {
                        tap();
                        setGoal((g) => Math.min(GOAL_MAX, (g ?? 0) + GOAL_STEP));
                      }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Line />
                  <Row
                    icon={kind === 'check' ? 'list-outline' : 'cube-outline'}
                    label={itemsLabel}
                    value={itemsValue}
                    onPress={() => setSheet('items')}
                  />
                </>
              )}
            </View>
            {kind === 'stock' && cleaned.length === 0 && (
              <ThemedText type="caption" style={[styles.pad, { color: c.accentText }]}>
                확인할 물건을 하나 이상 넣어 주세요
              </ThemedText>
            )}

            {routine && (
              <View style={[styles.card, { backgroundColor: c.background }]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void skipToday(routine.id);
                    router.back();
                  }}
                  style={styles.row}>
                  <ThemedText type="body">{skipped ? '건너뛰기 취소' : '오늘은 건너뛰기'}</ThemedText>
                </Pressable>
                <Line inset={16} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void removeRoutine(routine.id);
                    router.back();
                  }}
                  style={styles.row}>
                  <ThemedText type="body" style={{ color: c.danger }}>
                    삭제
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </ScrollView>

          <View style={[styles.bottom, { paddingBottom: Spacing.three + insets.bottom }]}>
            <Button size="lg" label={routine ? '저장' : '추가'} disabled={!canSave} onPress={save} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <RepeatPicker
        key={sheet === 'repeat' ? 'repeat-open' : 'repeat-closed'}
        open={sheet === 'repeat'}
        value={repeat}
        today={today}
        onDone={(v) => {
          setRepeat(v);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <ItemsSheet
        key={sheet === 'items' ? `items-${kind}` : 'items-closed'}
        open={sheet === 'items'}
        kind={kind}
        items={items}
        onDone={(next) => {
          setItems(next);
          setSheet(null);
        }}
      />
    </View>
  );
}

function Row({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface }]}>
      <Ionicons name={icon} size={20} color={c.textSecondary} />
      <ThemedText type="body" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type="body" style={{ color: c.textSecondary }}>
        {value}
      </ThemedText>
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

/** 줄 사이 선 — 아이콘이 있는 줄은 글자 앞(48)부터, 아이콘 없는 줄은 16부터 */
function Line({ inset = 48 }: { inset?: number }) {
  const c = useTheme();
  return <View style={[styles.line, { backgroundColor: c.divider, marginLeft: inset }]} />;
}

/** 단계 · 확인할 물건 고치기 — 닫으면(바깥을 눌러도) 적은 대로 남는다 */
function ItemsSheet({
  open,
  kind,
  items,
  onDone,
}: {
  open: boolean;
  kind: RoutineKind;
  items: string[];
  onDone: (items: string[]) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<string[]>(() => (items.length ? items : ['']));
  const isStep = kind === 'check';
  const done = () => onDone(draft.map((x) => x.trim()).filter(Boolean));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={done}>
      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={done} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <View style={styles.pad}>
            <ThemedText type="title">{isStep ? '단계' : '확인할 물건'}</ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {isStep ? '밤잠 준비처럼 순서대로 하는 일이면 단계를 나눠 체크할 수 있어요' : '부족을 고른 물건은 장보기에 추가돼요'}
            </ThemedText>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.itemsList}>
            <View style={[styles.card, { backgroundColor: c.background }]}>
              {draft.map((item, i) => (
                <View key={i}>
                  {i > 0 && <Line />}
                  <View style={styles.row}>
                    {isStep && (
                      <ThemedText type="label" style={[styles.stepNo, { color: c.textSecondary }]}>
                        {i + 1}
                      </ThemedText>
                    )}
                    <TextInput
                      style={[styles.itemInput, { color: c.text }]}
                      value={item}
                      onChangeText={(v) => setDraft((prev) => prev.map((x, j) => (j === i ? v : x)))}
                      placeholder={isStep ? `${i + 1}단계` : '물건 이름'}
                      placeholderTextColor={c.textTertiary}
                      maxLength={30}
                      accessibilityLabel={isStep ? `${i + 1}단계` : `물건 ${i + 1}`}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item || (isStep ? `${i + 1}단계` : '물건')} 빼기`}
                      hitSlop={8}
                      onPress={() => setDraft((prev) => prev.filter((_, j) => j !== i))}>
                      <Ionicons name="close-circle" size={22} color={c.textTertiary} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {draft.length < MAX_ITEMS[kind] && (
                <>
                  {draft.length > 0 && <Line />}
                  <Pressable accessibilityRole="button" onPress={() => setDraft((prev) => [...prev, ''])} style={styles.row}>
                    <Ionicons name="add" size={20} color={c.accentText} />
                    <ThemedText type="body" style={{ color: c.accentText, fontWeight: 600 }}>
                      {isStep ? '단계 추가' : '물건 추가'}
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
          <Button size="lg" label="완료" onPress={done} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  headerSide: { minWidth: 56 },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: 700 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: 14,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  name: {
    borderRadius: Radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    fontFamily: FontFamily.bold,
  },
  kindBlock: { gap: 6 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14 },
  segmentItem: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { boxShadow: '0 1px 3px rgba(22, 22, 26, 0.1)' },
  pad: { paddingHorizontal: 4, gap: 2 },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { height: StyleSheet.hairlineWidth * 2 },
  timePill: { height: 32, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  wheel: { paddingHorizontal: 16, alignItems: 'stretch' },
  goal: { minWidth: 52, textAlign: 'center', fontWeight: 700 },
  bottom: { paddingHorizontal: 20, paddingTop: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, gap: 14, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  itemsList: { paddingBottom: Spacing.one },
  stepNo: { width: 20, textAlign: 'center', fontWeight: 700 },
  itemInput: { flex: 1, fontSize: 16, fontFamily: FontFamily.regular, paddingVertical: 12 },
});
