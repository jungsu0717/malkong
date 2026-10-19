/**
 * 준비 목록 (SPEC-TOPIC-02 · 12, task common/022) — 외출 가방 · 여행 짐처럼 다시 쓰는 목록. 할 일 탭의 「준비 목록」 줄에서 들어온다.
 * 2열 카드(아이콘 · 이름 · 「남은 3개」), 마지막은 「새 목록」. 누르면 그 목록(주제 화면)으로 간다.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrepLists } from '@/components/todo/prep-lists';
import { iconOf } from '@/components/todo/topic-icons';
import { TopicSheet } from '@/components/todo/topic-sheet';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

export default function ListsScreen() {
  const c = useTheme();
  const { topics, todos, loading, addTopic } = useTodos();
  const [newList, setNewList] = useState(false);

  if (loading) return <ScreenLoading />;
  const openTopic = (id: string) => router.push({ pathname: '/topic/[id]', params: { id } });
  const lists = topics
    .filter((t) => t.kind === 'custom' && !t.hidden)
    .sort((a, b) => a.sort - b.sort)
    .map((t) => {
      const items = todos.filter((d) => d.topicId === t.id);
      return { id: t.id, title: t.title, icon: iconOf(t), left: items.filter((d) => !d.doneAt).length, done: items.filter((d) => d.doneAt).length };
    });

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {lists.length === 0 && (
          <ThemedText type="small" style={[styles.pad, { color: c.textSecondary }]}>
            외출 가방, 여행 짐처럼 자주 챙기는 것을 목록으로 만들어 두고 다시 쓸 수 있어요
          </ThemedText>
        )}
        <PrepLists lists={lists} onOpen={openTopic} onAdd={() => setNewList(true)} />
      </ScrollView>

      <TopicSheet
        key={newList ? 'topic-new' : 'topic-closed'}
        open={newList}
        topic={null}
        existingTitles={topics.map((t) => t.title)}
        onClose={() => setNewList(false)}
        onSave={(title, icon, items) => {
          setNewList(false);
          void addTopic(title, icon, items).then((t) => openTopic(t.id));
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  pad: { paddingHorizontal: 4 },
});
