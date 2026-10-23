/**
 * 성장 탭 위쪽 먹색 그림 (SPEC-STAGE-01, task growth/004 · 시안 「제안 4」) — 당근 걷기처럼 캐릭터와 굵은 막대.
 *
 * 아기방 모빌(별 · 달 · 구름) 아래 매트 위에서 버디가 움직인다 — 개월에 맞춰 누워서 바둥(0~5) · 기기(6~11) · 걷기(12~).
 * 버디 그림은 AI 로 만든 4초 반복 그림(assets/images/buddy, decisions/031)이다.
 * 막대에는 달마다 · 50일 · 100일 칸 가운데 지난 칸 하나와 앞으로 올 칸 — 네 칸. 발달 단계가 있는 달은 아래에 코랄 글씨(「2개월 · 미소」).
 * 지난 칸에는 체크, 다음 칸에는 「다음」. 발달 단계 · 기념일 칸을 누르면 그 내용으로 간다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import type { BuddyPose, StageStop, StageWindow } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

const POSES: Record<BuddyPose, { src: number; width: number; height: number }> = {
  lie: { src: require('@/assets/images/buddy/lie.webp'), width: 250, height: 148 },
  crawl: { src: require('@/assets/images/buddy/crawl.webp'), width: 206, height: 184 },
  walk: { src: require('@/assets/images/buddy/walk.webp'), width: 112, height: 188 },
};

const SCENE_HEIGHT = 200;
/** 막대 양 끝에서 첫 점 · 끝 점까지 */
const DOT_INSET = 8;
const LABEL_WIDTH = 84;

