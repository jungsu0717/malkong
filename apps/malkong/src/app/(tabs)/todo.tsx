/**
 * 할 일 탭 (SPEC-TOPIC-01 · 02 · 03 · 06 · 07 · 11 · SPEC-SHOP-01~05, task topic/001~004 · 008 · 009, decisions/024~026 · 031).
 *
 * 위에 세 칸 — 「내 할 일 · 장보기 · 아기 일정」, 칸마다 오늘 챙길 수.
 * - 내 할 일: 내가 적은 것만 오늘 · 예정 · 날짜 없음. 아래 「준비 목록 · 추천 할 일」. 적는 칸 위 날짜 칩(오늘 · 내일 · 날짜 고르기 · 날짜 없음)
 * - 장보기: 예전 장보기 탭 그대로(ShopContent · ShopInput)
 * - 아기 일정: 앱이 채우는 접종 · 검진 · 기념일 · 사이즈를 날짜순으로(BabySchedule). 적는 칸은 없다
 * 다른 화면에서 `/todo?cat=shop` · `?cat=baby` 로 칸을 골라 열 수 있다. `at`(누른 시각)을 함께 주면 다른 칸을 골라 둔 뒤 같은 칸으로 다시 와도 그 칸이 열린다.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BabySchedule, useBabyScheduleCount } from '@/components/todo/baby-schedule';
import { RepeatSuggest } from '@/components/todo/repeat-suggest';
import { ShopContent, ShopInput } from '@/components/todo/shop-content';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { Card, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { laterTodos, repeatSuggestion, shopLists, sortOpen, todayTodos, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useTheme } from '@/hooks/use-theme';

type Tab = 'mine' | 'shop' | 'baby';
const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: '내 할 일' },
  { id: 'shop', label: '장보기' },
  { id: 'baby', label: '아기 일정' },
];

export default function TodoScreen() {
  const c = useTheme();
  const params = useLocalSearchParams<{ cat?: string; at?: string }>();
  const { topics, todos, loading, add, update, toggleDone, remove, dismissed } = useTodos();
  const typing = useKeyboardVisible();
  const babyCount = useBabyScheduleCount();
  const [editing, setEditing] = useState<Todo | null>(null);
  // 고른 칸 — 다른 화면에서 `?cat=` 으로 새로 열면 그것을 따른다(고를 때 그때의 `cat` · `at` 을 함께 적어 둔다)
  const [chosen, setChosen] = useState<{ tab: Tab; from?: string }>({ tab: 'mine' });
  const asked = params.cat ? `${params.cat}:${params.at ?? ''}` : undefined;
  const fromParam: Tab | null = params.cat === 'shop' ? 'shop' : params.cat === 'baby' ? 'baby' : params.cat ? 'mine' : null;
  const tab: Tab = fromParam && chosen.from !== asked ? fromParam : chosen.tab;
  const pick = (next: Tab) => {
    if (next !== tab) tap();
    setChosen({ tab: next, from: asked });
  };

  const general = topics.find((t) => t.kind === 'general');
  const shop = topics.find((t) => t.kind === 'shopping');
  const mine = useMemo(() => todos.filter((t) => t.topicId === general?.id), [todos, general]);

  if (loading || !shop || !general) return <ScreenLoading />;
  const { open, doneToday } = todayTodos(mine);
  const later = laterTodos(mine);
  const undated = sortOpen(mine.filter((t) => !t.doneAt && !t.dueAt));
  const suggestion = repeatSuggestion(mine, dismissed);
  const lists = topics.filter((t) => t.kind === 'custom' && !t.hidden).sort((a, b) => a.sort - b.sort);
  const { toBuy, shipping } = shopLists(shop, todos);
  const counts: Record<Tab, number> = { mine: open.length, shop: toBuy.length + shipping.length, baby: babyCount };

  const row = (t: Todo, i: number) => (
    <TodoItem key={t.id} todo={t} divider={i > 0} onToggle={() => void toggleDone(t.id)} onEdit={() => setEditing(t)} />
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

            {/* 세 칸 (SPEC-TOPIC-02) */}
            <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceStrong }]}>
              {TABS.map((t) => {
                const on = t.id === tab;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => pick(t.id)}
                    style={[styles.segmentItem, on && [styles.segmentOn, { backgroundColor: c.background }]]}>
                    <ThemedText type="body" style={{ color: on ? c.text : c.textSecondary, fontWeight: on ? 700 : 400 }}>
                      {t.label}
                      {counts[t.id] > 0 ? (
                        <ThemedText type="body" style={{ color: on ? c.accent : c.textTertiary, fontWeight: 700 }}>
                          {` ${counts[t.id]}`}
                        </ThemedText>
                      ) : null}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {tab === 'shop' ? (
              <ShopContent shop={shop} />
            ) : tab === 'baby' ? (
              <BabySchedule />
            ) : (
              <>
                {/* 오늘 (SPEC-TOPIC-02) — 기한이 오늘이거나 지난 것, 오늘 끝낸 것 */}
                <View style={styles.section}>
                  <SectionHeader title="오늘" />
                  <Card style={styles.rows}>
                    {open.length + doneToday.length === 0 ? (
                      <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                        오늘 할 일이 없어요
                      </ThemedText>
                    ) : (
                      [...open, ...doneToday].map(row)
                    )}
                  </Card>
                </View>

                {later.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader title="예정" />
                    <Card style={styles.rows}>{later.map(row)}</Card>
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

                <Card tone="filled" style={styles.rows}>
                  <ListRow
                    icon="briefcase-outline"
                    title="준비 목록"
                    detail={lists.length > 0 ? lists.map((l) => l.title).join(' · ') : '외출 가방 · 여행 짐처럼 다시 쓰는 목록'}
                    onPress={() => router.push('/lists')}
                  />
                  <ListRow divider icon="star-outline" title="추천 할 일" detail="지금 시기에 맞는 것" onPress={() => router.push('/todo-recommend')} />
                </Card>
              </>
            )}
          </ScrollView>

          {tab === 'shop' ? (
            <ShopInput shop={shop} />
          ) : tab === 'mine' ? (
            <TodoInput
              dateChips
              placeholder="할 일 추가 (예: 분유 샘플 신청)"
              onAdd={(p) =>
                void add({ title: p.title, dueAt: p.dueAt ? p.dueAt.toISOString() : null, hasTime: p.hasTime, repeat: p.repeat, topicId: general.id })
              }
            />
          ) : null}
          {/* 배너는 바닥에 고정 — 넘겨도 가려지지 않는다. 적는 동안(키보드)은 적는 칸 바로 밑이라 잘못 눌리지 않게 숨긴다 */}
          {!typing && <AdBanner anchored />}
        </KeyboardAvoidingView>
      </SafeAreaView>

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
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, marginBottom: Spacing.one },
  segmentItem: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { boxShadow: '0 1px 3px rgba(22, 22, 26, 0.1)' },
  section: { gap: 10 },
  rows: { paddingVertical: 2 },
  empty: { paddingVertical: Spacing.three },
});
