import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { RepeatCheckIcon } from '@/components/baby-icons';
import { BrandLogo, BrandSlogan, BrandStar } from '@/components/brand';
import { HeroMobile } from '@/components/growth/growth-hero';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** 둘레가 나타나는 시간 · 머무는 시간 · 전체가 흐려지는 시간 (ms) */
const APPEAR = 200;
const HOLD = 1200;
const FADE = 500;

/** 기기 시작 화면의 그림 크기 — app.json imageWidth(160)와 splash-icon.png 600×844 의 비율 */
const IMAGE = { width: 160, height: 225 };

/** 시안을 그린 화면 크기 — 둘레의 자리는 이 화면의 가운데에서 잰 거리다 */
const BASE = { width: 390, height: 844 };

/**
 * 기기 시작 화면이 걷힐 때 한 번 (task common/018 · 025, decisions/032).
 * 기기 시작 화면(먹색 바탕 + 서 있는 버디)과 같은 자리에 버디를 그대로 두고, 둘레에 성장 탭의 모빌과
 * 루틴 · 할 일 · 성장 카드 셋, 아래에 로고(글자 + 별)와 슬로건을 한 번에 띄운다. 단계별 움직임은 두지 않는다(Julian, 2026-10-23).
 * 카드 내용은 앱을 보여 주는 그림이고 그 집의 실제 기록이 아니다. 작은 화면에서는 둘레만 줄이고 버디는 기기 시작 화면과 같은 크기다.
 * 바탕색은 app.json 의 expo-splash-screen 설정(`Colors.splash`)과 같아야 이음매가 보이지 않는다.
 */
