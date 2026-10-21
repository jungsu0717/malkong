/**
 * 할 일 탭 (SPEC-TOPIC-01 · 02 · 03 · 06 · 07 · 11 · SPEC-SHOP-01~05, task topic/001~004 · todo/001, decisions/024~026 · 031).
 *
 * 위에 카테고리 버튼 — 전체 · 장보기 · 접종 · 검진 · 기념일 · 사이즈 바꾸기 · 내 할 일. 장보기는 예전 장보기 탭이 그대로 들어온 것이다.
 * 「전체」는 보통 할 일 앱처럼 오늘 · 예정 · 날짜 없음으로 본다. 날짜가 있는 장보기는 할 일과 함께 보이고, 날짜 없는 장보기는
 * 「장보기 5개 · 마트 3 · 온라인 2」 한 줄로 줄인다(누르면 장보기 카테고리). 아래 「준비 목록 · 추천 할 일」 두 줄.
 * 다른 카테고리는 그 주제의 내용(TopicContent)과 장보기 내용(ShopContent)을 그대로 보인다.
 * 바닥 칸은 고른 카테고리에 맞춰 바뀐다 — 전체는 「내 할 일」(날짜를 안 적으면 오늘), 장보기는 살 곳 칩이 있는 칸.
 * 다른 화면에서 `/todo?cat=shop` 이나 `?cat=<주제 id>` 로 카테고리를 골라 열 수 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RepeatSuggest } from '@/components/todo/repeat-suggest';
import { ShopContent, ShopInput } from '@/components/todo/shop-content';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { TopicContent } from '@/components/todo/topic-content';
import { TodoRow } from '@/components/todo-row';
import { Card, Chip, Folded, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { monthStart, todoOf } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { laterTodos, repeatSuggestion, shopLists, shopPlaces, sortOpen, toBuyGroups, todayTodos, type Todo, type TopicKind } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 카테고리로 보이는 기본 주제 — 이 순서로. 기본 주제는 숨기지 않는다 */
const CATEGORY_KINDS: TopicKind[] = ['checkup', 'milestone', 'size', 'general'];
/** 「전체」 · 「장보기」 · 주제 id */
type Category = 'all' | 'shop' | string;

