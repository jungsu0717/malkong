/**
 * 홈 위쪽 먹색 머리 (SPEC-MAIN-08, task today/007) — 날짜 · 태어난 지 며칠, 제목 「홈」, 큰 글씨로 「이번 주 챙길 일 4개」.
 * 모양은 루틴 화면 머리(routine-hero)와 같은 결.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Gutter, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function HomeHero({
  topInset,
  dateText,
  headline,
}: {
  topInset: number;
  /** 「10월 27일 화요일 · 태어난 지 27일」 */
  dateText: string;
  headline: string;
}) {
  const c = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: c.hero, paddingTop: topInset + 16 }]}>
      {/* 위로 당겨도 흰 바탕이 보이지 않게 */}
      <View style={[styles.overscroll, { backgroundColor: c.hero }]} />
      <View style={styles.inner}>
        <View>
          <ThemedText type="small" style={{ color: c.onHeroDim }}>
            {dateText}
          </ThemedText>
          <ThemedText type="display" style={[styles.title, { color: c.onHero }]}>
            홈
          </ThemedText>
        </View>
        <ThemedText type="title" style={[styles.headline, { color: c.onHero }]}>
          {headline}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 24, paddingHorizontal: Gutter },
  overscroll: { position: 'absolute', left: 0, right: 0, top: -1000, height: 1000 },
  inner: { gap: 14, width: '100%', maxWidth: MaxContentWidth - Gutter * 2, alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 38 },
  headline: { fontSize: 24, lineHeight: 30 },
});
