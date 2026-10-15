/**
 * 주제 하나 (SPEC-TOPIC-01 · 02 · 03 · 07, task topic/001).
 *
 * 안 끝낸 할 일 → 시작 목록(기본 주제, 아직 넣지 않은 것만) → 끝낸 것(접어 둠). 접종 · 검진 주제는 맨 위에 공공 일정,
 * 장보기 주제는 다른 주제의 살 것까지 모아 보인다. 바닥 칸에 적으면 이 주제에 들어간다.
 */

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TopicSheet } from '@/components/todo/topic-sheet';
import { TodoRow } from '@/components/todo-row';
import { Button, Card, Folded, IconButton, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { STARTERS, sortDone, sortOpen, todosOfTopic, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 띄어쓰기를 뺀 제목 — 같은 할 일인지 볼 때 */
const norm = (s: string) => s.replace(/\s+/g, '');

export default function TopicScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, updateTopic } = useTodos();
  const markDone = useMarkDone();
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editTopic, setEditTopic] = useState(false);

  const topic = topics.find((t) => t.id === id);
  if (!baby || !age || loading) return <ScreenLoading />;
  if (!topic) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: '주제' }} />
        <ThemedText type="body" style={[styles.missing, { color: c.textSecondary }]}>
          이 주제를 찾지 못했어요
        </ThemedText>
      </ThemedView>
    );
  }

  const list = todosOfTopic(topic, todos);
  const open = sortOpen(list.filter((t) => !t.doneAt));
  const done = sortDone(list.filter((t) => t.doneAt));
  const nameOf = (topicId: string) => (topicId === topic.id ? null : (topics.find((t) => t.id === topicId)?.title ?? null));
  // 시작 목록 — 지금 안 끝낸 할 일과 이름이 같은 것은 빼고 보인다
  const openNames = new Set(open.map((t) => norm(t.title)));
  const starters = (STARTERS[topic.kind] ?? []).filter((s) => !openNames.has(norm(s.title)));
  const addStarter = (s: { title: string; buy?: boolean }) =>
    add({ title: s.title, buy: s.buy ?? false, source: 'starter', topicId: topic.id });

  const isCheckup = topic.kind === 'checkup';
  const groups = isCheckup ? checkupGroups(records, age.month) : [];
  const nowGroups = groups.filter((g) => g.status === 'open');
  const missed = groups.filter((g) => g.status === 'missed');
  const soon = groups.filter((g) => g.status === 'soon').slice(0, 2);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: topic.title,
          headerRight: () => <IconButton icon="create-outline" label="주제 고치기" onPress={() => setEditTopic(true)} />,
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
            {/* 접종 · 검진 — 공공 일정으로 계산 (SPEC-TOPIC-07) */}
            {isCheckup && (
              <View style={styles.section}>
                <SectionHeader title="일정" aside="질병관리청 · 건강보험공단 일정" />
                <Card style={styles.rows}>
                  {[...nowGroups, ...soon].length === 0 ? (
                    <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                      지금 챙길 접종 · 검진이 없어요
                    </ThemedText>
                  ) : (
                    [...nowGroups, ...soon].map((g, i) => (
                      <TodoRow
                        key={g.key}
                        todo={todoOf(g)}
                        birthDate={baby.birthDate}
                        currentMonth={age.month}
                        divider={i > 0}
                        onPick={() => markDone.pick(g)}
                      />
                    ))
                  )}
                </Card>
                {missed.length > 0 && (
                  <>
                    <ThemedText type="caption" style={{ color: c.textSecondary }}>
                      기간이 지난 일정이에요. 했다면 「했어요」로 알려 주세요
                    </ThemedText>
                    <Card style={styles.rows}>
                      <Folded limit={2}>
                        {missed.map((g, i) => (
                          <TodoRow
                            key={g.key}
                            todo={todoOf(g)}
                            birthDate={baby.birthDate}
                            currentMonth={age.month}
                            divider={i > 0}
                            onPick={() => markDone.pick(g)}
                          />
                        ))}
                      </Folded>
                    </Card>
                  </>
                )}
              </View>
            )}

            {/* 할 일 (SPEC-TOPIC-02) */}
            <View style={styles.section}>
              <SectionHeader title={isCheckup ? '챙길 것' : '할 일'} aside={open.length > 0 ? `${open.length}개` : undefined} />
              <Card style={styles.rows}>
                {open.length === 0 ? (
                  <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                    {starters.length > 0 ? '아래 시작 목록에서 넣거나, 바닥 칸에 적어 보세요' : '바닥 칸에 적어 보세요'}
                  </ThemedText>
                ) : (
                  open.map((t, i) => (
                    <TodoItem
                      key={t.id}
                      todo={t}
                      topicName={nameOf(t.topicId)}
                      divider={i > 0}
                      onToggle={() => void toggleDone(t.id)}
                      onEdit={() => setEditing(t)}
                    />
                  ))
                )}
              </Card>
            </View>

            {/* 시작 목록 — 한 번 만들어 둔 추천(SPEC-TOPIC-01, 헌장 8) */}
            {starters.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="시작 목록" />
                <Card style={styles.rows}>
                  {starters.map((s, i) => (
                    <ListRow
                      key={s.title}
                      divider={i > 0}
                      icon="add-circle-outline"
                      title={s.title}
                      detail={s.buy ? '살 것' : null}
                      right={
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${s.title} 넣기`}
                          hitSlop={8}
                          onPress={() => {
                            tap();
                            void addStarter(s);
                          }}>
                          <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                            넣기
                          </ThemedText>
                        </Pressable>
                      }
                    />
                  ))}
                </Card>
                {starters.length > 1 && (
                  <Button
                    label="모두 넣기"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      tap('success');
                      void (async () => {
                        for (const s of starters) await addStarter(s);
                      })();
                    }}
                  />
                )}
              </View>
            )}

            {/* 끝낸 것 — 지우지 않는다(헌장 2) */}
            {done.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="끝낸 것" aside={`${done.length}개`} />
                <Card style={styles.rows}>
                  <Folded limit={3}>
                    {done.map((t, i) => (
                      <TodoItem
                        key={t.id}
                        todo={t}
                        topicName={nameOf(t.topicId)}
                        divider={i > 0}
                        onToggle={() => void toggleDone(t.id)}
                        onEdit={() => setEditing(t)}
                      />
                    ))}
                  </Folded>
                </Card>
              </View>
            )}
          </ScrollView>

          <TodoInput
            placeholder={`${topic.title}에 적기 — 예: 금요일 ${starters[0]?.title ?? '장보기'}`}
            onAdd={(p) =>
              void add({ title: p.title, dueAt: p.dueAt ? p.dueAt.toISOString() : null, hasTime: p.hasTime, topicId: topic.id })
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {markDone.sheet}
      <TodoSheet
        key={editing?.id ?? 'none'}
        todo={editing}
        topics={topics.filter((t) => !t.hidden)}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) void update(editing.id, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) void remove(editing.id);
          setEditing(null);
        }}
      />
      <TopicSheet
        key={editTopic ? `edit-${topic.id}` : 'closed'}
        open={editTopic}
        topic={topic}
        onClose={() => setEditTopic(false)}
        onSave={(title) => {
          setEditTopic(false);
          void updateTopic(topic.id, { title });
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
  section: { gap: 10 },
  rows: { paddingVertical: 2 },
  empty: { paddingVertical: Spacing.three },
  missing: { padding: Spacing.four, textAlign: 'center' },
});
