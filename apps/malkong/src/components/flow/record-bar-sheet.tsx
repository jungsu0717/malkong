/**
 * 기록 단추 편집 (SPEC-MAIN-08, task today/029, decisions/046) — 위쪽 기록 단추 줄 맨 끝 「편집」에서 연다.
 *
 * 「보이는 단추」는 왼쪽 −로 빼고, 오른쪽 손잡이를 끌어서 순서를 바꾼다. 「추가할 수 있는 단추」는 +로 넣는다.
 * 아직 루틴이 아닌 단추(목욕, 놀이, 병원 …)와 「직접 만들기」는 넣을 때 「반복할까요?」를 묻고 루틴으로 만든다 — 반복하면 할 날에 흐름에 보이고, 알림도 정할 수 있다.
 * 「완료」를 눌러야 줄이 바뀐다. 루틴을 줄에서 빼도 루틴은 지우지 않는다(루틴 화면에 그대로).
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { StepButton } from '@/components/routine/repeat-picker';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { INLINE_WHEEL, TimeWheel, pickTime } from '@/components/time-picker';
import { KIND_UI } from '@/components/log/kinds';
import { tap, Toggle } from '@/components/ui';
import type { IntakeKind } from '@/data/events';
import { usePreferences } from '@/data/preferences-context';
import {
  arrangeBar,
  barAfterEdit,
  BAR_KIND_NAME,
  BAR_KINDS,
  isBarKind,
  moveKey,
  routineIdOf,
  routineKey,
  startersFor,
  type BarKey,
  type BarKind,
  type Starter,
} from '@/data/record-bar';
import { isTimed, scheduleLabel, timeLabel, titleKey, type Routine } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useTheme } from '@/hooks/use-theme';

/** 한 줄 높이 — 끌 때 몇 줄 옮겼는지 센다 */
const ROW_H = 58;
const KIND_SUB: Record<BarKind, string> = {
  breast: '시간 재기, 왼쪽과 오른쪽',
  formula: '양',
  diaper: '소변, 대변, 변 색',
  sleep: '시간 재기',
  temp: '온도',
  solid: '양과 메뉴',
  pumped: '양',
  pump: '양',
  milk: '양',
  water: '양',
  snack: '메모',
};
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const CUSTOM: Starter = { title: '', everyDays: 0, time: '10:00' };

