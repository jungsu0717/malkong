/**
 * 홈 「기록」 칸 (SPEC-MAIN-08 · SPEC-LOG-01~03, task log/003, decisions/036) — 하루에 여러 번 여는 이유.
 *
 * 흰 카드 하나에 위에서부터 재는 중(모유 · 잠, 바로 끝내기) · 마지막 수유가 얼마 전인지와 누가 남겼는지 · 단추 넷(모유 · 분유 · 기저귀 · 잠) ·
 * 오늘 합계 한 줄. 체온 · 키 · 몸무게와 날짜별 기록 · 그래프는 「전체 ›」의 기록 화면에 있다. 시트는 부르는 쪽이 `useLogActions` 로 둔다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { KIND_UI } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { agoLabel, clockLabel, durationLabel, eventTitle, lastFeed, lastFeedStart, todayStats } from '@/data/event-summary';
import { runningOf, type CareEvent, type EventKind } from '@/data/events';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/** 홈에서 바로 누르는 기록 — 하루에 여러 번 생기는 것만 */
const HOME_KINDS: EventKind[] = ['breast', 'formula', 'diaper', 'sleep'];

/** 재는 중 시계 — 「12:05」 · 「1:02:05」 */
function stopwatch(from: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function LogMini({
  events,
  onPress,
  onStop,
  onOpen,
}: {
  events: CareEvent[];
  /** 단추 하나 — 잠을 재는 중이면 끝내고, 그 밖에는 시트 */
  onPress: (kind: EventKind) => void;
  onStop: (e: CareEvent) => void;
  /** 기록 화면으로 */
  onOpen: () => void;
}) {
  const c = useTheme();
  const running = [runningOf(events, 'breast'), runningOf(events, 'sleep')].filter((e): e is CareEvent => e !== null);
  // 재는 중이면 1초마다 — 시계가 이 카드 안에서만 다시 그려지게 홈과 따로 센다
  const now = useNow(running.length > 0);
  const last = lastFeed(events);
  const lastStart = lastFeedStart(events);
  const today = todayStats(events, now);
  const sleeping = runningOf(events, 'sleep');

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      {running.map((e) => (
        <View key={e.id} style={[styles.running, { backgroundColor: c.accentSoft }]}>
          <View style={styles.flex}>
            <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
              {e.kind === 'sleep' ? '자는 중' : `모유 ${e.side === 'right' ? '오른쪽' : '왼쪽'}`} · {clockLabel(e.startAt)}부터
            </ThemedText>
            <ThemedText type="heading" style={styles.timer}>
              {stopwatch(e.startAt, now)}
            </ThemedText>
          </View>
          <Button label={e.kind === 'sleep' ? '수면 종료' : '종료'} size="sm" onPress={() => onStop(e)} />
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="기록 전체"
        onPress={onOpen}
        style={({ pressed }) => [styles.lastRow, pressed && { opacity: 0.6 }]}>
        <View style={styles.flex}>
          <ThemedText type="body" style={styles.lastTitle}>
            {last && lastStart ? `마지막 수유 ${agoLabel(lastStart, now)}` : '첫 수유를 기록해 보세요'}
          </ThemedText>
          <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary }}>
            {last && lastStart
              ? `${eventTitle(last, now)} · ${clockLabel(lastStart)}${last.by ? ` · ${last.by}` : ''}`
              : '아래 버튼으로 바로 기록할 수 있어요'}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
      </Pressable>

      <View style={styles.buttons}>
        {HOME_KINDS.map((kind) => {
          const on = kind === 'sleep' ? !!sleeping : kind === 'breast' && running.some((e) => e.kind === 'breast');
          const label = kind === 'sleep' && sleeping ? '수면 종료' : KIND_UI[kind].label;
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={`${label} 기록`}
              onPress={() => onPress(kind)}
              style={({ pressed }) => [styles.button, { backgroundColor: on ? c.accentSoft : pressed ? c.surfaceStrong : c.page }]}>
              <Ionicons name={KIND_UI[kind].icon} size={22} color={on ? c.accent : c.text} />
              <ThemedText type="caption" style={{ color: on ? c.accentText : c.text, fontWeight: 600 }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="caption" style={[styles.totals, { color: c.textSecondary }]}>
        오늘 수유 {today.feeds}번 · 기저귀 {today.diapers}번 · 잠 {durationLabel(today.sleepMin)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14, gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  running: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  timer: { fontVariant: ['tabular-nums'] },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  lastTitle: { fontWeight: 700 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minHeight: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  totals: { paddingHorizontal: 4 },
});
