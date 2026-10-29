/**
 * 홈 위쪽 먹색 머리 (SPEC-MAIN-08, task today/007 · 009 · 011) — 날짜 · 함께한 지 며칠, 큰 글씨로 「이번 주 챙길 일 4개」, 오른쪽에 버디 얼굴.
 * 탭 이름과 같은 제목 「홈」은 두지 않는다(Julian, 2026-10-29).
 * 모양은 루틴 화면 머리(routine-hero)와 같은 결.
 *
 * 버디는 오늘 할 루틴을 마지막 하나까지 완료한 순간 한 번 뛰어오르고(`celebrate` 가 거짓 → 참이 되는 때), 누르면 한 번 뛴다.
 * 말풍선 · 칭찬 문구는 두지 않는다 — 루틴 칸이 이미 모두 완료로 보인다.
 */

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { BuddyMark } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BUDDY = 56;

export function HomeHero({
  topInset,
  dateText,
  headline,
  celebrate = false,
}: {
  topInset: number;
  /** 「10월 27일 화요일 · 함께한 지 27일」 */
  dateText: string;
  headline: string;
  /** 오늘 할 루틴을 모두 완료했는가 — 참이 되는 순간 버디가 뛴다 */
  celebrate?: boolean;
}) {
  const c = useTheme();
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const hop = () => {
    y.set(
      withSequence(
        withTiming(-14, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.bounce }),
        withTiming(-6, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.bounce }),
      ),
    );
    scale.set(withSequence(withTiming(1.08, { duration: 160 }), withTiming(1, { duration: 240 })));
  };
  // 처음 열 때 이미 다 끝낸 상태면 뛰지 않는다 — 바뀌는 순간에만
  const was = useRef(celebrate);
  useEffect(() => {
    if (celebrate && !was.current) hop();
    was.current = celebrate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);
  const buddyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { scale: scale.get() }] }));

  return (
    <View style={[styles.hero, { backgroundColor: c.hero, paddingTop: topInset + 16 }]}>
      {/* 위로 당겨도 흰 바탕이 보이지 않게 */}
      <View style={[styles.overscroll, { backgroundColor: c.hero }]} />
      <View style={styles.inner}>
        <View style={styles.top}>
          <View style={[styles.flex, styles.text]}>
            <ThemedText type="small" style={{ color: c.onHeroDim }}>
              {dateText}
            </ThemedText>
            <ThemedText type="title" style={[styles.headline, { color: c.onHero }]}>
              {headline}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="image"
            accessibilityLabel="버디"
            hitSlop={8}
            onPress={() => {
              tap('light');
              hop();
            }}>
            <Animated.View style={buddyStyle}>
              <BuddyMark size={BUDDY} />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 24, paddingHorizontal: Gutter },
  overscroll: { position: 'absolute', left: 0, right: 0, top: -1000, height: 1000 },
  inner: { width: '100%', maxWidth: MaxContentWidth - Gutter * 2, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  text: { gap: 6 },
  headline: { fontSize: 24, lineHeight: 30 },
});