export function RecordBarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: 12 + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          {open && <Body onClose={onClose} />}
        </View>
      </View>
    </Modal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const c = useTheme();
  const { routines, addRoutine } = useRoutines();
  const { recordBar, setRecordBar } = usePreferences();
  const ids = routines.map((r) => r.id);
  const [list, setList] = useState<BarKey[]>(() => arrangeBar(recordBar, ids).shown);
  const [adding, setAdding] = useState<Starter | null>(null);
  const [drag, setDrag] = useState<{ key: BarKey; start: number; dy: number } | null>(null);
  const dragRef = useRef<{ key: BarKey; start: number } | null>(null);
  const listRef = useRef(list);
  useEffect(() => {
    listRef.current = list;
  }, [list]);

  const all: BarKey[] = [...BAR_KINDS, ...ids.map(routineKey)];
  const more = all.filter((k) => !list.includes(k));
  const starters = startersFor(routines.map((r) => r.title));
  const routineOf = (k: BarKey) => routines.find((r) => r.id === routineIdOf(k)) ?? null;

  const done = () => {
    tap('success');
    void setRecordBar(barAfterEdit(list, ids)).catch(() => undefined);
    onClose();
  };

  // 손잡이의 손짓은 한 번 만들어 두고 쓴다 — 끄는 도중에 바뀌면 움직인 거리를 잃는다
  const startDrag = useCallback((key: BarKey) => {
    const start = listRef.current.indexOf(key);
    dragRef.current = { key, start };
    setDrag({ key, start, dy: 0 });
    tap();
  }, []);
  const moveDrag = useCallback((dy: number) => {
    const d = dragRef.current;
    if (!d) return;
    setList((prev) => {
      const target = Math.max(0, Math.min(prev.length - 1, d.start + Math.round(dy / ROW_H)));
      const from = prev.indexOf(d.key);
      return from === target ? prev : moveKey(prev, from, target);
    });
    setDrag({ ...d, dy });
  }, []);
  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  if (adding) {
    return (
      <AddForm
        starter={adding}
        onCancel={() => setAdding(null)}
        onAdd={async (input) => {
          const have = routines.find((r) => titleKey(r.title) === titleKey(input.title));
          const r = have ?? (await addRoutine({ ...input, kind: 'check', items: null }));
          const key = routineKey(r.id);
          setList((prev) => (prev.includes(key) ? prev : [...prev, key]));
          setAdding(null);
        }}
      />
    );
  }

  return (
    <>
      <Header left="취소" title="기록 단추 편집" right="완료" onLeft={onClose} onRight={done} />
      <ScrollView scrollEnabled={!drag} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Section label="보이는 단추" note="끌어서 순서를 바꿔요">
          {list.map((k, i) => {
            const r = routineOf(k);
            const lifted = drag?.key === k;
            const shift = lifted ? drag.dy - (i - drag.start) * ROW_H : 0;
            return (
              <View
                key={k}
                style={[
                  styles.rowWrap,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider },
                  lifted && [styles.lifted, { backgroundColor: c.background, shadowColor: c.text, transform: [{ translateY: shift }] }],
                ]}>
                <EditRow
                  barKey={k}
                  routine={r}
                  mode="on"
                  onToggle={() => {
                    tap();
                    setList((prev) => prev.filter((x) => x !== k));
                  }}
                  grip={<Grip barKey={k} label={`${isBarKind(k) ? BAR_KIND_NAME[k] : (r?.title ?? '')} 순서 바꾸기`} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
                />
              </View>
            );
          })}
          {list.length === 0 && (
            <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
              아래에서 단추를 추가해 주세요
            </ThemedText>
          )}
        </Section>

        <Section label="추가할 수 있는 단추">
          {more.map((k, i) => (
            <View key={k} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider } : null}>
              <EditRow
                barKey={k}
                routine={routineOf(k)}
                mode="off"
                onToggle={() => {
                  tap();
                  setList((prev) => [...prev, k]);
                }}
              />
            </View>
          ))}
          {starters.map((s, i) => (
            <View key={s.title} style={more.length + i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider } : null}>
              <StarterRow
                title={s.title}
                sub=""
                onPress={() => {
                  tap();
                  setAdding(s);
                }}
              />
            </View>
          ))}
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }}>
            <StarterRow
              title="직접 만들기"
              sub="이름을 정해서 추가해요"
              custom
              onPress={() => {
                tap();
                setAdding(CUSTOM);
              }}
            />
          </View>
        </Section>
      </ScrollView>
    </>
  );
}

function Header({ left, title, right, rightDisabled = false, onLeft, onRight }: { left: string; title: string; right: string; rightDisabled?: boolean; onLeft: () => void; onRight: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onLeft} style={styles.headSide}>
        <ThemedText type="body" style={{ color: c.textSecondary }}>
          {left}
        </ThemedText>
      </Pressable>
      <ThemedText type="heading" numberOfLines={1} style={styles.headTitle}>
        {title}
      </ThemedText>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: rightDisabled }} disabled={rightDisabled} hitSlop={8} onPress={onRight} style={[styles.headSide, styles.headRight]}>
        <ThemedText type="body" style={{ color: c.accent, fontWeight: 700, opacity: rightDisabled ? 0.4 : 1 }}>
          {right}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Section({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="label" style={{ color: c.textSecondary }}>
          {label}
        </ThemedText>
        {note && (
          <ThemedText type="caption" style={{ color: c.textTertiary }}>
            {note}
          </ThemedText>
        )}
      </View>
      <View style={[styles.box, { backgroundColor: c.background }]}>{children}</View>
    </View>
  );
}

