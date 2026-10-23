/**
 * 할 일 탭의 장보기 카테고리 — 살 것 (SPEC-SHOP-01~05, task topic/004 · 007 · list/001 · today/003 · todo/001, decisions/026~029 · 031).
 *
 * 날짜가 아니라 살 것 기준이라, 못 산 것은 체크하지 않으면 그대로 남는다. 재고 확인 루틴이 있으면 맨 위에 한 줄 — 누르면 재고 확인 시트(SPEC-MAIN-06).
 * 살 것을 살 곳별로 묶는다 — 마트 · 다이소 같은 매장(사용자가 적은 곳) → 온라인 → 살 곳을 안 정한 것.
 * 온라인 묶음에만 「주문 완료」(언제 도착) → 배송 중 → 받으면 체크. 지난번 산 것과 매장마다 지난번 목록은 「다시 담기」에서 한 번에.
 * 바닥 칸(ShopInput)에서 살 곳 칩을 고르고 적는다. 장보기 줄은 할 일과 같은 `todo` 줄이고 장보기 주제(kind shopping)에 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { StockSheet } from '@/components/routine/stock-sheet';
import { ThemedText } from '@/components/themed-text';
import { OrderSheet } from '@/components/todo/order-sheet';
import { ShopItemSheet } from '@/components/todo/shop-item-sheet';
import { TodoInput } from '@/components/todo/todo-input';
import { TodoItem } from '@/components/todo/todo-item';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { Card, Chip, Folded, SectionHeader, tap } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { dueLabel } from '@/data/due-parse';
import { nextDayLabel, todayState, type Routine, type RoutineLog } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { ONLINE, buyAgain, lastTrips, recentStores, shopLists, shopPlaces, toBuyGroups, type Todo, type Topic } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

/** 「다이소에서 수납함」 → 살 곳 「다이소」 · 「수납함」. 앞의 한 낱말만 본다 */
function splitPlace(text: string): { place: string; title: string } | null {
  const m = /^(\S{1,12})에서\s+(.+)$/.exec(text.trim());
  return m ? { place: m[1], title: m[2].trim() } : null;
}

/**
 * 재고 확인 한 줄의 작은 글씨 — 확인할 날이면 「오늘 확인해 보세요」, 아니면 다음 확인 날과 지난번 결과
 * (지난번 확인한 날 재고 확인에서 들어온 살 것 수)
 */
function stockDetail(r: Routine, logs: RoutineLog[], stockTodos: Todo[], now: Date): string {
  const s = todayState(r, logs, now);
  if (s.skipped && !s.firstAt) return '오늘은 건너뛰었어요';
  if (s.due && !s.firstAt) return '오늘 확인해 보세요';
  const last = logs
    .filter((l) => l.routineId === r.id && l.step == null)
    .map((l) => new Date(l.at))
    .sort((a, b) => a.getTime() - b.getTime())
    .pop();
  const added = last ? stockTodos.filter((t) => new Date(t.createdAt).toDateString() === last.toDateString()).length : 0;
  if (s.firstAt) return added > 0 ? `오늘 부족한 ${added}개를 추가했어요` : '오늘 확인했어요 · 모두 충분해요';
  // 아직 한 번도 확인하지 않았으면 지난번 결과는 쓰지 않는다
  if (!last) return `다음 확인 ${nextDayLabel(s.nextInDays, now)}`;
  return `다음 확인 ${nextDayLabel(s.nextInDays, now)} · ${added > 0 ? `지난번에 부족한 ${added}개를 추가했어요` : '지난번엔 모두 충분했어요'}`;
}

/** 배송 중 줄의 작은 글씨 — 「쿠팡 · 내일 도착 예정」(주문한 곳을 안 적었으면 「온라인」) */
function shippingDetail(t: Todo): string {
  const when = t.arriveAt ? `${dueLabel(new Date(t.arriveAt), false)} 도착 예정` : '배송 중';
  return [t.store, when].filter(Boolean).join(' · ');
}

