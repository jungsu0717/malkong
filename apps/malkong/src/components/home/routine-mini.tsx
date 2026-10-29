/**
 * 홈 「오늘 할 루틴」 작은 버튼 (SPEC-MAIN-08, task today/007 · 011) — 아이콘 · 이름 · 상태 한 줄, 옆으로 넘기는 한 줄.
 *
 * 루틴 화면 버튼(routine-grid)을 작게 줄인 것이다. 누르면 같이 완료(단계 · 재고 확인은 시트), 길게 누르면 편집.
 * 오늘 할 루틴만 받고 자르지 않는다 — 홈에서 바로 완료하는 것이 이 칸의 쓸모다. 추가 · 추천은 루틴 화면에 있다.
 * 루틴이 늘어도 홈 길이가 그대로이게 높이를 고정하고 옆으로 넘긴다(Julian, 2026-10-29). 줄은 화면 오른쪽 끝까지 닿아
 * 다음 버튼이 조금 보이고, 그래서 넘길 수 있는 것을 안다. 버튼은 회색 바탕 위의 흰 카드(`card`).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter } from '@/constants/theme';
import { hasSteps, scheduleLabel, statusLine, timeLabel, type Routine, type TodayState } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

/** 버튼 너비 — 390pt 폰에서 셋과 넷째의 앞부분이 보인다 */
const TILE = 104;
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

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row}>
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
                backgroundColor: done ? c.accentSoft : pressed ? c.surfaceStrong : c.card,
                // 건너뛴 것은 흐리게
                opacity: s.skipped && !done ? 0.5 : pressed && done ? 0.8 : 1,
              },
            ]}>
            <View style={[styles.iconCircle, { backgroundColor: done ? c.accent : c.page }]}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 본문 여백을 넘어 화면 양 끝까지 — 넘기면 버튼이 화면 끝에서 사라진다
  strip: { marginHorizontal: -Gutter, flexGrow: 0 },
  row: { paddingHorizontal: Gutter, gap: GAP },
  tile: { width: TILE, borderRadius: 16, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 11, gap: 6 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: 700 },
});
