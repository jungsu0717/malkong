/**
 * 기록 찾기 — 돋보기 (SPEC-MAIN-13, task today/016). 「어젯밤에 몇 번 먹었어?」처럼 적으면 알아들은 조건을 칩으로 보이고,
 * 답은 find-parse.ts 가 기기 안 기록에서 직접 센다. 칩을 누르면 다른 것으로 바꾼다. 못 읽으면 안내 한 줄.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottleIcon } from '@/components/baby-icons';
import { DiaperGlyph } from '@/components/log/diaper-glyph';
import { ThemedText } from '@/components/themed-text';
import { Chip, tap } from '@/components/ui';
import { FontFamily, Spacing } from '@/constants/theme';
import { useEvents } from '@/data/events-context';
import { findWhen, parseFind, rangeOf, RANGE_CHOICES, runFind, WHAT_CHOICES, WHAT_LABEL, type FindQuery } from '@/data/find-parse';
import { useTheme } from '@/hooks/use-theme';

export function FindSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { events } = useEvents();
  const [text, setText] = useState('');
  /** 칩으로 바꾼 조건 — 글을 다시 적으면 지운다 */
  const [override, setOverride] = useState<Partial<FindQuery> | null>(null);
  const [picking, setPicking] = useState<'what' | 'range' | null>(null);
  const now = new Date();
  const parsed = parseFind(text, now);
  const query: FindQuery | null = parsed ? { ...parsed, ...override } : null;
  const answer = query ? runFind(query, events, now) : null;

  const close = () => {
    setText('');
    setOverride(null);
    setPicking(null);
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={close} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">기록 찾기</ThemedText>
          <View style={[styles.field, { borderColor: c.ink, backgroundColor: c.card }]}>
            <TextInput
              autoFocus
              value={text}
              onChangeText={(v) => {
                setText(v);
                setOverride(null);
                setPicking(null);
              }}
              placeholder="예: 어젯밤에 몇 번 먹었어?"
              placeholderTextColor={c.textTertiary}
              returnKeyType="search"
              accessibilityLabel="찾을 말"
              style={[styles.input, { color: c.text }]}
            />
            <Ionicons name="search" size={20} color={c.textSecondary} />
          </View>

          {text.trim().length > 0 && !query && (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <ThemedText type="label" style={{ fontWeight: 600 }}>
                찾는 기록이 없어요
              </ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                수유, 기저귀, 잠처럼 기록 이름을 넣어 보세요
              </ThemedText>
            </View>
          )}

          {query && answer && (
            <ScrollView style={styles.result} contentContainerStyle={styles.resultContent} keyboardShouldPersistTaps="handled">
              <View style={styles.chips}>
                <CondChip label={WHAT_LABEL[query.what]} open={picking === 'what'} onPress={() => setPicking((p) => (p === 'what' ? null : 'what'))} />
                <CondChip label={query.range.label} open={picking === 'range'} onPress={() => setPicking((p) => (p === 'range' ? null : 'range'))} />
              </View>
              {picking === 'what' && (
                <View style={styles.chips}>
                  {WHAT_CHOICES.map((w) => (
                    <Chip
                      key={w}
                      label={WHAT_LABEL[w]}
                      selected={w === query.what}
                      onPress={() => {
                        tap();
                        setOverride((o) => ({ ...o, what: w }));
                        setPicking(null);
                      }}
                    />
                  ))}
                </View>
              )}
              {picking === 'range' && (
                <View style={styles.chips}>
                  {RANGE_CHOICES.map((k) => {
                    const r = rangeOf(k, now);
                    return (
                      <Chip
                        key={k}
                        label={r.label}
                        selected={k === query.range.key}
                        onPress={() => {
                          tap();
                          setOverride((o) => ({ ...o, range: r }));
                          setPicking(null);
                        }}
                      />
                    );
                  })}
                </View>
              )}
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={styles.bigRow}>
                  <ThemedText type="display" style={styles.big}>
                    {answer.big}
                  </ThemedText>
                  {answer.line ? (
                    <ThemedText type="small" style={[styles.flex, { color: c.textSecondary }]}>
                      {answer.line}
                    </ThemedText>
                  ) : null}
                </View>
                {answer.rows.length === 0 && (
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    찾는 기록이 없어요
                  </ThemedText>
                )}
                {answer.rows.slice(0, 30).map((r, i) => (
                  <View key={r.key} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.divider }]}>
                    <ThemedText type="label" style={styles.when}>
                      {findWhen(r.at, now)}
                    </ThemedText>
                    <View style={[styles.dot, { backgroundColor: r.kind === 'breast' || r.kind === 'formula' ? c.accent : r.kind === 'sleep' ? c.ink : c.surfaceStrong }]}>
                      {r.kind === 'formula' ? (
                        <BottleIcon size={14} color="#FFFFFF" />
                      ) : r.kind === 'diaper' && r.diaper && r.diaper !== 'pee' ? (
                        <DiaperGlyph diaper={r.diaper} color={r.color ?? null} size={14} />
                      ) : (
                        <Ionicons
                          name={r.kind === 'breast' ? 'heart' : r.kind === 'sleep' ? 'moon' : r.kind === 'diaper' ? 'water-outline' : r.kind === 'temp' ? 'thermometer-outline' : r.kind === 'weight' ? 'scale-outline' : 'resize-outline'}
                          size={14}
                          color={r.kind === 'breast' || r.kind === 'sleep' ? '#FFFFFF' : c.text}
                        />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="label" style={{ fontWeight: 600 }}>
                        {r.title}
                      </ThemedText>
                      {r.by ? (
                        <ThemedText type="caption" style={{ color: c.textSecondary }}>
                          {r.by}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CondChip({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}, 바꾸기`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.cond, { borderColor: open ? c.ink : c.border, backgroundColor: c.card }]}>
      <ThemedText type="label" style={{ fontWeight: 600 }}>
        {label}
      </ThemedText>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1, minWidth: 0 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.three, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 4 },
  field: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 14, borderWidth: 2, paddingLeft: 14, paddingRight: 14, gap: 8 },
  input: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 17, paddingVertical: 0 },
  result: { flexGrow: 0 },
  resultContent: { gap: Spacing.three, paddingBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cond: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 4 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 6 },
  big: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  when: { width: 82, fontWeight: 700, fontVariant: ['tabular-nums'] },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
