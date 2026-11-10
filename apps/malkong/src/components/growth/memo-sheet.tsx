/**
 * 우리 아기 메모 쓰기 · 고치기 (SPEC-STAGE-03, task growth/004 · growth/011, decisions/042) — 「D+32 · 5주차」와 한 칸, 저장. 고칠 때는 삭제도.
 *
 * 글 칸 위에 그날 기록을 시간순 칩으로 둔다(`facts`). 칩을 누르면 「07:45 모유 15분」이 글 끝에 들어가고, 말투와 글은 사람이 쓴다 — 모델은 부르지 않는다.
 * 발달 체크로 남긴 것(「뒤집기」)은 별 칩으로 맨 앞. 오른쪽 위에 「수유 6번 710ml, 잠 8시간 20분」 한 줄.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { DiaperGlyph, diaperTone } from '@/components/log/diaper-glyph';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { appendFact, type Fact, type FactKind } from '@/data/day-facts';
import type { Memo } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

const MAX = 500;
/** 칩이 이보다 많으면 두 줄로 나눈다 */
const ONE_ROW = 6;
const TILE = 22;
const ICON = 13;

export function MemoSheet({
  open,
  memo,
  dayText,
  facts,
  summary,
  factsLabel = '오늘 기록',
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  /** 고칠 메모 — 없으면 새로 */
  memo: Memo | null;
  /** 「D+32 · 5주차」 */
  dayText: string;
  /** 그날 기록 칩 — 없거나 비어 있으면 칸을 두지 않는다 */
  facts?: Fact[];
  /** 「수유 6번 710ml, 잠 8시간 20분」 */
  summary?: string | null;
  /** 칩 위 이름 — 「오늘 기록」 · 「이날 기록」 */
  factsLabel?: string;
  onSave: (text: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(memo?.text ?? '');
  const [used, setUsed] = useState<Set<string>>(() => new Set());
  const list = facts ?? [];
  const rows = list.length > ONE_ROW ? [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))] : list.length ? [list] : [];

  const insert = (f: Fact) => {
    tap();
    setText((t) => appendFact(t, f.insert));
    setUsed((prev) => new Set(prev).add(f.key));
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <View style={styles.head}>
            <ThemedText type="title">우리 아기 메모</ThemedText>
            <View style={[styles.day, { backgroundColor: c.accentSoft }]}>
              <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
                {dayText}
              </ThemedText>
            </View>
          </View>
          {rows.length > 0 && (
            <View style={styles.facts}>
              <View style={styles.factsHead}>
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  {`${factsLabel} — 누르면 글에 들어가요`}
                </ThemedText>
                {summary && (
                  <ThemedText type="caption" numberOfLines={1} style={[styles.shrink, { color: c.textSecondary }]}>
                    {summary}
                  </ThemedText>
                )}
              </View>
              {rows.map((row, i) => (
                <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.row} contentContainerStyle={styles.rowInner}>
                  {row.map((f) => (
                    <FactChip key={f.key} fact={f} used={used.has(f.key)} onPress={() => insert(f)} />
                  ))}
                </ScrollView>
              ))}
            </View>
          )}
          <TextInput
            style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
            value={text}
            onChangeText={setText}
            placeholder="예: 처음으로 소리 내어 웃었어요"
            placeholderTextColor={c.textTertiary}
            multiline
            maxLength={MAX}
            autoFocus={!memo}
            accessibilityLabel="메모"
          />
          <Button size="lg" label="저장" disabled={!text.trim()} onPress={() => onSave(text)} />
          {memo && onDelete && <Button size="sm" variant="ghost" label="삭제" onPress={onDelete} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 칩 앞의 작은 아이콘 칸 — 하루 흐름의 노드 색을 따른다 */
function Tile({ kind, title }: { kind: FactKind; title: string }) {
  const c = useTheme();
  if (kind === 'breast' || kind === 'formula') {
    return (
      <View style={[styles.tile, { backgroundColor: c.accent }]}>
        {kind === 'formula' ? <BottleIcon size={ICON} color={c.onInk} /> : <Ionicons name="heart-outline" size={ICON} color={c.onInk} />}
      </View>
    );
  }
  if (kind === 'pee' || kind === 'poo' || kind === 'both') {
    return (
      <View style={[styles.tile, styles.round, diaperTone(kind, c), styles.lined]}>
        <DiaperGlyph diaper={kind} color={null} size={ICON} />
      </View>
    );
  }
  if (kind === 'sleep') {
    return (
      <View style={[styles.tile, { backgroundColor: c.ink }]}>
        <ZzIcon size={ICON} color={c.onInk} />
      </View>
    );
  }
  if (kind === 'routine' || kind === 'todo') {
    return (
      <View style={[styles.tile, styles.lined, { backgroundColor: c.doneBg, borderColor: c.doneLine }]}>
        <RoutineIcon title={title} size={ICON} color={c.doneFg} />
      </View>
    );
  }
  if (kind === 'check') {
    return (
      <View style={[styles.tile, { backgroundColor: c.peeBg }]}>
        <Ionicons name="star" size={ICON} color={c.peeFg} />
      </View>
    );
  }
  if (kind === 'temp') {
    return (
      <View style={[styles.tile, styles.lined, { backgroundColor: c.tempBg, borderColor: c.tempLine }]}>
        <Ionicons name="thermometer-outline" size={ICON} color={c.tempFg} />
      </View>
    );
  }
  return (
    <View style={[styles.tile, styles.lined, { backgroundColor: c.surface, borderColor: c.flowLine }]}>
      <Ionicons name={kind === 'weight' ? 'scale-outline' : 'resize-outline'} size={ICON} color={c.text} />
    </View>
  );
}

function FactChip({ fact, used, onPress }: { fact: Fact; used: boolean; onPress: () => void }) {
  const c = useTheme();
  const star = fact.kind === 'check';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fact.insert} 글에 넣기`}
      accessibilityState={{ selected: used }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: star ? c.peeLine : c.border, backgroundColor: used || pressed ? c.surfaceStrong : star ? c.peeBg : c.card },
      ]}>
      <Tile kind={fact.kind} title={fact.text} />
      {fact.time && (
        <ThemedText type="caption" style={[styles.time, { color: c.textSecondary }]}>
          {fact.time}
        </ThemedText>
      )}
      <ThemedText type="caption" style={{ fontWeight: 700 }}>
        {fact.text}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.three },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  facts: { gap: 6, marginTop: -Spacing.one },
  factsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  shrink: { flexShrink: 1, minWidth: 0 },
  // 칩 줄은 시트 여백 밖까지 밀려 나간다
  // 가로 ScrollView 가 키보드에 눌리지 않게 — 기본은 flexGrow 1 · flexShrink 1
  row: { marginHorizontal: -Spacing.four, flexGrow: 0, flexShrink: 0 },
  rowInner: { paddingHorizontal: Spacing.four, gap: 6 },
  chip: { height: 32, paddingLeft: 5, paddingRight: 10, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontVariant: ['tabular-nums'] },
  tile: { width: TILE, height: TILE, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: TILE / 2 },
  lined: { borderWidth: 1 },
  field: {
    minHeight: 132,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FontFamily.regular,
    textAlignVertical: 'top',
  },
});
