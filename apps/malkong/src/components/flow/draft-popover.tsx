/**
 * 초안 고치기 창 (SPEC-MAIN-16, task today/023, decisions/041) — 흐름에서 초안 노드를 누르면 그 위(위가 모자라면 아래)에 작게 뜬다.
 *
 * 시각은 5분씩, 분유 양은 10ml 씩, 모유 · 잠의 걸린 시간은 5분씩 고치고 「확인」을 누른다. 「초안에서 빼기」로 초안에서 뺀다.
 * 오늘이면 지금보다 뒤로는 옮기지 못한다. 목록 보기에서는 노드가 없어 위쪽 가운데에 뜬다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { draftMinutes, type Draft, type DraftPatch } from '@/data/day-draft';
import { hhmm } from '@/data/day-flow';
import { durationLabel } from '@/data/event-summary';
import { ITEM } from '@/data/flow-layout';
import { useTheme } from '@/hooks/use-theme';

const MIN = 60 * 1000;
const W = 300;
/** 노드 가운데에서 이름 세 줄 아래까지 */
const BELOW = ITEM / 2 + 60;

export function DraftPopover({
  draft,
  anchor,
  width,
  height,
  max,
  onChange,
  onRemove,
  onClose,
}: {
  draft: Draft;
  /** 노드의 가운데 — 목록 보기에서는 null */
  anchor: { cx: number; cy: number } | null;
  /** 흐름 캔버스의 너비와 높이 */
  width: number;
  height: number;
  /** 시각의 상한 — 오늘이면 지금, 지난날이면 그날 끝 */
  max: number;
  onChange: (patch: DraftPatch) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const amount0 = draft.input.type === 'event' ? (draft.input.input.amount ?? null) : null;
  const minutes0 = draftMinutes(draft);
  const [at, setAt] = useState(draft.at);
  const [amount, setAmount] = useState<number | null>(amount0);
  const [minutes, setMinutes] = useState<number | null>(minutes0);
  const [h, setH] = useState(190);
  const kind = draft.input.type === 'event' ? draft.input.input.kind : draft.input.type;
  const formula = kind === 'formula';
  const timed = kind === 'breast' || kind === 'sleep';
  const left = anchor ? Math.min(Math.max(8, anchor.cx - W / 2), Math.max(8, width - W - 8)) : Math.max(8, (width - W) / 2);
  // 노드 위에 띄운다(시안) — 위가 모자라면 아래, 아래도 모자라면 캔버스 안으로 올린다
  const above = anchor !== null && anchor.cy - ITEM / 2 - h - 12 >= 0;
  const below = anchor ? Math.min(anchor.cy + BELOW, Math.max(8, height - h - 8)) : 56;
  const top = anchor ? (above ? anchor.cy - ITEM / 2 - h - 12 : below) : 56;
  const pointerX = anchor ? Math.min(Math.max(14, anchor.cx - left - 7), W - 28) : null;
  const changed = at !== draft.at || amount !== amount0 || minutes !== minutes0;

  return (
    <View
      accessibilityViewIsModal
      onLayout={(e: LayoutChangeEvent) => setH(Math.round(e.nativeEvent.layout.height))}
      style={[styles.pop, { left, top, width: W, backgroundColor: c.card, borderColor: c.border, shadowColor: c.text }]}>
      {pointerX !== null && <View pointerEvents="none" style={[styles.pointer, above ? styles.pointerBottom : styles.pointerTop, { left: pointerX, backgroundColor: c.card, borderColor: c.border }]} />}
      <View style={styles.head}>
        <ThemedText type="heading" numberOfLines={1} style={styles.flex}>
          {draft.title}
        </ThemedText>
        <View style={[styles.tag, { backgroundColor: c.accentSoft }]}>
          <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700 }}>
            {draft.guessed ? '초안 · 평소 시각' : '초안'}
          </ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={18} color={c.textSecondary} />
        </Pressable>
      </View>
      <Stepper
        label="시각"
        value={`${hhmm(at)}${draft.guessed ? '쯤' : ''}`}
        minusLabel="5분 앞으로"
        plusLabel="5분 뒤로"
        onMinus={() => setAt(at - 5 * MIN)}
        onPlus={at + 5 * MIN <= max ? () => setAt(at + 5 * MIN) : null}
      />
      {formula && (
        <Stepper
          label="양"
          value={`${amount ?? 0}ml`}
          accent
          minusLabel="10ml 줄이기"
          plusLabel="10ml 늘리기"
          onMinus={(amount ?? 0) > 10 ? () => setAmount((amount ?? 0) - 10) : null}
          onPlus={(amount ?? 0) < 400 ? () => setAmount((amount ?? 0) + 10) : null}
        />
      )}
      {timed && minutes !== null && (
        <Stepper
          label="시간"
          value={durationLabel(minutes)}
          minusLabel="5분 줄이기"
          plusLabel="5분 늘리기"
          onMinus={minutes > 5 ? () => setMinutes(minutes - 5) : null}
          onPlus={at + (minutes + 5) * MIN <= max ? () => setMinutes(minutes + 5) : null}
        />
      )}
      <View style={styles.row}>
        <Small
          label="초안에서 빼기"
          onPress={() => {
            tap();
            onRemove();
          }}
        />
        <View style={styles.flex} />
        <Small
          label="확인"
          ink
          onPress={() => {
            tap('success');
            if (changed) onChange({ at, ...(formula && amount !== null ? { amount } : {}), ...(timed && minutes !== null ? { minutes } : {}) });
            onClose();
          }}
        />
      </View>
    </View>
  );
}

