import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { isLifeGroup, type GapGroup, type L1Item } from '@/data/timeline';

/**
 * 「챙길 것」 한 줄의 완료 알리기 (SPEC-HOME-02 완료 알림).
 *
 * 묶인 줄이면 항목이 모두 골라진 채로 열리고, 하지 않은 것만 끄면 된다. 날짜는 묻지 않는다 —
 * 한 번 누르는 것 이상의 입력을 요구하지 않는다(constitution 3·5).
 *
 * 줄마다 처음부터 다시 고르게 하려면 부르는 쪽에서 `key` 를 그 줄로 준다.
 */
export function MarkDoneSheet({
  group,
  onClose,
  onConfirm,
}: {
  group: GapGroup | null;
  onClose: () => void;
  onConfirm: (items: L1Item[]) => void;
}) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  // 처음에는 모두 골라져 있다 — 하지 않은 것만 끈다
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const items = group?.items ?? [];
  // 생활 항목은 해낸 일이 아니라 알아 둔 것이라 「확인」이라 부른다
  const life = group ? isLifeGroup(group) : false;
  const verb = life ? '확인' : '완료';
  const chosen = items.filter((i) => !excluded.has(i.id));

  return (
    <Modal visible={group !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: Spacing.four + insets.bottom },
          ]}>
          <ThemedText type="title">{life ? '확인했나요?' : '완료했나요?'}</ThemedText>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            {life
              ? '읽고 챙기기로 한 것만 남기고 골라 주세요'
              : `${items.length > 1 ? '한 것만 남기고 골라 주세요. ' : ''}날짜는 따로 적지 않아도 돼요`}
          </ThemedText>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {items.map((item) => {
              const on = !excluded.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.itemRow, { backgroundColor: colors.surface }]}
                  onPress={() => toggle(item.id)}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? colors.accent : colors.textSecondary}
                  />
                  <View style={styles.itemText}>
                    <ThemedText>{item.title}</ThemedText>
                    <ThemedText type="small" style={{ color: colors.textSecondary }}>
                      {item.body}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: chosen.length > 0 ? colors.accent : colors.surfaceStrong },
            ]}
            disabled={chosen.length === 0}
            onPress={() => onConfirm(chosen)}>
            <ThemedText
              style={[
                styles.buttonText,
                { color: chosen.length > 0 ? '#ffffff' : colors.textSecondary },
              ]}>
              {chosen.length > 1 ? `${chosen.length}건 ${verb}했어요` : `${verb}했어요`}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              취소
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '85%',
  },
  list: { marginTop: Spacing.two },
  listContent: { gap: Spacing.two },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  itemText: { flex: 1, gap: Spacing.half },
  button: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600', fontSize: 16 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
