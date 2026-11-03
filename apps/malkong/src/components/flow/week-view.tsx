/**
 * 일주일 보기 (SPEC-MAIN-10, task today/013) — 오늘까지 7일을 날마다 세로 막대 하나로. 베이비타임 「주간 패턴」을 참고했다(decisions/037).
 *
 * 막대의 위가 0시, 아래가 24시. 잠은 먹색, 수유는 코랄 가로줄, 오늘은 지금까지만 칠하고 남은 시간은 빗금.
 * 밤잠 드는 시간을 점과 점선으로 잇고, 이레 가운데 가장 길게 잔 잠에 코랄 테두리를 두른다. 막대를 누르면 그날 하루 보기.
 * 아래 문장 둘(weekLines)은 지난 기록에서 나온 값일 뿐이고 정상 · 이상을 판정하지 않는다(헌장 5).
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Polyline, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { longestSleep, weekDays, weekLines } from '@/data/day-flow';
import { durationLabel } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { useTheme } from '@/hooks/use-theme';

const AX = 18;
const GAP = 10;
const TOP = 34;
const PH = 12.5;
const CH = 24 * PH;
const BOTTOM = 34;

const r1 = (n: number) => Math.round(n * 10) / 10;

export function WeekView({ now, onPickDay }: { now: Date; onPickDay: (day: Date) => void }) {
  const c = useTheme();
  const { events } = useEvents();
  const [width, setWidth] = useState(0);
  const days = useMemo(() => weekDays(events, now), [events, now]);
  const lines = useMemo(() => weekLines(days, events, now), [days, events, now]);
  const longest = useMemo(() => longestSleep(events, now), [events, now]);

  const colW = width > 0 ? (width - AX - 6 * GAP) / 7 : 0;
  const colX = (i: number) => r1(AX + i * (colW + GAP));
  const Y = (h: number) => r1(TOP + h * PH);
  const beds = days.map((d, i) => (d.bedtime !== null ? ([r1(colX(i) + colW / 2), Y(d.bedtime)] as const) : null)).filter((p) => p !== null);

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <View style={{ height: TOP + CH + BOTTOM }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <>
              {[0, 6, 12, 18, 24].map((h) => (
                <View key={h} style={[styles.axisRow, { top: Y(h) - 7 }]} pointerEvents="none">
                  <ThemedText type="caption" style={[styles.axis, { color: c.textTertiary }]}>
                    {h}
                  </ThemedText>
                  {h > 0 && h < 24 && <View style={[styles.grid, { backgroundColor: c.divider }]} />}
                </View>
              ))}
              {days.map((d, i) => {
                const x = colX(i);
                const tone = d.isToday ? c.accentText : c.textSecondary;
                const total = d.isToday ? null : durationLabel(d.sleepMin).split(' ');
                return (
                  <Pressable
                    key={d.date.getTime()}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.date.getMonth() + 1}월 ${d.date.getDate()}일 하루 보기`}
                    onPress={() => {
                      tap();
                      onPickDay(d.date);
                    }}
                    style={[styles.colHit, { left: x - GAP / 2, width: colW + GAP }]}>
                    <View style={[styles.label, { left: GAP / 2, width: colW }]}>
                      <ThemedText type="caption" style={{ color: tone, fontSize: 11, lineHeight: 14, fontWeight: d.isToday ? 700 : 400 }}>
                        {d.weekday}
                      </ThemedText>
                      <ThemedText type="label" style={{ fontWeight: 700, lineHeight: 16, color: d.isToday ? c.accentText : c.text }}>
                        {d.date.getDate()}
                      </ThemedText>
                    </View>
                    <View style={[styles.col, { left: GAP / 2, width: colW, top: TOP, height: CH, backgroundColor: c.surface }]}>
                      {d.marks.now !== null && <Hatch top={d.marks.now * PH} height={CH - d.marks.now * PH} width={colW} />}
                      {d.marks.sleeps.map((s) => (
                        <View key={s.id} style={[styles.block, { top: r1(s.from * PH), height: Math.max(1, r1((s.to - s.from) * PH)), backgroundColor: c.ink }]} />
                      ))}
                      {d.marks.feeds.map((f) => (
                        <View key={f.id} style={[styles.feed, { top: r1(f.at * PH - 2), backgroundColor: c.accent }]} />
                      ))}
                      {d.marks.now !== null && <View style={[styles.nowLine, { top: r1(d.marks.now * PH - 1), backgroundColor: c.accent }]} />}
                    </View>
                    {longest &&
                      d.marks.sleeps
                        .filter((s) => s.id === longest.id)
                        .map((s) => (
                          <View
                            key={`long-${s.id}`}
                            pointerEvents="none"
                            style={[
                              styles.longest,
                              { left: GAP / 2 - 2, width: colW + 4, top: TOP + r1(s.from * PH) - 2, height: r1((s.to - s.from) * PH) + 4, borderColor: c.accent },
                            ]}
                          />
                        ))}
                    <View style={[styles.total, { top: TOP + CH + 6 }]}>
                      {total ? (
                        total.map((t) => (
                          <ThemedText key={t} type="caption" style={styles.totalText}>
                            {t}
                          </ThemedText>
                        ))
                      ) : (
                        <ThemedText type="caption" style={[styles.totalText, { color: c.accentText, fontWeight: 600 }]}>
                          지금까지
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                );
              })}
              {beds.length > 0 && (
                <Svg width={width} height={TOP + CH} style={StyleSheet.absoluteFill} pointerEvents="none">
                  {beds.length > 1 && (
                    <Polyline
                      points={beds.map((p) => p.join(',')).join(' ')}
                      fill="none"
                      stroke={c.accent}
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                      strokeLinecap="round"
                    />
                  )}
                  {beds.map((p) => (
                    <Circle key={p.join(',')} cx={p[0]} cy={p[1]} r={3} fill={c.card} stroke={c.accent} strokeWidth={1.8} />
                  ))}
                </Svg>
              )}
            </>
          )}
        </View>

        <View style={styles.legend}>
          <Legend swatch={<View style={[styles.swSleep, { backgroundColor: c.ink }]} />} text="잠" />
          <Legend swatch={<View style={[styles.swFeed, { backgroundColor: c.accent }]} />} text="수유" />
          <Legend
            swatch={
              <Svg width={18} height={8}>
                <Path d="M1 4h16" stroke={c.accent} strokeWidth={1.8} strokeDasharray="3 3" strokeLinecap="round" />
                <Circle cx={9} cy={4} r={2.6} fill={c.card} stroke={c.accent} strokeWidth={1.6} />
              </Svg>
            }
            text="밤잠 드는 시간"
          />
        </View>
      </View>

      {lines.length > 0 && (
        <View style={[styles.lines, { backgroundColor: c.card }]}>
          {lines.map((l, i) => (
            <View key={l} style={[styles.line, i > 0 && { borderTopWidth: 1, borderTopColor: c.divider }]}>
              <View style={[styles.lineIcon, { backgroundColor: i === 0 && l.startsWith('밤잠') ? c.surface : c.accentSoft }]}>
                <Ionicons
                  name={l.startsWith('밤잠') ? 'moon-outline' : 'star-outline'}
                  size={15}
                  color={l.startsWith('밤잠') ? c.text : c.accent}
                />
              </View>
              <ThemedText type="small" style={styles.lineText} lineBreakStrategyIOS="hangul-word">
                {l}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** 오늘 막대의 남은 시간 빗금 */
