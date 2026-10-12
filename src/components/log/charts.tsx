import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type Bar = { label: string; value: number; today?: boolean };

/**
 * 일주일 막대 (SPEC-LOG-04) — 날마다 막대 하나, 위에 값, 아래에 요일. 오늘 막대만 포인트 색.
 * `avg` 가 있으면 평소(지난날 평균) 높이에 점선을 긋는다. 판정 색(빨강 · 초록)은 쓰지 않는다 — 평소와 나란히 볼 뿐이다
 */
export function BarChart({
  bars,
  format,
  avg = null,
  height = 132,
}: {
  bars: Bar[];
  format: (v: number) => string;
  avg?: number | null;
  height?: number;
}) {
  const c = useTheme();
  const max = Math.max(1, avg ?? 0, ...bars.map((b) => b.value));
  return (
    <View style={styles.chart}>
      <View style={[styles.plot, { height }]}>
        {avg !== null && avg > 0 && (
          <View
            pointerEvents="none"
            style={[styles.avg, { bottom: (avg / max) * (height - 22), borderColor: c.textTertiary }]}
          />
        )}
        {bars.map((b, i) => (
          <View key={i} style={styles.col}>
            <ThemedText type="caption" style={{ color: b.value > 0 ? c.textSecondary : c.textTertiary, fontSize: 11 }}>
              {b.value > 0 ? format(b.value) : '·'}
            </ThemedText>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(b.value > 0 ? 4 : 2, (b.value / max) * (height - 22)),
                  backgroundColor: b.today ? c.accent : b.value > 0 ? c.text : c.surfaceStrong,
                  opacity: b.today || b.value === 0 ? 1 : 0.78,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <ThemedText
            key={i}
            type="caption"
            style={[styles.label, { color: b.today ? c.accentText : c.textSecondary, fontWeight: b.today ? 700 : 400 }]}>
            {b.today ? '오늘' : b.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

export type Point = { at: string; value: number };

/** 몸무게 · 키 — 기록한 날마다 점, 사이를 선으로(SPEC-LOG-04). 축은 그 기간의 최소~최대 */
export function LineChart({ points, format, height = 150 }: { points: Point[]; format: (v: number) => string; height?: number }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  if (points.length === 0) return null;
  const times = points.map((p) => new Date(p.at).getTime());
  const values = points.map((p) => p.value);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const v0 = Math.min(...values);
  const v1 = Math.max(...values);
  const pad = 14;
  const x = (t: number) => (t1 === t0 ? width / 2 : pad + ((t - t0) / (t1 - t0)) * (width - pad * 2));
  const y = (v: number) => (v1 === v0 ? height / 2 : pad + (1 - (v - v0) / (v1 - v0)) * (height - pad * 2));
  const xy = points.map((p) => `${x(new Date(p.at).getTime()).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const lastPoint = points[points.length - 1];
  return (
    <View style={styles.chart}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {points.length > 1 && <Polyline points={xy} fill="none" stroke={c.text} strokeWidth={2} strokeLinejoin="round" />}
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={x(new Date(p.at).getTime())}
                cy={y(p.value)}
                r={i === points.length - 1 ? 5 : 3.5}
                fill={i === points.length - 1 ? c.accent : c.background}
                stroke={i === points.length - 1 ? c.accent : c.text}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
      </View>
      <View style={styles.range}>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {shortDate(points[0].at)} {format(points[0].value)}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700 }}>
          {shortDate(lastPoint.at)} {format(lastPoint.value)}
        </ThemedText>
      </View>
    </View>
  );
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const styles = StyleSheet.create({
  chart: { gap: 6 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  avg: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  labels: { flexDirection: 'row', gap: 8 },
  label: { flex: 1, textAlign: 'center' },
  range: { flexDirection: 'row', justifyContent: 'space-between' },
});
