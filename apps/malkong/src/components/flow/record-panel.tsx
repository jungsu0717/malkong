/**
 * 위쪽 기록 칸 (SPEC-MAIN-08, task today/017) — 모유 · 분유 · 기저귀 · 잠 넷. 하루 흐름 어느 보기에서나 날짜 아래에 고정한다.
 *
 * 칸마다 동그란 기록 단추(+ 표시)와 그날 합계가 있다. 단추를 누르면 기록 시트, 이름과 합계를 누르면 그래프 화면(SPEC-LOG-04)이 열린다.
 * 자는 중이면 잠 단추가 「수면 종료」다(SPEC-LOG-02). 문장으로 적기는 오른쪽 아래 「물어보기」에서 한다(SPEC-MAIN-12).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import type { DayTotals } from '@/data/day-flow';
import { durationLabel } from '@/data/event-summary';
import type { EventKind } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

export type GraphMetric = 'formula' | 'breast' | 'diaper' | 'sleep';

export function RecordPanel({
  totals,
  date,
  sleeping,
  onRecord,
}: {
  totals: DayTotals;
  /** 합계의 날 — 그래프 화면도 그날로 연다 */
  date: Date;
  sleeping: boolean;
  onRecord: (kind: EventKind) => void;
}) {
  const c = useTheme();
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const cols: { kind: EventKind & GraphMetric; name: string; value: string; sub: string; flex: number }[] = [
    { kind: 'breast', name: '모유', value: durationLabel(totals.breastMin), sub: `${totals.breastCount}번`, flex: 1 },
    { kind: 'formula', name: '분유', value: `${Math.round(totals.formulaMl)}ml`, sub: `${totals.formulaCount}번`, flex: 1 },
    { kind: 'diaper', name: '기저귀', value: `${totals.diapers}번`, sub: `대변 ${totals.poo}번`, flex: 1 },
    { kind: 'sleep', name: '잠', value: durationLabel(totals.sleepMin), sub: `낮잠 ${totals.naps}번`, flex: 1.3 },
  ];

  const icon = (kind: EventKind) => {
    if (kind === 'breast') return <Ionicons name="heart-outline" size={22} color="#FFFFFF" />;
    if (kind === 'formula') return <BottleIcon size={22} color="#FFFFFF" />;
    if (kind === 'diaper') return <Ionicons name="water-outline" size={21} color={c.peeFg} />;
    return sleeping ? <Ionicons name="sunny-outline" size={22} color={c.accent} /> : <ZzIcon size={21} color={c.onInk} />;
  };
  const look = (kind: EventKind) =>
    kind === 'breast' || kind === 'formula'
      ? { backgroundColor: c.accent }
      : kind === 'diaper'
        ? { backgroundColor: c.peeBg, borderWidth: 1.5, borderColor: c.peeLine }
        : sleeping
          ? { backgroundColor: c.accentSoft }
          : { backgroundColor: c.ink };

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <View style={styles.cols}>
        {cols.map((col) => {
          const stop = col.kind === 'sleep' && sleeping;
          return (
            <View key={col.kind} style={[styles.col, { flex: col.flex }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={stop ? '수면 종료' : `${col.name} 기록`}
                hitSlop={4}
                onPress={() => onRecord(col.kind)}
                style={({ pressed }) => [styles.button, look(col.kind), pressed && { opacity: 0.8 }]}>
                {icon(col.kind)}
                {!stop && (
                  <View pointerEvents="none" style={[styles.plus, { backgroundColor: c.ink, borderColor: c.card }]}>
                    <Ionicons name="add" size={13} color={c.onInk} />
                  </View>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${col.name} ${col.value}, ${col.sub}. 그래프 보기`}
                onPress={() => {
                  tap();
                  router.push({ pathname: '/graphs', params: { metric: col.kind, day } });
                }}
                style={({ pressed }) => [styles.text, pressed && { opacity: 0.6 }]}>
                <View style={styles.nameRow}>
                  <ThemedText type="caption" style={{ color: stop ? c.accentText : c.textSecondary, fontSize: 12.5, lineHeight: 17, fontWeight: stop ? 700 : 400 }}>
                    {stop ? '수면 종료' : col.name}
                  </ThemedText>
                  {!stop && <Ionicons name="chevron-forward" size={12} color={c.textTertiary} />}
                </View>
                <ThemedText type="heading" numberOfLines={1} style={styles.value}>
                  {col.value}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 15 }}>
                  {col.sub}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 12 },
  cols: { flexDirection: 'row', gap: 6 },
  col: { minWidth: 0, gap: 6 },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', right: -5, bottom: -5, width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  value: { fontWeight: 700, fontSize: 15, lineHeight: 20, letterSpacing: -0.4 },
  flex: { flex: 1, minWidth: 0 },
});
