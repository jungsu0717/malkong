/**
 * 장보기 탭 (SPEC-SHOP-01~03, task topic/004, decisions/026).
 *
 * 살 것 → 「주문했어요」(어디서 · 언제 도착) → 배송 중 → 받으면 체크(완료). 매장에서 바로 샀으면 살 것에서 바로 체크한다.
 * 지난번 산 것은 「다시 담기」에서 한 번 눌러 살 것으로. 바닥 칸에 적으면 살 것에 들어간다.
 * 장보기 줄은 할 일과 같은 `todo` 줄이고 장보기 주제(kind shopping)에 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OrderSheet } from '@/components/todo/order-sheet';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { Card, Chip, Folded, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { dueLabel } from '@/data/due-parse';
import { buyAgain, recentStores, shopLists, type Todo } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useTheme } from '@/hooks/use-theme';

/** 배송 중 줄의 작은 글씨 — 「쿠팡 · 내일 도착 예정」 */
function shippingDetail(t: Todo): string {
  const when = t.arriveAt ? `${dueLabel(new Date(t.arriveAt), false)} 도착 예정` : '배송 중';
  return [t.store, when].filter(Boolean).join(' · ');
}

export default function ShopScreen() {
  const c = useTheme();
  const { topics, todos, loading, add, update, toggleDone, remove } = useTodos();
  const typing = useKeyboardVisible();
  const [ordering, setOrdering] = useState<Todo | null>(null);
  const [editing, setEditing] = useState<Todo | null>(null);

  const shop = topics.find((t) => t.kind === 'shopping');
  if (loading || !shop) return <ScreenLoading />;
  const { toBuy, shipping, done } = shopLists(shop, todos);
  const again = buyAgain(shop, todos);
  const stores = recentStores(todos);

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
            <ThemedText type="display">장보기</ThemedText>

            {/* 살 것 (SPEC-SHOP-01) */}
            <View style={styles.section}>
              <SectionHeader title="살 것" aside={toBuy.length > 0 ? `${toBuy.length}개` : undefined} />
              <Card style={styles.rows}>
                {toBuy.length === 0 ? (
                  <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                    살 것을 아래에 적어 두세요
                  </ThemedText>
                ) : (
                  toBuy.map((t, i) => (
                    <ShopRow
                      key={t.id}
                      todo={t}
                      divider={i > 0}
                      onCheck={() => void toggleDone(t.id)}
                      onLong={() => setEditing(t)}
                      action={{ label: '주문했어요', onPress: () => setOrdering(t) }}
                    />
                  ))
                )}
              </Card>
            </View>

            {/* 배송 중 (SPEC-SHOP-02) — 받으면 체크 */}
            {shipping.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="배송 중" aside={`${shipping.length}개`} />
                <Card style={styles.rows}>
                  {shipping.map((t, i) => (
                    <ShopRow
                      key={t.id}
                      todo={t}
                      detail={shippingDetail(t)}
                      divider={i > 0}
                      onCheck={() => void toggleDone(t.id)}
                      onLong={() => setOrdering(t)}
                      more={() => setOrdering(t)}
                    />
                  ))}
                </Card>
              </View>
            )}

            {/* 다시 담기 (SPEC-SHOP-03) — 지난번 산 것 중 지금 목록에 없는 것 */}
            {again.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="다시 담기" />
                <View style={styles.chips}>
                  {again.map((title) => (
                    <Chip key={title} label={title} icon="add" onPress={() => void add({ title, topicId: shop.id })} />
                  ))}
                </View>
              </View>
            )}

            {/* 완료 — 지우지 않는다(헌장 2). 누르면 되돌림 */}
            {done.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="완료" aside={`${done.length}개`} />
                <Card style={styles.rows}>
                  <Folded limit={3}>
                    {done.map((t, i) => (
                      <TodoItem
                        key={t.id}
                        todo={t}
                        topicName={t.store}
                        divider={i > 0}
                        onToggle={() => void toggleDone(t.id)}
                        onEdit={() => setEditing(t)}
                      />
                    ))}
                  </Folded>
                </Card>
              </View>
            )}

            {!typing && <AdBanner />}
          </ScrollView>

          <TodoInput
            placeholder="살 것 추가 (예: 기저귀 4단계)"
            onAdd={(p) =>
              void add({ title: p.title, dueAt: p.dueAt ? p.dueAt.toISOString() : null, hasTime: p.hasTime, topicId: shop.id })
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <OrderSheet
        key={ordering?.id ?? 'none'}
        todo={ordering}
        stores={stores}
        onClose={() => setOrdering(null)}
        onSave={(patch) => {
          if (ordering) void update(ordering.id, patch);
          setOrdering(null);
        }}
        onCancelOrder={() => {
          if (ordering) void update(ordering.id, { orderedAt: null, arriveAt: null });
          setOrdering(null);
        }}
        onDelete={() => {
          if (ordering) void remove(ordering.id);
          setOrdering(null);
        }}
      />
      <TodoSheet
        key={editing?.id ?? 'none-edit'}
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

/** 장보기 한 줄 — 동그라미를 누르면 완료, 오른쪽에 「주문했어요」나 「…」 */
function ShopRow({
  todo,
  detail,
  divider,
  onCheck,
  onLong,
  action,
  more,
}: {
  todo: Todo;
  detail?: string;
  divider: boolean;
  onCheck: () => void;
  onLong: () => void;
  action?: { label: string; onPress: () => void };
  more?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={todo.title}
        onPress={() => {
          tap('success');
          onCheck();
        }}
        onLongPress={onLong}
        delayLongPress={350}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}>
        <Ionicons name="ellipse-outline" size={24} color={c.text} />
        <View style={styles.text}>
          <ThemedText type="body">{todo.title}</ThemedText>
          {detail ? (
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {detail}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${todo.title} ${action.label}`}
          hitSlop={8}
          onPress={() => {
            tap();
            action.onPress();
          }}
          style={[styles.action, { backgroundColor: c.surface }]}>
          <ThemedText type="caption" style={{ fontWeight: 600 }}>
            {action.label}
          </ThemedText>
        </Pressable>
      )}
      {more && (
        <Pressable accessibilityRole="button" accessibilityLabel={`${todo.title} 주문 정보 편집`} hitSlop={8} onPress={more} style={styles.more}>
          <Ionicons name="ellipsis-horizontal" size={18} color={c.textTertiary} />
        </Pressable>
      )}
    </View>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  action: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  more: { paddingHorizontal: 6, paddingVertical: 10 },
});
