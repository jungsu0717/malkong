/**
 * 하루 시계 (SPEC-MAIN-08, task today/012) — 위가 밤 12시인 24시간 원. 베이비타임 「일과표」와 Napper 홈을 참고했다(decisions/037).
 *
 * 잠은 먹색 호, 남은 시간은 빗금, 수유는 원 위의 코랄 젖병, 기저귀는 원 바깥의 물방울, 지금은 코랄 눈금. 아이콘이 범례라 범례는 두지 않는다.
 * 원 가운데에 지금 시각(지난날이면 날짜), 오른쪽에 그날 합계. 펼친 기록이 있으면(`pick`) 그 기록만 또렷하고 나머지는 흐려진다.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import type { DayMarks } from '@/data/day-flow';
import { durationLabel } from '@/data/event-summary';
import { useTheme } from '@/hooks/use-theme';

const S = 176;
const C = S / 2;
const R = 58;
const SW = 12;
const DIM = 0.3;

const BOTTLE = ['M10.4 6V4.7q0-2 1.6-2t1.6 2V6', 'M8.4 6h7.2v2.6H8.4Z', 'M9 8.6h6q1.4 0 1.4 1.4v9.4q0 1.8-1.8 1.8H9.4q-1.8 0-1.8-1.8V10q0-1.4 1.4-1.4Z'];
const DROP = ['M12 3.5c3 3.6 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0c0-3.2 2.5-6.4 5.5-10Z'];

const r1 = (n: number) => Math.round(n * 10) / 10;
const ang = (h: number) => (h / 24) * 2 * Math.PI - Math.PI / 2;
const pt = (h: number, r: number): [number, number] => [r1(C + r * Math.cos(ang(h))), r1(C + r * Math.sin(ang(h)))];

/** 원 위의 호 — 하루를 다 덮으면 원 */
function arc(a: number, b: number, r: number): string | null {
  if (b - a >= 23.99) return null;
  const [x1, y1] = pt(a, r);
  const [x2, y2] = pt(b, r);
  return `M${x1} ${y1}A${r} ${r} 0 ${b - a > 12 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** 24 크기 아이콘 그림을 (x, y) 가운데 size 로 */
function Glyph({ paths, x, y, size, color, width }: { paths: string[]; x: number; y: number; size: number; color: string; width: number }) {
  const k = size / 24;
  return (
    <G transform={`translate(${r1(x - size / 2)} ${r1(y - size / 2)}) scale(${k})`}>
      {paths.map((d) => (
        <Path key={d} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </G>
  );
}

export function DayClock({
  marks,
  center,
  stats,
  pick = null,
}: {
  marks: DayMarks;
  /** 원 가운데 — 작은 글 · 큰 글(「지금」 「14:20」) */
  center: { small: string; big: string };
  stats: { sleepMin: number; feeds: number; diapers: number };
  /** 펼친 기록 id — 그것만 또렷하게 */
  pick?: string | null;
}) {
  const c = useTheme();
  const dimAll = pick !== null;
  const op = (id: string) => (dimAll && id !== pick ? DIM : 1);
  const future = marks.now !== null ? arc(marks.now, 23.99, R) : null;

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <View style={styles.clock}>
        <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <Defs>
            <Pattern id="hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Rect width={5} height={5} fill={c.surface} />
              <Rect width={1.6} height={5} fill={c.border} />
            </Pattern>
          </Defs>
          <Circle cx={C} cy={C} r={R} fill="none" stroke={c.surfaceStrong} strokeWidth={SW} />
          {future && <Path d={future} fill="none" stroke="url(#hatch)" strokeWidth={SW} />}
          {marks.sleeps.map((s) => {
            const d = arc(s.from, s.to, R);
            return d ? (
              <Path key={s.id} d={d} fill="none" stroke={c.ink} strokeWidth={SW} opacity={op(s.id)} />
            ) : (
              <Circle key={s.id} cx={C} cy={C} r={R} fill="none" stroke={c.ink} strokeWidth={SW} opacity={op(s.id)} />
            );
          })}
          {[6, 12, 18].map((h) => {
            const [x1, y1] = pt(h, R - SW / 2 - 6);
            const [x2, y2] = pt(h, R - SW / 2 - 2);
            return <Line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.flowLine} strokeWidth={1.5} strokeLinecap="round" />;
          })}
          {marks.diapers.map((d) => {
            const [x, y] = pt(d.at, R + SW / 2 + 9);
            return (
              <G key={d.id} opacity={op(d.id)}>
                <Circle cx={x} cy={y} r={7.5} fill={c.card} stroke={c.flowLine} strokeWidth={1} />
                <Glyph paths={DROP} x={x} y={y} size={10} color={c.textSecondary} width={2.6} />
              </G>
            );
          })}
          {marks.feeds.map((f) => {
            const [x, y] = pt(f.at, R);
            const big = pick === f.id;
            return (
              <G key={f.id} opacity={op(f.id)}>
                <Circle cx={x} cy={y} r={big ? 12 : 10} fill={c.accent} stroke={c.card} strokeWidth={2} />
                <Glyph paths={BOTTLE} x={x} y={y} size={big ? 15 : 12} color="#FFFFFF" width={2.4} />
              </G>
            );
          })}
          {marks.now !== null &&
            (() => {
              const [x1, y1] = pt(marks.now, R - SW / 2 - 3);
              const [x2, y2] = pt(marks.now, R + SW / 2 + 3);
              return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.accent} strokeWidth={3} strokeLinecap="round" />;
            })()}
        </Svg>
        <ThemedText type="caption" style={[styles.zero, { color: c.textTertiary }]}>
          0시
        </ThemedText>
        <View style={styles.center} pointerEvents="none">
          <ThemedText type="caption" style={{ color: c.textTertiary, fontSize: 11 }}>
            {center.small}
          </ThemedText>
          <ThemedText type="title" style={styles.big}>
            {center.big}
          </ThemedText>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="moon" bg={c.ink} fg={c.onInk} name="잠" value={durationLabel(stats.sleepMin)} />
        <Stat bottle bg={c.accent} fg="#FFFFFF" name="수유" value={`${stats.feeds}번`} />
        <Stat icon="water-outline" bg={c.card} fg={c.textSecondary} border={c.flowLine} name="기저귀" value={`${stats.diapers}번`} />
      </View>
    </View>
  );
}

function Stat({
  icon,
  bottle = false,
  bg,
  fg,
  border,
  name,
  value,
}: {
  icon?: 'moon' | 'water-outline';
  bottle?: boolean;
  bg: string;
  fg: string;
  border?: string;
  name: string;
  value: string;
}) {
  const c = useTheme();
  return (
    <View style={styles.stat}>
      <View style={[styles.chip, { backgroundColor: bg }, border ? { borderWidth: 1, borderColor: border } : null]}>
        {bottle ? (
          <Svg width={14} height={14} viewBox="0 0 24 24">
            {BOTTLE.map((d) => (
              <Path key={d} d={d} fill="none" stroke={fg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        ) : (
          <Ionicons name={icon ?? 'moon'} size={13} color={fg} />
        )}
      </View>
      <View>
        <ThemedText type="caption" style={{ color: c.textSecondary, fontSize: 11, lineHeight: 14 }}>
          {name}
        </ThemedText>
        <ThemedText type="body" style={styles.value}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  clock: { width: S, height: S },
  zero: { position: 'absolute', top: C - R + SW / 2 + 3, left: 0, right: 0, textAlign: 'center', fontSize: 10, lineHeight: 14 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  big: { fontSize: 19, lineHeight: 24, fontVariant: ['tabular-nums'] },
  stats: { flex: 1, minWidth: 0, gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: 700, lineHeight: 20 },
});
