import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BriefingCard } from '@/components/briefing-card';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { dayKey, type MalkongMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useDailyLog } from '@/hooks/use-daily-log';
import { useMarkDone } from '@/hooks/use-mark-done';

/**
 * 브리핑함 (SPEC-HOME-06, task home/004 · 005) — 버디 탭 오른쪽 위에서 연다. 배지는 오늘 아직 안 한 것의 수.
 * 맨 위가 오늘 브리핑이고 여기서도 할 일을 끝내고 하루 기록을 적는다. 그 아래는 지난 브리핑을 날짜 거꾸로.
 * 여기서 완료해도 대화의 브리핑과 같은 기록이 생긴다.
 */
export default function BriefingsScreen() {
  const { messages } = useChat();
  const { pick, justSaved, undo, sheet } = useMarkDone();
  const { openLog, sheet: logSheet } = useDailyLog();
  const [today] = useState(() => dayKey(new Date().toISOString()));
  const briefings = messages
    .filter((m): m is MalkongMessage => m.role === 'malkong' && m.meta.type === 'briefing')
    .reverse();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {briefings.length === 0 ? (
          <EmptyState
            title="아직 브리핑이 없어요"
            detail="매일 처음 앱을 열면 버디가 그날 챙길 것을 정리해 드려요"
            action={{ label: '버디로 가기', onPress: () => router.navigate('/') }}
          />
        ) : (
          briefings.map((m) => {
            const isToday = m.meta.type === 'briefing' && m.meta.day === today;
            return (
              <BriefingCard
                key={m.id}
                message={m}
                today={isToday}
                hello={false}
                onPick={pick}
                onLog={openLog}
                justSaved={isToday ? justSaved : null}
                onUndo={undo}
              />
            );
          })
        )}
      </ScrollView>
      {sheet}
      {logSheet}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Gutter,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
