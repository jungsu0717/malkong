/**
 * 오늘 아기 소식 카드 (SPEC-LOG-06, task log/004 · log/009, decisions/042) — 하루 흐름의 「오늘 소식 보내기」에서 연다.
 *
 * 흰 카드(가로:세로 4:5)에 하루 24시간 고리 — 위가 0시, 시계 방향으로 잠은 굵은 먹색 구간, 수유는 코랄 점, 기저귀는 바깥쪽 노란 점. 가운데 매트 위 버디(세 자세 중 무작위),
 * 위에 날짜 · 「함께한 지 74일」 · 그날 메모 한 줄, 아래에 수유 · 잠 · 기저귀 합계. 시트에서 카드를 먼저 보여 주고 「공유하기」로 1080×1350 그림을 공유한다(share-image.ts).
 * 가족 단톡방에 보내는 그림이라 아기 이름 · 체온 · 변 색은 넣지 않는다(day-news.ts). 밖으로 나가는 그림이라 다크 모드에서도 밝은 판 그대로다(Colors.light).
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef, useState, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { POSES } from '@/components/growth/growth-hero';
import { shareImage } from '@/components/share-image';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { DayNews, DayRing } from '@/data/day-news';
import { durationLabel } from '@/data/event-summary';
import type { BuddyPose } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

/** 카드를 그린 기준 크기 — 화면 너비에 맞춰 이 비율로 키우고 줄인다(기념 카드와 같다) */
const BASE_W = 360;
const BASE_H = 450;
const OUT_W = 1080;
const OUT_H = 1350;
/** 밖으로 나가는 그림의 색 — 폰의 다크 모드를 따르지 않는다 */
const L = Colors.light;

/** 24시간 고리 — 가운데와 반지름, 선 굵기 */
const CX = 180;
const CY = 222;
const R = 109;
const RING = 13;
/** 버디 — 발이 매트에 닿는 바닥 선과 자세마다 높이 · 매트 너비 */
const FLOOR = CY + 40;
const BUDDY: Record<BuddyPose, { h: number; mat: number }> = { lie: { h: 93, mat: 129 }, crawl: { h: 109, mat: 120 }, walk: { h: 118, mat: 92 } };

