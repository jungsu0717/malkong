/**
 * 터미타임처럼 시간을 재는 루틴 (SPEC-MAIN-02, task today/020) — 「지금 시작」으로 재거나, 지난 것의 시작과 끝을 눈금으로 적는다.
 * 하루에 여러 번 할 수 있어서 위에 「오늘 2번, 25분」을 보인다. 재는 중이면 시계와 「종료」.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimeRuler } from '@/components/log/ruler';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { durationLabel } from '@/data/event-summary';
import { logsOn, type Routine, type RoutineLog } from '@/data/routine';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const MIN = 60 * 1000;

/** 「12:05」 · 「1:02:05」 */
function clock(from: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function TimedSheet({
  routine,
  logs,
  running,
  onStart,
  onStop,
  onSave,
  onClose,
}: {
  routine: Routine | null;
  logs: RoutineLog[];
  /** 재는 중이면 시작한 때 */
  running: string | null;
  onStart: () => void;
  onStop: () => void;
  onSave: (start: Date, end: Date) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(!!running);
  const [start, setStart] = useState(() => new Date(Date.now() - 15 * MIN));
  const [end, setEnd] = useState(() => new Date());

  if (!routine) return null;
  const today = logsOn(routine.id, logs, now).filter((l) => l.step == null && !l.skip);
  const total = today.reduce((sum, l) => sum + (l.endAt ? Math.max(0, (new Date(l.endAt).getTime() - new Date(l.at).getTime()) / MIN) : 0), 0);
  const summary = today.length ? `오늘 ${today.length}번${total >= 1 ? `, ${durationLabel(total)}` : ''}` : null;
  const mins = Math.round((end.getTime() - start.getTime()) / MIN);
  const ok = mins >= 1 && end.getTime() <= now.getTime() + MIN;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <View style={styles.titleRow}>
            <ThemedText type="title" style={styles.flex}>
              {routine.title}
            </ThemedText>
            {summary && (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {summary}
              </ThemedText>
            )}
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {running ? (
              <View style={[styles.running, { backgroundColor: c.accentSoft }]}>
                <ThemedText type="heading" style={{ color: c.accentText, fontVariant: ['tabular-nums'] }}>
                  {`재는 중 ${clock(running, now)}`}
                </ThemedText>
                <Button
                  size="lg"
                  variant="accent"
                  label="종료"
                  onPress={() => {
                    tap('success');
                    onStop();
                  }}
                />
              </View>
            ) : (
              <Button
                size="lg"
                icon="play"
                label="지금 시작"
                onPress={() => {
                  tap();
                  onStart();
                }}
              />
            )}
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: c.divider }]} />
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {`또는 지난 ${routine.title} 적기`}
              </ThemedText>
              <View style={[styles.line, { backgroundColor: c.divider }]} />
            </View>
            <TimeRuler label="시작" value={start} onChange={setStart} caption={null} />
            <TimeRuler label="끝" value={end} onChange={setEnd} caption={ok ? `${durationLabel(mins)} 했어요` : '끝이 시작보다 앞이에요'} danger={!ok} />
            <Button
              size="lg"
              label="저장"
              disabled={!ok}
              onPress={() => {
                tap('success');
                onSave(start, end);
              }}
            />
          </ScrollView>
          <Button variant="ghost" size="sm" label="닫기" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1, minWidth: 0 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.two, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  body: { flexGrow: 0 },
  bodyContent: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  running: { borderRadius: 16, padding: 14, gap: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { flex: 1, height: 1 },
});
