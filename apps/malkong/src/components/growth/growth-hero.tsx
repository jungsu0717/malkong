/**
 * 성장 탭 위쪽 먹색 그림 (SPEC-STAGE-01, task growth/004 · 시안 「제안 4」) — 당근 걷기처럼 캐릭터와 굵은 막대.
 *
 * 아기방 모빌(별 · 달 · 구름) 아래 매트 위에서 버디가 움직인다 — 개월에 맞춰 누워서 바둥(0~5) · 기기(6~11) · 걷기(12~).
 * 버디 그림은 AI 로 만든 4초 반복 그림(assets/images/buddy, decisions/031)이다.
 * 막대에는 달마다 · 50일 · 100일 칸 가운데 지난 칸 하나와 앞으로 올 칸 — 네 칸. 발달 단계가 있는 달은 아래에 코랄 글씨(「2개월 · 미소」).
 * 지난 칸에는 체크, 다음 칸에는 「다음」. 발달 단계 · 기념일 칸을 누르면 그 내용으로 간다.
 *
 * 방이 살아 있게(task growth/008, Julian 「성장 탭이 가장 중요한 시각 효과」): 모빌이 천천히 흔들리고 별이 반짝이며,
 * 막대의 지금 자리에 버디 얼굴이 붙어 통통 뛴다. 칸의 날(달마다 · 50일 · 100일 · 돌) 당일에는 깃발이 걸리고 「오늘은 100일이에요」,
 * 색종이가 떨어지고 버디가 가끔 뛰어오른다. 움직임 줄이기를 켠 폰에서는 모두 멈춘 그림으로 보인다.
 * 탭 이름과 같은 제목 「성장」은 두지 않는다(홈과 같다).
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { BuddyMark } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import { celebrateLabel, type BuddyPose, type StageStop, type StageWindow } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 버디 자세 그림 — 기념 카드(milestone-card)도 같은 그림을 쓴다 */
export const POSES: Record<BuddyPose, { src: number; width: number; height: number }> = {
  lie: { src: require('@/assets/images/buddy/lie.webp'), width: 250, height: 148 },
  crawl: { src: require('@/assets/images/buddy/crawl.webp'), width: 206, height: 184 },
  walk: { src: require('@/assets/images/buddy/walk.webp'), width: 112, height: 188 },
};

const SCENE_HEIGHT = 200;
/** 막대 양 끝에서 첫 점 · 끝 점까지 */
const DOT_INSET = 8;
const LABEL_WIDTH = 84;
/** 막대 위 지금 자리의 버디 얼굴 동그라미 */
const MARKER = 30;

/** 별 — 꼭짓점 다섯, 바깥 반지름 ro · 안쪽 ri */
function starPath(cx: number, cy: number, ro: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}

