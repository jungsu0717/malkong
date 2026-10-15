/**
 * 할 일 탭 (SPEC-TOPIC-01 · 02 · 03 · 06 · 07 · 11, task topic/001~004, decisions/024~026).
 *
 * 보통 할 일 앱처럼 오늘 · 예정 · 날짜 없음으로 본다. 오늘에는 내가 적은 할 일과 앱이 채워 준 할 일(기념일, 사이즈 바꾸기),
 * 지금 기간인 접종 · 검진이 함께 보인다. 아래에 주제 그리드. 행성 그림은 홈에, 장보기는 장보기 탭에 있다.
 * 바닥 칸에 적으면 「내 할 일」에 들어가고, 날짜를 안 적으면 오늘 할 일이 된다 — 이 화면은 「오늘」을 보는 곳이라서.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RepeatSuggest } from '@/components/todo/repeat-suggest';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TopicGrid } from '@/components/todo/topic-grid';
import { TOPIC_ICONS } from '@/components/todo/topic-icons';
import { TodoRow } from '@/components/todo-row';
import { Card, Folded, ListRow, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { isLegacyKind, laterTodos, nowCount, repeatSuggestion, sortOpen, todayTodos, visibleTopics, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

export default function TodoScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, updateTopic, dismissed } = useTodos();
  const markDone = useMarkDone();
  const typing = useKeyboardVisible();
  const [editing, setEditing] = useState<Todo | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const month = age?.month ?? 0;
  // 장보기는 탭이 따로 있어 이 화면의 목록과 그리드에서 뺀다
  const shown = useMemo(() => visibleTopics(topics).filter((t) => t.kind !== 'shopping'), [topics]);
  // 숨긴 주제의 할 일은 이 화면에 올리지 않는다
  const visibleTodos = useMemo(() => {
    const ids = new Set(shown.map((t) => t.id));
    return todos.filter((t) => ids.has(t.topicId));
  }, [shown, todos]);
  const groups = useMemo(() => checkupGroups(records, month), [records, month]);
  // 오늘에는 지금 기간인 것만 — 지난 일정은 접종 · 검진 주제 안에서 「했다면 알려 주세요」로 본다
  const dueGroups = useMemo(() => groups.filter((g) => g.status === 'open'), [groups]);

  if (!baby || !age || loading) return <ScreenLoading />;
  const general = shown.find((t) => t.kind === 'general');
  // 사용자가 숨긴 주제만 — 예전 기본 주제(decisions/025)는 다시 보이지 않는다
  const hidden = topics.filter((t) => t.hidden && !isLegacyKind(t.kind));
  const { open, doneToday } = todayTodos(visibleTodos);
  const later = laterTodos(visibleTodos);
  const undated = sortOpen(visibleTodos.filter((t) => !t.doneAt && !t.dueAt && t.topicId === general?.id));
  // 「내 할 일」은 이름을 붙이지 않는다 — 앱이 채운 할 일에만 주제 이름
  const nameOf = (topicId: string) => (topicId === general?.id ? null : (topics.find((t) => t.id === topicId)?.title ?? null));
  const empty = open.length === 0 && dueGroups.length === 0 && doneToday.length === 0;
  const suggestion = repeatSuggestion(visibleTodos, dismissed);
  const openTopic = (id: string) => router.push({ pathname: '/topic/[id]', params: { id } });
  const row = (t: Todo, i: number) => (
    <TodoItem
      key={t.id}
      todo={t}
      topicName={nameOf(t.topicId)}
      divider={i > 0}
      onToggle={() => void toggleDone(t.id)}
      onEdit={() => setEditing(t)}
    />
  );

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

            {/* 오늘 (SPEC-TOPIC-02) */}
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
                    {[...open, ...doneToday].map((t, i) => row(t, dueGroups.length + i))}
                  </>
                )}
              </Card>
            </View>

            {/* 예정 — 내일부터. 앱이 채운 할 일도 기한 전부터 여기 보인다(SPEC-TOPIC-11) */}
            {later.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="예정" />
                <Card style={styles.rows}>
                  <Folded limit={5}>{later.map(row)}</Folded>
                </Card>
              </View>
            )}

            {undated.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="날짜 없음" />
                <Card style={styles.rows}>{undated.map(row)}</Card>
              </View>
            )}

            {/* 반복 추천 (SPEC-TOPIC-06) */}
            {suggestion && <RepeatSuggest suggestion={suggestion} />}

            {/* 주제 그리드 (SPEC-TOPIC-01) — 숫자는 지금 할 것(기한이 오늘까지거나 없는 것, 지금 기간인 접종 · 검진) */}
            <View style={styles.section}>
              <SectionHeader title="주제" />
              <TopicGrid
                topics={shown.map((t) => ({
                  id: t.id,
                  title: t.title,
                  icon: TOPIC_ICONS[t.kind],
                  count: nowCount(t, todos) + (t.kind === 'checkup' ? dueGroups.length : 0),
                }))}
                onOpen={openTopic}
              />
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

          <TodoInput
            placeholder="할 일 추가 (예: 내일 오전 10시 분유 주문)"
            onAdd={(p) => {
              // 이 화면은 「오늘」을 보는 곳 — 날짜를 안 적으면 오늘 할 일로
              const today = new Date();
              const dueAt = p.dueAt ?? new Date(today.getFullYear(), today.getMonth(), today.getDate());
              void add({ title: p.title, dueAt: dueAt.toISOString(), hasTime: p.hasTime, repeat: p.repeat });
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {markDone.sheet}
      <TodoSheet
        key={editing?.id ?? 'none'}
        todo={editing}
        topics={shown}
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
});
