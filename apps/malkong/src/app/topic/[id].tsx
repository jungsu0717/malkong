/**
 * 주제 하나 (SPEC-TOPIC-01 · 02 · 03 · 06 · 07 · 11 · 12, task topic/001~005).
 *
 * 할 일(안 끝낸 것) → 주제마다 더 보이는 것 → 완료(접어 둠).
 * - 접종 · 검진: 맨 위에 공공 일정, 할 일 이름은 「준비물」, 준비물 추천
 * - 사이즈 바꾸기: 앱이 생일로 만들 다가오는 할 일(아직 목록에 없는 것)과 날짜, 할 일마다 안내 한 줄
 * - 기념일: 맨 위에 50일 · 100일 · 돌 · 두 돌 날짜, 다가오는 할 일
 * - 생활 루틴: 반복 할 일 추천(한 번 눌러 추가)
 * - 직접 만든 주제: 완료 아래 「모두 체크 해제」(외출 가방처럼 다시 쓰는 목록)
 * 바닥 칸에 적으면 이 주제에 들어간다. 장보기 주제는 장보기 탭으로 보낸다.
 */

import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RepeatSuggest } from '@/components/todo/repeat-suggest';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TopicSheet } from '@/components/todo/topic-sheet';
import { TodoRow } from '@/components/todo-row';
import { Button, Card, Folded, IconButton, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { birthOf, milestoneDays, ruleOf, upcomingAuto, type AutoKind } from '@/data/auto-todos';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { dueLabel } from '@/data/due-parse';
import { useRecords } from '@/data/records-context';
import { repeatLabel } from '@/data/repeat';
import { STARTERS, repeatSuggestion, sortDone, sortOpen, titleKey, todosOfTopic, type Starter, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

const AUTO_KINDS: AutoKind[] = ['milestone', 'size'];
/** 다가오는 할 일을 몇 개까지 보일지 */
const UPCOMING_LIMIT = 4;

/** 「D-12」 — 오늘이면 「오늘」 */
function dday(date: Date, now = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - today) / 86_400_000);
  return days === 0 ? '오늘' : days > 0 ? `D-${days}` : `${-days}일 지남`;
}

