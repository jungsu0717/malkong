/**
 * 「지금」 노드 (SPEC-MAIN-08 · SPEC-LOG-01 · 02, task today/012) — 하루 흐름에서 지난 기록과 예정 사이에 있는 코랄 테두리 카드.
 *
 * 큰 글씨로 지금 상태(깨어 있는 시간, 자는 중 · 모유를 재는 중이면 시계), 그 아래 마지막 수유, 기록 버튼 넷과 「…」.
 * 모유를 재는 중이면 「종료」 · 「반대쪽」, 자는 중이면 「잠」 버튼이 「수면 종료」가 된다. 시계는 이 카드 안에서만 1초마다 다시 그린다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { KIND_UI } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { awakeMinutes, hhmm } from '@/data/day-flow';
import { agoLabel, durationLabel, lastFeedStart } from '@/data/event-summary';
import { runningOf, type CareEvent, type EventKind, type Side } from '@/data/events';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const KINDS: EventKind[] = ['breast', 'formula', 'diaper', 'sleep'];

/** 재는 중 시계 — 「12:05」 · 「1:02:05」 */
function stopwatch(from: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function NowNode({
  events,
  onPress,
  onStop,
  onStart,
  onMore,
}: {
  events: CareEvent[];
  /** 기록 버튼 — 잠을 재는 중이면 끝내고, 그 밖에는 입력 시트 */
  onPress: (kind: EventKind) => void;
  onStop: (e: CareEvent) => void;
  onStart: (kind: EventKind, side: Side | null) => void;
  onMore: () => void;
}) {
  const c = useTheme();
  const breast = runningOf(events, 'breast');
  const sleep = runningOf(events, 'sleep');
  const now = useNow(!!breast || !!sleep);
  const lastStart = lastFeedStart(events);
  const awake = awakeMinutes(events, now);

  const running = breast ?? sleep;
  const head = breast ? `모유 ${breast.side === 'right' ? '오른쪽' : '왼쪽'}` : sleep ? '자는 중' : null;
  const title = running
    ? stopwatch(running.startAt, now)
    : awake !== null
      ? `깨어 있어요 ${durationLabel(awake)}`
      : lastStart
        ? `마지막 수유 ${agoLabel(lastStart, now)}`
        : '첫 기록을 남겨 보세요';
  const sub =
    lastStart && (running || awake !== null)
      ? `마지막 수유 ${hhmm(lastStart)}, ${agoLabel(lastStart, now)}`
      : lastStart
        ? `${hhmm(lastStart)}에 시작했어요`
        : '아래 버튼을 누르면 바로 기록돼요';

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.accent }]}>
      <View style={styles.headRow}>
        <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700 }}>
          {head ? `지금 · ${head}` : '지금'}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {running ? `${hhmm(running.startAt)}부터` : hhmm(now)}
        </ThemedText>
      </View>
      <ThemedText type="display" style={[styles.title, running && styles.timer]}>
        {title}
      </ThemedText>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        {sub}
      </ThemedText>

      {breast && (
        <View style={styles.runRow}>
          <Button label="종료" variant="accent" size="sm" style={styles.flex} onPress={() => onStop(breast)} />
          <Button
            label="반대쪽"
            variant="secondary"
            size="sm"
            style={styles.flex}
            onPress={() => onStart('breast', breast.side === 'right' ? 'left' : 'right')}
          />
        </View>
      )}

      <View style={styles.buttons}>
        {KINDS.map((kind) => {
          const on = (kind === 'sleep' && !!sleep) || (kind === 'breast' && !!breast);
          const label = kind === 'sleep' && sleep ? '수면 종료' : KIND_UI[kind].label;
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={`${label} 기록`}
              onPress={() => onPress(kind)}
              style={({ pressed }) => [styles.button, { backgroundColor: on ? c.accentSoft : pressed ? c.surfaceStrong : c.surface }]}>
              <Ionicons name={KIND_UI[kind].icon} size={20} color={on ? c.accent : c.text} />
              <ThemedText type="caption" style={{ color: on ? c.accentText : c.text, fontWeight: 600 }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다른 기록과 루틴"
          onPress={() => {
            tap();
            onMore();
          }}
          style={({ pressed }) => [styles.more, { borderColor: c.border, backgroundColor: pressed ? c.surfaceStrong : c.card }]}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 4 },
  flex: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, lineHeight: 32, letterSpacing: -0.6 },
  timer: { fontVariant: ['tabular-nums'] },
  runRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 10 },
  button: { flex: 1, minHeight: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3 },
  more: { width: 44, minHeight: 58, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
