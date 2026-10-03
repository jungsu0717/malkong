/**
 * 큰 로딩 — 육아 소품 아이콘이 톡톡 바뀐다 (app-design 「로딩과 모션」, decisions/015).
 *
 * 동그란 바탕 안에서 쪽쪽이 → 젖병 → 딸랑이 → 곰돌이가 차례로 「뿅」 커지며 나타나고, 바뀔 때마다 바탕이 살짝 통통 튄다.
 * 아이콘은 탭과 같은 베이비 세트(`baby-icons.tsx`)다. 캐릭터 그림은 쓰지 않는다(Julian, 2026-10-04).
 */

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import type { ColorValue } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { BottleIcon, PacifierIcon, RattleIcon, TeddyIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 차례로 보일 아이콘 — 늘릴 때는 여기에 더한다 */
const ICONS: ComponentType<{ size?: number; color: ColorValue }>[] = [
  PacifierIcon,
  BottleIcon,
  RattleIcon,
  TeddyIcon,
];

const CIRCLE = 72;
const ICON = 38;
const STEP_MS = 700;

export function BabyLoading({ label }: { label?: string }) {
  const c = useTheme();
  const [index, setIndex] = useState(0);
  const bump = useSharedValue(1);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % ICONS.length), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bump.set(withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, { damping: 9 })));
  }, [index, bump]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const Icon = ICONS[index];

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.circle, { backgroundColor: c.accentSoft }, circleStyle]}>
        <Animated.View
          key={index}
          entering={ZoomIn.springify().damping(11)}
          exiting={ZoomOut.duration(140)}
          style={styles.icon}>
          <Icon size={ICON} color={c.accent} />
        </Animated.View>
      </Animated.View>
      {label && (
        <ThemedText type="caption" style={{ color: c.textSecondary, textAlign: 'center' }}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three, paddingVertical: Spacing.two, alignItems: 'center' },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { position: 'absolute' },
});
