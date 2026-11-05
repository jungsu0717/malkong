/**
 * 1년 보기의 줄 (SPEC-MAIN-11, task today/013) — 왼쪽 세로 줄과 점, 오른쪽 카드. 하루 보기는 2026-11-05 에 n8n 식 노드(flow-graph.tsx)로 바꿨다.
 *
 * 지난 쪽은 실선, 지금 뒤는 점선이다. 시각은 「11:30」처럼 24시간.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { tap, type IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export const SPINE = 40;
const LINE_X = 19;

export type Port = 'feed' | 'sleep' | 'side' | 'routine' | 'now' | 'future' | 'futureFeed' | 'start' | 'none';
export type Segment = 'solid' | 'dashed' | 'none';

/** 세로 줄 한 토막 — 실선은 View, 점선은 SVG */
function Seg({ kind, style }: { kind: Segment; style: StyleProp<ViewStyle> }) {
  const c = useTheme();
  if (kind === 'none') return null;
  if (kind === 'solid') return <View style={[styles.seg, { backgroundColor: c.flowLine }, style]} />;
  return (
    <View style={[styles.seg, style]}>
      <Svg width={2} height="100%">
        <Line x1={1} y1={1} x2={1} y2="100%" stroke={c.flowLine} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function Dot({ port }: { port: Port }) {
  const c = useTheme();
  switch (port) {
    case 'feed':
    case 'futureFeed':
      return <View style={[styles.dot12, { backgroundColor: c.card, borderColor: c.accent, borderWidth: 2.5 }]} />;
    case 'sleep':
      return <View style={[styles.dot12, { backgroundColor: c.ink, borderColor: c.page, borderWidth: 2 }]} />;
    case 'routine':
      return <View style={[styles.dot10, { backgroundColor: c.flowLine }]} />;
    case 'now':
      return <View style={[styles.dot16, { backgroundColor: c.accent, borderColor: c.accentSoft, borderWidth: 3 }]} />;
    case 'future':
    case 'start':
      return <View style={[styles.dot10, { backgroundColor: c.page, borderColor: c.flowLine, borderWidth: 2 }]} />;
    default:
      return null;
  }
}

/**
 * 노드 한 줄 — 왼쪽 줄과 점, 오른쪽 내용. `portTop` 을 주면 점이 그 높이에(키 큰 카드), 아니면 가운데.
 */
export function FlowRow({
  port,
  above,
  below,
  portTop,
  dim = false,
  children,
}: {
  port: Port;
  above: Segment;
  below: Segment;
  portTop?: number;
  dim?: boolean;
  children: ReactNode;
}) {
  const c = useTheme();
  const center = portTop === undefined;
  return (
    <View style={[styles.row, dim && styles.dim]}>
      <View style={styles.spine}>
        <Seg kind={above} style={center ? { top: 0, height: '50%' } : { top: 0, height: portTop }} />
        <Seg kind={below} style={center ? { top: '50%', bottom: 0 } : { top: portTop, bottom: 0 }} />
        {port === 'side' ? (
          <View style={[styles.branch, { backgroundColor: c.flowLine }, center ? { top: '50%' } : { top: portTop }]} />
        ) : (
          <View style={[styles.dotWrap, center ? { top: '50%' } : { top: portTop }]}>
            <Dot port={port} />
          </View>
        )}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/** 점선 테두리 버튼 — 「이전 기록 8개」 · 「지난 접종 · 검진 2개」 */
export function ChipButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, { borderColor: c.flowLine, backgroundColor: pressed ? c.surfaceStrong : c.page }]}>
      <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600 }}>
        {label}
      </ThemedText>
      <Ionicons name={icon} size={14} color={c.textSecondary} />
    </Pressable>
  );
}

/**
 * 예정 노드 — 점선 테두리 카드. 왼쪽 아이콘 칸 · 제목과 작은 글 · 오른쪽 끝(종 · 동그라미 · 닫기).
 * `tone` 이 accent 면 아이콘이 코랄(다음 수유)
 */
export function FutureCard({
  icon,
  title,
  sub,
  right,
  tone = 'neutral',
  onPress,
  onLongPress,
  label,
}: {
  icon: ReactNode | IconName;
  title: string;
  sub?: string | null;
  right?: ReactNode;
  tone?: 'neutral' | 'accent';
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
}) {
  const c = useTheme();
  const body = (
    <>
      <View style={[styles.tile, styles.tileDashed, { borderColor: tone === 'accent' ? c.accent : c.flowLine }]}>
        {typeof icon === 'string' ? <Ionicons name={icon as IconName} size={18} color={tone === 'accent' ? c.accent : c.textSecondary} /> : icon}
      </View>
      <View style={styles.text}>
        <ThemedText type="body" style={{ fontWeight: 600, lineHeight: 20 }} numberOfLines={2} lineBreakStrategyIOS="hangul-word">
          {title}
        </ThemedText>
        {sub ? (
          <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </>
  );
  const style = [styles.card, styles.future, { borderColor: c.flowLine, backgroundColor: c.page }];
  if (!onPress && !onLongPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [...style, pressed && { backgroundColor: c.surfaceStrong }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dim: { opacity: 0.35 },
  spine: { width: SPINE, flexShrink: 0 },
  seg: { position: 'absolute', left: LINE_X, width: 2 },
  branch: { position: 'absolute', left: LINE_X + 2, width: SPINE - LINE_X - 2, height: 2, marginTop: -1 },
  dotWrap: { position: 'absolute', left: 0, width: LINE_X * 2 + 2, height: 0, alignItems: 'center', justifyContent: 'center' },
  dot10: { width: 10, height: 10, borderRadius: 5 },
  dot12: { width: 12, height: 12, borderRadius: 6 },
  dot16: { width: 16, height: 16, borderRadius: 8 },
  content: { flex: 1, minWidth: 0, paddingVertical: 3 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  future: { borderStyle: 'dashed', borderWidth: 1.5 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tileDashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontWeight: 700, lineHeight: 20 },
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 4,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pillText: { flexShrink: 1 },
  gap: { fontSize: 11, lineHeight: 20 },
  chip: {
    alignSelf: 'flex-start',
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
