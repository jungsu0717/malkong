/**
 * 좌우로 끄는 눈금 (SPEC-LOG-01, task log/007) — 분유 양, 모유 먹인 시간, 기록의 때, 잔 시간을 고른다.
 *
 * 가로 ScrollView 라서 손을 놓아도 미끄러지다 멈춘다. 가운데 코랄 선이 고른 값이고, 칸이 바뀔 때마다 가볍게 진동한다.
 * 값이 밖에서 바뀌면(바퀴로 고르면) 눈금도 따라 움직인다. 때 눈금은 지금 뒤로 그리지 않고, 지금 자리에 코랄 점선과 「지금」을 둔다.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { DateTimeWheel, INLINE_WHEEL, pickDateTime } from '@/components/time-picker';
import { tap } from '@/components/ui';
import { hhmm } from '@/data/day-flow';
import { durationLabel, startOfDay } from '@/data/event-summary';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const H = 58;

type Scale = {
  min: number;
  max: number;
  /** 손을 놓았을 때 맞추는 간격(값 단위) */
  step: number;
  /** 값 1 이 몇 px */
  px: number;
  /** 작은 눈금 · 중간 눈금 · 숫자 간격(값 단위) */
  tick: number;
  mid: number;
  every: number;
  /** 눈금 숫자 */
  text: (v: number) => string;
  /** 0 자리에 숫자를 쓰지 않는다(잔 시간) */
  skipZero?: boolean;
  /** max 가 지금이면 거기에 「지금」 */
  nowAtMax?: boolean;
};

/** 눈금 한 줄 — value 는 Scale 의 값 단위 */
export function Ruler({ value, onChange, aria, ...scale }: Scale & { value: number; onChange: (v: number) => void; aria: string }) {
  const c = useTheme();
  const { min, max, step, px, tick, mid, every, text, skipZero, nowAtMax } = scale;
  const [w, setW] = useState(0);
  const ref = useRef<ScrollView>(null);
  /** 마지막으로 이 눈금이 알린 값 — 밖에서 바뀐 값만 눈금을 옮긴다 */
  const last = useRef<number | null>(null);
  const span = Math.max(0, max - min) * px;

  useEffect(() => {
    if (!w || last.current === value) return;
    last.current = value;
    ref.current?.scrollTo({ x: (Math.min(max, Math.max(min, value)) - min) * px, animated: false });
  }, [value, min, max, px, w]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = min + e.nativeEvent.contentOffset.x / px;
    const v = Math.min(max, Math.max(min, min + Math.round((raw - min) / step) * step));
    if (v === last.current) return;
    last.current = v;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(v);
  };

  // 눈금 그림은 범위가 바뀔 때만 다시 그린다 — 끄는 동안 수백 개를 다시 만들지 않게
  const ticks = useMemo(() => {
    if (!w) return null;
    const out: ReactNode[] = [];
    const from = Math.ceil(min / tick) * tick;
    for (let v = from; v <= max + 1e-6; v += tick) {
      const x = w / 2 + (v - min) * px;
      const isLabel = Math.abs(v % every) < 1e-6;
      const isMid = Math.abs(v % mid) < 1e-6;
      out.push(
        <Line
          key={`t${v}`}
          x1={x}
          y1={10}
          x2={x}
          y2={isLabel ? 34 : isMid ? 26 : 20}
          stroke={isLabel ? c.textTertiary : c.flowLine}
          strokeWidth={isLabel ? 1.8 : 1.3}
          strokeLinecap="round"
        />,
      );
      if (isLabel && !(skipZero && v === 0)) {
        out.push(
          <SvgText key={`l${v}`} x={x} y={52} fontSize={11} fill={c.textSecondary} textAnchor="middle">
            {text(v)}
          </SvgText>,
        );
      }
    }
    if (nowAtMax) {
      const x = w / 2 + (max - min) * px;
      out.push(<Line key="now" x1={x} y1={8} x2={x} y2={40} stroke={c.accent} strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="3 3" />);
      out.push(
        <SvgText key="nowText" x={x + 8} y={29} fontSize={12} fontWeight="700" fill={c.accentText}>
          지금
        </SvgText>,
      );
    }
    return (
      <Svg width={w + (max - min) * px} height={H}>
        {out}
      </Svg>
    );
  }, [w, min, max, px, tick, mid, every, skipZero, nowAtMax, text, c]);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={aria}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === 'increment' ? value + step : value - step;
        onChange(Math.min(max, Math.max(min, next)));
      }}
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={[styles.box, { backgroundColor: c.card, borderColor: c.border }]}>
      {w > 0 && (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          snapToInterval={step * px}
          decelerationRate="fast"
          contentContainerStyle={{ width: w + span }}>
          {ticks}
        </ScrollView>
      )}
      <Svg width={14} height={H} style={[styles.marker, { left: w / 2 - 7 }]} pointerEvents="none">
        <Path d="M1 0H13L7 7Z" fill={c.accent} />
        <Line x1={7} y1={4} x2={7} y2={40} stroke={c.accent} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** 눈금 위 줄 — 왼쪽 이름, 오른쪽 큰 값 */
