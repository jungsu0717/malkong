import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { BriefingCard } from '@/components/briefing-card';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import type { MalkongMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useMarkDone } from '@/hooks/use-mark-done';

/**
 * 지난 브리핑 보관함 (SPEC-HOME-06, task home/004) — 버디 탭 오른쪽 위에서 연다.
 * 대화 타임라인에 있는 브리핑만 날짜 거꾸로 모아 보인다. 여기서 완료해도 같은 기록이 생긴다.
 */
export default function BriefingsScreen() {
  const { messages } = useChat();
  const { pick, sheet } = useMarkDone();
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
          briefings.map((m) => <BriefingCard key={m.id} message={m} today={false} onPick={pick} />)
        )}
      </ScrollView>
      {sheet}
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
