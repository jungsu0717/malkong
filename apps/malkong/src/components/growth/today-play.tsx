/**
 * 오늘의 놀이 카드 (SPEC-STAGE-04, task growth/007) — 성장 탭 머리 바로 아래.
 * 지금 시기의 「해 주면 좋아요」 가운데 날마다 하나(「다른 놀이」로 다음 것). 「했어요」를 누르면 그날 그 놀이가 메모로 남아
 * 이번 주 점이 채워지고 성장 일기에 모인다. 다시 누르면 지운다. 못 한 날을 탓하는 말은 쓰지 않는다.
 * 카드 글을 누르면 놀이 전체(해 주면 좋아요 화면).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DraftTag } from '@/components/growth/knowledge-sheet';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { playedToday, weekPlayCount } from '@/data/growth-plus';
import { useMemos } from '@/data/memos-context';
import { happyMoment } from '@/data/review';
import { playFor, playName } from '@/hooks/use-growth';
import { useTheme } from '@/hooks/use-theme';

export function TodayPlay({ birthDate, now }: { birthDate: string; now: Date }) {
  const c = useTheme();
  const { memos, togglePlay } = useMemos();
  const [offset, setOffset] = useState(0);
  const item = playFor(birthDate, now, offset);
  if (!item) return null;

  const done = playedToday(memos, item.id, now);
  const week = weekPlayCount(memos, now);
  const name = playName(item);

  return (
    <View style={[styles.card, { backgroundColor: c.accentSoft }]}>
      <View style={styles.head}>
        <View style={styles.label}>
          <Ionicons name="star-outline" size={15} color={c.accentText} />
          <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
            오늘의 놀이
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            tap();
            setOffset((o) => o + 1);
          }}>
          <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
            다른 놀이 ›
          </ThemedText>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityHint="놀이 전체 보기"
        onPress={() => {
          tap();
          router.push('/growth-tips');
        }}
        style={({ pressed }) => [styles.body, pressed && { opacity: 0.7 }]}>
        <ThemedText style={styles.title}>{name}</ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {item.body}
        </ThemedText>
        {!item.approved && <DraftTag />}
      </Pressable>

      <View style={styles.foot}>
        <View style={styles.week}>
          <View style={styles.dots}>
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < week ? c.accent : c.surfaceStrong }]} />
            ))}
          </View>
          {week > 0 && (
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              이번 주 {week}번
            </ThemedText>
          )}
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${name} 했어요`}
          onPress={() => {
            tap(done ? 'light' : 'success');
            void togglePlay(item.id, name).then((added) => {
              // 좋은 순간 — 쌓이면 스토어 별점 창(SPEC-MY-09)
              if (added) void happyMoment();
            });
          }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: done ? c.accent : c.ink, opacity: pressed ? 0.8 : 1 },
          ]}>
          {done && <Ionicons name="checkmark" size={16} color={c.onInk} />}
          <ThemedText type="small" style={{ color: c.onInk, fontWeight: 700 }}>
            했어요
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg + 4, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { gap: 3 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: 700, letterSpacing: -0.4 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  week: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  button: { height: 36, paddingHorizontal: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 4 },
});