/** 끝없이 되풀이하는 움직임 하나 — 움직임 줄이기면 멈춘 값 그대로 */
function useLoop(start: (v: SharedValue<number>) => void, still: boolean, initial = 0): SharedValue<number> {
  const v = useSharedValue(initial);
  useEffect(() => {
    if (still) return;
    start(v);
    return () => {
      cancelAnimation(v);
      v.set(initial);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, v]);
  return v;
}

const easeSin = Easing.inOut(Easing.sin);

export function GrowthHero({
  topInset,
  days,
  week,
  pose,
  stage,
  onStop,
  onShare,
}: {
  topInset: number;
  days: number;
  week: number;
  pose: BuddyPose;
  stage: StageWindow;
  onStop: (stop: StageStop) => void;
  /** 기념일 당일 「공유하기」 — 기념 카드 시트를 연다(milestone-card) */
  onShare?: () => void;
}) {
  const c = useTheme();
  const still = useReducedMotion();
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  // 탭을 열면 막대가 지금 자리까지 찬다
  useEffect(() => {
    fill.set(still ? stage.progress : withTiming(stage.progress, { duration: 900 }));
  }, [fill, stage.progress, still]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  // 모빌은 매단 곳을 축으로 좌우 5도, 6초에 한 번
  const sway = useLoop(
    (v) => v.set(withRepeat(withSequence(withTiming(1, { duration: 3000, easing: easeSin }), withTiming(-1, { duration: 3000, easing: easeSin })), -1)),
    still,
  );
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get() * 5}deg` }] }));
  // 지금 자리 버디 — 막대 끝을 따라가며 살짝 통통
  const bob = useLoop((v) => v.set(withRepeat(withSequence(withTiming(-3, { duration: 1100, easing: easeSin }), withTiming(0, { duration: 1100, easing: easeSin })), -1)), still);
  const markerStyle = useAnimatedStyle(() => ({ left: `${fill.get() * 100}%`, transform: [{ translateY: bob.get() }] }));

  const today = stage.today;
  const party = today ? celebrateLabel(today) : null;
  // 기념일에는 버디가 몇 초마다 한 번 뛰어오른다
  const hop = useLoop(
    (v) =>
      v.set(
        withRepeat(
          withSequence(
            withDelay(2600, withTiming(-14, { duration: 160, easing: Easing.out(Easing.quad) })),
            withTiming(0, { duration: 240, easing: Easing.bounce }),
            withTiming(-5, { duration: 110, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 150, easing: Easing.bounce }),
          ),
          -1,
        ),
      ),
    still || !today,
  );
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.get() }] }));

  const art = POSES[pose];
  const span = Math.max(0, width - DOT_INSET * 2);
  const centerOf = (i: number) => DOT_INSET + (span * i) / (stage.stops.length - 1);
  const nextKey = stage.next?.key;

  return (
    <View style={[styles.hero, { backgroundColor: c.hero, paddingTop: topInset + 16 }]}>
      {/* 위로 당겨도 흰 바탕이 보이지 않게 */}
      <View style={[styles.overscroll, { backgroundColor: c.hero }]} />
      <View style={styles.inner}>
        {today && (
          <View style={styles.bunting} pointerEvents="none">
            <Bunting />
          </View>
        )}
        <Animated.View style={[styles.mobile, swayStyle]} pointerEvents="none">
          <HeroMobile twinkle={!still} />
        </Animated.View>
        {/* 기념일에는 별 대신 색종이 — 큰 글씨와 겹치지 않게 */}
        {today ? (
          <Confetti still={still} />
        ) : (
          <>
            <Twinkle still={still} style={{ left: '50%', top: 10 }} size={12} color={c.heroStar} duration={1700} delay={900} />
            <Twinkle still={still} style={{ left: '53%', top: 84 }} size={8} color={c.heroMoon} duration={1300} delay={0} />
          </>
        )}

        {party ? (
          <View style={styles.party} accessible accessibilityLabel={`오늘은 ${party.head}${party.tail}`}>
            <ThemedText type="small" style={{ color: c.onHeroDim }}>
              오늘은
            </ThemedText>
            <ThemedText style={[styles.days, { color: c.onHero }]}>
              {party.head}
              <ThemedText style={[styles.days, { color: c.heroAccent }]}>{party.tail}</ThemedText>
            </ThemedText>
            {onShare && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  onShare();
                }}
                style={({ pressed }) => [styles.share, { backgroundColor: c.heroTrack }, pressed && { opacity: 0.6 }]}>
                <Ionicons name="share-outline" size={15} color={c.onHero} />
                <ThemedText type="label" style={{ color: c.onHero, fontWeight: 700 }}>
                  공유하기
                </ThemedText>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <ThemedText type="small" style={{ color: c.onHeroDim }}>
              태어난 지
            </ThemedText>
            <View style={styles.dayRow} accessible accessibilityLabel={`태어난 지 ${days}일, ${week}주차`}>
              <ThemedText style={[styles.days, { color: c.onHero }]}>D+{days}</ThemedText>
              <ThemedText type="body" style={{ color: c.onHeroDim, fontWeight: 600 }}>
                {week}주차
              </ThemedText>
            </View>
          </>
        )}

        {/* 매트와 장난감, 버디 */}
        <View style={styles.scene} pointerEvents="none">
          <View style={[styles.mat, { backgroundColor: c.heroMat }]} />
          <View style={styles.toys}>
            <Toys />
          </View>
          <Animated.View style={[styles.buddy, hopStyle]}>
            <Image source={art.src} style={{ width: art.width, height: art.height }} contentFit="contain" autoplay accessibilityIgnoresInvertColors />
          </Animated.View>
        </View>

        {/* 막대 (SPEC-STAGE-01) */}
        <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.track, { backgroundColor: c.heroTrack }]} />
          <Animated.View style={[styles.fill, { backgroundColor: c.heroAccent }, fillStyle]} />
          {width > 0 &&
            stage.stops.map((s, i) => (
              <View key={s.key} style={[styles.dot, { left: centerOf(i) - 4, backgroundColor: c.onHero }]} />
            ))}
          <Animated.View pointerEvents="none" style={[styles.marker, { backgroundColor: c.onHero, borderColor: c.heroAccent }, markerStyle]}>
            <BuddyMark size={18} />
          </Animated.View>
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
                    {s.key === today?.key ? (
                      <View style={[styles.next, { backgroundColor: c.heroAccent }]}>
                        <ThemedText type="caption" style={{ color: c.hero, fontWeight: 700, fontSize: 11 }}>
                          오늘
                        </ThemedText>
                      </View>
                    ) : passed ? (
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

/**
 * 아기방 모빌 — 별 · 달 · 구름. 시작 화면도 같은 모빌을 쓴다(`scale` 로 키우고, 초승달을 파낼 바탕색 `cutout`).
 * `twinkle` 이면 별이 천천히 반짝인다(성장 탭).
 */
export function HeroMobile({ scale = 1, cutout, twinkle = false }: { scale?: number; cutout?: string; twinkle?: boolean }) {
  const c = useTheme();
  const glow = useLoop(
    (v) => v.set(withRepeat(withSequence(withTiming(0.5, { duration: 1300, easing: easeSin }), withTiming(1, { duration: 1300, easing: easeSin })), -1)),
    !twinkle,
    1,
  );
  const glowProps = useAnimatedProps(() => ({ opacity: glow.get() }));
  return (
    <Svg width={140 * scale} height={110 * scale} viewBox="0 0 140 110">
      <Path d="M8 16 Q70 0 132 16" fill="none" stroke={c.heroTrack} strokeWidth={3} strokeLinecap="round" />
      <Path d="M70 0 L70 8" stroke={c.heroTrack} strokeWidth={3} strokeLinecap="round" />
      <Path d="M26 13 L26 54 M70 8 L70 74 M114 13 L114 48" stroke={c.heroTrack} strokeWidth={1.5} />
      <AnimatedPath d={starPath(26, 68, 13, 5.6)} fill={c.heroStar} animatedProps={glowProps} />
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

/** 머리 바탕의 작은 별 — 천천히 반짝인다 */
function Twinkle({
  still,
  style,
  size,
  color,
  duration,
  delay,
}: {
  still: boolean;
  style: { left: DimensionValue; top: number };
  size: number;
  color: string;
  duration: number;
  delay: number;
}) {
  const v = useLoop(
    (x) => x.set(withDelay(delay, withRepeat(withSequence(withTiming(0.35, { duration, easing: easeSin }), withTiming(1, { duration, easing: easeSin })), -1))),
    still,
    1,
  );
  const st = useAnimatedStyle(() => ({ opacity: v.get() * 0.85, transform: [{ scale: 0.75 + 0.25 * v.get() }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.twinkle, style, st]}>
      <Svg width={size} height={size} viewBox="-6 -6 12 12">
        <Path d={starPath(0, 0, 6, 2.6)} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** 기념일 깃발 — 머리 왼쪽 위에 늘어진 줄과 삼각 깃발 아홉 */
export function Bunting({ scale = 1 }: { scale?: number }) {
  const c = useTheme();
  const colors = [c.heroAccent, c.heroStar, c.heroMoon];
  const flags: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    // 줄(0,6) → (120,44) → (240,4) 위의 자리
    const x = 2 * (1 - t) * t * 120 + t * t * 240;
    const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 44 + t * t * 4;
    flags.push(<Path key={i} d={`M${x - 8} ${y - 1} L${x + 8} ${y - 1} L${x} ${y + 15}Z`} fill={colors[i % 3]} />);
  }
  return (
    <Svg width={240 * scale} height={44 * scale} viewBox="0 0 240 44">
      <Path d="M0 6 Q120 44 240 4" fill="none" stroke={c.heroTrack} strokeWidth={1.5} />
      {flags}
    </Svg>
  );
}

/** 기념일 색종이 — 다섯 조각이 천천히 떨어진다. 자리는 머리 너비의 비율, 왼쪽 위 큰 글씨(너비 63% · 높이 96까지)는 피한다 */
const CONFETTI: { left: DimensionValue; top: number; w: number; h: number; tone: 'accent' | 'star' | 'moon'; duration: number; delay: number }[] = [
  { left: '68%', top: 40, w: 6, h: 10, tone: 'accent', duration: 3600, delay: 0 },
  { left: '58%', top: 104, w: 7, h: 7, tone: 'star', duration: 4200, delay: 1200 },
  { left: '40%', top: 118, w: 5, h: 9, tone: 'moon', duration: 3900, delay: 2300 },
  { left: '88%', top: 134, w: 6, h: 10, tone: 'accent', duration: 4200, delay: 600 },
  { left: '6%', top: 124, w: 7, h: 7, tone: 'star', duration: 3600, delay: 1800 },
];

function Confetti({ still }: { still: boolean }) {
  return (
    <>
      {CONFETTI.map((p, i) => (
        <Piece key={i} piece={p} still={still} />
      ))}
    </>
  );
}

function Piece({ piece, still }: { piece: (typeof CONFETTI)[number]; still: boolean }) {
  const c = useTheme();
  const v = useLoop((x) => x.set(withDelay(piece.delay, withRepeat(withTiming(1, { duration: piece.duration, easing: Easing.linear }), -1))), still, 0.3);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(v.get(), [0, 0.15, 1], [0, 1, 0]),
    transform: [{ translateY: -6 + 32 * v.get() }, { rotate: `${160 * v.get()}deg` }],
  }));
  const color = piece.tone === 'accent' ? c.heroAccent : piece.tone === 'star' ? c.heroStar : c.heroMoon;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.twinkle,
        { left: piece.left, top: piece.top, width: piece.w, height: piece.h, borderRadius: piece.w === piece.h ? piece.w / 2 : 2, backgroundColor: color },
        st,
      ]}
    />
  );
}

/** 매트 위 장난감 — 블록 둘과 공 */
export function Toys({ scale = 1 }: { scale?: number }) {
  const c = useTheme();
  return (
    <Svg width={64 * scale} height={48 * scale} viewBox="0 0 64 48">
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
  /** 모빌은 머리 맨 위(상태 표시줄 바로 아래)에 매달고, 매단 곳을 축으로 흔든다 */
  mobile: { position: 'absolute', right: -4, top: -16, transformOrigin: '50% 0%' },
  twinkle: { position: 'absolute' },
  /** 기념일 깃발은 머리 왼쪽 끝부터 */
  bunting: { position: 'absolute', left: -20, top: -16 },
  /** 깃발 아래로 큰 글씨를 내린다 */
  party: { marginTop: 28 },
  share: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
  },
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
  marker: {
    position: 'absolute',
    top: (14 - MARKER) / 2,
    width: MARKER,
    height: MARKER,
    marginLeft: -MARKER / 2,
    borderRadius: MARKER / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: { height: 66, marginTop: 12 },
  label: { position: 'absolute', top: 0, width: LABEL_WIDTH, gap: 1 },
  status: { height: 24, justifyContent: 'center', marginTop: 4 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  next: { height: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
});
