/**
 * 루틴 탭 시간순 보기 (SPEC-MAIN-01 · 02, task today/003) — 오늘 할 루틴을 알림 시각 순으로 한 줄씩.
 *
 * - 왼쪽에 시각(없으면 「하루 중」), 가운데 동그라미와 세로선, 오른쪽에 이름과 상태
 * - 체크 루틴은 줄이나 동그라미를 누르면 완료 ↔ 되돌림. 다음에 할 루틴은 동그라미 테두리가 코랄이고 이름 옆에 「다음」
 * - 타이머 루틴은 진행 막대(목표가 있을 때)와 「+1분」 「+2분」 「타이머」
 * - 길게 누르면 편집
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { clockLabel, countsDone, everyLabel, statusLine, timeLabel, type Routine, type TodayItem } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

export function RoutineTimeline({
  items,
  nextId,
  now,
  onCheck,
  onAddMinutes,
  onTimer,
  onEdit,
}: {
  items: TodayItem[];
  /** 다음에 할 루틴 — 「다음」 표시 */
  nextId: string | null;
  now: Date;
  onCheck: (id: string) => void;
  onAddMinutes: (id: string, minutes: number) => void;
  onTimer: (routine: Routine) => void;
  onEdit: (routine: Routine) => void;
}) {
  return (
    <View>
      {items.map((item, i) => (
        <Row
          key={item.r.id}
          item={item}
          next={item.r.id === nextId}
          last={i === items.length - 1}
          now={now}
          onCheck={() => onCheck(item.r.id)}
          onAddMinutes={(m) => onAddMinutes(item.r.id, m)}
          onTimer={() => onTimer(item.r)}
          onEdit={() => onEdit(item.r)}
        />
      ))}
    </View>
  );
}

function Row({
  item,
  next,
  last,
  now,
  onCheck,
  onAddMinutes,
  onTimer,
  onEdit,
}: {
  item: TodayItem;
  next: boolean;
  last: boolean;
  now: Date;
  onCheck: () => void;
  onAddMinutes: (minutes: number) => void;
  onTimer: () => void;
  onEdit: () => void;
}) {
  const c = useTheme();
  const { r, s } = item;
  const line = statusLine(r, s);
  const done = countsDone(r, s);
  const running = r.kind === 'minutes' && !!r.runningSince;
  const elapsed = running ? Math.max(0, Math.floor((now.getTime() - new Date(r.runningSince!).getTime()) / 1000)) : 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const doneText = s.firstAt ? (s.firstBy ? `${s.firstBy} · ${clockLabel(s.firstAt)} 완료` : `${clockLabel(s.firstAt)} 완료`) : '';
  // 시각은 왼쪽에 이미 있으니 상태 줄이 시각뿐이면 반복(「매일」 「2일마다」)을 보인다
  const sub = r.time && line.text === timeLabel(r.time) ? everyLabel(r.everyDays) : line.text;

  const toggle = () => {
    tap(done ? 'light' : 'success');
    onCheck();
  };

  return (
    <View style={styles.row}>
      <ThemedText
        type="caption"
        style={[styles.time, { color: next ? c.accentText : c.textSecondary, fontWeight: next ? 700 : 400 }]}>
        {r.time ? timeLabel(r.time) : '하루 중'}
      </ThemedText>

      <View style={styles.rail}>
        {r.kind === 'minutes' ? (
          <View style={[styles.dot, done ? { backgroundColor: c.ink } : { borderWidth: 2, borderColor: next ? c.accent : c.text }]}>
            <Ionicons name={done ? 'checkmark' : 'time-outline'} size={done ? 14 : 13} color={done ? c.onInk : c.text} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={r.title}
            hitSlop={10}
            onPress={toggle}
            style={[styles.dot, done ? { backgroundColor: c.ink } : { borderWidth: 2, borderColor: next ? c.accent : c.text }]}>
            {done && <Ionicons name="checkmark" size={14} color={c.onInk} />}
          </Pressable>
        )}
        {!last && <View style={[styles.line, { backgroundColor: c.border }]} />}
      </View>

      <Pressable
        accessibilityRole={r.kind === 'minutes' ? 'none' : 'button'}
        accessibilityLabel={r.kind === 'minutes' ? undefined : `${r.title}, ${done ? doneText : sub}`}
        onPress={r.kind === 'minutes' ? undefined : toggle}
        onLongPress={onEdit}
        delayLongPress={350}
        style={({ pressed }) => [styles.body, last && styles.bodyLast, pressed && r.kind !== 'minutes' && { opacity: 0.6 }]}>
        <View style={styles.titleRow}>
          <ThemedText type="body" style={{ fontWeight: 600, color: done ? c.textSecondary : c.text, flexShrink: 1 }} numberOfLines={1}>
            {r.title}
          </ThemedText>
          {next && (
            <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
              <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700, fontSize: 11 }}>
                다음
              </ThemedText>
            </View>
          )}
          {r.kind === 'minutes' && (
            <ThemedText type="caption" style={[styles.right, { color: c.textSecondary }]}>
              {running ? clock : line.text}
            </ThemedText>
          )}
        </View>

        {r.kind === 'minutes' ? (
          <>
            {r.goalMinutes ? (
              <View style={[styles.bar, { backgroundColor: c.surfaceStrong }]}>
                <View style={[styles.barFill, { backgroundColor: c.ink, width: `${Math.min(100, (s.minutes / r.goalMinutes) * 100)}%` }]} />
              </View>
            ) : null}
            <View style={styles.buttons}>
              {[1, 2].map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.title} ${m}분 더하기`}
                  onPress={() => {
                    tap('success');
                    onAddMinutes(m);
                  }}
                  style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
                  <ThemedText type="label" style={{ fontWeight: 700 }}>
                    +{m}분
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={running ? `${r.title} 타이머 멈추기` : `${r.title} 타이머 시작`}
                onPress={() => {
                  tap();
                  onTimer();
                }}
                style={[styles.pill, { backgroundColor: c.ink }]}>
                <Ionicons name={running ? 'stop' : 'play'} size={11} color={c.onInk} />
                <ThemedText type="label" style={{ fontWeight: 700, color: c.onInk }}>
                  {running ? '멈춤' : '타이머'}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <ThemedText type="caption" style={{ color: done ? c.text : c.textSecondary, fontWeight: done ? 600 : 400 }}>
            {done ? doneText : sub}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  time: { width: 58, paddingTop: 12, lineHeight: 22 },
  rail: { width: 28, alignItems: 'center', paddingTop: 11 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, marginTop: 4 },
  body: { flex: 1, paddingTop: 10, paddingBottom: 18, gap: 4 },
  bodyLast: { paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  right: { marginLeft: 'auto' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: { height: 6, borderRadius: 3 },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 16 },
});