export function GrowthHero({
  topInset,
  days,
  week,
  pose,
  stage,
  onStop,
}: {
  topInset: number;
  days: number;
  week: number;
  pose: BuddyPose;
  stage: StageWindow;
  onStop: (stop: StageStop) => void;
}) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  // 탭을 열면 막대가 지금 자리까지 찬다
  useEffect(() => {
    fill.set(withTiming(stage.progress, { duration: 900 }));
  }, [fill, stage.progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  const art = POSES[pose];
  const span = Math.max(0, width - DOT_INSET * 2);
  const centerOf = (i: number) => DOT_INSET + (span * i) / (stage.stops.length - 1);
  const nextKey = stage.next?.key;

  return (
    <View style={[styles.hero, { backgroundColor: c.hero, paddingTop: topInset + 16 }]}>
      {/* 위로 당겨도 흰 바탕이 보이지 않게 */}
      <View style={[styles.overscroll, { backgroundColor: c.hero }]} />
      <View style={styles.inner}>
        <View style={styles.mobile} pointerEvents="none">
          <HeroMobile />
        </View>

        <ThemedText type="title" style={[styles.title, { color: c.onHero }]}>
          성장
        </ThemedText>
        <ThemedText type="small" style={[styles.since, { color: c.onHeroDim }]}>
          태어난 지
        </ThemedText>
        <View style={styles.dayRow} accessible accessibilityLabel={`태어난 지 ${days}일, ${week}주차`}>
          <ThemedText style={[styles.days, { color: c.onHero }]}>D+{days}</ThemedText>
          <ThemedText type="body" style={{ color: c.onHeroDim, fontWeight: 600 }}>
            {week}주차
          </ThemedText>
        </View>

        {/* 매트와 장난감, 버디 */}
        <View style={styles.scene} pointerEvents="none">
          <View style={[styles.mat, { backgroundColor: c.heroMat }]} />
          <View style={styles.toys}>
            <Toys />
          </View>
          <View style={styles.buddy}>
            <Image source={art.src} style={{ width: art.width, height: art.height }} contentFit="contain" autoplay accessibilityIgnoresInvertColors />
          </View>
        </View>

        {/* 막대 (SPEC-STAGE-01) */}
        <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.track, { backgroundColor: c.heroTrack }]} />
          <Animated.View style={[styles.fill, { backgroundColor: c.heroAccent }, fillStyle]} />
          {width > 0 &&
            stage.stops.map((s, i) => (
              <View key={s.key} style={[styles.dot, { left: centerOf(i) - 4, backgroundColor: c.onHero }]} />
            ))}
        </View>
        <View style={styles.labels}>
          {width > 0 &&
            stage.stops.map((s, i) => {
              const passed = i < stage.passed;
              const first = i === 0;
              const last = i === stage.stops.length - 1;
              const left = first ? 0 : last ? width - LABEL_WIDTH : centerOf(i) - LABEL_WIDTH / 2;
              const align = first ? 'flex-start' : last ? 'flex-end' : 'center';
              const tappable = !!s.milestone || s.kind === 'day' || s.key === 'm12' || s.key === 'm24';
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label}, ${s.milestone ? `대부분 이때까지 ${s.milestone.name}` : s.sub}${passed ? ', 지남' : ''}`}
                  disabled={!tappable}
                  onPress={() => {
                    tap();
                    onStop(s);
                  }}
                  style={[styles.label, { left, alignItems: align }]}>
                  <ThemedText type="label" style={{ color: c.onHero, fontWeight: 700 }} numberOfLines={1}>
                    {s.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    numberOfLines={1}
                    style={s.milestone ? { color: c.heroAccent, fontWeight: 700 } : { color: c.onHeroDim }}>
                    {s.sub}
                  </ThemedText>
                  <View style={styles.status}>
                    {passed ? (
                      <View style={[styles.check, { backgroundColor: c.heroAccent }]}>
                        <Ionicons name="checkmark" size={13} color={c.hero} />
                      </View>
                    ) : s.key === nextKey ? (
                      <View style={[styles.next, { backgroundColor: c.heroTrack }]}>
                        <ThemedText type="caption" style={{ color: c.heroAccent, fontWeight: 700, fontSize: 11 }}>
                          다음
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>
    </View>
  );
}

/** 아기방 모빌 — 별 · 달 · 구름. 시작 화면도 같은 모빌을 쓴다(`scale` 로 키우고, 초승달을 파낼 바탕색 `cutout`) */
export function HeroMobile({ scale = 1, cutout }: { scale?: number; cutout?: string }) {
  const c = useTheme();
  const star = (cx: number, cy: number, ro: number, ri: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? ro : ri;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return `M${pts.join(' L')}Z`;
  };
  return (
    <Svg width={140 * scale} height={110 * scale} viewBox="0 0 140 110">
      <Path d="M8 16 Q70 0 132 16" fill="none" stroke={c.heroTrack} strokeWidth={3} strokeLinecap="round" />
      <Path d="M70 0 L70 8" stroke={c.heroTrack} strokeWidth={3} strokeLinecap="round" />
      <Path d="M26 13 L26 54 M70 8 L70 74 M114 13 L114 48" stroke={c.heroTrack} strokeWidth={1.5} />
      <Path d={star(26, 68, 13, 5.6)} fill={c.heroStar} />
      <Circle cx={70} cy={89} r={14} fill={c.heroMoon} />
      <Circle cx={77} cy={84} r={12.5} fill={cutout ?? c.hero} />
      <G fill={c.heroCloud}>
        <Circle cx={106} cy={60} r={8} />
        <Circle cx={116} cy={55} r={10} />
        <Circle cx={126} cy={61} r={7} />
        <Rect x={100} y={59} width={32} height={9} rx={4.5} />
      </G>
    </Svg>
  );
}

/** 매트 위 장난감 — 블록 둘과 공 */
function Toys() {
  const c = useTheme();
  return (
    <Svg width={64} height={48} viewBox="0 0 64 48">
      <Rect x={2} y={20} width={26} height={26} rx={6} fill={c.heroAccent} />
      <Rect x={8} y={1} width={20} height={20} rx={5} fill={c.heroStar} transform="rotate(8 18 11)" />
      <Circle cx={48} cy={34} r={12} fill={c.heroCloud} />
      <Path d="M36 34 Q48 26 60 34" fill="none" stroke={c.heroAccent} strokeWidth={3} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 18, paddingHorizontal: 20, overflow: 'hidden' },
  overscroll: { position: 'absolute', left: 0, right: 0, top: -1000, height: 1000 },
  inner: { width: '100%', maxWidth: MaxContentWidth - 40, alignSelf: 'center' },
  /** 모빌은 머리 맨 위(상태 표시줄 바로 아래)에 매단다 */
  mobile: { position: 'absolute', right: -4, top: -16 },
  title: { fontSize: 24, lineHeight: 30 },
  since: { marginTop: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  days: { fontSize: 40, lineHeight: 48, fontWeight: 700, letterSpacing: -1.2 },
  scene: { height: SCENE_HEIGHT, marginTop: -8 },
  mat: { position: 'absolute', left: 4, right: 4, bottom: 8, height: 40, borderRadius: 20 },
  toys: { position: 'absolute', left: 20, bottom: 26 },
  buddy: { position: 'absolute', left: 60, right: 0, bottom: 20, alignItems: 'center' },
  bar: { height: 14, marginTop: 10, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 14, borderRadius: 7 },
  fill: { position: 'absolute', left: 0, height: 14, borderRadius: 7 },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, top: 3 },
  labels: { height: 66, marginTop: 8 },
  label: { position: 'absolute', top: 0, width: LABEL_WIDTH, gap: 1 },
  status: { height: 24, justifyContent: 'center', marginTop: 4 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  next: { height: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
});