function Hatch({ top, height, width }: { top: number; height: number; width: number }) {
  const c = useTheme();
  return (
    <View style={{ position: 'absolute', left: 0, top, width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="weekHatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={6} height={6} fill={c.surface} />
            <Rect width={2} height={6} fill={c.border} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#weekHatch)" />
      </Svg>
    </View>
  );
}

function Legend({ swatch, text }: { swatch: ReactNode; text: string }) {
  return (
    <View style={styles.legendItem}>
      {swatch}
      <ThemedText type="caption">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  axisRow: { position: 'absolute', left: 0, right: 0, height: 14, flexDirection: 'row', alignItems: 'center' },
  axis: { width: AX, fontSize: 10, lineHeight: 14 },
  grid: { flex: 1, height: 1 },
  colHit: { position: 'absolute', top: 0, bottom: 0 },
  label: { position: 'absolute', top: 0, alignItems: 'center' },
  col: { position: 'absolute', borderRadius: 8, overflow: 'hidden' },
  block: { position: 'absolute', left: 0, right: 0, borderRadius: 3 },
  feed: { position: 'absolute', left: 0, right: 0, height: 4 },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  longest: { position: 'absolute', borderWidth: 2, borderRadius: 5 },
  total: { position: 'absolute', left: -6, right: -6, alignItems: 'center' },
  totalText: { fontSize: 10, lineHeight: 13 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swSleep: { width: 10, height: 10, borderRadius: 2 },
  swFeed: { width: 12, height: 4 },
  lines: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  lineIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1, paddingTop: 4 },
});
