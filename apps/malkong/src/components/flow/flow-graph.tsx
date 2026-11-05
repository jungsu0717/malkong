/**
 * 하루 흐름 그림 (SPEC-MAIN-08, task today/014) — 자리와 선은 `flow-layout.ts` 가 계산하고, 여기서는 노드와 선을 그린다.
 *
 * 잠은 먹색 네모, 잠과 잠 사이는 넓은 노드, 그 사이 기록은 아래로 점선이 갈라진 동그라미. 이름과 시각은 노드 아래에 둔다(n8n 처럼).
 * 지난 선 위로는 작은 점이 시간 방향으로 흐르고, 지금으로 들어오는 선은 코랄이다. 움직임 줄이기를 켜거나 화면이 안 보이면 멈춘다.
 * 새로 남긴 기록은 그 자리에 튀어나온다 — 처음 그릴 때는 튀어나오지 않는다(LayoutAnimationConfig skipEntering).
 */

import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  LayoutAnimationConfig,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { BottleIcon } from '@/components/baby-icons';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import type { IconName } from '@/components/ui';
import { SQ, SUB, type FlowGeo, type Rect } from '@/data/flow-layout';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DOT_GAP = 13;

/** 선 — 갈라지는 점선, 앞으로의 점선, 지난 선과 흐르는 점, 지금으로 들어오는 코랄 선 */
export function FlowEdges({ geo, width }: { geo: FlowGeo; width: number }) {
  const c = useTheme();
  const reduce = useReducedMotion();
  const focused = useIsFocused();
  const offset = useSharedValue(0);
  const moving = !reduce && focused;
  useEffect(() => {
    if (!moving) return;
    offset.set(0);
    offset.set(withRepeat(withTiming(-(DOT_GAP + 0.1), { duration: 1600, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(offset);
  }, [moving, offset]);
  const pastDots = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  const nowDots = useAnimatedProps(() => ({ strokeDashoffset: offset.get() * 1.6 }));
  const { past, now, fans, future } = geo.edges;
  return (
    <Svg width={width} height={geo.height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {fans ? <Path d={fans} fill="none" stroke={c.flowLine} strokeWidth={1.6} strokeDasharray="5 4" /> : null}
      {future ? <Path d={future} fill="none" stroke={c.flowLine} strokeWidth={2} strokeDasharray="4 5" /> : null}
      {past ? <Path d={past} fill="none" stroke={c.flowLine} strokeWidth={2} strokeLinecap="round" /> : null}
      {past ? (
        <AnimatedPath d={past} fill="none" stroke={c.textTertiary} strokeWidth={3.6} strokeLinecap="round" strokeDasharray={`0.1 ${DOT_GAP}`} animatedProps={pastDots} />
      ) : null}
      {now ? <Path d={now} fill="none" stroke={c.accent} strokeOpacity={0.4} strokeWidth={2.2} strokeLinecap="round" /> : null}
      {now ? (
        <AnimatedPath d={now} fill="none" stroke={c.accent} strokeWidth={3.8} strokeLinecap="round" strokeDasharray={`0.1 ${DOT_GAP}`} animatedProps={nowDots} />
      ) : null}
    </Svg>
  );
}

/** 노드 아래 두 줄 — 이름과 시각 */
export function NodeLabel({ cx, top, title, sub, width = 116, dim = false }: { cx: number; top: number; title: string; sub?: string | null; width?: number; dim?: boolean }) {
  const c = useTheme();
  return (
    <View pointerEvents="none" style={[styles.label, { left: cx - width / 2, top, width, opacity: dim ? 0.55 : 1 }]}>
      <ThemedText type="caption" numberOfLines={1} style={styles.labelTitle}>
        {title}
      </ThemedText>
      {sub ? (
        <ThemedText type="caption" numberOfLines={1} style={[styles.labelSub, { color: c.textSecondary }]}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** 노드 옆의 작은 포트 동그라미 */
export function Port({ x, y, accent = false }: { x: number; y: number; accent?: boolean }) {
  const c = useTheme();
  return <View pointerEvents="none" style={[styles.port, { left: x - 4.5, top: y - 4.5, borderColor: accent ? c.accent : c.flowLine, backgroundColor: c.card }]} />;
}

/** 잠 네모 — 먹색, 달 아이콘 */
export function SleepSquare({ rect, label, onPress }: { rect: Rect; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 자세히`}
      onPress={onPress}
      style={({ pressed }) => [styles.square, styles.shadow, { left: rect.x, top: rect.y, backgroundColor: c.ink, opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name="moon" size={24} color={c.onInk} />
    </Pressable>
  );
}

/** 잠과 잠 사이 — 넓은 노드. 해 아이콘, 시각, 그 아래 걸린 시간 */
export function WakeNode({ rect, title, sub, onPress }: { rect: Rect; title: string; sub: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub} 자세히`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wide,
        styles.shadow,
        { left: rect.x, top: rect.y, width: rect.w, height: rect.h, backgroundColor: pressed ? c.surface : c.card, borderColor: c.border },
      ]}>
      <View style={[styles.tile, { backgroundColor: c.surface }]}>
        <Ionicons name="sunny-outline" size={19} color={c.text} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="heading" numberOfLines={1} style={styles.wideTitle}>
          {title}
        </ThemedText>
        <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary }}>
          {sub}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** 지금 노드의 코랄 점 — 천천히 숨 쉬듯 퍼진다 */
export function PulseDot({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.get()), transform: [{ scale: 1 + t.get() * 1.4 }] }));
  return (
    <View style={styles.pulse}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: color }, ring]} />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

/** 지금 노드 — 코랄 테두리. 자는 중이면 먹색 바탕 */
export function NowNode({ rect, sleeping, title, sub, children, onPress }: { rect: Rect; sleeping: boolean; title: string; sub: string | null; children?: ReactNode; onPress?: () => void }) {
  const c = useTheme();
  const bg = sleeping ? c.ink : c.card;
  const fg = sleeping ? c.onInk : c.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, sub].filter(Boolean).join(', ')}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.now, styles.shadow, { left: rect.x, top: rect.y, width: rect.w, minHeight: rect.h, backgroundColor: bg, borderColor: c.accent }]}>
      <View style={styles.nowHead}>
        <View style={[styles.tile, { backgroundColor: sleeping ? 'rgba(255,255,255,0.12)' : c.accentSoft }]}>
          {sleeping ? <Ionicons name="moon" size={18} color={c.onInk} /> : <PulseDot color={c.accent} />}
        </View>
        <View style={styles.flex}>
          <ThemedText type="heading" numberOfLines={1} style={[styles.nowTitle, { color: fg }]}>
            {title}
          </ThemedText>
          {sub ? (
            <ThemedText type="caption" numberOfLines={1} style={{ color: sleeping ? 'rgba(255,255,255,0.72)' : c.textSecondary }}>
              {sub}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {children}
    </Pressable>
  );
}