/** 고리 위의 점 — 위가 0시, 시계 방향 */
function at(hour: number, r: number): { x: number; y: number } {
  const a = (hour / 24) * 2 * Math.PI - Math.PI / 2;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

/** 잠 구간의 호 — 선 끝 장식 없이 긋고 양 끝에 동그라미를 따로 찍는다(두꺼운 곡선의 둥근 끝을 그리는 쪽마다 다르게 그려서) */
function arc(from: number, to: number): string {
  const a = at(from, R);
  const b = at(to, R);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}A${R} ${R} 0 ${to - from > 12 ? 1 : 0} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function Ring({ ring }: { ring: DayRing }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${BASE_W} ${BASE_H}`} style={StyleSheet.absoluteFill} accessibilityLabel="하루 24시간 — 잠, 수유, 기저귀">
      <Defs>
        <Pattern id="dots" patternUnits="userSpaceOnUse" x={0} y={0} width={16} height={16}>
          <Circle cx={8} cy={8} r={1.1} fill={L.flowDot} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={BASE_W} height={BASE_H} fill="url(#dots)" />
      <Circle cx={CX} cy={CY} r={R} stroke={L.surfaceStrong} strokeWidth={RING} fill="none" />
      {[0, 6, 12, 18].map((h) => {
        const a = at(h, R - 10);
        const b = at(h, R + 10);
        return <Line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={L.background} strokeWidth={3} />;
      })}
      {ring.sleeps.map((s, i) =>
        s.to - s.from >= 24 ? (
          <Circle key={i} cx={CX} cy={CY} r={R} stroke={L.ink} strokeWidth={RING} fill="none" />
        ) : (
          <Path key={i} d={arc(s.from, s.to)} stroke={L.ink} strokeWidth={RING} fill="none" />
        ),
      )}
      {ring.sleeps
        .filter((s) => s.to - s.from < 24)
        .flatMap((s, i) => [at(s.from, R), at(s.to, R)].map((p, j) => <Circle key={`cap-${i}-${j}`} cx={p.x} cy={p.y} r={RING / 2} fill={L.ink} />))}
      {ring.diapers.map((h, i) => {
        const p = at(h, R + 19);
        return <Circle key={`d${i}`} cx={p.x} cy={p.y} r={4.6} fill={L.diaperDot} />;
      })}
      {ring.feeds.map((h, i) => {
        const p = at(h, R);
        return <Circle key={`f${i}`} cx={p.x} cy={p.y} r={9} fill={L.accent} stroke={L.background} strokeWidth={3} />;
      })}
    </Svg>
  );
}

function Stat({ k, tile, icon, label, value, round = false }: { k: number; tile: string; icon: React.ReactNode; label: string; value: string; round?: boolean }) {
  // 「12번 · 1080ml」처럼 긴 값은 한 단계 작게 — 칸을 넘겨 줄임표가 붙지 않게
  const size = value.length > 10 ? 12.5 : 14;
  return (
    <View style={[styles.stat, { gap: 6 * k }]}>
      <View style={{ width: 26 * k, height: 26 * k, borderRadius: round ? 13 * k : 8 * k, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={styles.shrink}>
        <ThemedText style={{ fontSize: 10 * k, lineHeight: 13 * k, color: L.textSecondary }}>{label}</ThemedText>
        <ThemedText style={{ fontSize: size * k, lineHeight: 18 * k, fontWeight: 700, color: L.text }} numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function Legend({ k, color, label }: { k: number; color: string; label: string }) {
  return (
    <View style={[styles.legend, { gap: 4 * k }]}>
      <View style={{ width: 7 * k, height: 7 * k, borderRadius: 4 * k, backgroundColor: color }} />
      <ThemedText style={{ fontSize: 10 * k, lineHeight: 13 * k, color: L.textSecondary }}>{label}</ThemedText>
    </View>
  );
}

function NewsCard({ news, pose, width, cardRef }: { news: DayNews; pose: BuddyPose; width: number; cardRef: RefObject<View | null> }) {
  const k = width / BASE_W;
  const art = POSES[pose];
  const b = BUDDY[pose];
  const w = (b.h * art.width) / art.height;
  const { stats } = news;
  return (
    <View ref={cardRef} collapsable={false} style={{ width, height: BASE_H * k, backgroundColor: L.background, overflow: 'hidden' }}>
      <Ring ring={news.ring} />

      <View style={[styles.abs, { left: 22 * k, top: 22 * k, gap: 2 * k }]}>
        <ThemedText style={{ fontSize: 12 * k, lineHeight: 16 * k, color: L.textSecondary }}>{news.dateText}</ThemedText>
        <ThemedText style={{ fontSize: 26 * k, lineHeight: 32 * k, fontWeight: 700, letterSpacing: -0.6 * k, color: L.text }}>{news.daysText}</ThemedText>
      </View>
      <View style={[styles.logo, { right: 22 * k, top: 28 * k, gap: 4 * k }]}>
        <ThemedText style={{ fontSize: 12 * k, lineHeight: 16 * k, fontWeight: 700, color: L.textSecondary }}>육아버디</ThemedText>
        <Svg width={10 * k} height={10 * k} viewBox="-6 -6 12 12" style={{ marginTop: -7 * k }}>
          <Path d="M0,-6 L1.5,-2.1 L5.7,-1.9 L2.5,0.8 L3.5,4.9 L0,2.6 L-3.5,4.9 L-2.5,0.8 L-5.7,-1.9 L-1.5,-2.1Z" fill={L.accent} />
        </Svg>
      </View>

      {news.note && (
        <View style={[styles.abs, styles.note, { left: 22 * k, right: 22 * k, top: 78 * k, gap: 6 * k }]}>
          <View style={{ width: 28 * k, height: 28 * k, borderRadius: 8 * k, backgroundColor: L.memoBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="document-text-outline" size={15 * k} color={L.memoFg} />
          </View>
          <ThemedText style={[styles.shrink, { fontSize: 13 * k, lineHeight: 18 * k, fontWeight: 600, color: L.text }]} numberOfLines={1}>
            “{news.note}”
          </ThemedText>
        </View>
      )}

      <View style={{ position: 'absolute', left: (CX - b.mat / 2) * k, top: (CY + 33) * k, width: b.mat * k, height: 24 * k, borderRadius: 12 * k, backgroundColor: L.surface }} />
      <Image
        source={art.src}
        style={{ position: 'absolute', left: (CX - w / 2) * k, top: (FLOOR - b.h) * k, width: w * k, height: b.h * k }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />

      <View style={[styles.abs, styles.legends, { left: 0, right: 0, top: 354 * k, gap: 13 * k }]}>
        <Legend k={k} color={L.ink} label="잠" />
        <Legend k={k} color={L.accent} label="수유" />
        <Legend k={k} color={L.diaperDot} label="기저귀" />
        <View style={[styles.legend, { gap: 4 * k }]}>
          <View style={{ width: 7 * k, height: 2 * k, backgroundColor: L.textSecondary }} />
          <ThemedText style={{ fontSize: 10 * k, lineHeight: 13 * k, color: L.textSecondary }}>위가 0시, 시계 방향</ThemedText>
        </View>
      </View>

      <View style={[styles.abs, styles.stats, { left: 16 * k, right: 16 * k, top: 384 * k, gap: 8 * k }]}>
        <View style={{ flex: 1.3 }}>
          <Stat k={k} tile={L.accent} icon={<BottleIcon size={15 * k} color={L.onInk} />} label="수유" value={`${stats.feeds}번${stats.formulaMl > 0 ? ` · ${stats.formulaMl}ml` : ''}`} />
        </View>
        <View style={{ flex: 1.25 }}>
          <Stat k={k} tile={L.ink} icon={<ZzIcon size={14 * k} color={L.onInk} />} label="잠" value={durationLabel(stats.sleepMin)} />
        </View>
        <View style={{ flex: 0.85 }}>
          <Stat k={k} tile={L.peeBg} round icon={<Ionicons name="water-outline" size={14 * k} color={L.peeFg} />} label="기저귀" value={`${stats.diapers}번`} />
        </View>
      </View>
    </View>
  );
}

export function DayNewsSheet({
  news,
  title,
  pose,
  onClose,
}: {
  /** 보낼 소식 — null 이면 시트를 닫아 둔다 */
  news: DayNews | null;
  /** 시트 제목 — 「오늘 소식」 · 「11월 9일 소식」 */
  title: string;
  /** 버디 자세 — 여는 쪽이 열 때마다 무작위로 고른다(randomPose) */
  pose: BuddyPose;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const width = Math.min(window.width - Spacing.four * 2, BASE_W);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    await shareImage(card, OUT_W, OUT_H);
    setBusy(false);
  };

  return (
    <Modal visible={news !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">{title}</ThemedText>
          {news && (
            <View style={[styles.card, { borderColor: c.border }]}>
              <NewsCard news={news} pose={pose} width={width} cardRef={card} />
            </View>
          )}
          <Button
            size="lg"
            icon="share-outline"
            label="공유하기"
            disabled={busy}
            onPress={() => {
              tap();
              void share();
            }}
          />
          <Button variant="ghost" size="sm" label="닫기" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.two },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  card: { alignSelf: 'center', borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginVertical: Spacing.two },
  abs: { position: 'absolute', left: 0, top: 0 },
  note: { flexDirection: 'row', alignItems: 'center' },
  legends: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  logo: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
});
