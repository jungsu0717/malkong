/**
 * 버디 — 쪽쪽이 문 아기 캐릭터, 육아버디의 얼굴 (decisions/015).
 * 원본은 캐릭터 시트 한 장(`assets/brand/buddy-sheet.jpg`)이고, 잘라 낸 그림은 `assets/images/mascot/`.
 * 머리 위 · 생각 중 · 빈 화면 · 지식 지도 가운데에 같은 얼굴을 쓴다.
 * 로고는 글자 「육아버디」 오른쪽 위에 앱 아이콘의 노란 별, 슬로건은 「육아 할 일, / 버디가 챙겨요」(decisions/032).
 */

import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export const BUDDY_FACE = require('@/assets/images/mascot/face.png');
export const BUDDY_STANDING = require('@/assets/images/mascot/standing.png');

/** 얼굴 그림의 가로:세로 — 잘라 낸 그림 그대로(384×355) */
const FACE_RATIO = 355 / 384;

export function BuddyMark({ size = 24 }: { size?: number }) {
  return (
    <Image
      source={BUDDY_FACE}
      style={{ width: size, height: size * FACE_RATIO }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

/** 동그란 바탕 위의 버디 — 빈 화면과 온보딩 머리에 */
export function BuddyAvatar({ size = 40 }: { size?: number }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <BuddyMark size={size * 0.78} />
    </View>
  );
}

/** 다섯 꼭짓점 별 — 앱 아이콘 · 로고 · 성장 탭 모빌의 그 별 */
export function BrandStar({ size, color }: { size: number; color?: string }) {
  const c = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1 6.1 20.3l1.3-6.5L2.5 9.3l6.6-.8z" fill={color ?? c.heroStar} />
    </Svg>
  );
}

/** 로고 — 글자 「육아버디」와 오른쪽 위 노란 별(decisions/032). `size` 는 글자 크기 */
export function BrandLogo({ size = 36, color }: { size?: number; color?: string }) {
  const c = useTheme();
  const star = Math.round(size * 0.42);
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="육아버디">
      <ThemedText style={{ fontSize: size, lineHeight: Math.round(size * 1.2), fontWeight: 700, letterSpacing: -size * 0.035, color: color ?? c.text }}>
        육아버디
      </ThemedText>
      <View style={{ position: 'absolute', right: -Math.round(size * 0.36), top: -Math.round(size * 0.08) }}>
        <BrandStar size={star} />
      </View>
    </View>
  );
}

/** 슬로건 — 「육아 할 일,」 다음 줄 「버디가 챙겨요」, 「버디」만 코랄. 먹색 바탕(`onDark`)과 흰 바탕 둘 다 */
export function BrandSlogan({ onDark = false, size = 16 }: { onDark?: boolean; size?: number }) {
  const c = useTheme();
  const lineHeight = Math.round(size * 1.5);
  return (
    <View style={{ alignItems: 'center' }}>
      <ThemedText style={{ fontSize: size, lineHeight, color: onDark ? c.onHeroDim : c.textSecondary }}>육아 할 일,</ThemedText>
      <ThemedText style={{ fontSize: size, lineHeight, fontWeight: 700, color: onDark ? c.onHero : c.text }}>
        <ThemedText style={{ fontSize: size, lineHeight, fontWeight: 700, color: onDark ? c.heroAccent : c.accent }}>버디</ThemedText>가 챙겨요
      </ThemedText>
    </View>
  );
}