/** 기록 종류 · 루틴 단추 한 줄 — 왼쪽 − / +, 아이콘, 이름과 설명, 오른쪽 손잡이 */
function EditRow({ barKey, routine, mode, onToggle, grip }: { barKey: BarKey; routine: Routine | null; mode: 'on' | 'off'; onToggle: () => void; grip?: React.ReactNode }) {
  const c = useTheme();
  const kind = isBarKind(barKey) ? barKey : null;
  const name = kind ? BAR_KIND_NAME[kind] : (routine?.title ?? '');
  const sub = kind ? KIND_SUB[kind] : routine ? [scheduleLabel(routine), routine.time ? `${timeLabel(routine.time)} 알림` : null, isTimed(routine) ? '시간 재기' : null].filter(Boolean).join(', ') : '';
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'on' ? `${name} 빼기` : `${name} 추가`}
        hitSlop={8}
        onPress={onToggle}
        style={[styles.sign, { backgroundColor: mode === 'on' ? c.accent : c.ink }]}>
        <Ionicons name={mode === 'on' ? 'remove' : 'add'} size={16} color={c.onInk} />
      </Pressable>
      <KindTile kind={kind} title={name} />
      <View style={styles.flex}>
        <ThemedText type="body" numberOfLines={1} style={styles.rowTitle}>
          {name}
        </ThemedText>
        {sub ? (
          <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary }}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      {grip}
    </View>
  );
}

