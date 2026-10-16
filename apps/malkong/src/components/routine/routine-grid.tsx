/**
 * 오늘 탭 루틴 버튼 모음 (SPEC-MAIN-01 · 02 · 03, task today/002) — 루틴을 3열 버튼으로 한눈에 다 보인다.
 *
 * - 체크: 누르면 완료(아이콘에 코랄 체크, 「08:10 완료」), 다시 누르면 되돌린다
 * - 타이머: 누르면 타이머 시작 · 멈춤, 오른쪽 위 「+5분」
 * - 오늘 할 날이 아닌 N일마다 루틴도 흐리게 보인다(「내일」 「3일 뒤」). 눌러서 미리 완료할 수 있다
 * - 편집 중이면 누르면 편집, 아니면 길게 눌러 편집. 마지막 칸은 「추가」
 * - 루틴이 하나도 없으면 추천이 버튼으로 다 보이고, 누르면 바로 추가된다
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { ROUTINE_TEMPLATES, everyLabel, statusLine, timeLabel, type Routine, type RoutineTemplate, type TodayState } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 3;
const GAP = 8;

export function RoutineGrid({
  items,
  now,
  editing,
  onCheck,
  onAddMinutes,
  onTimer,
  onEdit,
  onAdd,
  onQuickAdd,
}: {
  /** 보일 순서대로 — 오늘 할 것 먼저 */
  items: { r: Routine; s: TodayState }[];
  now: Date;
  editing: boolean;
  onCheck: (id: string) => void;
  onAddMinutes: (id: string) => void;
  onTimer: (routine: Routine) => void;
  onEdit: (routine: Routine) => void;
  onAdd: () => void;
  onQuickAdd: (t: RoutineTemplate) => void;
}) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(() => Math.min(window.width, MaxContentWidth) - Gutter * 2);
  const tileWidth = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.length === 0
        ? ROUTINE_TEMPLATES.map((t) => <TemplateTile key={t.title} template={t} width={tileWidth} onPress={() => onQuickAdd(t)} />)
        : items.map(({ r, s }) => (
            <RoutineTile
              key={r.id}
              routine={r}
              state={s}
              now={now}
              width={tileWidth}
              editing={editing}
              onPress={() => {
                if (editing) return onEdit(r);
                if (r.kind === 'check') {
                  tap(s.firstAt ? 'light' : 'success');
                  return onCheck(r.id);
                }
                tap();
                onTimer(r);
              }}
              onLongPress={() => onEdit(r)}
              onAddMinutes={() => {
                tap('success');
                onAddMinutes(r.id);
              }}
            />
          ))}
      <AddTile width={tileWidth} label={items.length === 0 ? '직접 추가' : '추가'} onPress={onAdd} />
    </View>
  );
}

function RoutineTile({
  routine,
  state,
  now,
  width,
  editing,
  onPress,
  onLongPress,
  onAddMinutes,
}: {
  routine: Routine;
  state: TodayState;
  now: Date;
  width: number;
  editing: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onAddMinutes: () => void;
}) {
  const c = useTheme();
  const running = !!routine.runningSince;
  const line = statusLine(routine, state);
  const elapsed = running ? Math.max(0, Math.floor((now.getTime() - new Date(routine.runningSince!).getTime()) / 1000)) : 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const filled = line.done || running;
  const label =
    routine.kind === 'check'
      ? `${routine.title}, ${line.text}`
      : `${routine.title}, ${running ? `타이머 ${clock}` : line.text}, 누르면 타이머 ${running ? '멈춤' : '시작'}`;

  return (
    <Pressable
      accessibilityRole={routine.kind === 'check' && !editing ? 'checkbox' : 'button'}
      accessibilityState={routine.kind === 'check' && !editing ? { checked: line.done } : undefined}
      accessibilityLabel={editing ? `${routine.title} 편집` : label}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.tile,
        { width, backgroundColor: pressed ? c.surfaceStrong : c.surface, opacity: state.due || running ? 1 : 0.5 },
      ]}>
      <View>
        <View style={[styles.iconCircle, { backgroundColor: filled ? c.ink : c.background }]}>
          {running ? (
            <Ionicons name="stop" size={18} color={c.onInk} />
          ) : (
            <RoutineIcon title={routine.title} kind={routine.kind} size={22} color={filled ? c.onInk : c.text} />
          )}
        </View>
        {line.done && !running && (
          <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.surface }]}>
            <Ionicons name="checkmark" size={11} color={c.onInk} />
          </View>
        )}
      </View>

      {editing ? (
        <View style={[styles.corner, styles.editMark, { backgroundColor: c.background }]}>
          <Ionicons name="pencil" size={12} color={c.text} />
        </View>
      ) : routine.kind === 'minutes' && state.due ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${routine.title} 5분 더하기`}
          hitSlop={6}
          onPress={onAddMinutes}
          style={({ pressed }) => [styles.corner, styles.plus, { backgroundColor: pressed ? c.surfaceStrong : c.background }]}>
          <ThemedText type="caption" style={{ fontWeight: 700 }}>
            +5분
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="body" numberOfLines={2} lineBreakStrategyIOS="hangul-word" style={styles.name}>
        {routine.title}
      </ThemedText>
      <ThemedText
        type="caption"
        numberOfLines={1}
        style={{ color: running || line.done ? c.text : c.textSecondary, fontWeight: running || line.done ? 600 : 400 }}>
        {running ? clock : line.text}
      </ThemedText>
    </Pressable>
  );
}

/** 루틴이 하나도 없을 때의 추천 버튼 — 누르면 바로 추가된다 */
function TemplateTile({ template, width, onPress }: { template: RoutineTemplate; width: number; onPress: () => void }) {
  const c = useTheme();
  const sub = template.kind === 'minutes' ? '타이머' : template.time ? timeLabel(template.time) : everyLabel(template.everyDays);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.title} 추가`}
      onPress={() => {
        tap('success');
        onPress();
      }}
      style={({ pressed }) => [styles.tile, styles.dashed, { width, borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' }]}>
      <View>
        <View style={[styles.iconCircle, { backgroundColor: c.surface }]}>
          <RoutineIcon title={template.title} kind={template.kind} size={22} color={c.textSecondary} />
        </View>
        <View style={[styles.badge, { backgroundColor: c.ink, borderColor: c.background }]}>
          <Ionicons name="add" size={12} color={c.onInk} />
        </View>
      </View>
      <ThemedText type="body" numberOfLines={2} lineBreakStrategyIOS="hangul-word" style={styles.name}>
        {template.title}
      </ThemedText>
      <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary }}>
        {sub}
      </ThemedText>
    </Pressable>
  );
}

function AddTile({ width, label, onPress }: { width: number; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`루틴 ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        styles.dashed,
        styles.addTile,
        { width, borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' },
      ]}>
      <View style={[styles.iconCircle, { backgroundColor: c.surface }]}>
        <Ionicons name="add" size={22} color={c.text} />
      </View>
      <ThemedText type="label" style={{ fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { minHeight: 112, borderRadius: Radius.lg, padding: 12, gap: 4 },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 26,
    top: 26,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', top: 10, right: 10 },
  editMark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  plus: { height: 26, paddingHorizontal: 8, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: 600, marginTop: 6 },
});
