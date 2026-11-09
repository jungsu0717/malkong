import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PooIcon } from '@/components/baby-icons';
import { STOOL_SWATCH } from '@/components/log/kinds';
import type { DiaperKind, StoolColor } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

/**
 * 기저귀 아이콘 — 소변은 물방울, 대변은 대변 모양(적은 변 색으로 채움), 둘 다면 둘을 나란히.
 * 대변을 물방울로 그리면 묽은 변처럼 보여서 나눠 그린다(Julian, 2026-11-09).
 */
export function DiaperGlyph({ diaper, color, size }: { diaper: DiaperKind; color: StoolColor | null; size: number }) {
  const c = useTheme();
  const fill = color ? STOOL_SWATCH[color] : 'none';
  if (diaper === 'pee') return <Ionicons name="water-outline" size={size} color={c.peeFg} />;
  if (diaper === 'poo') return <PooIcon size={size} color={c.pooFg} fill={fill} />;
  return (
    <View style={styles.pair}>
      <Ionicons name="water-outline" size={Math.round(size * 0.7)} color={c.peeFg} />
      <PooIcon size={Math.round(size * 0.8)} color={c.pooFg} fill={fill} />
    </View>
  );
}

/** 기저귀 바탕 — 소변은 노랑, 대변이 있으면 갈색 */
export function diaperTone(diaper: DiaperKind, c: ReturnType<typeof useTheme>) {
  return diaper === 'pee' ? { backgroundColor: c.peeBg, borderColor: c.peeLine } : { backgroundColor: c.pooBg, borderColor: c.pooLine };
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
