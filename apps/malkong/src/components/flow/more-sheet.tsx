/**
 * 지금 노드의 「…」 (SPEC-MAIN-08, task today/012) — 하루에 여러 번 생기지 않는 기록(체온 · 몸무게 · 키)과 루틴 관리 · 기록 알림.
 */

import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KIND_UI } from '@/components/log/kinds';
import { ListRow, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { EventKind } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

export type MoreAction = { kind: EventKind } | { go: 'routines' | 'notifications' };

export type MoreRow = { title: string; icon: IconName; action: MoreAction; detail?: string };

const ROWS: MoreRow[] = [
  { title: '체온 기록', icon: KIND_UI.temp.icon, action: { kind: 'temp' } },
  { title: '몸무게 기록', icon: KIND_UI.weight.icon, action: { kind: 'weight' } },
  { title: '키 기록', icon: KIND_UI.height.icon, action: { kind: 'height' } },
  { title: '루틴 관리', icon: 'repeat-outline', action: { go: 'routines' }, detail: '목욕처럼 날마다 챙기는 일' },
  { title: '기록 알림', icon: 'notifications-outline', action: { go: 'notifications' } },
];

/** `rows` 를 주면 그 줄만(1년 보기의 「키, 몸무게 기록」) */
export function MoreSheet({
  open,
  rows = ROWS,
  onClose,
  onPick,
}: {
  open: boolean;
  rows?: MoreRow[];
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
