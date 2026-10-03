/**
 * 마스코트 말콩이의 얼굴 — 육아버디의 브랜드 표시 하나 (app-design 「아이콘」, decisions/014). 쪽쪽이 문 아기다.
 * 머리 위 · 생각 중 · 빈 화면 · 런처 아이콘에 같은 얼굴을 쓴다.
 */

import { View } from 'react-native';

import { PacifierBabyIcon } from '@/components/baby-icons';
import { useTheme } from '@/hooks/use-theme';

export function MalkongMark({ size = 24, color }: { size?: number; color?: string }) {
  const c = useTheme();
  return <PacifierBabyIcon size={size} color={color ?? c.accent} />;
}

/** 동그란 바탕 위의 말콩이 — 빈 화면과 브리핑 머리에 */
export function MalkongAvatar({ size = 40, tone = 'soft' }: { size?: number; tone?: 'soft' | 'solid' }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone === 'solid' ? c.accent : c.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <PacifierBabyIcon size={size * 0.62} color={tone === 'solid' ? '#FFFFFF' : c.accent} />
    </View>
  );
}
