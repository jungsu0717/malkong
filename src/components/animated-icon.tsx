import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';

const DURATION = 600;

/**
 * 시작 화면이 걷힐 때 한 번 — 붉은 말을 탄 쪽쪽이 아기(브랜드 러너)가 같은 자리에서 흐려진다.
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
  const image = <Image style={styles.image} source={require('@/assets/images/splash-icon.png')} />;

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
  image: { width: 200, height: 200 },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
