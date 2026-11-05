/**
 * 고르기 시트 (SPEC-MAIN-11) — 1년 보기의 「키, 몸무게 기록」에서 무엇을 적을지 고른다. 하루 흐름의 「…」은 2026-11-05 에 뺐다(decisions/038).
 */

import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { EventKind } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

export type MoreAction = { kind: EventKind } | { go: 'routines' | 'notifications' };

export type MoreRow = { title: string; icon: IconName; action: MoreAction; detail?: string };

export function MoreSheet({
  open,
  rows,
  onClose,
  onPick,
}: {
  open: boolean;
  rows: MoreRow[];
  onClose: () => void;
  onPick: (a: MoreAction) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.three + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          {rows.map((r, i) => (
            <ListRow key={r.title} divider={i > 0} icon={r.icon} title={r.title} detail={r.detail} onPress={() => onPick(r.action)} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: 4 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 6 },
});
