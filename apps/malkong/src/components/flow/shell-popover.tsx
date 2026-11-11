/**
 * 빈칸 채우기 창 (SPEC-MAIN-16, task today/029, decisions/046) — 흐름에서 초안의 빈칸을 누르면 그 위(위가 모자라면 아래)에 작게 뜬다.
 *
 * 분유는 양을 10ml 씩, 모유와 잠은 걸린 시간을 5분씩 고친다. 시각은 「지금」, 「어제처럼」(복사한 날의 시각), 「직접 입력」 가운데 골라 「기록」을 누른다.
 * 그 자리에서 기록이 되고 빈칸은 사라진다. 「초안에서 빼기」로 빈칸만 뺄 수도 있다. 지나간 날의 초안에는 「지금」이 없다.
 * 목록 보기에서는 노드가 없어 위쪽 가운데에 뜬다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { NodeIcon, draftTone, type ItemKind } from '@/components/flow/flow-graph';
import { ThemedText } from '@/components/themed-text';
import { INLINE_WHEEL, TimeWheel, pickTime } from '@/components/time-picker';
import { tap } from '@/components/ui';
import { dateOfYmd, shellTitle, sourceWord, type Shell, type ShellSet } from '@/data/day-draft';
import { hhmm } from '@/data/day-flow';
import { durationLabel } from '@/data/event-summary';
import { ITEM } from '@/data/flow-layout';
import type { ShellPatch } from '@/hooks/use-day-shells';
import { useTheme } from '@/hooks/use-theme';

const MIN = 60 * 1000;
const W = 312;
/** 노드 가운데에서 이름 세 줄 아래까지 */
const BELOW = ITEM / 2 + 60;

type When = 'now' | 'hint' | 'custom';

/** 빈칸의 흐름 노드 모양 — 기저귀는 소변 · 대변, 잠은 따로 그린다 */
export function shellItemKind(s: Shell): ItemKind | 'sleep' {
  if (s.kind === 'diaper') return s.diaper === 'pee' ? 'pee' : s.diaper === 'both' ? 'both' : 'poo';
  return s.kind;
}

const ASK: Record<Shell['kind'], string> = { formula: '언제 먹었어요?', breast: '언제 먹었어요?', diaper: '언제 갈았어요?', sleep: '언제 잠들었어요?', routine: '언제 했어요?' };

