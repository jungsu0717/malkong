/**
 * 기록 그래프 (SPEC-LOG-04, task log/006) — 하루 흐름 맨 위 합계 칸을 누르면 열린다.
 *
 * 위에서 분유 · 모유 · 기저귀 · 잠을 고르고, 하루 · 일주일 · 한 달을 고른다. 큰 숫자 하나, 막대, 달라진 점 한 줄.
 * 셈은 graph-series.ts — 정상 · 이상을 판정하지 않는다(헌장 5). 막대는 View 로 그린다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import { hhmm } from '@/data/day-flow';
import { startOfDay } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import {
  daySummary,
  formatValue,
  METRIC_LABEL,
  monthSummary,
  shortValue,
  weekSummary,
  type DayValue,
  type Metric,
} from '@/data/graph-series';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

type Period = 'day' | 'week' | 'month';
const METRICS: Metric[] = ['formula', 'breast', 'diaper', 'sleep'];
const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: '하루' },
  { key: 'week', label: '일주일' },
  { key: 'month', label: '한 달' },
];
const isMetric = (v: unknown): v is Metric => v === 'formula' || v === 'breast' || v === 'diaper' || v === 'sleep';
const dateLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

export default function GraphsScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ metric?: string; day?: string }>();
  const now = useNow(false);
  const { events } = useEvents();
  const [metric, setMetric] = useState<Metric>(isMetric(params.metric) ? params.metric : 'formula');
  const [period, setPeriod] = useState<Period>('day');
  const day = useMemo(() => {
    const [y, m, d] = (params.day ?? '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : now;
  }, [params.day, now]);
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          기록 그래프
        </ThemedText>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.metrics}>
          {METRICS.map((m) => {
            const on = m === metric;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  setMetric(m);
                }}
                style={[styles.metric, on ? { backgroundColor: c.ink } : { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}>
                <ThemedText type="label" style={{ fontWeight: 700, color: on ? c.onInk : c.text }}>
                  {METRIC_LABEL[m]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceStrong }]}>
          {PERIODS.map((p) => {
            const on = p.key === period;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  setPeriod(p.key);
                }}
                style={[styles.seg, on && { backgroundColor: c.card }]}>
                <ThemedText type="label" style={{ fontWeight: on ? 700 : 500, color: on ? c.text : c.textSecondary, fontSize: 14 }}>
                  {p.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {period === 'day' && <DayCard metric={metric} day={day} isToday={isToday} now={now} events={events} />}
        {period === 'week' && <PeriodCard metric={metric} summary={weekSummary(events, metric, now)} labelEvery={1} />}
        {period === 'month' && <PeriodCard metric={metric} summary={monthSummary(events, metric, now)} labelEvery={7} />}
      </ScrollView>
      <AdBanner anchored />
    </ThemedView>
  );
}

function Card({ big, sub, children, line }: { big: string; sub: string; children: React.ReactNode; line: string | null }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <View style={styles.cardHead}>
        <ThemedText type="display" style={styles.big}>
          {big}
        </ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {sub}
        </ThemedText>
      </View>
      {children}
      {line && (
        <ThemedText type="label" style={{ fontWeight: 600 }}>
          {line}
        </ThemedText>
      )}
    </View>
  );
}

function DayCard({ metric, day, isToday, now, events }: { metric: Metric; day: Date; isToday: boolean; now: Date; events: Parameters<typeof daySummary>[0] }) {
  const c = useTheme();
  const s = daySummary(events, metric, day, now);
  const nowH = isToday ? (now.getTime() - startOfDay(now).getTime()) / 3600000 : 24;
  const max = Math.max(1, ...s.marks.map((m) => m.value));
  const head = isToday ? '오늘' : dateLabel(day);
  const sub = metric === 'sleep' ? `${head} ${s.count}번` : `${head} ${s.count}번${s.last ? `, 마지막 ${hhmm(s.last)}` : ''}`;
  const H = 110;
  return (
    <Card big={formatValue(metric, s.total)} sub={sub} line={s.line}>
      <View style={[styles.dayChart, { height: H + 40 }]}>
        <View style={[styles.axis, { backgroundColor: c.divider, bottom: 20 }]} />
        {isToday && <View style={[styles.later, { left: `${(nowH / 24) * 100}%`, bottom: 20, height: H + 6, backgroundColor: c.surface }]} />}
        {isToday && <View style={[styles.nowLine, { left: `${(nowH / 24) * 100}%`, bottom: 20, height: H + 12, backgroundColor: c.accent }]} />}
        {s.marks.map((m, i) => {
          const left = `${(m.from / 24) * 100}%` as const;
          if (metric === 'sleep') {
            const w = `${(((m.to ?? nowH) - m.from) / 24) * 100}%` as const;
            return <View key={i} style={[styles.sleepBar, { left, width: w, bottom: 20, backgroundColor: c.ink }]} />;
          }
          if (metric === 'diaper') {
            return <View key={i} style={[styles.diaperDot, { left, bottom: 26, backgroundColor: m.poo ? c.textSecondary : c.card, borderColor: c.textSecondary }]} />;
          }
          const h = Math.max(6, (m.value / max) * H);
          return (
            <View key={i} style={[styles.barWrap, { left, bottom: 20 }]}>
              <ThemedText type="caption" style={styles.barValue}>
                {metric === 'formula' ? `${m.value}ml` : `${m.value}분`}
              </ThemedText>
              <View style={[styles.dayBar, { height: h, backgroundColor: c.accent }]} />
            </View>
          );
        })}
        <View style={styles.hours}>
          {[0, 6, 12, 18, 24].map((h) => (
            <ThemedText key={h} type="caption" style={{ color: c.textTertiary, fontSize: 10.5 }}>
              {`${h}시`}
            </ThemedText>
          ))}
        </View>
      </View>
    </Card>
  );
}

function PeriodCard({ metric, summary, labelEvery }: { metric: Metric; summary: { avg: number; days: DayValue[]; line: string | null }; labelEvery: number }) {
  const c = useTheme();
  const { days } = summary;
  const total = (d: DayValue) => d.value;
  const max = Math.max(1, ...days.map(total));
  const H = 132;
  const avgBottom = (summary.avg / max) * H;
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const wide = days.length <= 7;
  return (
    <Card big={summary.avg > 0 ? `하루 평균 ${formatValue(metric, summary.avg)}` : '기록이 아직 적어요'} sub={`${dateLabel(first)} ~ ${dateLabel(last)}`} line={summary.line}>
      <View style={{ height: H + (wide ? 20 : 0) }}>
        {summary.avg > 0 && <View style={[styles.avgLine, { bottom: avgBottom, borderColor: c.flowLine }]} />}
        <View style={[styles.bars, { gap: wide ? 0 : 3 }]}>
          {days.map((d, i) => {
            const today = d.isToday;
            const h = (total(d) / max) * H;
            return (
              <View key={i} style={styles.barCol}>
                {wide && (
                  <ThemedText type="caption" style={[styles.colValue, { color: today ? c.accentText : c.text }]}>
                    {shortValue(metric, total(d))}
                  </ThemedText>
                )}
                {metric === 'diaper' ? (
                  <View style={{ width: wide ? 26 : '100%' }}>
                    <View style={[styles.stackTop, { height: (d.poo / max) * H, backgroundColor: c.ink }]} />
                    <View style={[styles.stackBottom, { height: (Math.max(0, d.value - d.poo) / max) * H, backgroundColor: c.flowLine }]} />
                  </View>
                ) : (
                  <View style={[styles.col, { width: wide ? 26 : '100%', height: Math.max(total(d) > 0 ? 3 : 0, h), backgroundColor: today ? c.accent : c.accentSoft }]} />
                )}
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.colLabels}>
        {days.map((d, i) =>
          i % labelEvery === 0 || d.isToday ? (
            <ThemedText key={i} type="caption" style={[styles.colLabel, { color: d.isToday ? c.accentText : c.textSecondary, fontWeight: d.isToday ? 700 : 400, flex: wide ? 1 : undefined }]}>
              {d.isToday ? '오늘' : wide ? `${d.date.getDate()}일` : `${d.date.getMonth() + 1}/${d.date.getDate()}`}
            </ThemedText>
          ) : wide ? (
            <View key={i} style={styles.flex} />
          ) : null,
        )}
      </View>
      {metric === 'diaper' && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: c.flowLine }]} />
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              소변
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: c.ink }]} />
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              대변
            </ThemedText>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 4, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 12, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  metrics: { flexDirection: 'row', gap: 6 },
  metric: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12 },
  seg: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, padding: 16, gap: 14 },
  cardHead: { gap: 2 },
  big: { fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  dayChart: { position: 'relative' },
  axis: { position: 'absolute', left: 0, right: 0, height: 1 },
  later: { position: 'absolute', right: 0, opacity: 0.8 },
  nowLine: { position: 'absolute', width: 2, marginLeft: -1 },
  sleepBar: { position: 'absolute', height: 16, borderRadius: 4 },
  diaperDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginLeft: -5 },
  barWrap: { position: 'absolute', alignItems: 'center', width: 48, marginLeft: -24 },
  barValue: { fontWeight: 700, fontSize: 11.5, marginBottom: 3 },
  dayBar: { width: 14, borderRadius: 5 },
  hours: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  avgLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  colValue: { fontWeight: 700, fontSize: 11.5 },
  col: { borderRadius: 6 },
  stackTop: { borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  stackBottom: { borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  colLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  colLabel: { textAlign: 'center', fontSize: 11 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
