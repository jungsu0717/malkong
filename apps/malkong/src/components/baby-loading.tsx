/**
 * 큰 로딩 — 가운데 작은 버디가 움직이고 그 아래 한 줄 (app-design 「로딩과 모션」, task growth/004).
 *
 * 성장 탭의 버디 셋(누워서 바둥 · 기기 · 걷기, assets/images/buddy) 가운데 하나를 열 때마다 골라 보인다.
 * 문구는 자세에 맞춘다 — 「바둥바둥 기다리는 중…」 「열심히 기어가는 중…」 「아장아장 걸어가는 중…」(Julian, 2026-10-22).
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 높이를 맞추고 너비는 그림 비율대로 */
const HEIGHT = 96;

const POSES = [
  { src: require('@/assets/images/buddy/lie.webp'), width: 162, label: '바둥바둥 기다리는 중…' },
  { src: require('@/assets/images/buddy/crawl.webp'), width: 107, label: '열심히 기어가는 중…' },
  { src: require('@/assets/images/buddy/walk.webp'), width: 57, label: '아장아장 걸어가는 중…' },
];

export function BabyLoading() {
  const c = useTheme();
  const [pose] = useState(() => POSES[Math.floor(Math.random() * POSES.length)]);

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={pose.label}>
      <View style={styles.art}>
        <Image source={pose.src} style={{ width: pose.width, height: HEIGHT }} contentFit="contain" autoplay />
      </View>
      <ThemedText type="small" style={{ color: c.textSecondary, textAlign: 'center' }}>
        {pose.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, paddingVertical: Spacing.two, alignItems: 'center' },
  art: { height: HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
});
