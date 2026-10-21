/**
 * 준비 목록 하나 (SPEC-TOPIC-01 · 12, task topic/005 · todo/001) — 외출 가방 · 여행 짐처럼 직접 만든 목록.
 * 내용은 할 일 탭 카테고리와 같은 TopicContent 이고, 바닥 칸에 적으면 이 목록에 들어간다. 오른쪽 위에서 이름 · 아이콘 편집과 숨기기.
 * 기본 주제(접종 · 검진 · 기념일 · 사이즈 · 내 할 일 · 장보기)는 할 일 탭 카테고리로 보낸다.
 */

import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodoInput } from '@/components/todo/todo-input';
import { TopicContent } from '@/components/todo/topic-content';
import { TopicSheet } from '@/components/todo/topic-sheet';
import { IconButton } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

export default function TopicScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baby, age } = useBaby();
  const { topics, loading, add, updateTopic } = useTodos();
  const [editTopic, setEditTopic] = useState(false);

  const topic = topics.find((t) => t.id === id);
  if (!baby || !age || loading) return <ScreenLoading />;
  if (!topic) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: '준비 목록' }} />
        <ThemedText type="body" style={[styles.missing, { color: c.textSecondary }]}>
          이 목록을 찾지 못했어요
        </ThemedText>
      </ThemedView>
    );
  }

  // 기본 주제는 할 일 탭의 카테고리에 있다(SPEC-TOPIC-02)
  if (topic.kind !== 'custom') return <Redirect href={{ pathname: '/todo', params: { cat: topic.kind === 'shopping' ? 'shop' : topic.id } }} />;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: topic.title,
          headerRight: () => <IconButton icon="create-outline" label="목록 편집" onPress={() => setEditTopic(true)} />,
        }}
      />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            <TopicContent topic={topic} />
          </ScrollView>

          <TodoInput
            placeholder="할 일 추가 (예: 금요일 오전 10시)"
            onAdd={(p) =>
              void add({
                title: p.title,
                dueAt: p.dueAt ? p.dueAt.toISOString() : null,
                hasTime: p.hasTime,
                repeat: p.repeat,
                topicId: topic.id,
              })
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <TopicSheet
        key={editTopic ? `edit-${topic.id}` : 'closed'}
        open={editTopic}
        topic={topic}
        onClose={() => setEditTopic(false)}
        onSave={(title, icon) => {
          setEditTopic(false);
          void updateTopic(topic.id, icon ? { title, icon } : { title });
        }}
        onHide={() => {
          setEditTopic(false);
          void updateTopic(topic.id, { hidden: true });
          router.back();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  missing: { padding: Spacing.four, textAlign: 'center' },
});