function Head({ label, children }: { label: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.head}>
      <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Big({ value, unit }: { value: string; unit?: string }) {
  const c = useTheme();
  return (
    <View style={styles.big}>
      <ThemedText type="heading" style={styles.bigText}>
        {value}
      </ThemedText>
      {unit ? (
        <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
          {unit}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Caption({ text, danger = false }: { text: string; danger?: boolean }) {
  const c = useTheme();
  return (
    <ThemedText type="small" style={{ color: danger ? c.danger : c.textSecondary, textAlign: 'right' }}>
      {text}
    </ThemedText>
  );
}

/** 양이나 길이를 고르는 눈금 — 분유 ml, 모유 분, 잔 시간 */
export function ValueRuler({
  label,
  value,
  onChange,
  big,
  unit,
  caption,
  danger,
  ...scale
}: Scale & { label: string; value: number; onChange: (v: number) => void; big: string; unit?: string; caption?: string | null; danger?: boolean }) {
  return (
    <View style={styles.group}>
      <Head label={label}>
        <Big value={big} unit={unit} />
      </Head>
      <Ruler {...scale} value={value} onChange={onChange} aria={`${label} ${big}${unit ?? ''}`} />
      {caption ? <Caption text={caption} danger={danger} /> : null}
    </View>
  );
}

const dayWord = (at: Date, now: Date) => {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / DAY);
  return days === 0 ? '오늘' : days === 1 ? '어제' : `${at.getMonth() + 1}월 ${at.getDate()}일`;
};

/**
 * 때를 고르는 눈금 — 1분 단위, 5분마다 눈금, 30분마다 시각. 고른 때 앞뒤 하루를 그리고 지금 뒤로는 그리지 않는다.
 * 때 글자를 누르면 날짜와 시간 바퀴(iOS · 웹은 아래에 펼치고, 안드로이드는 창). 바퀴로 범위 밖을 고르면 그 때를 가운데로 다시 그린다.
 */
export function TimeRuler({ label, value, onChange, caption }: { label: string; value: Date; onChange: (at: Date) => void; caption?: string | null }) {
  const c = useTheme();
  const now = useNow(false);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => value.getTime());
  const lo = anchor - DAY;
  const hi = Math.min(now.getTime(), anchor + DAY);
  const base = startOfDay(new Date(lo)).getTime();
  const minV = Math.ceil((lo - base) / MIN);
  const maxV = Math.max(minV, Math.floor((hi - base) / MIN));
  const v = Math.round((value.getTime() - base) / MIN);
  const atNow = hi === now.getTime();

  const pick = (d: Date) => {
    if (d.getTime() < lo || d.getTime() > hi) setAnchor(d.getTime());
    onChange(d);
  };
  const ago = Math.round((now.getTime() - value.getTime()) / MIN);
  const auto = ago < 1 ? '지금' : `${durationLabel(ago)} 전`;
  const text = useMemo(() => (m: number) => hhmm(base + m * MIN), [base]);

  return (
    <View style={styles.group}>
      <Head label={label}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${dayWord(value, now)} ${value.getHours()}시 ${value.getMinutes()}분. 눌러서 날짜 바꾸기`}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          onPress={() => {
            tap();
            if (INLINE_WHEEL) setOpen((o) => !o);
            else pickDateTime(value, pick);
          }}
          style={({ pressed }) => [styles.when, pressed && { opacity: 0.6 }]}>
          <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
            {dayWord(value, now)}
          </ThemedText>
          <ThemedText type="heading" style={styles.bigText}>
            {hhmm(value)}
          </ThemedText>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={open ? c.accent : c.textSecondary} />
        </Pressable>
      </Head>
      <Ruler
        value={Math.min(maxV, Math.max(minV, v))}
        onChange={(m) => onChange(new Date(base + m * MIN))}
        aria={`${label} ${dayWord(value, now)} ${hhmm(value)}`}
        min={minV}
        max={maxV}
        step={1}
        px={1.6}
        tick={5}
        mid={15}
        every={30}
        text={text}
        nowAtMax={atNow}
      />
      {caption !== null ? <Caption text={caption ?? auto} /> : null}
      {open && <DateTimeWheel value={value} onChange={pick} />}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  bigText: { fontSize: 26, lineHeight: 32, fontWeight: 700, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  when: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  box: { height: H, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  marker: { position: 'absolute', top: 0 },
});