/** 「시각  −  16:50  +」 — 한 줄 */
function Stepper({ label, value, accent = false, minusLabel, plusLabel, onMinus, onPlus }: { label: string; value: string; accent?: boolean; minusLabel: string; plusLabel: string; onMinus: (() => void) | null; onPlus: (() => void) | null }) {
  const c = useTheme();
  return (
    <View style={styles.stepRow}>
      <ThemedText type="label" style={[styles.stepLabel, { color: c.textSecondary }]}>
        {label}
      </ThemedText>
      <Round icon="remove" aria={minusLabel} onPress={onMinus} />
      <ThemedText type="heading" style={[styles.stepValue, accent && { color: c.accentText }]}>
        {value}
      </ThemedText>
      <Round icon="add" aria={plusLabel} onPress={onPlus} />
    </View>
  );
}

function Round({ icon, aria, onPress }: { icon: 'add' | 'remove'; aria: string; onPress: (() => void) | null }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={aria}
      accessibilityState={{ disabled: onPress === null }}
      disabled={onPress === null}
      hitSlop={4}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.round, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card, opacity: onPress === null ? 0.4 : 1 }]}>
      <Ionicons name={icon} size={18} color={c.text} />
    </Pressable>
  );
}

function Small({ label, ink = false, onPress }: { label: string; ink?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.small, ink ? { borderColor: c.ink, backgroundColor: c.ink, opacity: pressed ? 0.85 : 1 } : { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card }]}>
      <ThemedText type="label" style={{ fontWeight: 700, color: ink ? c.onInk : c.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pop: {
    position: 'absolute',
    zIndex: 30,
    elevation: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  pointer: { position: 'absolute', width: 14, height: 14, borderWidth: 1.5, transform: [{ rotate: '45deg' }] },
  pointerTop: { top: -8, borderRightWidth: 0, borderBottomWidth: 0 },
  pointerBottom: { bottom: -8, borderLeftWidth: 0, borderTopWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  tag: { height: 20, paddingHorizontal: 7, borderRadius: 10, justifyContent: 'center' },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { width: 34 },
  stepValue: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'], fontSize: 17 },
  round: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  small: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
