/**
 * 버디 그림과 아기방 장식 (SPEC-STAGE-07 · SPEC-LOG-06) — 기념 카드 · 오늘 소식 카드 · 시작 화면 · 1년 보기가 같이 쓴다.
 *
 * 버디 자세는 개월에 맞춰 누워서 바둥(0~5) · 기기(6~11) · 걷기(12~), AI 로 만든 4초 반복 그림(assets/images/buddy, decisions/031)이다.
 * 예전 성장 탭의 먹색 머리 장면(막대 · 깃발이 걸리는 기념일 장면)은 탭과 함께 뺐다(decisions/037). 장식 조각만 남긴다.
 */

import { useEffect, type ReactNode } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { BuddyPose } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 버디 자세 그림 — 기념 카드(milestone-card)도 같은 그림을 쓴다 */
export const POSES: Record<BuddyPose, { src: number; width: number; height: number }> = {
  lie: { src: require('@/assets/images/buddy/lie.webp'), width: 250, height: 148 },
  crawl: { src: require('@/assets/images/buddy/crawl.webp'), width: 206, height: 184 },
  walk: { src: require('@/assets/images/buddy/walk.webp'), width: 112, height: 188 },
};

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

/**
 * 아기방 모빌 — 별 · 달 · 구름. 시작 화면도 같은 모빌을 쓴다(`scale` 로 키우고, 초승달을 파낼 바탕색 `cutout`).
 * `twinkle` 이면 별이 천천히 반짝인다.
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