export default function TodoScreen() {
  const c = useTheme();
  const params = useLocalSearchParams<{ cat?: string }>();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, add, update, toggleDone, remove, dismissed } = useTodos();
  const markDone = useMarkDone();
  const typing = useKeyboardVisible();
  const [editing, setEditing] = useState<Todo | null>(null);
  // 고른 카테고리 — 다른 화면에서 `?cat=` 으로 새로 열면 그것을 따른다(고를 때 그때의 `cat` 을 함께 적어 둔다)
  const [chosen, setChosen] = useState<{ cat: Category; from?: string }>({ cat: 'all' });
  const category = params.cat && chosen.from !== params.cat ? params.cat : chosen.cat;
  const pick = (next: Category) => setChosen({ cat: next, from: params.cat });

  const month = age?.month ?? 0;
  const categoryTopics = useMemo(
    () =>
      CATEGORY_KINDS.map((k) => topics.find((t) => t.kind === k)).filter((t): t is NonNullable<typeof t> => !!t),
    [topics],
  );
  const shop = topics.find((t) => t.kind === 'shopping');
  // 「전체」에 모이는 할 일 — 기본 주제와 날짜 있는 장보기. 준비 목록(직접 만든 주제)은 아래 「준비 목록」에 있다
  const visibleTodos = useMemo(() => {
    const ids = new Set(categoryTopics.map((t) => t.id));
    return todos.filter((t) => ids.has(t.topicId) || (t.topicId === shop?.id && !!t.dueAt && !t.orderedAt));
  }, [categoryTopics, shop, todos]);
  const groups = useMemo(() => checkupGroups(records, month), [records, month]);
  // 오늘에는 지금 기간인 것만 — 지난 일정은 접종 · 검진 카테고리 안에서 「했다면 알려 주세요」로 본다
  const dueGroups = useMemo(() => groups.filter((g) => g.status === 'open'), [groups]);
  // 예정에 섞일 곧 시작하는 접종 · 검진(다음 개월까지)
  const soonGroups = useMemo(() => groups.filter((g) => g.status === 'soon' && g.month <= month + 1), [groups, month]);

  if (!baby || !age || loading || !shop) return <ScreenLoading />;
  const general = categoryTopics.find((t) => t.kind === 'general');
  const selectedTopic = categoryTopics.find((t) => t.id === category) ?? null;
  const current: Category = category === 'shop' || selectedTopic ? category : 'all';

  const { open, doneToday } = todayTodos(visibleTodos);
  const later = laterTodos(visibleTodos);
  const undated = sortOpen(visibleTodos.filter((t) => !t.doneAt && !t.dueAt && t.topicId === general?.id));
  // 「내 할 일」은 이름을 붙이지 않는다 — 앱이 채운 할 일과 장보기에만 주제 이름
  const nameOf = (topicId: string) => (topicId === general?.id ? null : (topics.find((t) => t.id === topicId)?.title ?? null));
  const empty = open.length === 0 && dueGroups.length === 0 && doneToday.length === 0;
  const suggestion = repeatSuggestion(visibleTodos, dismissed);
  const lists = topics.filter((t) => t.kind === 'custom' && !t.hidden).sort((a, b) => a.sort - b.sort);
  // 예정 — 기한이 내일부터인 할 일과 곧 시작하는 접종 · 검진을 날짜 순으로
  const upcoming = [
    ...later.map((t) => ({ at: t.dueAt ?? '', kind: 'todo' as const, todo: t })),
    ...soonGroups.map((g) => ({ at: monthStart(baby.birthDate, g.month).toISOString(), kind: 'checkup' as const, group: g })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // 장보기 한 줄 요약 — 살 것(살 곳별 수)과 배송 중
  const { toBuy, shipping } = shopLists(shop, todos);
  const shopCount = toBuy.length + shipping.length;
  const shopSummary = [
    ...toBuyGroups(toBuy, shopPlaces(shop, todos)).map((g) => `${g.place ?? '기타'} ${g.items.length}`),
    ...(shipping.length > 0 ? [`배송 중 ${shipping.length}`] : []),
  ].join(' · ');

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
            <ThemedText type="display" style={styles.pad}>
              할 일
            </ThemedText>

            {/* 카테고리 (SPEC-TOPIC-02) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={styles.chipRow}
              accessibilityRole="tablist">
              <Chip label="전체" selected={current === 'all'} onPress={() => pick('all')} />
              <Chip label={shopCount > 0 ? `장보기 ${shopCount}` : '장보기'} selected={current === 'shop'} onPress={() => pick('shop')} />
              {categoryTopics.map((t) => (
                <Chip key={t.id} label={t.title} selected={current === t.id} onPress={() => pick(t.id)} />
              ))}
            </ScrollView>

            <View style={[styles.body, styles.pad]}>
              {current === 'shop' ? (
                <ShopContent shop={shop} />
              ) : selectedTopic ? (
                <TopicContent key={selectedTopic.id} topic={selectedTopic} />
              ) : (
                <>
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

                  {/* 장보기 한 줄 (SPEC-SHOP-01) — 날짜 없는 살 것이 목록을 채우지 않게 */}
                  {shopCount > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        tap();
                        pick('shop');
                      }}
                      style={({ pressed }) => [styles.shop, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
                      <View style={[styles.shopIcon, { backgroundColor: c.background }]}>
                        <Ionicons name="bag-handle-outline" size={20} color={c.text} />
                      </View>
                      <View style={styles.flex}>
                        <ThemedText type="body" style={{ fontWeight: 700 }}>
                          장보기 {shopCount}개
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
                          {shopSummary}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
                    </Pressable>
                  )}

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
                      icon="star-outline"
                      title="추천 할 일"
                      detail="지금 시기에 맞는 할 일"
                      onPress={() => router.push('/todo-recommend')}
                    />
                  </Card>
                </>
              )}
            </View>
          </ScrollView>

          {current === 'shop' ? (
            <ShopInput shop={shop} />
          ) : (
            <TodoInput
              placeholder={selectedTopic ? '할 일 추가 (예: 금요일 오전 10시)' : '할 일 추가 (예: 내일 오전 10시 분유 주문)'}
              onAdd={(p) => {
                if (selectedTopic) {
                  void add({
                    title: p.title,
                    dueAt: p.dueAt ? p.dueAt.toISOString() : null,
                    hasTime: p.hasTime,
                    repeat: p.repeat,
                    topicId: selectedTopic.id,
                  });
                  return;
                }
                // 「전체」는 「오늘」을 보는 곳 — 날짜를 안 적으면 오늘 할 일로
                const today = new Date();
                const dueAt = p.dueAt ?? new Date(today.getFullYear(), today.getMonth(), today.getDate());
                void add({ title: p.title, dueAt: dueAt.toISOString(), hasTime: p.hasTime, repeat: p.repeat });
              }}
            />
          )}
          {/* 배너는 바닥에 고정 — 넘겨도 가려지지 않는다. 적는 동안(키보드)은 적는 칸 바로 밑이라 잘못 눌리지 않게 숨긴다 */}
          {!typing && <AdBanner anchored />}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  pad: { paddingHorizontal: Gutter },
  chipRow: { flexGrow: 0 },
  chips: { gap: 6, paddingHorizontal: Gutter },
  body: { gap: Spacing.four, paddingTop: Spacing.one },
  section: { gap: 10 },
  rows: { paddingVertical: 2 },
  empty: { paddingVertical: Spacing.three },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.lg },
  shopIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
