/**
 * 재고 확인 시트 (SPEC-MAIN-06, task today/003) — 확인할 물건마다 「충분」 · 「부족」을 고르고,
 * 「부족한 2개 장보기에 추가」(부족한 게 없으면 「모두 충분해요」)를 누르면 루틴이 완료된다. 「확인할 물건 추가」로 물건을 더한다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { everyLabel, type Routine } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

export function StockSheet({
  routine,
  onDone,
  onAddItem,
  onClose,
}: {
  /** 열 루틴 — 없으면 닫힘 */
  routine: Routine | null;
  /** 부족한 물건으로 끝낸다 */
  onDone: (short: string[]) => void;
  onAddItem: (name: string) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [short, setShort] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const items = routine?.items ?? [];
  const chosen = items.filter((i) => short.has(i));

  const pick = (name: string, isShort: boolean) => {
    tap();
    setShort((prev) => {
      const next = new Set(prev);
      if (isShort) next.add(name);
      else next.delete(name);
      return next;
    });
  };
  const submitNew = () => {
    const name = adding?.trim();
    if (name && !items.includes(name)) onAddItem(name);
    setAdding(null);
  };

  return (
    <Modal visible={routine !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        {routine && (
          <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
            <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: c.surface }]}>
                <RoutineIcon title={routine.title} kind={routine.kind} size={22} color={c.text} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="title">{routine.title}</ThemedText>
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  {everyLabel(routine.everyDays)} · 부족한 것은 장보기에 추가돼요
                </ThemedText>
              </View>
            </View>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {items.map((name) => {
                const isShort = short.has(name);
                return (
                  <View key={name} style={[styles.row, { borderBottomColor: c.divider }]}>
                    <ThemedText type="body" style={styles.flex}>
                      {name}
                    </ThemedText>
                    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={[styles.segment, { backgroundColor: c.surface }]}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: !isShort }}
                        onPress={() => pick(name, false)}
                        style={[styles.option, !isShort && { backgroundColor: c.background }]}>
                        <ThemedText type="label" style={{ fontWeight: !isShort ? 700 : 400, color: !isShort ? c.text : c.textSecondary }}>
                          충분
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isShort }}
                        onPress={() => pick(name, true)}
                        style={[styles.option, isShort && { backgroundColor: c.accent }]}>
                        <ThemedText type="label" style={{ fontWeight: isShort ? 700 : 400, color: isShort ? c.onInk : c.textSecondary }}>
                          부족
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {adding === null ? (
                <Pressable accessibilityRole="button" onPress={() => setAdding('')} style={styles.addItem}>
                  <Ionicons name="add" size={16} color={c.textSecondary} />
                  <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                    확인할 물건 추가
                  </ThemedText>
                </Pressable>
              ) : (
                <TextInput
                  autoFocus
                  style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
                  value={adding}
                  onChangeText={setAdding}
                  onSubmitEditing={submitNew}
                  onBlur={submitNew}
                  returnKeyType="done"
                  placeholder="물건 이름 (예: 젖병 세정제)"
                  placeholderTextColor={c.textTertiary}
                  maxLength={30}
                />
              )}
            </ScrollView>

            <Button
              size="lg"
              label={chosen.length > 0 ? `부족한 ${chosen.length}개 장보기에 추가` : '모두 충분해요'}
              onPress={() => {
                tap('success');
                onDone(chosen);
              }}
            />
          </View>
        )}
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
    gap: Spacing.three,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  segment: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12 },
  option: { height: 30, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14 },
  field: {
    marginTop: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
});
