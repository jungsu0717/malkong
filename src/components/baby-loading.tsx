/**
 * 큰 로딩 — 버디가 「@」 다리로 결연하게 달려온다 (app-design 「로딩과 모션」, decisions/015).
 *
 * 캐릭터 시트에서 따로 잘라 낸 세 조각을 겹쳐 움직인다: 다리 없는 달리기 몸통(통통 튐), 몸 아래 「@」 다리(빙글빙글),
 * 뒤로 흐르는 물결(속도감). 몸 전체는 칸을 가로질러 달린다. 모두 Reanimated 로 UI 스레드에서 돈다.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BODY = require('@/assets/images/mascot/run-body.png');
const SWIRL = require('@/assets/images/mascot/run-swirl.png');
const WAVES = require('@/assets/images/mascot/run-waves.png');

/** 달리는 버디 한 덩어리의 크기 — 몸통 300×331 · 다리 200×200 · 물결 240×131 그림을 이 비율로 줄인다 */
const BODY_W = 64;
const BODY_H = BODY_W * (331 / 300);
const SWIRL_W = 40;
const WAVES_W = 50;
const WAVES_H = WAVES_W * (131 / 240);
const RUNNER_W = WAVES_W + BODY_W - 6;
const RUNNER_H = BODY_H + SWIRL_W * 0.55;

export function BabyRunLoading({ label }: { label?: string }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const run = useSharedValue(0);
  const hop = useSharedValue(0);
  const spin = useSharedValue(0);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (!width) return;
    run.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false));
    hop.set(withRepeat(withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }), -1, true));
    spin.set(withRepeat(withTiming(1, { duration: 260, easing: Easing.linear }), -1, false));
    flow.set(withRepeat(withTiming(1, { duration: 300, easing: Easing.linear }), -1, false));
  }, [width, run, hop, spin, flow]);

  const runnerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -RUNNER_W + run.value * (width + RUNNER_W) }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * hop.value }, { rotate: '4deg' }],
  }));
  const swirlStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const wavesStyle = useAnimatedStyle(() => ({
    opacity: 1 - flow.value * 0.5,
    transform: [{ translateX: -8 * flow.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { height: RUNNER_H + 6 }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View style={[styles.runner, runnerStyle]}>
            <Animated.View style={[styles.waves, wavesStyle]}>
              <Image source={WAVES} style={{ width: WAVES_W, height: WAVES_H }} contentFit="contain" />
            </Animated.View>
            <Animated.View style={[styles.body, bodyStyle]}>
              <Image source={BODY} style={{ width: BODY_W, height: BODY_H }} contentFit="contain" />
            </Animated.View>
            <Animated.View style={[styles.swirl, swirlStyle]}>
              <Image source={SWIRL} style={{ width: SWIRL_W, height: SWIRL_W }} contentFit="contain" />
            </Animated.View>
          </Animated.View>
        )}
      </View>
      {label && (
        <ThemedText type="caption" style={{ color: c.textSecondary, textAlign: 'center' }}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, paddingVertical: Spacing.two },
  track: { overflow: 'hidden' },
  runner: { position: 'absolute', left: 0, top: 0, width: RUNNER_W, height: RUNNER_H },
  waves: { position: 'absolute', left: 0, top: BODY_H * 0.38 },
  body: { position: 'absolute', left: WAVES_W - 6, top: 0 },
  // 몸통 아래 가운데, 몸 앞에 — 잘린 몸 끝을 다리가 덮는다
  swirl: { position: 'absolute', left: WAVES_W - 6 + BODY_W * 0.24, top: BODY_H - SWIRL_W * 0.55 },
});
