import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AdBanner } from '@/components/ad-banner';
import { openRecordNudge } from '@/components/record-nudge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, EmptyState, Segmented, tap, type IconName } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { dayKey } from '@/data/chat';
import { isBriefing, type InboxCard, type InboxKind } from '@/data/inbox';
import { useInbox } from '@/data/inbox-context';
import { inboxCardHref } from '@/data/schedule';
import { useTheme } from '@/hooks/use-theme';

type Section = 'briefing' | 'notice';

const ICONS: Record<InboxKind, IconName> = {
  daily: 'sunny-outline',
  weekly: 'calendar-outline',
  monthly: 'ribbon-outline',
  nudge: 'create-outline',
  family: 'people-outline',
};

/** 언제 왔나 — 오늘은 시각, 어제, 그 전은 날짜 */
function whenOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (dayKey(iso) === dayKey(now.toISOString())) {
    const h = d.getHours();
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 알림함 (SPEC-HOME-07, task home/007) — 버디 탭 오른쪽 위에서 연다. 「브리핑」 · 「알림」 둘로, 줄마다 요약만.
 * 누르면 읽음이 되고 그리로 간다 — 브리핑은 일정 탭의 그날, 기록 요청은 그 카드. 맨 아래 배너(app-design 광고 자리).
 */
export default function InboxScreen() {
  const c = useTheme();
  const { cards, markRead } = useInbox();
  const [section, setSection] = useState<Section>('briefing');
  const briefings = cards.filter(isBriefing);
  const notices = cards.filter((card) => !isBriefing(card));
  const shown = section === 'briefing' ? briefings : notices;
  const unreadOf = (list: InboxCard[]) => list.filter((card) => !card.readAt).length;
  const unreadShown = unreadOf(shown);

  const open = (card: InboxCard) => {
    tap();
    void markRead([card.id]);
    if (card.kind === 'nudge') {
      if (router.canGoBack()) router.back();
      openRecordNudge();
      return;
    }
    const href = inboxCardHref(card);
    if (href) router.navigate(href);
  };

  const label = (name: string, list: InboxCard[]) => (unreadOf(list) > 0 ? `${name} ${unreadOf(list)}` : name);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () =>
            unreadShown > 0 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                // 웹의 머리에는 오른쪽 여백이 없다
                style={Platform.OS === 'web' ? { paddingHorizontal: Gutter } : undefined}
                onPress={() => {
                  tap();
                  void markRead(shown.filter((card) => !card.readAt).map((card) => card.id));
                }}>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  모두 읽음
                </ThemedText>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Segmented
          options={[
            { value: 'briefing', label: label('브리핑', briefings) },
            { value: 'notice', label: label('알림', notices) },
          ]}
          value={section}
          onChange={setSection}
        />

        {shown.length === 0 ? (
          <EmptyState
            title={section === 'briefing' ? '아직 온 브리핑이 없어요' : '아직 온 알림이 없어요'}
            detail={
              section === 'briefing'
                ? '매일 처음 앱을 열면 버디가 그날 브리핑을 보내요. 월요일엔 주간, 월령이 바뀌면 월간 일정도 와요'
                : '기록이 며칠 비었을 때의 요청 같은 앱 알림이 여기 모여요. 가족 공유 신청도 나중에 여기로 와요'
            }
          />
        ) : (
          <Card style={styles.list}>
            {shown.map((card, i) => {
              const unread = !card.readAt;
              return (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.title}, ${card.summary}${unread ? ', 새 알림' : ''}`}
                  onPress={() => open(card)}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View style={[styles.icon, { backgroundColor: unread ? c.accentSoft : c.surface }]}>
                    <Ionicons name={ICONS[card.kind]} size={18} color={unread ? c.accent : c.textSecondary} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <ThemedText type="body" style={[styles.flex, { fontWeight: unread ? 700 : 500 }]} numberOfLines={1}>
                        {card.title}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: c.textTertiary }}>
                        {whenOf(card.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={2}>
                      {card.summary}
                    </ThemedText>
                  </View>
                  {unread && <View style={[styles.dot, { backgroundColor: c.accent }]} />}
                </Pressable>
              );
            })}
          </Card>
        )}
        <AdBanner />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    padding: Gutter,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  list: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
