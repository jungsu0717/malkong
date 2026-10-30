/**
 * 홈 「가족 초대」 카드 (SPEC-MAIN-08 · SPEC-MY-05, task log/003, decisions/036) — 아직 가족이 없는 폰에만.
 *
 * 할머니 · 할아버지까지 아기 하루를 함께 보게 하는 것이 이 앱이 사람을 모으는 길이다(가족 한 집에 쓰는 폰이 늘어난다).
 * 누르면 가족과 함께 보기 화면, × 를 누르면 이 폰에서 다시 보이지 않는다(마이 → 가족과 함께 보기는 그대로).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export function FamilyInvite({ onHide }: { onHide: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="가족 초대"
      onPress={() => {
        tap();
        router.push('/family');
      }}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceStrong : c.card }]}>
      <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="people-outline" size={20} color={c.accent} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="body" style={styles.title}>
          할머니, 할아버지도 함께 봐요
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          초대 코드 하나로 기록과 아기 일정을 같이 봐요
        </ThemedText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="가족 초대 카드 닫기" hitSlop={10} onPress={onHide}>
        <Ionicons name="close" size={18} color={c.textTertiary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: 700 },
});