/** 아직 루틴이 아닌 단추 — 누르면 반복을 묻는다 */
function StarterRow({ title, sub, custom = false, onPress }: { title: string; sub: string; custom?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} 추가`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface }]}>
      <View style={[styles.sign, { backgroundColor: c.ink }]}>
        <Ionicons name="add" size={16} color={c.onInk} />
      </View>
      {custom ? (
        <View style={[styles.tile, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.flowLine }]}>
          <Ionicons name="create-outline" size={17} color={c.textSecondary} />
        </View>
      ) : (
        <KindTile kind={null} title={title} />
      )}
      <View style={styles.flex}>
        <ThemedText type="body" numberOfLines={1} style={styles.rowTitle}>
          {title}
        </ThemedText>
        {sub ? (
          <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary }}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

function KindTile({ kind, title }: { kind: BarKind | null; title: string }) {
  const c = useTheme();
  if (kind === 'breast') return <View style={[styles.tile, { backgroundColor: c.accent }]}><Ionicons name="heart-outline" size={17} color="#FFFFFF" /></View>;
  if (kind === 'formula') return <View style={[styles.tile, { backgroundColor: c.accent }]}><BottleIcon size={17} color="#FFFFFF" /></View>;
  if (kind === 'diaper') return <View style={[styles.tile, { backgroundColor: c.peeBg, borderWidth: 1.5, borderColor: c.peeLine }]}><Ionicons name="water-outline" size={16} color={c.peeFg} /></View>;
  if (kind === 'sleep') return <View style={[styles.tile, { backgroundColor: c.ink }]}><ZzIcon size={16} color={c.onInk} /></View>;
  if (kind === 'temp') return <View style={[styles.tile, { backgroundColor: c.tempBg, borderWidth: 1.5, borderColor: c.tempLine }]}><Ionicons name="thermometer-outline" size={16} color={c.tempFg} /></View>;
  if (kind === 'pumped') return <View style={[styles.tile, { backgroundColor: c.accentSoft }]}><BottleIcon size={17} color={c.accent} /></View>;
  if (kind) return <View style={[styles.tile, { backgroundColor: c.accentSoft }]}><Ionicons name={KIND_UI[kind as IntakeKind].icon} size={16} color={c.accent} /></View>;
  return (
    <View style={[styles.tile, { backgroundColor: c.doneBg, borderWidth: 1.5, borderColor: c.doneLine }]}>
      <RoutineIcon title={title} size={16} color={c.doneFg} />
    </View>
  );
}

/** 끌어서 순서를 바꾸는 손잡이 — 손잡이를 잡으면 목록 스크롤을 멈춘다 */
function Grip({ barKey, label, onStart, onMove, onEnd }: { barKey: BarKey; label: string; onStart: (key: BarKey) => void; onMove: (dy: number) => void; onEnd: () => void }) {
  const c = useTheme();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => onStart(barKey),
        onPanResponderMove: (_, g) => onMove(g.dy),
        onPanResponderRelease: () => onEnd(),
        onPanResponderTerminate: () => onEnd(),
      }),
    [barKey, onStart, onMove, onEnd],
  );
  return (
    <View {...pan.panHandlers} accessibilityLabel={label} style={styles.grip}>
      <Ionicons name="reorder-two-outline" size={22} color={c.textTertiary} />
    </View>
  );
}

type RepeatChoice = 'none' | 'daily' | 'every' | 'weekdays';

/** 단추를 추가하면서 반복을 묻는다 — 이름, 「반복할까요?」, 반복하면 알림 */
function AddForm({ starter, onCancel, onAdd }: { starter: Starter; onCancel: () => void; onAdd: (input: { title: string; everyDays: number; weekdays: number[] | null; time: string | null }) => Promise<void> }) {
  const c = useTheme();
  const [title, setTitle] = useState(starter.title);
  const [repeat, setRepeat] = useState<RepeatChoice>(starter.everyDays === 0 ? 'none' : starter.everyDays === 1 ? 'daily' : 'every');
  const [every, setEvery] = useState(starter.everyDays > 1 ? starter.everyDays : 2);
  const [days, setDays] = useState<number[]>([new Date().getDay()]);
  const [alarm, setAlarm] = useState(false);
  const [time, setTime] = useState(starter.time);
  const [wheel, setWheel] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = title.trim();
  const repeating = repeat !== 'none';

  const pick = (r: RepeatChoice) => {
    if (r !== repeat) tap();
    setRepeat(r);
  };
  const add = async () => {
    if (!name || busy) return;
    tap('success');
    setBusy(true);
    const everyDays = repeat === 'none' ? 0 : repeat === 'daily' ? 1 : repeat === 'every' ? every : days.length === 7 ? 1 : 7;
    const weekdays = repeat === 'weekdays' && days.length < 7 ? [...days].sort((a, b) => a - b) : null;
    await onAdd({ title: name, everyDays, weekdays, time: repeating && alarm ? time : null }).catch(() => undefined);
    setBusy(false);
  };
  const check = <Ionicons name="checkmark" size={20} color={c.accent} />;
  const line = <View style={[styles.line, { backgroundColor: c.divider }]} />;

  return (
    <>
      <Header left="취소" title={starter.title || '직접 만들기'} right="추가" rightDisabled={!name || busy} onLeft={onCancel} onRight={() => void add()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.nameRow}>
          <KindTile kind={null} title={name || starter.title} />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="단추 이름"
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="단추 이름"
            maxLength={20}
            autoFocus={!starter.title}
            style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.text }]}
          />
        </View>

        <Section label="반복할까요?">
          {(
            [
              ['none', '반복 안 함'],
              ['daily', '매일'],
            ] as [RepeatChoice, string][]
          ).map(([r, label], i) => (
            <View key={r}>
              {i > 0 && line}
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: repeat === r }} onPress={() => pick(r)} style={styles.choice}>
                <ThemedText type="body" style={[styles.flex, repeat === r && styles.on]}>
                  {label}
                </ThemedText>
                {repeat === r && check}
              </Pressable>
            </View>
          ))}
          {line}
          <View accessibilityRole="radio" accessibilityState={{ checked: repeat === 'every' }} style={styles.choice}>
            <Pressable onPress={() => pick('every')} style={styles.flex} accessibilityLabel="며칠마다">
              <ThemedText type="body" style={repeat === 'every' && styles.on}>
                며칠마다
              </ThemedText>
            </Pressable>
            <StepButton icon="remove" label="하루 줄이기" disabled={every <= 2} onPress={() => (tap(), setRepeat('every'), setEvery((n) => Math.max(2, n - 1)))} />
            <ThemedText type="body" style={[styles.count, styles.on, { color: repeat === 'every' ? c.text : c.textSecondary }]}>
              {every}일마다
            </ThemedText>
            <StepButton icon="add" label="하루 늘리기" disabled={every >= 99} onPress={() => (tap(), setRepeat('every'), setEvery((n) => Math.min(99, n + 1)))} />
          </View>
          {line}
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: repeat === 'weekdays' }} onPress={() => pick('weekdays')} style={styles.choice}>
            <ThemedText type="body" style={[styles.flex, repeat === 'weekdays' && styles.on]}>
              요일 정하기
            </ThemedText>
            {repeat === 'weekdays' && check}
          </Pressable>
          {repeat === 'weekdays' && (
            <View style={styles.days}>
              {DAY_NAMES.map((d, i) => {
                const on = days.includes(i);
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${d}요일`}
                    onPress={() => {
                      tap();
                      setDays((prev) => (prev.includes(i) ? (prev.length > 1 ? prev.filter((x) => x !== i) : prev) : [...prev, i]));
                    }}
                    style={[styles.day, { backgroundColor: on ? c.ink : c.surface }]}>
                    <ThemedText type="label" style={{ color: on ? c.onInk : c.text, fontWeight: on ? 700 : 400 }}>
                      {d}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>

        {repeating && (
          <Section label="알림">
            <View style={styles.choice}>
              <ThemedText type="body" style={styles.flex}>
                {alarm ? `${timeLabel(time)}에 알려 드려요` : '알리지 않아요'}
              </ThemedText>
              {alarm && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`알림 시각 ${timeLabel(time)}, 바꾸기`}
                  onPress={() => (INLINE_WHEEL ? setWheel((v) => !v) : pickTime(time, setTime))}
                  style={[styles.timePill, { backgroundColor: c.accentSoft }]}>
                  <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
                    바꾸기
                  </ThemedText>
                </Pressable>
              )}
              <Toggle value={alarm} onChange={setAlarm} label="알림" />
            </View>
            {alarm && wheel && INLINE_WHEEL && (
              <View style={styles.wheel}>
                <TimeWheel value={time} onChange={setTime} />
              </View>
            )}
          </Section>
        )}

        <ThemedText type="caption" style={[styles.note, { color: c.textSecondary }]}>
          {repeating ? '반복하면 할 날마다 흐름에 미리 보여요' : '단추를 누를 때만 기록해요'}
        </ThemedText>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  headSide: { width: 64, height: 36, justifyContent: 'center' },
  headRight: { alignItems: 'flex-end' },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  section: { gap: 6, paddingTop: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  box: { borderRadius: 16, overflow: 'visible' },
  rowWrap: { borderRadius: 0 },
  lifted: { zIndex: 10, borderRadius: 14, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  sign: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  rowTitle: { fontWeight: 700, fontSize: 15, lineHeight: 20 },
  grip: { width: 40, height: ROW_H, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  empty: { paddingVertical: 16, textAlign: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 },
  input: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 16, fontWeight: 700 },
  choice: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { height: StyleSheet.hairlineWidth * 2, marginLeft: 16 },
  on: { fontWeight: 700 },
  count: { minWidth: 64, textAlign: 'center' },
  days: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  day: { flex: 1, aspectRatio: 1, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  timePill: { height: 30, paddingHorizontal: 10, borderRadius: 15, justifyContent: 'center' },
  wheel: { alignItems: 'center', paddingBottom: 8 },
  note: { paddingHorizontal: 4 },
});
