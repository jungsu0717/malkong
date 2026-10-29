/**
 * 접종 · 검진 병원 예약일 (SPEC-TOPIC-02, task topic/010) — 아기 일정에서 접종 · 검진 줄의 이름을 누르면 열린다.
 *
 * 맨 위에 묶음 이름과 이름표 · 공공 일정 시기, 그 아래 「병원 예약일」 — 지금 값과 「예약일 삭제」, 말로 적는 칸(「11/3 오전 10시」).
 * 예약은 「접종 · 검진」 주제의 할 일로 저장해서(appointment.ts) 시각을 적으면 그때 알림이 온다.
 * 동그라미(완료 알리기)는 줄에서 따로 누른다 — 이 시트는 날짜만 다룬다.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { dueLabel, parseDue } from '@/data/due-parse';
import { useTheme } from '@/hooks/use-theme';

export type ApptTarget = {
  /** 「B형간염 2차」 */
  title: string;
  /** 「접종」 「검진」 */
  tag: string;
  /** 공공 일정 시기 — 「생후 1개월 · 10월 20일 무렵부터」 */
  when: string;
  /** 지금 적어 둔 예약 — 없으면 null */
  current: { at: Date; hasTime: boolean } | null;
};

export function ApptSheet({
  target,
  onClose,
  onSave,
  onClear,
}: {
  target: ApptTarget | null;
  onClose: () => void;
  onSave: (due: { at: Date; hasTime: boolean }) => void;
  onClear: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const typed = text.trim() ? parseDue(text) : null;
  const due = typed?.dueAt ? { at: typed.dueAt, hasTime: typed.hasTime } : (target?.current ?? null);
  const unread = !!text.trim() && !typed?.dueAt;

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title" lineBreakStrategyIOS="hangul-word">
            {target?.title ?? ''}
          </ThemedText>
          <View style={styles.meta}>
            {target?.tag ? (
              <View style={[styles.tag, { backgroundColor: c.surface }]}>
                <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600, fontSize: 11 }}>
                  {target.tag}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              {target?.when ?? ''}
            </ThemedText>
          </View>

          <ThemedText type="label" style={[styles.label, { color: c.textSecondary }]}>
            병원 예약일
          </ThemedText>
          <View style={styles.dueRow}>
            <ThemedText type="body" style={{ flex: 1, color: due ? c.text : c.textTertiary }}>
              {due ? dueLabel(due.at, due.hasTime) + (due.hasTime ? ' · 알림' : '') : '없음'}
            </ThemedText>
            {target?.current && !text.trim() && <Button label="예약일 삭제" size="sm" variant="ghost" onPress={onClear} />}
          </View>
          <TextInput
            style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
            value={text}
            onChangeText={setText}
            placeholder="예: 11/3 오전 10시 · 다음 주 화요일"
            placeholderTextColor={c.textTertiary}
            maxLength={40}
          />
          {unread && (
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              날짜나 시각을 읽지 못했어요
            </ThemedText>
          )}

          <Button size="lg" style={styles.save} label="저장" disabled={!typed?.dueAt} onPress={() => typed?.dueAt && onSave({ at: typed.dueAt, hasTime: typed.hasTime })} />
          <Button variant="ghost" size="sm" label="취소" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.two },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  label: { marginTop: Spacing.three },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  save: { marginTop: Spacing.three },
});
