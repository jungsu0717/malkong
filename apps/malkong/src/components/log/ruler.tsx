/**
 * 좌우로 끄는 눈금 (SPEC-LOG-01, task log/007) — 분유 양, 모유 먹인 시간, 기록의 때, 잔 시간을 고른다.
 *
 * 가로 ScrollView 라서 손을 놓아도 미끄러지다 멈춘다. 가운데 코랄 선이 고른 값이고, 칸이 바뀔 때마다 가볍게 진동한다.
 * 값이 밖에서 바뀌면(달력으로 날짜를 고르면) 눈금도 따라 움직인다. 때 눈금은 지금 뒤로 그리지 않고, 지금 자리에 코랄 점선과 「지금」을 둔다.
 * 눈금은 보이는 곳 앞뒤 토막만 그린다 — 때 눈금은 이틀 치라 한 장으로 그리면 폰 메모리를 많이 쓴다.
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
/** 눈금을 나눠 그리는 토막 너비 — 화면보다 넓게 */
const CHUNK = 600;
/** 토막 양옆 여백 — 토막 끝에 걸친 숫자가 잘리지 않게 */
const BLEED = 24;

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
  /** 손을 놓은 뒤 미끄러지는 정도 — 때 눈금은 휙 밀면 멀리 가게 'normal' */
  glide?: 'fast' | 'normal';
};

type ChunkColors = { tick: string; label: string; text: string; accent: string; accentText: string };

/** 눈금 토막 k 한 장 — 콘텐츠 좌표 x = w/2 + (v - min) * px 중 [k*CHUNK, (k+1)*CHUNK) 에 드는 눈금 */
function drawChunk(k: number, s: Omit<Scale, 'step' | 'glide'> & { w: number }, col: ChunkColors): ReactNode {
  const { w, min, max, px, tick, mid, every, text, skipZero, nowAtMax } = s;
  const x0 = k * CHUNK;
  const out: ReactNode[] = [];
  const vFrom = Math.max(min, min + (x0 - w / 2) / px);
  const vTo = Math.min(max, min + (x0 + CHUNK - w / 2) / px);
  for (let v = Math.ceil(vFrom / tick) * tick; v <= vTo + 1e-6; v += tick) {
    const cx = w / 2 + (v - min) * px;
    if (cx < x0 || cx >= x0 + CHUNK) continue;
    const x = cx - x0 + BLEED;
    const isLabel = Math.abs(v % every) < 1e-6;
    const isMid = Math.abs(v % mid) < 1e-6;
    out.push(
      <Line
        key={`t${v}`}
        x1={x}
        y1={10}
        x2={x}
        y2={isLabel ? 34 : isMid ? 26 : 19}
        stroke={isLabel ? col.label : col.tick}
        strokeWidth={isLabel ? 1.8 : isMid ? 1.4 : 1.1}
        strokeLinecap="round"
      />,
    );
    if (isLabel && !(skipZero && v === 0)) {
      out.push(
        <SvgText key={`l${v}`} x={x} y={52} fontSize={11} fill={col.text} textAnchor="middle">
          {text(v)}
        </SvgText>,
      );
    }
  }
  const nowX = w / 2 + (max - min) * px;
  if (nowAtMax && nowX >= x0 && nowX < x0 + CHUNK) {
    const x = nowX - x0 + BLEED;
    out.push(<Line key="now" x1={x} y1={8} x2={x} y2={40} stroke={col.accent} strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="3 3" />);
    out.push(
      <SvgText key="nowText" x={x + 8} y={29} fontSize={12} fontWeight="700" fill={col.accentText}>
        지금
      </SvgText>,
    );
  }
  return (
    <Svg key={k} width={CHUNK + BLEED * 2} height={H} style={[styles.chunk, { left: x0 - BLEED }]}>
      {out}
    </Svg>
  );
}

/** 눈금 한 줄 — value 는 Scale 의 값 단위 */
export function Ruler({ value, onChange, aria, ...scale }: Scale & { value: number; onChange: (v: number) => void; aria: string }) {
  const c = useTheme();
  const { min, max, step, px, tick, mid, every, text, skipZero, nowAtMax, glide = 'fast' } = scale;
  const [w, setW] = useState(0);
  const ref = useRef<ScrollView>(null);
  /** 마지막으로 이 눈금이 알린 값 — 밖에서 바뀐 값만 눈금을 옮긴다 */
  const last = useRef<number | null>(null);
  /** 화면 왼쪽 끝이 있는 토막 — 이 토막 앞뒤만 그린다 */
  const [chunk, setChunk] = useState(() => Math.max(0, Math.floor(((Math.min(max, Math.max(min, value)) - min) * px) / CHUNK)));
  const chunkRef = useRef(chunk);
  const span = Math.max(0, max - min) * px;

  const follow = (x: number) => {
    const k = Math.max(0, Math.floor(x / CHUNK));
    if (k === chunkRef.current) return;
    chunkRef.current = k;
    setChunk(k);
  };

  useEffect(() => {
    if (!w || last.current === value) return;
    last.current = value;
    const x = (Math.min(max, Math.max(min, value)) - min) * px;
    ref.current?.scrollTo({ x, animated: false });
    const k = Math.max(0, Math.floor(x / CHUNK));
    if (k !== chunkRef.current) {
      chunkRef.current = k;
      setChunk(k);
    }
  }, [value, min, max, px, w]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    follow(e.nativeEvent.contentOffset.x);
    const raw = min + e.nativeEvent.contentOffset.x / px;
    const v = Math.min(max, Math.max(min, min + Math.round((raw - min) / step) * step));
    if (v === last.current) return;
    last.current = v;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(v);
  };

  // 보이는 토막 앞뒤만 — 토막이 바뀔 때만 다시 만든다. 끄는 동안 수백 개를 다시 만들지 않게
  const chunks = useMemo(() => {
    if (!w) return null;
    const lastChunk = Math.floor((w + span) / CHUNK);
    const colors = { tick: c.flowLine, label: c.textTertiary, text: c.textSecondary, accent: c.accent, accentText: c.accentText };
    const out: ReactNode[] = [];
    for (let k = Math.max(0, chunk - 1); k <= Math.min(lastChunk, chunk + 2); k++) {
      out.push(drawChunk(k, { w, min, max, px, tick, mid, every, text, skipZero, nowAtMax }, colors));
    }
    return out;
  }, [w, span, chunk, min, max, px, tick, mid, every, skipZero, nowAtMax, text, c]);

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
          decelerationRate={glide}
          contentContainerStyle={{ width: w + span, height: H }}>
          {chunks}
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
 * 때를 고르는 눈금 — 1분마다 작은 눈금(6pt), 5분마다 중간 눈금, 15분마다 시각. 천천히 끌면 1분씩, 휙 밀면 멀리 미끄러진다.
 * 고른 때 앞뒤 하루를 그리고 지금 뒤로는 그리지 않는다. 때 글자를 누르면 날짜 바퀴(시각은 그대로, iOS · 웹은 아래에 펼치고
 * 안드로이드는 창). 범위 밖 날짜를 고르면 그 때를 가운데로 다시 그린다.
 */
export function TimeRuler({
  label,
  value,
  onChange,
  caption,
  danger = false,
}: {
  label: string;
  value: Date;
  onChange: (at: Date) => void;
  caption?: string | null;
  danger?: boolean;
}) {
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
        px={6}
        tick={1}
        mid={5}
        every={15}
        text={text}
        nowAtMax={atNow}
        glide="normal"
      />
      {caption !== null ? <Caption text={caption ?? auto} danger={danger} /> : null}
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
  chunk: { position: 'absolute', top: 0 },
});
