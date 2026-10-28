/**
 * 홈 「오늘 할 루틴」 작은 버튼 (SPEC-MAIN-08, task today/007) — 아이콘 · 이름 · 상태 한 줄을 3열로.
 *
 * 루틴 화면 버튼(routine-grid)을 작게 줄인 것이다. 누르면 같이 완료(단계 · 재고 확인은 시트), 길게 누르면 편집.
 * 오늘 할 루틴만 받고 자르지 않는다 — 홈에서 바로 완료하는 것이 이 칸의 쓸모다. 추가 · 추천은 루틴 화면에 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth } from '@/constants/theme';
import { hasSteps, scheduleLabel, statusLine, timeLabel, type Routine, type TodayState } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 3;
const GAP = 8;

/** 상태 한 줄 — 루틴 화면 버튼과 같되, 시작 전인 단계 루틴의 「· 4단계」는 좁은 칸이라 뺀다 */
function miniLine(r: Routine, s: TodayState): { text: string; done: boolean } {
  const line = statusLine(r, s);
  if (s.due && !line.done && !s.skipped && hasSteps(r) && s.stepsDone.length === 0) {
    return { text: r.time ? timeLabel(r.time) : scheduleLabel(r), done: false };
  }
  return line;
}

export function RoutineMini({
  items,
  onCheck,
  onEdit,
}: {
  /** 보일 순서대로(todayPlan 의 today) */
  items: { r: Routine; s: TodayState }[];
  onCheck: (id: string) => void;
  onEdit: (routine: Routine) => void;
}) {
  const c = useTheme();
  const window = useWindowDimensions();
  const [width, setWidth] = useState(() => Math.min(window.width, MaxContentWidth) - Gutter * 2);
  const tileWidth = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map(({ r, s }) => {
        const line = miniLine(r, s);
        const done = line.done;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`${r.title}, ${line.text}`}
            onPress={() => {
              tap(s.firstAt ? 'light' : 'success');
              onCheck(r.id);
            }}
            onLongPress={() => onEdit(r)}
            delayLongPress={350}
            style={({ pressed }) => [
              styles.tile,
              {
                width: tileWidth,
                backgroundColor: done ? c.accentSoft : pressed ? c.surfaceStrong : c.surface,
                // 건너뛴 것은 흐리게
                opacity: s.skipped && !done ? 0.5 : pressed && done ? 0.8 : 1,
              },
            ]}>
            <View style={[styles.iconCircle, { backgroundColor: done ? c.accent : c.background }]}>
              {done ? <Ionicons name="checkmark" size={16} color={c.onInk} /> : <RoutineIcon title={r.title} size={17} color={c.text} />}
            </View>
            <View>
              <ThemedText type="small" numberOfLines={1} style={styles.name}>
                {r.title}
              </ThemedText>
              <ThemedText type="caption" numberOfLines={1} style={{ color: done ? c.accentText : c.textSecondary, fontWeight: done ? 600 : 400 }}>
                {line.text}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: 16, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 11, gap: 6 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: 700 },
});
