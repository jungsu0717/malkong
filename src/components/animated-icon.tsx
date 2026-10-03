import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';

const DURATION = 600;

/**
 * 시작 화면이 걷힐 때 한 번 — 서 있는 버디가 같은 자리에서 흐려진다.
 * 그림과 바탕색은 app.json 의 expo-splash-screen 설정과 같아야 이음매가 보이지 않는다.
 */
export function AnimatedSplashOverlay() {
  const scheme = useColorScheme();
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const background = { backgroundColor: Colors[scheme === 'dark' ? 'dark' : 'light'].background };
  const fade = new Keyframe({
    0: { opacity: 1 },
    20: { opacity: 1 },
    100: { opacity: 0, easing: Easing.out(Easing.ease) },
  });
  // app.json 의 expo-splash-screen 과 같은 그림(서 있는 버디) — 밝은 · 어두운 바탕 모두 같은 그림
  const image = <Image style={styles.image} source={require('@/assets/images/splash-icon.png')} contentFit="contain" />;

  return animate ? (
    <Animated.View
      entering={fade.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={[styles.splashOverlay, background]}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => setAnimate(true));
      }}
      style={[styles.splashOverlay, background]}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  // splash-icon.png 600×844 를 app.json imageWidth(160)와 같은 크기로
  image: { width: 160, height: 225 },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
