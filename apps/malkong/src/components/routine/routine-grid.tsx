/**
 * 루틴 화면 버튼 모음 (SPEC-MAIN-01 · 02 · 03, task today/002) — 루틴을 3열 버튼으로 한눈에 다 보인다.
 *
 * - 누르면 완료(연한 코랄 바탕에 코랄 체크 동그라미, 「08:10 완료」), 다시 누르면 되돌린다. 단계 · 재고 확인은 시트가 열린다
 * - 루틴 화면은 오늘 할 루틴만 넘긴다(다른 날 루틴은 화면 아래 한 줄, task today/003). 모양은 시안 C(task today/004)
 * - 편집 중이면 누르면 편집, 아니면 길게 눌러 편집. 마지막 칸은 「추가」
 * - 지금 시기 추천 중 아직 안 넣은 것이 점선 버튼으로 뒤따르고, 누르면 바로 추가, 길게 누르면 숨긴다(task today/005 · 006)
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth } from '@/constants/theme';
import { statusLine, templateDetail, type Routine, type RoutineTemplate, type TodayState } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 3;
const GAP = 8;

export function RoutineGrid({
  items,
  templates,
  editing,
  onCheck,
  onEdit,
  onAdd,
  onQuickAdd,
  onHideSuggestion,
}: {
  /** 보일 순서대로 */
  items: { r: Routine; s: TodayState }[];
  /** 루틴 뒤에 보일 추천 — 아직 안 넣고 숨기지 않은 것(recommend.ts gridSuggestions) */
  templates: RoutineTemplate[];
  editing: boolean;
  onCheck: (id: string) => void;
  onEdit: (routine: Routine) => void;
  onAdd: () => void;
  onQuickAdd: (t: RoutineTemplate) => void;
  /** 추천 버튼을 길게 눌러 숨긴다 */
  onHideSuggestion: (t: RoutineTemplate) => void;
}) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(() => Math.min(window.width, MaxContentWidth) - Gutter * 2);
  const tileWidth = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map(({ r, s }) => (
        <RoutineTile
          key={r.id}
          routine={r}
          state={s}
          width={tileWidth}
          editing={editing}
          onPress={() => {
            if (editing) return onEdit(r);
            tap(s.firstAt ? 'light' : 'success');
            onCheck(r.id);
          }}
          onLongPress={() => onEdit(r)}
        />
      ))}
      {templates.map((t) => (
        <TemplateTile key={t.title} template={t} width={tileWidth} onPress={() => onQuickAdd(t)} onLongPress={() => onHideSuggestion(t)} />
      ))}
      <AddTile width={tileWidth} onPress={onAdd} />
    </View>
  );
}

function RoutineTile({
  routine,
  state,
  width,
  editing,
  onPress,
  onLongPress,
}: {
  routine: Routine;
  state: TodayState;
  width: number;
  editing: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const c = useTheme();
  const line = statusLine(routine, state);
  const done = line.done;

  return (
    // 오늘 할 날이 아니거나 건너뛴 것은 흐리게
    <View style={{ width, opacity: state.due && !(state.skipped && !done) ? 1 : 0.5 }}>
      <Pressable
        accessibilityRole={editing ? 'button' : 'checkbox'}
        accessibilityState={editing ? undefined : { checked: done }}
        accessibilityLabel={editing ? `${routine.title} 편집` : `${routine.title}, ${line.text}`}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.tile,
          styles.fill,
          { backgroundColor: done ? c.accentSoft : pressed ? c.surfaceStrong : c.surface, opacity: pressed && done ? 0.8 : 1 },
        ]}>
        <View style={[styles.iconCircle, { backgroundColor: done ? c.accent : c.background }]}>
          {done ? <Ionicons name="checkmark" size={18} color={c.onInk} /> : <RoutineIcon title={routine.title} size={19} color={c.text} />}
        </View>

        {editing && (
          <View style={[styles.corner, styles.editMark, { backgroundColor: c.background }]}>
            <Ionicons name="pencil" size={12} color={c.text} />
          </View>
        )}

        <ThemedText type="body" numberOfLines={2} lineBreakStrategyIOS="hangul-word" style={styles.name}>
          {routine.title}
        </ThemedText>
        <ThemedText type="caption" numberOfLines={2} style={{ color: done ? c.accentText : c.textSecondary, fontWeight: done ? 600 : 400 }}>
          {/* 「오후 8:00 · 2단계」는 좁은 칸에서 낱말 가운데가 끊기지 않게 점에서 줄을 바꾼다 */}
          {line.text.replace(' · ', '\n')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** 아직 안 넣은 추천 버튼 — 누르면 바로 추가, 길게 누르면 숨긴다 */
function TemplateTile({
  template,
  width,
  onPress,
  onLongPress,
}: {
  template: RoutineTemplate;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const c = useTheme();
  const sub = templateDetail(template);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.title} 추가`}
      accessibilityHint="길게 누르면 이 추천을 숨겨요"
      onPress={() => {
        tap('success');
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={({ pressed }) => [styles.tile, styles.dashed, { width, borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' }]}>
      <View>
        <View style={[styles.iconCircle, { backgroundColor: c.surface }]}>
          <RoutineIcon title={template.title} size={19} color={c.textSecondary} />
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

function AddTile({ width, onPress }: { width: number; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="루틴 추가"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        styles.dashed,
        styles.addTile,
        { width, borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' },
      ]}>
      <Ionicons name="add" size={22} color={c.text} />
      <ThemedText type="label" style={{ fontWeight: 600 }}>
        추가
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { minHeight: 104, borderRadius: 18, padding: 12, gap: 4 },
  fill: { flexGrow: 1 },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 21,
    top: 21,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', top: 10, right: 10 },
  editMark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: 700, marginTop: 6 },
});
