import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';

import { RidingBabyIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

// 브랜드 로딩 모션 — 쪽쪽이 문 아기가 붉은 말을 타고(나폴레옹 포즈) 달려온다.
// 말콩의 유래(말띠 해의 콩알이)가 그대로 모션이 된다 (app-design 로딩 절).
// 정식은 Lottie 자산으로 교체 예정이고, 이 코드는 그 전까지의 임시 구현이다.
// 쓰임새: 초기 구동·화면 단위 로딩 같은 "큰 로딩". 콘텐츠 로딩은 스켈레톤이 기본.

const RUNNER_SIZE = 34;
const RUNNER_WIDTH = RUNNER_SIZE * (48 / 34);

export function BabyRunLoading({ label }: { label?: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const [run] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!width) return;
    const runLoop = Animated.loop(
      Animated.timing(run, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 230,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 230,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    runLoop.start();
    bobLoop.start();
    return () => {
      runLoop.stop();
      bobLoop.stop();
    };
  }, [width, run, bob]);

  return (
    <View style={styles.wrap}>
      <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View
            style={{
              transform: [
                {
                  translateX: run.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-RUNNER_WIDTH, width],
                  }),
                },
                { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              ],
            }}>
            <RidingBabyIcon size={RUNNER_SIZE} color={colors.accent} horseColor={colors.horse} />
          </Animated.View>
        )}
      </View>
      {label && (
        <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'center' }}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, paddingVertical: Spacing.two },
  track: { height: RUNNER_SIZE + 4, overflow: 'hidden' },
});
