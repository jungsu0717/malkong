/**
 * 「지금 아기와 있는 곳」 고르기 (SPEC-MAIN-07 · SPEC-TOPIC-13) — 병원 · 산후조리원 · 집. 루틴 추천과 할 일 추천 화면 위에 있다.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { PLACES, PLACE_LABELS, type Place } from '@/data/recommend';
import { useTheme } from '@/hooks/use-theme';

export function PlacePicker({ place, onChange, caption }: { place: Place; onChange: (p: Place) => void; caption: string }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
        지금 아기와 있는 곳
      </ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel="지금 아기와 있는 곳" style={styles.row}>
        {PLACES.map((p) => {
          const on = place === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                onChange(p);
              }}
              style={[styles.option, { backgroundColor: on ? c.ink : c.background }]}>
              <ThemedText type="small" style={{ color: on ? c.onInk : c.text, fontWeight: on ? 700 : 400 }}>
                {PLACE_LABELS[p]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        {caption}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 6 },
  option: { flex: 1, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