export function ShellPopover({
  set,
  shell,
  anchor,
  above: placeAbove,
  width,
  height,
  now,
  onRecord,
  onRemove,
  onClose,
}: {
  set: ShellSet;
  shell: Shell;
  /** 노드의 가운데 — 목록 보기에서는 null */
  anchor: { cx: number; cy: number } | null;
  /** 노드 위에 띄울지 — 화면이 같은 기준으로 스크롤하도록 부르는 쪽이 정한다 */
  above: boolean;
  /** 흐름 캔버스의 너비와 높이 */
  width: number;
  height: number;
  now: Date;
  onRecord: (at: Date, patch: ShellPatch) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const dayStart = dateOfYmd(set.day).getTime();
  const isToday = now.getTime() >= dayStart && now.getTime() < dayStart + 24 * 60 * MIN;
  const hintAt = dayStart + shell.minute * MIN;
  const [when, setWhen] = useState<When>(isToday ? 'now' : 'hint');
  const [custom, setCustom] = useState(hhmm(isToday ? now : hintAt));
  const [wheel, setWheel] = useState(false);
  const [amount, setAmount] = useState<number | null>(shell.amount);
  const [minutes, setMinutes] = useState<number | null>(shell.minutes);
  const [h, setH] = useState(280);

  const customAt = (() => {
    const [hh, mm] = custom.split(':').map(Number);
    return dayStart + (hh * 60 + mm) * MIN;
  })();
  const at = when === 'now' ? now.getTime() : when === 'hint' ? hintAt : customAt;
  // 기록은 지나간 일이다 — 오늘이면 지금보다 늦은 시각은 고르지 못한다
  const late = (x: number) => isToday && x > now.getTime() + MIN;
  const timed = (shell.kind === 'breast' || shell.kind === 'sleep') && minutes !== null;
  const patch: ShellPatch = { amount, minutes };
  const title = shellTitle(shell, patch);

  const left = anchor ? Math.min(Math.max(8, anchor.cx - W / 2), Math.max(8, width - W - 8)) : Math.max(8, (width - W) / 2);
  const above = anchor !== null && placeAbove && anchor.cy - ITEM / 2 - h - 12 >= 0;
  const below = anchor ? Math.min(anchor.cy + BELOW, Math.max(8, height - h - 8)) : 56;
  const top = anchor ? (above ? anchor.cy - ITEM / 2 - h - 12 : below) : 56;
  const pointerX = anchor ? Math.min(Math.max(14, anchor.cx - left - 7), W - 28) : null;
  const kind = shellItemKind(shell);

  const openCustom = () => {
    tap();
    setWhen('custom');
    if (INLINE_WHEEL) setWheel((v) => !v || when !== 'custom');
    else pickTime(custom, setCustom);
  };

  return (
    <View
      accessibilityViewIsModal
      onLayout={(e: LayoutChangeEvent) => setH(Math.round(e.nativeEvent.layout.height))}
      style={[styles.pop, { left, top, width: W, backgroundColor: c.card, borderColor: c.border, shadowColor: c.text }]}>
      {pointerX !== null && <View pointerEvents="none" style={[styles.pointer, above ? styles.pointerBottom : styles.pointerTop, { left: pointerX, backgroundColor: c.card, borderColor: c.border }]} />}
      <View style={styles.head}>
        {kind === 'sleep' ? (
          <View style={[styles.tile, { backgroundColor: c.card, borderColor: c.ink, borderWidth: 1.6, borderStyle: 'dashed' }]}>
            <Ionicons name="moon-outline" size={17} color={c.text} />
          </View>
        ) : (
          <View style={[styles.tile, draftTone(kind, c), kind === 'pee' || kind === 'poo' || kind === 'both' ? styles.round : null]}>
            <NodeIcon kind={kind} title={shell.title} stool={null} size={17} light />
          </View>
        )}
        <ThemedText type="heading" numberOfLines={1} style={styles.flex}>
          {title}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={18} color={c.textSecondary} />
        </Pressable>
      </View>

      {shell.kind === 'formula' && (
        <Stepper
          label="양"
          value={`${amount ?? 0}ml`}
          minusLabel="10ml 줄이기"
          plusLabel="10ml 늘리기"
          onMinus={(amount ?? 0) > 10 ? () => setAmount((amount ?? 0) - 10) : null}
          onPlus={(amount ?? 0) < 400 ? () => setAmount((amount ?? 0) + 10) : null}
        />
      )}
      {timed && (
        <Stepper
          label="시간"
          value={durationLabel(minutes)}
          minusLabel="5분 줄이기"
          plusLabel="5분 늘리기"
          onMinus={minutes > 5 ? () => setMinutes(minutes - 5) : null}
          onPlus={minutes < 16 * 60 ? () => setMinutes(minutes + 5) : null}
        />
      )}

      <View style={styles.whenBox}>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {ASK[shell.kind]}
        </ThemedText>
        <View style={styles.chips}>
          {isToday && <Chip label={`지금 ${hhmm(now)}`} on={when === 'now'} onPress={() => (tap(), setWhen('now'), setWheel(false))} />}
          <Chip
            label={`${sourceWord(set)}처럼 ${hhmm(hintAt)}`}
            on={when === 'hint'}
            disabled={late(hintAt)}
            onPress={() => (tap(), setWhen('hint'), setWheel(false))}
          />
          <Chip label={when === 'custom' ? custom : '직접 입력'} on={when === 'custom'} onPress={openCustom} />
        </View>
        {when === 'custom' && wheel && INLINE_WHEEL && (
          <View style={styles.wheel}>
            <TimeWheel value={custom} onChange={setCustom} />
          </View>
        )}
      </View>

      <View style={styles.row}>
        <Small
          label="기록"
          ink
          disabled={late(at)}
          onPress={() => {
            tap('success');
            // 「지금」은 누른 때 — 창을 열어 둔 사이에 시계가 흘렀을 수 있다
            onRecord(when === 'now' ? new Date() : new Date(at), patch);
          }}
        />
        <Small
          label="초안에서 빼기"
          onPress={() => {
            tap();
            onRemove();
          }}
        />
      </View>
    </View>
  );
}

/** 「양  −  160ml  +」 — 한 줄 */
function Stepper({ label, value, minusLabel, plusLabel, onMinus, onPlus }: { label: string; value: string; minusLabel: string; plusLabel: string; onMinus: (() => void) | null; onPlus: (() => void) | null }) {
  const c = useTheme();
  return (
    <View style={styles.stepRow}>
      <ThemedText type="label" style={[styles.stepLabel, { color: c.textSecondary }]}>
        {label}
      </ThemedText>
      <Round icon="remove" aria={minusLabel} onPress={onMinus} />
      <ThemedText type="heading" style={styles.stepValue}>
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
      style={({ pressed }) => [styles.roundBtn, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card, opacity: onPress === null ? 0.4 : 1 }]}>
      <Ionicons name={icon} size={18} color={c.text} />
    </Pressable>
  );
}

function Chip({ label, on, disabled = false, onPress }: { label: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.card, opacity: disabled ? 0.4 : 1 }]}>
      <ThemedText type="label" style={{ fontWeight: on ? 700 : 500, color: on ? c.accentText : c.text, fontVariant: ['tabular-nums'] }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Small({ label, ink = false, disabled = false, onPress }: { label: string; ink?: boolean; disabled?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.small,
        ink ? [styles.flex, { borderColor: c.ink, backgroundColor: c.ink, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }] : { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card },
      ]}>
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
    gap: 10,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  pointer: { position: 'absolute', width: 14, height: 14, borderWidth: 1.5, transform: [{ rotate: '45deg' }] },
  pointerTop: { top: -8, borderRightWidth: 0, borderBottomWidth: 0 },
  pointerBottom: { bottom: -8, borderLeftWidth: 0, borderTopWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 16 },
  flex: { flex: 1, minWidth: 0 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { width: 34 },
  stepValue: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'], fontSize: 17 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  whenBox: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  wheel: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  small: { height: 42, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
