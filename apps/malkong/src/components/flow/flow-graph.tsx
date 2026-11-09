/**
 * 하루 흐름 그림 (SPEC-MAIN-08, task today/017) — 자리와 선은 `flow-layout.ts` 가 계산하고, 여기서는 틀 · 노드 · 선을 그린다.
 *
 * 묶음은 둥근 틀, 수유는 코랄 네모, 기저귀는 동그라미, 완료한 루틴과 할 일은 흰 네모에 체크, 잠은 먹색 네모. 이름과 시각은 노드 아래에 둔다(n8n 처럼).
 * 지난 선 위로는 작은 점이 시간 방향으로 흐르고, 지금 묶음 안의 선은 코랄이다. 움직임 줄이기를 켜거나 화면이 안 보이면 멈춘다.
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

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { DiaperGlyph, diaperTone } from '@/components/log/diaper-glyph';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import type { IconName } from '@/components/ui';
import type { StoolColor } from '@/data/events';
import { DOT, HEAD, ITEM, SLEEP_NOW_H, type FlowGeo, type Rect } from '@/data/flow-layout';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DOT_GAP = 13;

/** 선 — 지난 선과 흐르는 점, 지금 묶음 안의 코랄 선, 앞으로의 점선 */
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
  const { past, now, future } = geo.edges;
  return (
    <Svg width={width} height={geo.height} style={StyleSheet.absoluteFill} pointerEvents="none">
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
export function NodeLabel({
  cx,
  top,
  title,
  sub,
  width = 70,
  dim = false,
  accent = false,
  gap = null,
}: {
  cx: number;
  top: number;
  title: string;
  sub?: string | null;
  width?: number;
  dim?: boolean;
  accent?: boolean;
  /** 셋째 줄 — 같은 기록끼리 간격(코랄) */
  gap?: string | null;
}) {
  const c = useTheme();
  return (
    <View pointerEvents="none" style={[styles.label, { left: cx - width / 2, top, width, opacity: dim ? 0.55 : 1 }]}>
      <ThemedText type="caption" numberOfLines={1} style={[styles.labelTitle, accent && { color: c.accentText }]}>
        {title}
      </ThemedText>
      {sub ? (
        <ThemedText type="caption" numberOfLines={1} style={[styles.labelSub, { color: c.textSecondary }]}>
          {sub}
        </ThemedText>
      ) : null}
      {gap ? (
        <ThemedText type="caption" numberOfLines={1} style={[styles.labelGap, { color: c.accentText }]}>
          {gap}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** 묶음 틀 — 위에 「07:10~08:30」과 오른쪽 「1시간 20분」. 지금 묶음은 코랄 테두리 */
export function BlockFrame({
  rect,
  title,
  right,
  now = false,
  aria,
  onPress,
  children,
}: {
  rect: Rect;
  title: string;
  right?: string | null;
  now?: boolean;
  aria: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={aria}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frame,
        now && styles.nowShadow,
        {
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          backgroundColor: pressed ? c.surface : c.card,
          borderColor: now ? c.accent : c.border,
          borderWidth: now ? 2 : 1,
          shadowColor: c.accent,
        },
      ]}>
      <View style={[styles.frameHead, { height: HEAD - (now ? 1 : 0) }]}>
        <ThemedText type="caption" numberOfLines={1} style={[styles.frameTitle, now && styles.frameTitleNow]}>
          {title}
        </ThemedText>
        {right ? (
          <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary, fontSize: 12 }}>
            {right}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </Pressable>
  );
}

export type ItemKind = 'breast' | 'formula' | 'pee' | 'poo' | 'both' | 'temp' | 'weight' | 'height' | 'routine' | 'todo' | 'memo';

/** 묶음 안 기록 하나 — 수유는 코랄 네모, 기저귀는 동그라미(소변 노랑, 대변 갈색), 체온 빨강, 루틴과 할 일은 파랑 네모에 체크, 메모 보라. gap 은 셋째 줄 간격 */
export function ItemNode({
  cx,
  cy,
  kind,
  title,
  sub,
  aria,
  stool,
  gap,
  highlight,
  onPress,
}: {
  cx: number;
  cy: number;
  kind: ItemKind;
  title: string;
  sub: string;
  aria: string;
  /** 같은 기록끼리 간격 「+3시간 5분」 */
  gap?: string | null;
  /** 물어보기가 답한 기록 — 코랄 테두리와 짧은 표시 */
  highlight?: string | null;
  /** 대변 색을 적었으면 대변 아이콘을 그 색으로 채운다 */
  stool?: StoolColor | null;
  onPress: () => void;
}) {
  const c = useTheme();
  const diaper = isDiaper(kind);
  const done = kind === 'routine' || kind === 'todo';
  const size = diaper ? 42 : ITEM;
  const icon = <NodeIcon kind={kind} title={title} stool={stool ?? null} size={21} />;
  const tone = nodeTone(kind, c);
  return (
    <>
      <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.itemWrap, { left: cx - size / 2, top: cy - size / 2, width: size, height: size }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={aria}
          hitSlop={6}
          onPress={onPress}
          style={({ pressed }) => [
            styles.item,
            styles.shadow,
            { width: size, height: size, borderRadius: diaper ? size / 2 : 12 },
            tone,
            pressed && { opacity: 0.8 },
          ]}>
          {icon}
        </Pressable>
        {highlight != null && <HighlightRing size={size} round={diaper} />}
        {done && (
          <View pointerEvents="none" style={[styles.badge, { backgroundColor: c.ink, borderColor: c.card }]}>
            <Ionicons name="checkmark" size={10} color={c.onInk} />
          </View>
        )}
      </Animated.View>
      {/* 비춘 기록은 테두리와 코랄 이름 — 위에 표시를 붙이면 묶음 제목을 가린다 */}
      <NodeLabel cx={cx} top={cy + ITEM / 2 + 8} title={title} sub={sub} gap={gap} accent={highlight != null} width={title.length > 6 || sub.length > 6 ? 86 : 70} />
    </>
  );
}

const isDiaper = (kind: ItemKind): kind is 'pee' | 'poo' | 'both' => kind === 'pee' || kind === 'poo' || kind === 'both';

/** 기록마다 바탕색 — 흰 네모로 다 같아 보이지 않게(빌드 12 피드백). 흐름 노드와 목록 줄이 같이 쓴다 */
export function nodeTone(kind: ItemKind, c: ReturnType<typeof useTheme>) {
  if (kind === 'breast' || kind === 'formula') return { backgroundColor: c.accent };
  if (isDiaper(kind)) return { ...diaperTone(kind, c), borderWidth: 1.5 };
  if (kind === 'temp') return { backgroundColor: c.tempBg, borderColor: c.tempLine, borderWidth: 1.5 };
  if (kind === 'routine' || kind === 'todo') return { backgroundColor: c.doneBg, borderColor: c.doneLine, borderWidth: 1.5 };
  if (kind === 'memo') return { backgroundColor: c.memoBg, borderColor: c.memoLine, borderWidth: 1.5 };
  return { backgroundColor: c.surface, borderColor: c.flowLine, borderWidth: 1.5 };
}

/** 기록 아이콘 — 수유는 흰 하트 · 젖병, 기저귀는 물방울과 대변, 루틴은 이름에 맞는 아이콘 */
export function NodeIcon({ kind, title, stool, size }: { kind: ItemKind; title: string; stool: StoolColor | null; size: number }) {
  const c = useTheme();
  if (kind === 'formula') return <BottleIcon size={size} color="#FFFFFF" />;
  if (kind === 'routine' || kind === 'todo') return <RoutineIcon title={title} size={size} color={c.doneFg} />;
  if (isDiaper(kind)) return <DiaperGlyph diaper={kind} color={stool} size={size} />;
  const ion: Partial<Record<ItemKind, IconName>> = { breast: 'heart-outline', temp: 'thermometer-outline', weight: 'scale-outline', height: 'resize-outline', memo: 'document-text-outline' };
  const color = kind === 'breast' ? '#FFFFFF' : kind === 'temp' ? c.tempFg : kind === 'memo' ? c.memoFg : c.text;
  return <Ionicons name={ion[kind] ?? 'ellipse-outline'} size={size} color={color} />;
}

/** 물어보기가 답한 기록의 테두리 */
function HighlightRing({ size, round }: { size: number; round: boolean }) {
  const c = useTheme();
  const pad = 9;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ring,
        { left: -pad, top: -pad, width: size + pad * 2, height: size + pad * 2, borderRadius: round ? (size + pad * 2) / 2 : 18, borderColor: c.accent, shadowColor: c.accent },
      ]}
    />
  );
}