export type SubKind = 'breast' | 'formula' | 'pee' | 'poo' | 'temp' | 'weight' | 'height' | 'routine' | 'todo';

/** 갈라진 기록 — 동그라미 아이콘. 완료한 루틴과 할 일은 체크 표시 */
export function SubNode({
  cx,
  cy,
  kind,
  title,
  sub,
  aria,
  onPress,
}: {
  cx: number;
  cy: number;
  kind: SubKind;
  title: string;
  sub: string;
  aria: string;
  onPress: () => void;
}) {
  const c = useTheme();
  const feed = kind === 'breast' || kind === 'formula';
  const done = kind === 'routine' || kind === 'todo';
  const ion: Partial<Record<SubKind, IconName>> = { breast: 'heart', pee: 'water-outline', poo: 'water', temp: 'thermometer-outline', weight: 'scale-outline', height: 'resize-outline' };
  const icon =
    kind === 'formula' ? (
      <BottleIcon size={19} color="#FFFFFF" />
    ) : done ? (
      <RoutineIcon title={title} size={19} color={c.text} />
    ) : (
      <Ionicons name={ion[kind] ?? 'ellipse-outline'} size={kind === 'breast' ? 18 : 19} color={feed ? '#FFFFFF' : kind === 'poo' ? c.textSecondary : c.text} />
    );
  return (
    <>
      <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.subWrap, { left: cx - SUB / 2, top: cy - SUB / 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={aria}
          hitSlop={6}
          onPress={onPress}
          style={({ pressed }) => [
            styles.sub,
            styles.shadow,
            feed ? { backgroundColor: c.accent } : done ? { backgroundColor: c.surfaceStrong } : { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.flowLine },
            pressed && { opacity: 0.8 },
          ]}>
          {icon}
        </Pressable>
        {done && (
          <View pointerEvents="none" style={[styles.badge, { backgroundColor: c.ink, borderColor: c.card }]}>
            <Ionicons name="checkmark" size={10} color={c.onInk} />
          </View>
        )}
      </Animated.View>
      <NodeLabel cx={cx} top={cy + 24} title={title} sub={sub} width={72} />
    </>
  );
}

/** 앞으로 올 것 — 흐린 점선 네모 */
export function FutureSquare({
  rect,
  icon,
  accent = false,
  aria,
  onPress,
  onLongPress,
}: {
  rect: Rect;
  icon: ReactNode;
  accent?: boolean;
  aria: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={aria}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={({ pressed }) => [
        styles.square,
        { left: rect.x, top: rect.y, borderWidth: 1.5, borderStyle: 'dashed', borderColor: accent ? c.accent : c.flowLine, backgroundColor: pressed ? c.surface : c.card, opacity: 0.6 },
      ]}>
      {icon}
    </Pressable>
  );
}

/** 접힌 이전 기록 */
export function ChipNode({ rect, label, onPress }: { rect: Rect; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 펼치기`}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.shadow, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderColor: c.border, backgroundColor: pressed ? c.surface : c.card }]}>
      <ThemedText type="caption" style={{ fontWeight: 700 }}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
    </Pressable>
  );
}

/** 흐름 전체의 틀 — 선 위에 노드를 얹는다. 처음 그릴 때는 튀어나오지 않는다 */
export function FlowCanvas({ geo, width, children }: { geo: FlowGeo; width: number; children: ReactNode }) {
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={{ width, height: geo.height }}>
        <FlowEdges geo={geo} width={width} />
        {children}
      </View>
    </LayoutAnimationConfig>
  );
}

export const NODE = SQ;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shadow: {
    shadowColor: '#16161A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  label: { position: 'absolute', alignItems: 'center' },
  labelTitle: { fontWeight: 700, fontSize: 12.5, lineHeight: 17 },
  labelSub: { fontSize: 11, lineHeight: 15, fontVariant: ['tabular-nums'] },
  port: { position: 'absolute', width: 9, height: 9, borderRadius: 5, borderWidth: 1.8 },
  square: { position: 'absolute', width: SQ, height: SQ, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wide: { position: 'absolute', borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  wideTitle: { fontWeight: 700, fontSize: 14, lineHeight: 19 },
  now: { position: 'absolute', borderRadius: 16, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  nowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nowTitle: { fontWeight: 700, fontSize: 16, lineHeight: 21 },
  pulse: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  pulseDot: { width: 12, height: 12, borderRadius: 6 },
  subWrap: { position: 'absolute', width: SUB, height: SUB },
  sub: { width: SUB, height: SUB, borderRadius: SUB / 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -5, bottom: -5, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
