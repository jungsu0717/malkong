/**
 * 할 일 탭 (SPEC-TOPIC-01 · 02 · 03 · 06 · 07 · 10, task topic/001 · 002, decisions/024).
 *
 * 맨 위에 행성 그림(주제별 이번 달 할 일과 반복 할 일, 이번 주 완료 수와 오늘 남은 수), 그 아래 오늘 할 일(기한이 오늘이거나
 * 지난 것, 지금 기간인 접종 · 검진), 반복 추천, 주제 그리드. 그림 높이를 줄여 첫 화면에 오늘 할 일이 같이 보이게 한다.
 * 바닥 칸에 적으면 주제를 고르지 않아도 제목으로 짐작해 넣고, 날짜를 안 적으면 오늘 할 일로 둔다 — 이 화면은 「오늘」을 보는 곳이라서.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TopicGalaxy, type GalaxyPlanet } from '@/components/todo/topic-galaxy';
import { TopicGrid } from '@/components/todo/topic-grid';
import { TOPIC_ICONS, topicColor } from '@/components/todo/topic-icons';
import { TopicSheet } from '@/components/todo/topic-sheet';
import { TodoRow } from '@/components/todo-row';
import { Card, ListRow, SectionHeader } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import {
  monthTodos,
  nowCount,
  repeatSuggestion,
  todayTodos,
  todosOfTopic,
  visibleTopics,
  weekDoneCount,
  type Todo,
} from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 행성 그림 높이 — 첫 화면에 오늘 할 일이 같이 보이게 예전(330)보다 낮게 */
const GALAXY_HEIGHT = 240;
/** 행성 하나에 그리는 할 일 점 수 */
const MAX_DOTS = 10;

export default function TodoScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, addTopic, updateTopic, dismissed } = useTodos();
  // 탭에 들어올 때마다 그림 등장 모션을 다시, 안 보일 때는 멈춘다
  const [visit, setVisit] = useState(0);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisit((v) => v + 1);
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
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

  const month = age?.month ?? 0;
  const shown = useMemo(() => visibleTopics(topics, todos, month), [topics, todos, month]);
  const groups = useMemo(() => checkupGroups(records, month), [records, month]);
  // 오늘에는 지금 기간인 것만 — 지난 일정은 접종 · 검진 주제 안에서 「했다면 알려 주세요」로 본다
  const dueGroups = useMemo(() => groups.filter((g) => g.status === 'open'), [groups]);

  // 행성 그림 — 주제마다 이번 달 할 일 점(10개까지, 넘으면 완료와 남은 것의 비율을 지켜 줄인다)과 반복 할 일 위성(SPEC-TOPIC-10)
  const planets = useMemo<GalaxyPlanet[]>(() => {
    const raw = shown.map((t, i) => {
      const list = monthTodos(t, todos);
      const done = list.filter((d) => d.doneAt).map((d) => ({ key: d.id, done: true }));
      const open = list.filter((d) => !d.doneAt).map((d) => ({ key: d.id, done: false }));
      // 접종 · 검진은 지금 기간인 일정도 남은 할 일로
      if (t.kind === 'checkup') open.push(...dueGroups.map((g) => ({ key: g.key, done: false })));
      const total = done.length + open.length;
      const cap = Math.min(MAX_DOTS, total);
      const doneDots = total > 0 ? Math.round((cap * done.length) / total) : 0;
      return {
        id: t.id,
        name: t.title,
        color: topicColor(t.kind, i),
        total,
        dots: [...done.slice(0, doneDots), ...open.slice(0, cap - doneDots)],
        moons: todosOfTopic(t, todos).filter((d) => !d.doneAt && d.repeat).length,
      };
    });
    const most = Math.max(1, ...raw.map((p) => p.total));
    return raw.map(({ total, ...p }) => ({ ...p, size: total / most }));
  }, [shown, todos, dueGroups]);

  if (!baby || !age || loading) return <ScreenLoading />;
  const hidden = topics.filter((t) => t.hidden);
  const { open, doneToday } = todayTodos(todos);
  const nameOf = (topicId: string) => topics.find((t) => t.id === topicId)?.title ?? null;
  const empty = open.length === 0 && dueGroups.length === 0 && doneToday.length === 0;
  const left = open.length + dueGroups.length;
  const weekDone = weekDoneCount(todos);
  const summary =
    [weekDone > 0 ? `이번 주 ${weekDone}개 완료` : null, left > 0 ? `오늘 ${left}개 남았어요` : null].filter(Boolean).join(' · ') ||
    (todos.length === 0 ? '할 일을 추가하면 주제마다 점으로 보여요' : '오늘 남은 할 일이 없어요');
  const suggestion = repeatSuggestion(todos, dismissed);
  const openTopic = (id: string) => router.push({ pathname: '/topic/[id]', params: { id } });

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

            {/* 행성 그림 (SPEC-TOPIC-10) — 숫자는 여기서만 보이고 오늘 머리에는 다시 적지 않는다 */}
            <View style={[styles.galaxy, { backgroundColor: c.space }]}>
              <TopicGalaxy
                planets={planets}
                replay={visit}
                active={focused}
                onSelect={openTopic}
                height={GALAXY_HEIGHT}
                coreColor={c.accent}
              />
              {/* 요약과 점 설명은 위에 — 앞쪽 행성이 카드 아래로 지나간다 */}
              <View pointerEvents="none" style={styles.overlayTop}>
                <ThemedText type="label" style={{ color: c.onSpace, fontWeight: 600 }}>
                  {summary}
                </ThemedText>
                {todos.length > 0 && (
                  <View style={styles.legend}>
                    <View style={[styles.dotFilled, { backgroundColor: c.onSpaceDim }]} />
                    <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                      완료
                    </ThemedText>
                    <View style={[styles.dotHollow, { borderColor: c.onSpaceDim }]} />
                    <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                      남은 할 일
                    </ThemedText>
                    <View style={[styles.dotMoon, { backgroundColor: c.onSpaceDim }]} />
                    <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                      반복
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>

            {/* 오늘 할 일 (SPEC-TOPIC-02) */}
            <View style={styles.section}>
              <SectionHeader title="오늘" />
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
                onAdd={() => setNewTopic(true)}
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
              void add({
                title: p.title,
                dueAt: dueAt.toISOString(),
                hasTime: p.hasTime,
                repeat: p.repeat,
                topicId: pickTopic ?? undefined,
              }).then((t) => {
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
  galaxy: { borderRadius: Radius.lg, overflow: 'hidden', height: GALAXY_HEIGHT },
  overlayTop: { position: 'absolute', top: 14, left: 16, right: 16, gap: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dotFilled: { width: 7, height: 7, borderRadius: 4 },
  dotHollow: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.2, marginLeft: 8 },
  dotMoon: { width: 5, height: 5, borderRadius: 3, marginLeft: 8 },
  rows: { paddingVertical: 2 },
  empty: { paddingVertical: Spacing.three },
  hiddenToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: 6 },
  added: { textAlign: 'center', paddingTop: Spacing.one },
});
