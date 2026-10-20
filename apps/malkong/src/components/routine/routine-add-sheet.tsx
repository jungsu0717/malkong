/**
 * 루틴 추가 (SPEC-MAIN-03, task today/004) — 지금 시기의 추천이 버튼으로 다 보이고, 누르면 추가 · 다시 누르면 뺀다.
 * 빼면 「목욕을 뺐어요 · 되돌리기」가 잠깐 뜬다. 아래 「직접 만들기」(새 화면)와 「시기별 추천 전체 보기」.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, tap, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { titleKey, type Routine, type RoutineTemplate } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 4;
const GAP = 8;
/** 「되돌리기」가 떠 있는 시간 */
const UNDO_MS = 4000;

export function RoutineAddSheet({
  open,
  caption,
  moreDetail,
  templates,
  routines,
  onAdd,
  onRemove,
  onUndo,
  onCustom,
  onMore,
  onClose,
}: {
  open: boolean;
  /** 「생후 0~2개월 추천 · 누르면 추가, 다시 누르면 빼요」 */
  caption: string;
  /** 「시기별 추천 전체 보기」 아래 한 줄 */
  moreDetail: string;
  templates: RoutineTemplate[];
  /** 지금 있는 루틴 — 이름이 같으면 추가된 것으로 본다 */
  routines: Routine[];
  onAdd: (t: RoutineTemplate) => void;
  onRemove: (routine: Routine) => void;
  onUndo: (routine: Routine) => void;
  onCustom: () => void;
  onMore: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [gridWidth, setGridWidth] = useState(0);
  const [removed, setRemoved] = useState<Routine | null>(null);
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  const byKey = new Map(routines.map((r) => [titleKey(r.title), r]));
  const width = gridWidth ? Math.floor((gridWidth - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <ThemedText type="title">루틴 추가</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {caption}
              </ThemedText>
            </View>

            <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
              {width > 0 &&
                templates.map((t) => {
                  const routine = byKey.get(titleKey(t.title));
                  const on = !!routine;
                  return (
                    <Pressable
                      key={t.title}
                      accessibilityRole="button"
                      accessibilityLabel={on ? `${t.title}, 추가됨. 누르면 빼요` : `${t.title} 추가`}
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        if (routine) {
                          tap();
                          onRemove(routine);
                          setRemoved(routine);
                        } else {
                          tap('success');
                          onAdd(t);
                          setRemoved(null);
                        }
                      }}
                      style={({ pressed }) => [styles.template, { width, opacity: pressed ? 0.6 : 1 }]}>
                      <View>
                        <View style={[styles.circle, { backgroundColor: on ? c.ink : c.surface }]}>
                          <RoutineIcon title={t.title} kind={t.kind} size={24} color={on ? c.onInk : c.text} />
                        </View>
                        <View style={[styles.badge, { backgroundColor: on ? c.accent : c.ink, borderColor: c.background }]}>
                          <Ionicons name={on ? 'checkmark' : 'add'} size={12} color={c.onInk} />
                        </View>
                      </View>
                      <ThemedText type="caption" numberOfLines={2} style={[styles.name, { fontWeight: on ? 700 : 400 }]}>
                        {t.title}
                      </ThemedText>
                    </Pressable>
                  );
                })}
            </View>

            <View style={[styles.links, { borderColor: c.border }]}>
              <LinkRow icon="add" title="직접 만들기" detail="이름 · 반복 · 알림 시각을 정해요" onPress={onCustom} />
              <View style={[styles.line, { backgroundColor: c.divider }]} />
              <LinkRow icon="calendar-clear-outline" title="시기별 추천 전체 보기" detail={moreDetail} onPress={onMore} />
            </View>
          </ScrollView>

          {removed && (
            <View accessibilityRole="alert" style={[styles.toast, { backgroundColor: c.ink }]}>
              <ThemedText type="small" style={{ color: c.onInk }}>
                {removed.title}
                {hasBatchim(removed.title) ? '을' : '를'} 뺐어요
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  onUndo(removed);
                  setRemoved(null);
                }}
                style={({ pressed }) => [styles.undo, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={[StyleSheet.absoluteFill, styles.undoFill, { backgroundColor: c.onInk }]} />
                <ThemedText type="label" style={{ color: c.onInk, fontWeight: 700 }}>
                  되돌리기
                </ThemedText>
              </Pressable>
            </View>
          )}
          <Button size="lg" label="완료" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function LinkRow({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <View style={[styles.linkIcon, { backgroundColor: c.surface }]}>
        <Ionicons name={icon} size={18} color={c.text} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="body" style={{ fontWeight: 700 }}>
          {title}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

/** 마지막 글자에 받침이 있나 — 「목욕을」 「밤잠 준비를」 */
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
    gap: Spacing.three,
    maxHeight: '92%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  content: { gap: Spacing.three, paddingBottom: Spacing.one },
  head: { gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: GAP },
  template: { alignItems: 'center', gap: 6 },
  circle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { textAlign: 'center' },
  links: { borderWidth: 1, borderRadius: Radius.lg, marginTop: Spacing.one },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  linkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  line: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 16 },
  flex: { flex: 1 },
  toast: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 44,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 22,
  },
  undo: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', overflow: 'hidden' },
  undoFill: { opacity: 0.16 },
});
