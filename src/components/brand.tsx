/**
 * 버디 — 쪽쪽이 문 아기 캐릭터, 육아버디의 얼굴 (decisions/015).
 * 원본은 캐릭터 시트 한 장(`assets/brand/buddy-sheet.jpg`)이고, 잘라 낸 그림은 `assets/images/mascot/`.
 * 머리 위 · 생각 중 · 빈 화면 · 지식 지도 가운데에 같은 얼굴을 쓴다.
 */

import { Image } from 'expo-image';
import { View } from 'react-native';

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