export function ShopContent({ shop }: { shop: Topic }) {
  const c = useTheme();
  const { topics, todos, add, update, toggleDone, remove } = useTodos();
  const { routines, logs, updateRoutine, completeStock, skipToday } = useRoutines();
  const [stockOpen, setStockOpen] = useState(false);
  const [ordering, setOrdering] = useState<Todo | null>(null);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [doneEditing, setDoneEditing] = useState<Todo | null>(null);

  const { toBuy, shipping, done } = shopLists(shop, todos);
  const places = shopPlaces(shop, todos);
  const groups = toBuyGroups(toBuy, places);
  const again = buyAgain(shop, todos);
  const trips = lastTrips(shop, todos);
  const stores = recentStores(todos);
  const addItem = (title: string, store: string | null) => add({ title, topicId: shop.id, store });
  const stock = routines.find((r) => r.kind === 'stock');
  const now = new Date();

  return (
    <>
      {/* 재고 확인 (SPEC-SHOP-01 · SPEC-MAIN-06) */}
      {stock && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            setStockOpen(true);
          }}
          style={({ pressed }) => [styles.stock, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
          <View style={[styles.stockIcon, { backgroundColor: c.background }]}>
            <RoutineIcon title={stock.title} kind={stock.kind} size={20} color={c.text} />
          </View>
          <View style={styles.text}>
            <ThemedText type="body" style={{ fontWeight: 600 }}>
              {stock.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {stockDetail(
                stock,
                logs,
                todos.filter((t) => t.topicId === shop.id && t.source === 'stock'),
                now,
              )}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        </Pressable>
      )}

      {/* 살 것 — 살 곳별로 (SPEC-SHOP-01) */}
      {groups.length === 0 ? (
        <Card>
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            살 것을 아래에 입력하세요. 살 곳을 고르면 장소별로 묶여요
          </ThemedText>
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.place ?? 'none'} style={styles.section}>
            <SectionHeader title={g.place ?? '기타'} aside={`${g.items.length}개`} />
            <Card style={styles.rows}>
              {g.items.map((t, i) => (
                <ShopRow
                  key={t.id}
                  todo={t}
                  // 온라인 묶음에서는 쇼핑몰 이름(「쿠팡」)을 작게
                  detail={t.source === 'stock' ? '재고 확인에서 추가' : g.place === ONLINE && t.store && t.store !== ONLINE ? t.store : undefined}
                  divider={i > 0}
                  onCheck={() => void toggleDone(t.id)}
                  onLong={() => setEditing(t)}
                  // 「주문 완료」는 온라인 묶음에만 — 매장에서 산 것은 동그라미로 바로 완료
                  action={g.place === ONLINE ? { label: '주문 완료', onPress: () => setOrdering(t) } : undefined}
                  more={g.place === ONLINE ? undefined : () => setEditing(t)}
                />
              ))}
            </Card>
          </View>
        ))
      )}

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

      {/* 다시 담기 (SPEC-SHOP-03) — 매장마다 지난번 목록, 그리고 지난번 산 것 하나씩 */}
      {(trips.length > 0 || again.length > 0) && (
        <View style={styles.section}>
          <SectionHeader title="다시 담기" />
          <View style={styles.chips}>
            {trips.map((trip) => (
              <Chip
                key={`trip-${trip.place}`}
                label={`${trip.place} 지난번 목록 ${trip.titles.length}개`}
                icon="repeat"
                onPress={() =>
                  void (async () => {
                    for (const title of trip.titles) await addItem(title, trip.place);
                  })()
                }
              />
            ))}
            {again.map((item) => (
              <Chip key={item.title} label={item.title} icon="add" onPress={() => void addItem(item.title, item.place)} />
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
                  onEdit={() => setDoneEditing(t)}
                />
              ))}
            </Folded>
          </Card>
        </View>
      )}
      <StockSheet
        key={stockOpen ? 'stock-open' : 'stock-closed'}
        routine={stockOpen && stock ? stock : null}
        onDone={(short) => {
          setStockOpen(false);
          if (stock) void completeStock(stock.id, short);
        }}
        onAddItem={(name) => stock && void updateRoutine(stock.id, { items: [...(stock.items ?? []), name] })}
        onSkip={() => {
          setStockOpen(false);
          if (stock) void skipToday(stock.id);
        }}
        onClose={() => setStockOpen(false)}
      />
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
      <ShopItemSheet
        key={editing?.id ?? 'none-edit'}
        todo={editing}
        places={places}
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
      <TodoSheet
        key={doneEditing?.id ?? 'none-done'}
        todo={doneEditing}
        topics={topics.filter((t) => !t.hidden)}
        onClose={() => setDoneEditing(null)}
        onSave={(patch) => {
          if (doneEditing) void update(doneEditing.id, patch);
          setDoneEditing(null);
        }}
        onDelete={() => {
          if (doneEditing) void remove(doneEditing.id);
          setDoneEditing(null);
        }}
      />
    </>
  );
}

/** 바닥 입력 칸 — 살 곳 칩을 고르고 적는다(고른 칩은 다음에도 남는다). 「다이소에서 수납함」처럼 적으면 살 곳을 읽는다 */
export function ShopInput({ shop }: { shop: Topic }) {
  const { todos, add } = useTodos();
  const [place, setPlace] = useState<string | null>(null);
  const places = shopPlaces(shop, todos);
  return (
    <TodoInput
      placeholder={place ? `${place}에서 살 것 추가` : '살 것 추가 (예: 다이소에서 수납함)'}
      options={places.map((p) => ({ id: p, label: p }))}
      selected={place}
      onSelect={setPlace}
      noneLabel="선택 안 함"
      onAdd={(p) => {
        const where = splitPlace(p.title);
        void add({
          title: where?.title ?? p.title,
          dueAt: p.dueAt ? p.dueAt.toISOString() : null,
          hasTime: p.hasTime,
          topicId: shop.id,
          store: where?.place ?? place,
        });
      }}
    />
  );
}

/** 장보기 한 줄 — 동그라미를 누르면 완료, 오른쪽에 「주문 완료」나 「…」 */
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
  section: { gap: 10 },
  rows: { paddingVertical: 2 },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.lg },
  stockIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  action: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  more: { paddingHorizontal: 6, paddingVertical: 10 },
});
