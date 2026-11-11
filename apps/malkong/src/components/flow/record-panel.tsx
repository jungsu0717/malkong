/**
 * 위쪽 기록 줄 (SPEC-MAIN-08, task today/017 · 029 · 030, decisions/046 · 047) — 하루 흐름 어느 보기에서나 날짜 아래에 고정한다.
 *
 * 윗줄은 기록 11가지(처음부터 모두 보인다), 아랫줄은 「루틴」이다. 두 줄 모두 옆으로 밀어 더 본다(record-bar.ts).
 * 기록 칸마다 동그란 기록 아이콘(+ 표시)과 그날 합계가 있고, 아이콘을 누르면 기록 시트가 열린다. 윗줄 끝 「편집」에서 빼고 순서를 바꾼다.
 * 이름과 합계를 누르면 수유, 기저귀, 잠은 그래프 화면(SPEC-LOG-04)이 열린다. 자는 중이면 잠 칸이 「수면 종료」다(SPEC-LOG-02).
 * 루틴은 알약 모양 칸이다. 누르면 지금 한 번 완료로 기록하고(단계, 재고, 시간을 재는 루틴은 그 시트), 길게 누르면 루틴 편집이 열린다.
 * 아랫줄 끝 「추가」는 기록 편집의 「루틴 추가」로 바로 간다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Glyph, kindTone } from '@/components/record-icons';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { hhmm, type DayTotals } from '@/data/day-flow';
import { durationLabel, startOfDay } from '@/data/event-summary';
import type { EventKind } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { usePreferences } from '@/data/preferences-context';
import { arrangeBar, BAR_KIND_NAME, type BarKind } from '@/data/record-bar';
import { isDueOn, isTimed, logsOn, noRepeat, scheduleLabel, type Routine } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { useTheme } from '@/hooks/use-theme';

export type GraphMetric = 'formula' | 'breast' | 'diaper' | 'sleep';

const MIN = 60 * 1000;

export function RecordPanel({
  totals,
  date,
  sleeping,
  onRecord,
  onRoutine,
  onEdit,
  onAddRoutine,
}: {
  totals: DayTotals;
  /** 합계의 날 — 그래프 화면도 그날로 연다 */
  date: Date;
  sleeping: boolean;
  onRecord: (kind: EventKind) => void;
  onRoutine: (routine: Routine) => void;
  /** 윗줄 끝 「편집」 */
  onEdit: () => void;
  /** 아랫줄 끝 「추가」 */
  onAddRoutine: () => void;
}) {
  const c = useTheme();
  const { events } = useEvents();
  const { routines, logs, timers } = useRoutines();
  const { recordBar } = usePreferences();
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const layout = arrangeBar(
    recordBar,
    routines.map((r) => r.id),
  );
  const shownRoutines = layout.routines.map((id) => routines.find((r) => r.id === id)).filter((r): r is Routine => !!r);

  const d0 = startOfDay(date).getTime();
  const ofDay = (kind: EventKind) => events.filter((e) => e.kind === kind && new Date(e.startAt).getTime() >= d0 && new Date(e.startAt).getTime() < d0 + 24 * 60 * MIN);

  /** 칸의 합계 두 줄 — 크게 보이는 값과 그 아래 작은 글 */
  const figures = (kind: BarKind): [string, string] => {
    if (kind === 'breast') return [durationLabel(totals.breastMin), `${totals.breastCount}번`];
    if (kind === 'formula') return [`${Math.round(totals.formulaMl)}ml`, `${totals.formulaCount}번`];
    if (kind === 'diaper') return [`${totals.diapers}번`, `대변 ${totals.poo}번`];
    if (kind === 'sleep') return [durationLabel(totals.sleepMin), `낮잠 ${totals.naps}번`];
    const list = ofDay(kind);
    const last = list[list.length - 1];
    if (kind === 'temp') return [`${list.length}번`, last?.amount != null ? `${last.amount}℃` : ''];
    // 간식은 횟수와 마지막 시각, 이유식 · 유축 · 우유 · 물은 그날 합계 ml 와 횟수
    if (kind === 'snack') return [`${list.length}번`, last ? hhmm(last.startAt) : ''];
    return [`${Math.round(list.reduce((sum, e) => sum + (e.amount ?? 0), 0))}ml`, `${list.length}번`];
  };

  /** 루틴 칸의 작은 글 — 재는 중, 오늘 한 것, 아니면 할 때 */
  const routineStatus = (r: Routine): { text: string; done: boolean; running: boolean } => {
    const running = !!timers[r.id];
    if (running) return { text: '재는 중', done: false, running };
    const done = logsOn(r.id, logs, date).filter((l) => l.step == null && !l.skip);
    if (done.length) {
      const minutes = done.reduce((sum, l) => sum + (l.endAt ? Math.max(0, (new Date(l.endAt).getTime() - new Date(l.at).getTime()) / MIN) : 0), 0);
      const text = isTimed(r) && minutes > 0 ? durationLabel(minutes) : done.length > 1 ? `${done.length}번 완료` : `${hhmm(done[0].at)} 완료`;
      return { text, done: true, running };
    }
    if (noRepeat(r)) return { text: '', done: false, running };
    return { text: isDueOn(r, logs, date) && r.time ? r.time : scheduleLabel(r), done: false, running };
  };

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>
        {layout.kinds.map((kind) => {
          const stop = kind === 'sleep' && sleeping;
          const graph = kind === 'breast' || kind === 'formula' || kind === 'diaper' || kind === 'sleep';
          const name = BAR_KIND_NAME[kind];
          const [value, sub] = figures(kind);
          const t = kindTone(kind, c);
          return (
            <View key={kind} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={stop ? '수면 종료' : `${name} 기록`}
                hitSlop={4}
                onPress={() => onRecord(kind)}
                style={({ pressed }) => [
                  styles.badge,
                  stop ? { backgroundColor: c.accentSoft } : { backgroundColor: t.bg },
                  !stop && t.line ? { borderWidth: 1.5, borderColor: t.line } : null,
                  pressed && { opacity: 0.8 },
                ]}>
                {stop ? <Ionicons name="sunny-outline" size={22} color={c.accent} /> : <Glyph name={kind} size={22} color={t.fg} />}
                {!stop && (
                  <View pointerEvents="none" style={[styles.plus, { backgroundColor: c.ink, borderColor: c.card }]}>
                    <Ionicons name="add" size={13} color={c.onInk} />
                  </View>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${name} ${value}${sub ? `, ${sub}` : ''}. ${graph ? '그래프 보기' : '기록'}`}
                onPress={() => {
                  tap();
                  if (graph) router.push({ pathname: '/graphs', params: { metric: kind, day } });
                  else onRecord(kind);
                }}
                style={({ pressed }) => pressed && { opacity: 0.6 }}>
                <View style={styles.nameRow}>
                  <ThemedText type="caption" numberOfLines={1} style={[styles.name, { color: stop ? c.accentText : c.textSecondary, fontWeight: stop ? 700 : 400 }]}>
                    {stop ? '수면 종료' : name}
                  </ThemedText>
                  {!stop && <Ionicons name="chevron-forward" size={12} color={c.textTertiary} />}
                </View>
                <ThemedText type="heading" numberOfLines={1} style={styles.value}>
                  {value}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={[styles.sub, { color: c.textSecondary }]}>
                  {sub || ' '}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="기록 편집"
          hitSlop={4}
          onPress={() => {
            tap();
            onEdit();
          }}
          style={({ pressed }) => [styles.editCell, pressed && { opacity: 0.6 }]}>
          <View style={[styles.badge, styles.dashed, { borderColor: c.flowLine }]}>
            <Ionicons name="options-outline" size={21} color={c.textSecondary} />
          </View>
          <ThemedText type="caption" numberOfLines={1} style={[styles.name, styles.center, { color: c.textSecondary }]}>
            편집
          </ThemedText>
        </Pressable>
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />

      <View style={styles.routineRow}>
        <ThemedText type="caption" style={[styles.routineLabel, { color: c.textSecondary }]}>
          루틴
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {shownRoutines.map((r) => {
            const s = routineStatus(r);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}${s.text ? `, ${s.text}` : ''}. 완료로 기록`}
                accessibilityHint="길게 누르면 루틴 편집이 열려요"
                onPress={() => onRoutine(r)}
                onLongPress={() => {
                  tap();
                  router.push({ pathname: '/routine-form', params: { id: r.id } });
                }}
                style={({ pressed }) => [
                  styles.chip,
                  s.done ? { backgroundColor: c.doneBg, borderColor: c.doneLine } : { backgroundColor: c.card, borderColor: c.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <View style={[styles.mark, { backgroundColor: s.done ? c.doneFg : c.doneBg }]}>
                  {s.done ? <Ionicons name="checkmark" size={16} color={c.card} /> : <RoutineIcon title={r.title} size={16} color={c.doneFg} />}
                </View>
                <ThemedText type="label" numberOfLines={1} style={styles.chipTitle}>
                  {r.title}
                </ThemedText>
                {s.text ? (
                  <ThemedText type="caption" numberOfLines={1} style={{ color: s.running ? c.accentText : s.done ? c.doneFg : c.textSecondary }}>
                    {s.text}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="루틴 추가"
            onPress={() => {
              tap();
              onAddRoutine();
            }}
            style={({ pressed }) => [styles.chip, styles.dashed, styles.addChip, { borderColor: c.flowLine }, pressed && { opacity: 0.6 }]}>
            <Ionicons name="add" size={16} color={c.textSecondary} />
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              추가
            </ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden' },
  kinds: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  cell: { minWidth: 64, gap: 6 },
  editCell: { width: 44, gap: 6 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  plus: { position: 'absolute', right: -5, bottom: -5, width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  name: { fontSize: 12.5, lineHeight: 17 },
  center: { textAlign: 'center' },
  value: { fontWeight: 700, fontSize: 15, lineHeight: 20, letterSpacing: -0.4 },
  sub: { fontSize: 11.5, lineHeight: 15 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 14 },
  routineRow: { flexDirection: 'row', alignItems: 'center' },
  routineLabel: { width: 50, paddingLeft: 14, fontSize: 12.5, fontWeight: 600 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 14, paddingVertical: 10 },
  chip: { height: 38, borderRadius: 19, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 5, paddingRight: 13 },
  addChip: { paddingLeft: 10, gap: 4 },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chipTitle: { fontWeight: 700 },
});
