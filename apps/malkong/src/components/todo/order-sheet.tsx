/**
 * 주문 정보 (SPEC-SHOP-02) — 온라인 묶음의 「주문했어요」를 누르면 주문한 곳(안 적어도 된다) · 언제 도착하는지 적는다.
 * 배송 중인 것은 고치거나 주문 취소 · 삭제. 주문한 곳은 사용자가 전에 적은 이름만 칩으로 보인다(앱이 쇼핑몰 이름을 미리 넣지 않는다).
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { dueLabel, parseDue } from '@/data/due-parse';
import { ONLINE, type Todo } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export type OrderPatch = Pick<Todo, 'store' | 'arriveAt' | 'orderedAt'>;

const dayAfter = (n: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
};
const QUICK: { label: string; days: number }[] = [
  { label: '오늘', days: 0 },
  { label: '내일', days: 1 },
  { label: '모레', days: 2 },
];

export function OrderSheet({
  todo,
  stores,
  onClose,
  onSave,
  onCancelOrder,
  onDelete,
}: {
  todo: Todo | null;
  stores: string[];
  onClose: () => void;
  onSave: (patch: OrderPatch) => void;
  /** 배송 중을 살 것으로 되돌린다 */
  onCancelOrder: () => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const ordered = !!todo?.orderedAt;
  // 살 곳 「온라인」은 주문한 곳이 아니므로 비워 두고 시작한다
  const [store, setStore] = useState(todo?.store && todo.store !== ONLINE ? todo.store : '');
  const [arrive, setArrive] = useState<Date | null>(todo?.arriveAt ? new Date(todo.arriveAt) : null);
  const [arriveText, setArriveText] = useState('');
  // 날짜 칸에 적은 말이 있으면 그것을 읽는다(「10/20」 「금요일」)
  const typed = arriveText.trim() ? parseDue(arriveText).dueAt : null;
  const shown = typed ? new Date(typed.getFullYear(), typed.getMonth(), typed.getDate()) : arrive;
  const unread = !!arriveText.trim() && !typed;

  return (
    <Modal visible={todo !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="title">{todo?.title}</ThemedText>

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              주문한 곳
            </ThemedText>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={store}
              onChangeText={setStore}
              placeholder="예: 자주 쓰는 쇼핑몰 이름 (안 적어도 돼요)"
              placeholderTextColor={c.textTertiary}
              maxLength={40}
            />
            {stores.length > 0 && (
              <View style={styles.chips}>
                {stores.map((s) => (
                  <Chip key={s} label={s} selected={store.trim() === s} onPress={() => setStore(s)} />
                ))}
              </View>
            )}

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              도착 예정
            </ThemedText>
            <View style={styles.chips}>
              {QUICK.map((q) => {
                const d = dayAfter(q.days);
                return (
                  <Chip
                    key={q.label}
                    label={q.label}
                    selected={!typed && !!arrive && arrive.getTime() === d.getTime()}
                    onPress={() => {
                      setArriveText('');
                      setArrive(d);
                    }}
                  />
                );
              })}
              <Chip
                label="모름"
                selected={!typed && !arrive}
                onPress={() => {
                  setArriveText('');
                  setArrive(null);
                }}
              />
            </View>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={arriveText}
              onChangeText={setArriveText}
              placeholder="다른 날: 10/20 · 금요일"
              placeholderTextColor={c.textTertiary}
              maxLength={20}
            />
            <ThemedText type="caption" style={{ color: unread ? c.accentText : c.textSecondary }}>
              {unread ? '날짜를 읽지 못했어요' : shown ? `${dueLabel(shown, false)} 도착 예정` : '도착 날짜를 모르면 비워 두세요'}
            </ThemedText>
          </ScrollView>

          <Button
            size="lg"
            label={ordered ? '저장' : '주문했어요'}
            disabled={unread}
            onPress={() =>
              onSave({
                store: store.trim() || ONLINE,
                arriveAt: shown ? shown.toISOString() : null,
                orderedAt: todo?.orderedAt ?? new Date().toISOString(),
              })
            }
          />
          {ordered && <Button variant="secondary" size="sm" label="주문 취소" onPress={onCancelOrder} />}
          <Button variant="danger" size="sm" label="삭제" onPress={onDelete} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
    gap: Spacing.two,
    maxHeight: '90%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  content: { gap: Spacing.two, paddingBottom: Spacing.two },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
