/**
 * 할 일 탭 (SPEC-TOPIC-01 · 02 · 03 · 06 · 07 · 11, task topic/001~004, decisions/024~026).
 *
 * 보통 할 일 앱처럼 오늘 · 예정 · 날짜 없음으로 본다. 오늘에는 내가 적은 할 일과 앱이 채워 준 할 일(기념일, 사이즈 바꾸기),
 * 지금 기간인 접종 · 검진이 함께 보이고, 예정에는 곧 시작하는 접종 · 검진도 D-day 로 섞인다. 그 아래 「준비 목록 · 주제별 보기 · 추천 할 일」
 * 세 줄 — 긴 목록은 상세 화면에서 본다(task today/003 · common/022, decisions/029 · 030). 살 것은 장보기 탭에 있다.
 * 바닥 칸에 적으면 「내 할 일」에 들어가고, 날짜를 안 적으면 오늘 할 일이 된다 — 이 화면은 「오늘」을 보는 곳이라서.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RepeatSuggest } from '@/components/todo/repeat-suggest';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TodoRow } from '@/components/todo-row';
import { Card, Folded, ListRow, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { monthStart, todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { laterTodos, repeatSuggestion, sortOpen, todayTodos, visibleTopics, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

export default function TodoScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, dismissed } = useTodos();
  const markDone = useMarkDone();
  const typing = useKeyboardVisible();
  const [editing, setEditing] = useState<Todo | null>(null);

  const month = age?.month ?? 0;
  // 장보기는 장보기 탭, 직접 만든 목록은 아래 「준비 목록」에 있어 날짜 목록과 주제 그리드에서 뺀다(task today/003)
  const shown = useMemo(() => visibleTopics(topics).filter((t) => t.kind !== 'shopping' && t.kind !== 'custom'), [topics]);
  // 숨긴 주제의 할 일은 이 화면에 올리지 않는다
  const visibleTodos = useMemo(() => {
    const ids = new Set(shown.map((t) => t.id));
    return todos.filter((t) => ids.has(t.topicId));
  }, [shown, todos]);
  const groups = useMemo(() => checkupGroups(records, month), [records, month]);
  // 오늘에는 지금 기간인 것만 — 지난 일정은 접종 · 검진 주제 안에서 「했다면 알려 주세요」로 본다
  const dueGroups = useMemo(() => groups.filter((g) => g.status === 'open'), [groups]);
  // 예정에 섞일 곧 시작하는 접종 · 검진(다음 개월까지) — 루틴 탭에 있던 「다가오는 날」을 옮겼다
  const soonGroups = useMemo(() => groups.filter((g) => g.status === 'soon' && g.month <= month + 1), [groups, month]);

  if (!baby || !age || loading) return <ScreenLoading />;
  const general = shown.find((t) => t.kind === 'general');
  const { open, doneToday } = todayTodos(visibleTodos);
  const later = laterTodos(visibleTodos);
  const undated = sortOpen(visibleTodos.filter((t) => !t.doneAt && !t.dueAt && t.topicId === general?.id));
  // 「내 할 일」은 이름을 붙이지 않는다 — 앱이 채운 할 일에만 주제 이름
  const nameOf = (topicId: string) => (topicId === general?.id ? null : (topics.find((t) => t.id === topicId)?.title ?? null));
  const empty = open.length === 0 && dueGroups.length === 0 && doneToday.length === 0;
  const suggestion = repeatSuggestion(visibleTodos, dismissed);
  // 준비 목록 이름 — 더 보기 줄에 한 줄로
  const lists = topics.filter((t) => t.kind === 'custom' && !t.hidden).sort((a, b) => a.sort - b.sort);
  // 예정 — 기한이 내일부터인 할 일과 곧 시작하는 접종 · 검진을 날짜 순으로
  const upcoming = [
    ...later.map((t) => ({ at: t.dueAt ?? '', kind: 'todo' as const, todo: t })),
    ...soonGroups.map((g) => ({ at: monthStart(baby.birthDate, g.month).toISOString(), kind: 'checkup' as const, group: g })),
  ].sort((a, b) => a.at.localeCompare(b.at));
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
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="예정" />
                <Card style={styles.rows}>
                  <Folded limit={5}>
                    {upcoming.map((u, i) =>
                      u.kind === 'todo' ? (
                        row(u.todo, i)
                      ) : (
                        <TodoRow
                          key={u.group.key}
                          todo={todoOf(u.group)}
                          birthDate={baby.birthDate}
                          currentMonth={month}
                          divider={i > 0}
                          onPick={() => markDone.pick(u.group)}
                        />
                      ),
                    )}
                  </Folded>
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

            {/* 더 보기 — 긴 목록은 상세 화면으로(요약 + 상세, task common/022) */}
            <Card style={styles.rows}>
              <ListRow
                icon="briefcase-outline"
                title="준비 목록"
                detail={lists.length > 0 ? lists.map((l) => l.title).join(' · ') : '외출 가방 · 여행 짐처럼 다시 쓰는 목록'}
                onPress={() => router.push('/lists')}
              />
              <ListRow
                divider
                icon="grid-outline"
                title="주제별 보기"
                detail="접종 · 검진 일정, 기념일, 사이즈, 완료한 할 일"
                onPress={() => router.push('/topics')}
              />
              <ListRow
                divider
                icon="star-outline"
                title="추천 할 일"
                detail="지금 시기에 맞는 할 일"
                onPress={() => router.push('/todo-recommend')}
              />
            </Card>

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
});