/** 숨 쉬듯 퍼지는 코랄 점 */
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

/** 지금 묶음 끝의 「지금」 점 */
export function NowDot({ cx, cy, time }: { cx: number; cy: number; time: string }) {
  const c = useTheme();
  return (
    <>
      <View accessible accessibilityLabel={`지금 ${time}`} style={[styles.nowDot, { left: cx - DOT / 2, top: cy - DOT / 2, backgroundColor: c.accentSoft }]}>
        <PulseDot color={c.accent} />
      </View>
      <NodeLabel cx={cx} top={cy + ITEM / 2 + 8} title="지금" sub={time} accent />
    </>
  );
}

/** 묶음 사이 — 기록이 없던 시간 */
export function GapPill({ cx, cy, label }: { cx: number; cy: number; label: string }) {
  const c = useTheme();
  return (
    <View pointerEvents="none" style={[styles.pill, { left: cx - 48, top: cy - 11, backgroundColor: c.page, borderColor: c.border }]}>
      <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 15, fontVariant: ['tabular-nums'] }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** 잠 — 먹색 네모, 아래에 「낮잠 1시간 10분」 「12:00~13:10」. 묶음 사이 선 위에서는 조금 작게 */
export function SleepNode({
  cx,
  cy,
  small = false,
  title,
  sub,
  gap = null,
  highlight = null,
  onPress,
}: {
  cx: number;
  cy: number;
  small?: boolean;
  title: string;
  sub: string;
  /** 앞 잠에서 깬 뒤 깨어 있던 시간 */
  gap?: string | null;
  highlight?: string | null;
  onPress: () => void;
}) {
  const c = useTheme();
  const size = small ? 40 : ITEM;
  return (
    <>
      <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.itemWrap, { left: cx - size / 2, top: cy - size / 2, width: size, height: size }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sub} ${title} 자세히`}
          hitSlop={6}
          onPress={onPress}
          style={({ pressed }) => [styles.item, styles.shadow, { width: size, height: size, borderRadius: 12, backgroundColor: c.ink, opacity: pressed ? 0.85 : 1 }]}>
          <ZzIcon size={small ? 20 : 22} color={c.onInk} />
        </Pressable>
        {highlight != null && <HighlightRing size={size} round={false} />}
      </Animated.View>
      <NodeLabel cx={cx} top={cy + size / 2 + 4} title={title} sub={sub} gap={gap} width={150} accent={highlight != null} />
    </>
  );
}

/** 지금 자는 중 — 먹색 넓은 노드, 코랄 테두리 */
export function SleepNowNode({ rect, title, sub, onPress }: { rect: Rect; title: string; sub: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={[styles.sleepNow, styles.shadow, { left: rect.x, top: rect.y, width: rect.w, height: SLEEP_NOW_H, backgroundColor: c.ink, borderColor: c.accent }]}>
      <View style={[styles.tile, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
        <ZzIcon size={19} color={c.onInk} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="heading" numberOfLines={1} style={[styles.sleepNowTitle, { color: c.onInk }]}>
          {title}
        </ThemedText>
        <ThemedText type="caption" numberOfLines={1} style={{ color: c.onInk, opacity: 0.72 }}>
          {sub}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** 앞으로 올 것 — 흐린 점선 네모 */
export function GhostNode({
  cx,
  cy,
  icon,
  title,
  sub,
  accent = false,
  aria,
  onPress,
  onLongPress,
}: {
  cx: number;
  cy: number;
  icon: ReactNode;
  title: string;
  sub: string;
  accent?: boolean;
  aria: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={aria}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={450}
        style={({ pressed }) => [
          styles.item,
          styles.ghost,
          {
            left: cx - ITEM / 2,
            top: cy - ITEM / 2,
            borderColor: accent ? c.accent : c.flowLine,
            backgroundColor: pressed ? c.surface : c.card,
            opacity: accent ? 0.85 : 0.6,
          },
        ]}>
        {icon}
      </Pressable>
      <NodeLabel cx={cx} top={cy + ITEM / 2 + 8} title={title} sub={sub} width={92} dim={!accent} accent={accent} />
    </>
  );
}

/** 접힌 이전 기록 */
export function ChipNode({ rect, label, onPress }: { rect: Rect; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.shadow, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderColor: c.flowLine, backgroundColor: pressed ? c.surface : c.card }]}>
      <ThemedText type="caption" style={{ fontWeight: 700 }}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
    </Pressable>
  );
}

/** 흐름 전체의 틀 — 묶음 틀 위에 선, 그 위에 노드를 얹는다. 처음 그릴 때는 튀어나오지 않는다 */
export function FlowCanvas({ geo, width, frames, children }: { geo: FlowGeo; width: number; frames: ReactNode; children: ReactNode }) {
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={{ width, height: geo.height }}>
        {frames}
        <FlowEdges geo={geo} width={width} />
        {children}
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shadow: {
    shadowColor: '#16161A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  nowShadow: { shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  label: { position: 'absolute', alignItems: 'center' },
  labelTitle: { fontWeight: 700, fontSize: 12.5, lineHeight: 17 },
  labelSub: { fontSize: 11, lineHeight: 15, fontVariant: ['tabular-nums'] },
  labelGap: { fontSize: 11, lineHeight: 15, fontWeight: 600, fontVariant: ['tabular-nums'] },
  ring: { position: 'absolute', borderWidth: 3, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  frame: { position: 'absolute', borderRadius: 18 },
  frameHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14 },
  frameTitle: { fontWeight: 700, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'], flexShrink: 1 },
  frameTitleNow: { fontSize: 15, lineHeight: 20 },
  itemWrap: { position: 'absolute' },
  item: { alignItems: 'center', justifyContent: 'center' },
  ghost: { position: 'absolute', width: ITEM, height: ITEM, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  nowDot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  pulse: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  pulseDot: { width: 12, height: 12, borderRadius: 6 },
  pill: { position: 'absolute', width: 96, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sleepNow: { position: 'absolute', borderRadius: 16, borderWidth: 2, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sleepNowTitle: { fontWeight: 700, fontSize: 16, lineHeight: 21 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
