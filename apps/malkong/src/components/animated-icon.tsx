import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** 이름과 슬로건이 떠오르는 시간 · 머무는 시간 · 전체가 흐려지는 시간 (ms) */
const RISE = 350;
const HOLD = 1000;
const FADE = 600;

/** 기기 시작 화면의 그림 크기 — app.json imageWidth(160)와 splash-icon.png 600×844 의 비율 */
const IMAGE = { width: 160, height: 225 };

/**
 * 기기 시작 화면이 걷힐 때 한 번 (task common/018) — 서 있는 버디는 같은 자리에 그대로 두고,
 * 그 아래에 「육아버디」와 슬로건이 한 박자 떠올랐다가 전체가 함께 흐려진다.
 * 그림과 바탕색은 app.json 의 expo-splash-screen 설정(`Colors.splash`)과 같아야 이음매가 보이지 않는다.
 * 글은 그림에 굽지 않는다 — Android 12+ 가 시작 그림을 아이콘 크기로 줄이고, 글꼴 · 다크 모드 색은 코드가 가지고 있다.
 */
export function AnimatedSplashOverlay() {
  const c = useTheme();
  const [visible, setVisible] = useState(true);
  const started = useRef(false);
  const words = useSharedValue(0);
  const whole = useSharedValue(1);

  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * 8 }],
  }));
  const wholeStyle = useAnimatedStyle(() => ({ opacity: whole.value }));

  if (!visible) return null;

  const start = () => {
    if (started.current) return;
    started.current = true;
    words.set(withTiming(1, { duration: RISE, easing: Easing.out(Easing.ease) }));
    whole.set(
      withDelay(
        RISE + HOLD,
        withTiming(0, { duration: FADE, easing: Easing.out(Easing.ease) }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(setVisible, false);
        }),
      ),
    );
  };

  return (
    <Animated.View
      onLayout={() => {
        // 첫 그리기가 끝난 뒤 기기 시작 화면을 걷는다 — 같은 그림이라 바뀌는 게 보이지 않는다
        SplashScreen.hideAsync().finally(start);
      }}
      style={[styles.overlay, { backgroundColor: c.splash }, wholeStyle]}>
      <Image style={IMAGE} source={require('@/assets/images/splash-icon.png')} contentFit="contain" />
      <Animated.View style={[styles.words, wordsStyle]}>
        <ThemedText type="display">육아버디</ThemedText>
        <View style={styles.slogan}>
          <ThemedText type="body" style={[styles.center, { color: c.textSecondary }]}>
            육아의 모든 질문,{'\n'}우리 아기 기준으로 버디가 다 챙겨요
          </ThemedText>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  // 버디는 화면 한가운데 그대로 — 글은 그 아래에 따로 놓아 버디가 밀리지 않게 한다
  words: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: IMAGE.height / 2 + 20,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  slogan: { marginTop: 8 },
  center: { textAlign: 'center' },
});