export function AnimatedSplashOverlay() {
  const c = useTheme();
  const window = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const started = useRef(false);
  const around = useSharedValue(0);
  const whole = useSharedValue(1);

  const aroundStyle = useAnimatedStyle(() => ({ opacity: around.value }));
  const wholeStyle = useAnimatedStyle(() => ({ opacity: whole.value }));

  if (!visible) return null;

  const start = () => {
    if (started.current) return;
    started.current = true;
    around.set(withTiming(1, { duration: APPEAR, easing: Easing.out(Easing.ease) }));
    whole.set(
      withDelay(
        APPEAR + HOLD,
        withTiming(0, { duration: FADE, easing: Easing.out(Easing.ease) }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(setVisible, false);
        }),
      ),
    );
  };

  // 가운데에서 잰 자리 — 작은 화면(아이폰 SE 등)에서는 둘레를 줄이되, 버디는 기기 시작 화면과 같은 크기라
  // 버디 바깥으로 나간 거리만 줄인다(카드가 버디에 겹치지 않게)
  const s = Math.min(1, window.height / BASE.height, window.width / BASE.width);
  const cx = window.width / 2;
  const cy = window.height / 2;
  const out = (d: number, half: number) => (Math.abs(d) <= half ? d : Math.sign(d) * (half + (Math.abs(d) - half) * s));
  const at = (dx: number, dy: number) => ({ left: cx + out(dx, IMAGE.width / 2), top: cy + out(dy, IMAGE.height / 2) });

  return (
    <Animated.View
      onLayout={() => {
        // 첫 그리기가 끝난 뒤 기기 시작 화면을 걷는다 — 같은 그림이라 바뀌는 게 보이지 않는다
        SplashScreen.hideAsync().finally(start);
      }}
      style={[styles.overlay, { backgroundColor: c.splash }, wholeStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, aroundStyle]} pointerEvents="none">
        {/* 버디 뒤의 은은한 코랄 빛 */}
        <View style={[styles.abs, at(-110, -110)]}>
          <Svg width={220 * s} height={220 * s} viewBox="0 0 220 220">
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c.heroAccent} stopOpacity={0.2} />
                <Stop offset="1" stopColor={c.heroAccent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={110} cy={110} r={110} fill="url(#glow)" />
          </Svg>
        </View>
        <View style={[styles.abs, at(-77, -402)]}>
          <HeroMobile scale={1.1 * s} cutout={c.splash} />
        </View>
        <View style={[styles.abs, at(-151, -252)]}>
          <BrandStar size={10 * s} />
        </View>
        <View style={[styles.abs, at(-143, 78)]}>
          <BrandStar size={13 * s} />
        </View>
        <View style={[styles.abs, at(-109, 118)]}>
          <BrandStar size={9 * s} />
        </View>
      </Animated.View>

      <Image style={IMAGE} source={require('@/assets/images/splash-icon.png')} contentFit="contain" />

      <Animated.View style={[StyleSheet.absoluteFill, aroundStyle]} pointerEvents="none">
        <SplashCard style={at(-177, -222)} rotate={-6} scale={s} icon={<RepeatCheckIcon size={13} color={c.onHeroDim} />} name="루틴">
          <View style={styles.row}>
            <View style={[styles.done, { backgroundColor: c.heroAccent }]}>
              <Ionicons name="checkmark" size={15} color={c.hero} />
            </View>
            <View>
              <ThemedText style={[styles.cardTitle, { color: c.onHero }]}>목욕</ThemedText>
              <ThemedText style={[styles.cardSub, { color: c.heroAccent, fontWeight: 600 }]}>08:10 완료</ThemedText>
            </View>
          </View>
        </SplashCard>
        <SplashCard style={at(27, -196)} rotate={5} scale={s} icon={<Ionicons name="checkbox-outline" size={13} color={c.onHeroDim} />} name="할 일">
          <View style={styles.row}>
            <View style={[styles.open, { borderColor: c.onHeroDim }]} />
            <View>
              <ThemedText style={[styles.cardTitle, { color: c.onHero, fontSize: 14 }]}>산후 검진 예약</ThemedText>
              <ThemedText style={[styles.cardSub, { color: c.onHeroDim }]}>내일 오전 10:00</ThemedText>
            </View>
          </View>
        </SplashCard>
        <SplashCard style={at(35, 70)} rotate={-3} scale={s} icon={<Ionicons name="leaf-outline" size={13} color={c.onHeroDim} />} name="성장">
          <ThemedText style={[styles.cardTitle, { color: c.onHero, fontSize: 16 }]}>
            D+25 <ThemedText style={[styles.cardSub, { color: c.onHeroDim }]}>4주차</ThemedText>
          </ThemedText>
          <View style={[styles.track, { backgroundColor: c.heroTrack }]}>
            <View style={[styles.fill, { backgroundColor: c.heroAccent }]} />
            <View style={[styles.knob, { backgroundColor: c.onHero }]} />
          </View>
          <View style={styles.ends}>
            <ThemedText style={[styles.tiny, { color: c.onHeroDim }]}>1개월</ThemedText>
            <ThemedText style={[styles.tiny, { color: c.onHeroDim }]}>50일</ThemedText>
          </View>
        </SplashCard>

        <View style={[styles.words, { top: at(0, 206).top, transform: [{ scale: s }] }]}>
          <BrandLogo size={36} color={c.onHero} />
          <BrandSlogan onDark />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** 먹색 위의 작은 카드 — 위에 탭 아이콘과 이름 */
function SplashCard({
  style,
  rotate,
  scale,
  icon,
  name,
  children,
}: {
  style: { left: number; top: number };
  rotate: number;
  scale: number;
  icon: ReactNode;
  name: string;
  children: ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={[styles.card, style, { backgroundColor: c.heroCard, borderColor: c.heroCardLine, transform: [{ rotate: `${rotate}deg` }, { scale }] }]}>
      <View style={styles.tab}>
        {icon}
        <ThemedText style={[styles.tiny, { color: c.onHeroDim, fontSize: 11, fontWeight: 600 }]}>{name}</ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  abs: { position: 'absolute' },
  card: {
    position: 'absolute',
    width: 150,
    paddingTop: 11,
    paddingBottom: 12,
    paddingHorizontal: 13,
    borderRadius: 16,
    gap: 7,
    borderWidth: 1,
  },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  done: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  open: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: 700, letterSpacing: -0.3 },
  cardSub: { fontSize: 11, lineHeight: 15 },
  tiny: { fontSize: 10, lineHeight: 14 },
  track: { height: 6, borderRadius: 3, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '58%', borderRadius: 3 },
  knob: { position: 'absolute', left: '58%', width: 12, height: 12, marginLeft: -6, borderRadius: 6 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  // 버디는 화면 한가운데 그대로 — 로고와 슬로건은 그 아래에 따로 놓아 버디가 밀리지 않게 한다
  words: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 16 },
});
