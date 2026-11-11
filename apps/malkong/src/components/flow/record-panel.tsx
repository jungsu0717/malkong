/**
 * 위쪽 기록 단추 줄 (SPEC-MAIN-08, task today/017 · 029, decisions/046) — 하루 흐름 어느 보기에서나 날짜 아래에 고정한다.
 *
 * 모유, 분유, 기저귀, 잠, 그리고 루틴 단추가 한 줄에 놓이고 옆으로 밀어 더 본다. 줄 맨 끝 「편집」에서 넣고 빼고 순서를 바꾼다(record-bar.ts).
 * 칸마다 동그란 기록 단추(+ 표시)와 그날 합계가 있다. 기록 단추를 누르면 기록 시트, 루틴은 지금 한 번 완료로 기록한다(단계 · 재고 · 시간을 재는 루틴은 그 시트).
 * 이름과 합계를 누르면 수유 · 기저귀 · 잠은 그래프 화면(SPEC-LOG-04), 루틴은 루틴 편집이 열린다. 자는 중이면 잠 단추가 「수면 종료」다(SPEC-LOG-02).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { hhmm, type DayTotals } from '@/data/day-flow';
import { durationLabel, startOfDay } from '@/data/event-summary';
import { KIND_UI } from '@/components/log/kinds';
import { isIntake, type EventKind } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { usePreferences } from '@/data/preferences-context';
import { arrangeBar, BAR_KIND_NAME, isBarKind, routineIdOf, type BarKind } from '@/data/record-bar';
import { isTimed, logsOn, noRepeat, scheduleLabel, type Routine } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useTheme } from '@/hooks/use-theme';

export type GraphMetric = 'formula' | 'breast' | 'diaper' | 'sleep';

const MIN = 60 * 1000;

type Cell = { key: string; name: string; value: string; sub: string; wide?: boolean; accentSub?: boolean };

export function RecordPanel({
  totals,
  date,
  sleeping,
  onRecord,
  onRoutine,
  onEdit,
}: {
  totals: DayTotals;
  /** 합계의 날 — 그래프 화면도 그날로 연다 */
  date: Date;
  sleeping: boolean;
  onRecord: (kind: EventKind) => void;
  onRoutine: (routine: Routine) => void;
  /** 줄 끝 「편집」 */
  onEdit: () => void;
}) {
  const c = useTheme();
  const { events } = useEvents();
  const { routines, logs, timers } = useRoutines();
  const { recordBar } = usePreferences();
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const { shown } = arrangeBar(recordBar, routines.map((r) => r.id));

  const d0 = startOfDay(date).getTime();
  const ofDay = (kind: EventKind) => events.filter((e) => e.kind === kind && new Date(e.startAt).getTime() >= d0 && new Date(e.startAt).getTime() < d0 + 24 * 60 * MIN);
  const temps = ofDay('temp');
  const kindCell = (kind: BarKind): Cell => {
    if (kind === 'breast') return { key: kind, name: BAR_KIND_NAME.breast, value: durationLabel(totals.breastMin), sub: `${totals.breastCount}번` };
    if (kind === 'formula') return { key: kind, name: BAR_KIND_NAME.formula, value: `${Math.round(totals.formulaMl)}ml`, sub: `${totals.formulaCount}번` };
    if (kind === 'diaper') return { key: kind, name: BAR_KIND_NAME.diaper, value: `${totals.diapers}번`, sub: `대변 ${totals.poo}번` };
    if (kind === 'sleep') return { key: kind, name: BAR_KIND_NAME.sleep, value: durationLabel(totals.sleepMin), sub: `낮잠 ${totals.naps}번`, wide: true };
    if (isIntake(kind)) {
      // 이유식 · 유축 · 우유 · 물은 그날 합계 ml 와 횟수, 간식은 횟수와 마지막 시각
      const list = ofDay(kind);
      if (kind === 'snack') return { key: kind, name: BAR_KIND_NAME.snack, value: `${list.length}번`, sub: list.length ? hhmm(list[list.length - 1].startAt) : '' };
      return { key: kind, name: BAR_KIND_NAME[kind], value: `${Math.round(list.reduce((sum, e) => sum + (e.amount ?? 0), 0))}ml`, sub: `${list.length}번` };
    }
    const last = temps[temps.length - 1];
    return { key: kind, name: BAR_KIND_NAME.temp, value: `${temps.length}번`, sub: last?.amount != null ? `${last.amount}℃` : '' };
  };
  const routineCell = (r: Routine): Cell => {
    const done = logsOn(r.id, logs, date).filter((l) => l.step == null && !l.skip);
    const running = timers[r.id];
    const minutes = done.reduce((sum, l) => sum + (l.endAt ? Math.max(0, (new Date(l.endAt).getTime() - new Date(l.at).getTime()) / MIN) : 0), 0);
    const value = isTimed(r) && minutes > 0 ? durationLabel(minutes) : `${done.length}번`;
    const last = done[done.length - 1];
    const sub = running ? '재는 중' : last ? hhmm(last.at) : noRepeat(r) ? '' : [scheduleLabel(r), r.time].filter(Boolean).join(' ');
    return { key: r.id, name: r.title, value, sub, accentSub: !!running };
  };

  const cells = shown.flatMap((k): { cell: Cell; kind: BarKind | null; routine: Routine | null }[] => {
    if (isBarKind(k)) return [{ cell: kindCell(k), kind: k, routine: null }];
    const r = routines.find((x) => x.id === routineIdOf(k));
    return r ? [{ cell: routineCell(r), kind: null, routine: r }] : [];
  });

  const icon = (kind: BarKind) => {
    if (kind === 'breast') return <Ionicons name="heart-outline" size={22} color="#FFFFFF" />;
    if (kind === 'formula') return <BottleIcon size={22} color="#FFFFFF" />;
    if (kind === 'diaper') return <Ionicons name="water-outline" size={21} color={c.peeFg} />;
    if (kind === 'temp') return <Ionicons name="thermometer-outline" size={21} color={c.tempFg} />;
    if (kind === 'pumped') return <BottleIcon size={22} color={c.accent} />;
    if (isIntake(kind)) return <Ionicons name={KIND_UI[kind].icon} size={21} color={c.accent} />;
    return sleeping ? <Ionicons name="sunny-outline" size={22} color={c.accent} /> : <ZzIcon size={21} color={c.onInk} />;
  };
  const look = (kind: BarKind) =>
    kind === 'breast' || kind === 'formula'
      ? { backgroundColor: c.accent }
      : kind === 'diaper'
        ? { backgroundColor: c.peeBg, borderWidth: 1.5, borderColor: c.peeLine }
        : kind === 'temp'
          ? { backgroundColor: c.tempBg, borderWidth: 1.5, borderColor: c.tempLine }
          : isIntake(kind)
            ? { backgroundColor: c.accentSoft }
            : sleeping
            ? { backgroundColor: c.accentSoft }
            : { backgroundColor: c.ink };

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cols}>
        {cells.map(({ cell, kind, routine }) => {
          const stop = kind === 'sleep' && sleeping;
          const graph = kind === 'breast' || kind === 'formula' || kind === 'diaper' || kind === 'sleep';
          return (
            <View key={cell.key} style={[styles.col, cell.wide && styles.wide]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={stop ? '수면 종료' : `${cell.name} 기록`}
                hitSlop={4}
                onPress={() => (kind ? onRecord(kind) : routine && onRoutine(routine))}
                style={({ pressed }) => [styles.button, kind ? look(kind) : { backgroundColor: c.doneBg, borderWidth: 1.5, borderColor: c.doneLine }, pressed && { opacity: 0.8 }]}>
                {kind ? icon(kind) : <RoutineIcon title={cell.name} size={21} color={c.doneFg} />}
                {!stop && (
                  <View pointerEvents="none" style={[styles.plus, { backgroundColor: c.ink, borderColor: c.card }]}>
                    <Ionicons name="add" size={13} color={c.onInk} />
                  </View>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${cell.name} ${cell.value}${cell.sub ? `, ${cell.sub}` : ''}. ${graph ? '그래프 보기' : routine ? '루틴 편집' : '기록'}`}
                onPress={() => {
                  tap();
                  if (graph) router.push({ pathname: '/graphs', params: { metric: kind, day } });
                  else if (routine) router.push({ pathname: '/routine-form', params: { id: routine.id } });
                  else if (kind) onRecord(kind);
                }}
                style={({ pressed }) => [styles.text, pressed && { opacity: 0.6 }]}>
                <View style={styles.nameRow}>
                  <ThemedText type="caption" numberOfLines={1} style={[styles.name, { color: stop ? c.accentText : c.textSecondary, fontWeight: stop ? 700 : 400 }]}>
                    {stop ? '수면 종료' : cell.name}
                  </ThemedText>
                  {!stop && <Ionicons name="chevron-forward" size={12} color={c.textTertiary} />}
                </View>
                <ThemedText type="heading" numberOfLines={1} style={styles.value}>
                  {cell.value}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={[styles.sub, { color: cell.accentSub ? c.accentText : c.textSecondary }]}>
                  {cell.sub || ' '}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
        <View style={styles.col}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기록 단추 편집"
            hitSlop={4}
            onPress={() => {
              tap();
              onEdit();
            }}
            style={({ pressed }) => [styles.button, styles.edit, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card }]}>
            <Ionicons name="options-outline" size={21} color={c.textSecondary} />
          </Pressable>
          <ThemedText type="caption" style={[styles.name, { color: c.textSecondary }]}>
            편집
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden' },
  cols: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  col: { width: 74, gap: 6 },
  wide: { width: 92 },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  edit: { borderWidth: 1.5, borderStyle: 'dashed' },
  plus: { position: 'absolute', right: -5, bottom: -5, width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  name: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  value: { fontWeight: 700, fontSize: 15, lineHeight: 20, letterSpacing: -0.4 },
  sub: { fontSize: 11.5, lineHeight: 15 },
});