export default function TopicScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, updateTopic, resetTopic, dismissed, autoRemoved } = useTodos();
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

  // 장보기는 탭이 따로 있다(SPEC-SHOP-01)
  if (topic.kind === 'shopping') return <Redirect href="/shop" />;

  const list = todosOfTopic(topic, todos);
  const open = sortOpen(list.filter((t) => !t.doneAt));
  const done = sortDone(list.filter((t) => t.doneAt));
  const birth = birthOf(baby.birthDate);
  const now = new Date();

  // 추천 — 지금 안 끝낸 할 일과 이름이 같은 것은 빼고 보인다
  const openNames = new Set(open.map((t) => titleKey(t.title)));
  const starters = (STARTERS[topic.kind] ?? []).filter((s) => !openNames.has(titleKey(s.title)));
  const addStarter = (s: Starter) => add({ title: s.title, repeat: s.repeat, source: 'starter', topicId: topic.id });
  const suggestion = repeatSuggestion(todos, dismissed, topic.id);

  const isCheckup = topic.kind === 'checkup';
  const groups = isCheckup ? checkupGroups(records, age.month) : [];
  const nowGroups = groups.filter((g) => g.status === 'open');
  const missed = groups.filter((g) => g.status === 'missed');
  const soon = groups.filter((g) => g.status === 'soon').slice(0, 2);

  // 앱이 채우는 주제 — 아직 목록에 없는 다가오는 할 일(SPEC-TOPIC-11)
  const autoKind = (AUTO_KINDS as string[]).includes(topic.kind) ? (topic.kind as AutoKind) : null;
  // 이미 목록에 있거나 사용자가 지운 것은 빼고
  const have = new Set([...todos.map((t) => t.ref).filter((r): r is string => !!r), ...autoRemoved]);
  const upcoming = autoKind ? upcomingAuto(autoKind, birth, now, have).slice(0, UPCOMING_LIMIT) : [];
  const days = topic.kind === 'milestone' ? milestoneDays(birth) : [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todoRow = (t: Todo, i: number) => {
    const rule = ruleOf(t.ref);
    return (
      <TodoItem
        key={t.id}
        todo={t}
        note={rule?.note}
        divider={i > 0}
        onToggle={() => void toggleDone(t.id)}
        onEdit={() => setEditing(t)}
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: topic.title,
          headerRight: () => <IconButton icon="create-outline" label="주제 편집" onPress={() => setEditTopic(true)} />,
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
            {/* 기념일 날짜 — 지난 날은 흐리게 */}
            {days.length > 0 && (
              <Card style={styles.days}>
                {days.map((d) => {
                  const past = d.date < today;
                  return (
                    <View key={d.label} style={styles.day}>
                      <ThemedText type="label" style={{ color: past ? c.textTertiary : c.text, fontWeight: 600 }}>
                        {d.label}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: past ? c.textTertiary : c.textSecondary }}>
                        {`${d.date.getMonth() + 1}월 ${d.date.getDate()}일`}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: past ? c.textTertiary : c.accentText, fontWeight: 600 }}>
                        {past ? '지남' : dday(d.date, now)}
                      </ThemedText>
                    </View>
                  );
                })}
              </Card>
            )}

            {/* 접종 · 검진 — 공공 일정으로 계산 (SPEC-TOPIC-07) */}
            {isCheckup && (
              <View style={styles.section}>
                <SectionHeader title="일정" aside="질병관리청 · 건강보험공단 일정" />
                <Card style={styles.rows}>
                  {[...nowGroups, ...soon].length === 0 ? (
                    <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                      이번 달 접종 · 검진이 없어요
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
                      지난 일정이에요. 이미 했다면 「했어요」를 눌러 주세요
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
              <SectionHeader title={isCheckup ? '준비물' : '할 일'} aside={open.length > 0 ? `${open.length}개` : undefined} />
              <Card style={styles.rows}>
                {open.length === 0 ? (
                  <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                    {autoKind
                      ? upcoming.length > 0
                        ? '지금 할 일은 없어요. 날짜가 가까워지면 여기에 추가돼요'
                        : '지금 할 일은 없어요'
                      : starters.length > 0
                        ? '추천에서 고르거나 아래에 입력해 주세요'
                        : '아래에 입력해 주세요'}
                  </ThemedText>
                ) : (
                  open.map(todoRow)
                )}
              </Card>
            </View>

            {/* 다가오는 할 일 — 앱이 생일로 계산(SPEC-TOPIC-11). 날짜가 가까워지면 위 할 일에 추가된다 */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="다가오는 할 일" />
                <Card style={styles.rows}>
                  {upcoming.map((u, i) => (
                    <ListRow
                      key={u.rule.ref}
                      divider={i > 0}
                      icon="calendar-outline"
                      title={u.rule.title}
                      detail={dueLabel(u.due, false, now)}
                      right={
                        <ThemedText type="caption" style={{ color: c.textSecondary }}>
                          {dday(u.due, now)}
                        </ThemedText>
                      }
                    />
                  ))}
                </Card>
              </View>
            )}

            {/* 반복 추천 (SPEC-TOPIC-06) */}
            {suggestion && <RepeatSuggest suggestion={suggestion} />}

            {/* 추천 — 한 번 만들어 둔 목록(SPEC-TOPIC-01, 헌장 8). 생활 루틴은 반복 할 일로 추가된다 */}
            {starters.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="추천" />
                <Card style={styles.rows}>
                  {starters.map((s, i) => (
                    <ListRow
                      key={s.title}
                      divider={i > 0}
                      icon="add-circle-outline"
                      title={s.title}
                      detail={s.repeat ? `${repeatLabel(s.repeat)} 반복` : null}
                      right={
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${s.title} 추가`}
                          hitSlop={8}
                          onPress={() => {
                            tap();
                            void addStarter(s);
                          }}>
                          <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                            추가
                          </ThemedText>
                        </Pressable>
                      }
                    />
                  ))}
                </Card>
                {starters.length > 1 && (
                  <Button
                    label="모두 추가"
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

            {/* 완료 — 지우지 않는다(헌장 2). 직접 만든 주제는 외출 가방처럼 다시 쓰게 「모두 체크 해제」(SPEC-TOPIC-12) */}
            {done.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="완료" aside={`${done.length}개`} />
                <Card style={styles.rows}>
                  <Folded limit={3}>{done.map(todoRow)}</Folded>
                </Card>
                {topic.kind === 'custom' && done.some((t) => !t.repeat) && (
                  <Button
                    label="모두 체크 해제"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      tap();
                      void resetTopic(topic.id);
                    }}
                  />
                )}
              </View>
            )}

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
        onSave={(title, icon) => {
          setEditTopic(false);
          void updateTopic(topic.id, icon ? { title, icon } : { title });
        }}
        // 「내 할 일」은 숨기지 않는다 — 첫 화면에서 적은 할 일이 들어가는 곳이라서
        onHide={
          topic.kind === 'general'
            ? undefined
            : () => {
                setEditTopic(false);
                void updateTopic(topic.id, { hidden: true });
                router.back();
              }
        }
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
  days: { flexDirection: 'row', paddingVertical: Spacing.three },
  day: { alignItems: 'center', gap: 2, flex: 1 },
});
