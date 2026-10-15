/**
 * 할 일 탭 (SPEC-TOPIC-01 · 02 · 03 · 07, task topic/001, decisions/024).
 *
 * 맨 위에 오늘 할 일(기한이 오늘이거나 지난 것, 지금 기간인 접종 · 검진), 그 아래 주제 목록(끝낸 수 / 전체 수).
 * 바닥 칸에 적으면 주제를 고르지 않아도 제목으로 짐작해 넣고, 날짜를 안 적으면 오늘 할 일로 둔다 — 이 화면은 「오늘」을 보는 곳이라서.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TopicSheet } from '@/components/todo/topic-sheet';
import { TodoRow } from '@/components/todo-row';
import { Card, ListRow, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { checkupGroups, nextCheckupLine } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { todayTodos, topicCount, visibleTopics, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { TOPIC_ICONS } from '@/components/todo/topic-icons';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

export default function TodoScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, addTopic, updateTopic } = useTodos();
  const markDone = useMarkDone();
  const typing = useKeyboardVisible();
  const [editing, setEditing] = useState<Todo | null>(null);
  const [newTopic, setNewTopic] = useState(false);
  const [pickTopic, setPickTopic] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  /** 방금 추가한 곳 — 「분유에 추가했어요」를 잠깐 보인다. 날짜가 있는 할 일은 오늘 목록에 안 보이므로 */
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [added]);

  if (!baby || !age || loading) return <ScreenLoading />;
  const month = age.month;
  const shown = visibleTopics(topics, todos, month);
  const hidden = topics.filter((t) => t.hidden);
  const { open, doneToday } = todayTodos(todos);
  const groups = checkupGroups(records, month);
  // 오늘에는 지금 기간인 것만 — 지난 일정은 접종 · 검진 주제 안에서 「했다면 알려 주세요」로 본다
  const dueGroups = groups.filter((g) => g.status === 'open');
  const nameOf = (topicId: string) => topics.find((t) => t.id === topicId)?.title ?? null;
  const empty = open.length === 0 && dueGroups.length === 0 && doneToday.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            <ThemedText type="display">할 일</ThemedText>

            {/* 오늘 할 일 (SPEC-TOPIC-02) */}
            <View style={styles.section}>
              <SectionHeader title="오늘" aside={open.length + dueGroups.length > 0 ? `${open.length + dueGroups.length}개` : undefined} />
              <Card style={styles.rows}>
                {empty ? (
                  <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                    오늘 할 일이 없어요
                  </ThemedText>
                ) : (
                  <>
                    {dueGroups.map((g, i) => (
                      <TodoRow
                        key={g.key}
                        todo={todoOf(g)}
                        birthDate={baby.birthDate}
                        currentMonth={month}
                        divider={i > 0}
                        onPick={() => markDone.pick(g)}
                      />
                    ))}
                    {[...open, ...doneToday].map((t, i) => (
                      <TodoItem
                        key={t.id}
                        todo={t}
                        topicName={nameOf(t.topicId)}
                        divider={dueGroups.length + i > 0}
                        onToggle={() => void toggleDone(t.id)}
                        onEdit={() => setEditing(t)}
                      />
                    ))}
                  </>
                )}
              </Card>
            </View>

            {/* 주제 (SPEC-TOPIC-01) */}
            <View style={styles.section}>
              <SectionHeader title="주제" />
              <Card style={styles.rows}>
                {shown.map((t, i) => {
                  const count = topicCount(t, todos);
                  const detail =
                    t.kind === 'checkup'
                      ? nextCheckupLine(groups, baby.birthDate, month)
                      : count.total > 0
                        ? `${count.done} / ${count.total}`
                        : '할 일 없음';
                  return (
                    <ListRow
                      key={t.id}
                      divider={i > 0}
                      icon={TOPIC_ICONS[t.kind]}
                      title={t.title}
                      detail={detail}
                      onPress={() => router.push({ pathname: '/topic/[id]', params: { id: t.id } })}
                    />
                  );
                })}
                <ListRow divider icon="add" title="주제 추가" onPress={() => setNewTopic(true)} />
              </Card>
              {hidden.length > 0 && (
                <Pressable accessibilityRole="button" onPress={() => setShowHidden((v) => !v)} style={styles.hiddenToggle}>
                  <ThemedText type="label" style={{ color: c.textSecondary }}>
                    숨긴 주제 {hidden.length}개
                  </ThemedText>
                  <Ionicons name={showHidden ? 'chevron-up' : 'chevron-down'} size={14} color={c.textSecondary} />
                </Pressable>
              )}
              {showHidden && hidden.length > 0 && (
                <Card style={styles.rows}>
                  {hidden.map((t, i) => (
                    <ListRow
                      key={t.id}
                      divider={i > 0}
                      icon={TOPIC_ICONS[t.kind]}
                      title={t.title}
                      detail="숨김"
                      right={
                        <Pressable accessibilityRole="button" onPress={() => void updateTopic(t.id, { hidden: false })} hitSlop={8}>
                          <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                            숨김 해제
                          </ThemedText>
                        </Pressable>
                      }
                    />
                  ))}
                </Card>
              )}
            </View>

            {/* 배너는 목록 끝에 — 적는 칸과 떨어뜨린다(SPEC-TOPIC-03 금지) */}
            {!typing && <AdBanner />}
          </ScrollView>

          {added && (
            <ThemedText type="caption" style={[styles.added, { color: c.textSecondary }]}>
              {added}
            </ThemedText>
          )}
          <TodoInput
            placeholder="할 일 추가 (예: 내일 오전 10시 분유 주문)"
            topics={shown}
            topicId={pickTopic}
            onTopic={setPickTopic}
            onAdd={(p) => {
              // 이 화면은 「오늘」을 보는 곳 — 날짜를 안 적으면 오늘 할 일로
              const today = new Date();
              const dueAt = p.dueAt ?? new Date(today.getFullYear(), today.getMonth(), today.getDate());
              void add({ title: p.title, dueAt: dueAt.toISOString(), hasTime: p.hasTime, topicId: pickTopic ?? undefined }).then((t) => {
                if (t) setAdded(`${nameOf(t.topicId) ?? '할 일'}에 추가했어요`);
              });
            }}
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
        key={newTopic ? 'open' : 'closed'}
        open={newTopic}
        topic={null}
        onClose={() => setNewTopic(false)}
        onSave={(title) => {
          setNewTopic(false);
          void addTopic(title).then((t) => router.push({ pathname: '/topic/[id]', params: { id: t.id } }));
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
  hiddenToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: 6 },
  added: { textAlign: 'center', paddingTop: Spacing.one },
});
