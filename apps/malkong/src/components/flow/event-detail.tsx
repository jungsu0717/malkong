/**
 * 펼친 기록 노드 (SPEC-MAIN-08, task today/012) — 기록 노드를 누르면 그 자리에서 이 카드로 바뀐다.
 *
 * 시간과 누가, 모유는 쪽마다 걸린 시간, 분유 양, 변 색, 메모. 수유면 n8n 노드를 열었을 때처럼 들어오는 것과 나가는 것 —
 * 「앞 수유 → 이번 → 다음 수유」 세 칸과 「앞 수유와 3시간 10분 간격이에요」. 아래에 「삭제」 · 「편집」(입력 시트).
 * 쪽을 바꾼 모유는 쪽마다 줄을 눌러 편집한다. 삭제는 한 번 더 눌러야 지워진다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KIND_UI } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { feedNeighbors, feedTitle, hhmm, sidesLine, type FeedSession, type FlowItem } from '@/data/day-flow';
import { STOOL_COLOR_LABEL, durationLabel, eventTitle, minutesOf } from '@/data/event-summary';
import type { CareEvent } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

type Openable = Extract<FlowItem, { type: 'feed' | 'sleep' | 'side' }>;

export function EventDetail({
  item,
  events,
  now,
  onClose,
  onEdit,
  onDelete,
}: {
  item: Openable;
  events: CareEvent[];
  now: Date;
  onClose: () => void;
  onEdit: (e: CareEvent) => void;
  /** 지울 줄 — 쪽을 바꾼 모유는 여러 줄 */
  onDelete: (ids: string[]) => void;
}) {
  const c = useTheme();
  const [confirming, setConfirming] = useState(false);
  const parts = item.type === 'feed' ? item.session.parts : [item.event];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const title = item.type === 'feed' ? feedTitle(item.session, now) : eventTitle(item.event, now);
  const timed = first.kind === 'breast' || first.kind === 'sleep';
  const range = timed && last.endAt ? `${hhmm(first.startAt)}~${hhmm(last.endAt)}` : hhmm(first.startAt);
  const by = parts.map((p) => p.by).find(Boolean) ?? null;
  const notes = parts.map((p) => p.note).filter((n): n is string => !!n);

  const rows: { label: string; value: string }[] = [];
  if (item.type === 'feed') {
    const sides = sidesLine(item.session, now);
    if (sides) rows.push({ label: '시간', value: sides });
  }
  if (item.type === 'sleep') rows.push({ label: '시간', value: durationLabel(minutesOf(item.event, now)) });
  if (first.kind === 'diaper' && first.color && first.diaper !== 'pee') rows.push({ label: '변 색', value: STOOL_COLOR_LABEL[first.color] });
  if (notes.length > 0) rows.push({ label: '메모', value: notes.join(' · ') });

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.ink }]}>
      <View style={styles.head}>
        <View style={[styles.tile, { backgroundColor: first.kind === 'sleep' ? c.hero : first.kind === 'breast' || first.kind === 'formula' ? c.accentSoft : c.surface }]}>
          <Ionicons
            name={KIND_UI[first.kind].icon}
            size={18}
            color={first.kind === 'sleep' ? c.onHero : first.kind === 'breast' || first.kind === 'formula' ? c.accent : c.textSecondary}
          />
        </View>
        <View style={styles.flex}>
          <ThemedText type="heading" style={{ fontWeight: 700 }}>
            {title}
          </ThemedText>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {[range, by].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={8}
          onPress={() => {
            tap();
            onClose();
          }}
          style={[styles.close, { backgroundColor: c.surface }]}>
          <Ionicons name="close" size={18} color={c.text} />
        </Pressable>
      </View>

      {rows.map((r) => (
        <View key={r.label} style={styles.kv}>
          <ThemedText type="small" style={[styles.k, { color: c.textSecondary }]}>
            {r.label}
          </ThemedText>
          <ThemedText type="small" style={styles.flex}>
            {r.value}
          </ThemedText>
        </View>
      ))}

      {item.type === 'feed' && <FeedChain session={item.session} events={events} now={now} />}

      {/* 쪽을 바꾼 모유 — 쪽마다 눌러 편집 */}
      {parts.length > 1 && (
        <View style={styles.parts}>
          {parts.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${eventTitle(p, now)} 편집`}
              onPress={() => onEdit(p)}
              style={({ pressed }) => [styles.part, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
              <ThemedText type="small" style={styles.flex}>
                {eventTitle(p, now)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {p.endAt ? `${hhmm(p.startAt)}~${hhmm(p.endAt)}` : hhmm(p.startAt)}
              </ThemedText>
              <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {confirming ? (
          <>
            <Button label="취소" variant="secondary" size="sm" onPress={() => setConfirming(false)} />
            <Button label="삭제" variant="danger" size="sm" onPress={() => onDelete(parts.map((p) => p.id))} />
          </>
        ) : (
          <>
            <Button label="삭제" variant="secondary" size="sm" onPress={() => setConfirming(true)} />
            {parts.length === 1 && <Button label="편집" size="sm" onPress={() => onEdit(first)} />}
          </>
        )}
      </View>
    </View>
  );
}

/** 앞 수유 → 이번 → 다음 수유(있으면 그 수유, 이것이 마지막이면 예상) */
function FeedChain({ session, events, now }: { session: FeedSession; events: CareEvent[]; now: Date }) {
  const c = useTheme();
  const { prev, next, guess, gapBefore } = feedNeighbors(session, events, now);
  if (!prev && !next && !guess) return null;
  const box = (key: string, head: string, body: string, tone: 'plain' | 'this' | 'guess'): ReactNode => (
    <View
      key={key}
      style={[
        styles.box,
        tone === 'this'
          ? { backgroundColor: c.accentSoft }
          : tone === 'guess'
            ? { borderColor: c.flowLine, borderWidth: 1.5, borderStyle: 'dashed' }
            : { backgroundColor: c.surface },
      ]}>
      <ThemedText type="caption" numberOfLines={1} style={{ color: tone === 'this' ? c.accentText : c.textSecondary, fontSize: 11, lineHeight: 14 }}>
        {head}
      </ThemedText>
      <ThemedText type="label" numberOfLines={1} style={{ fontWeight: 700, color: tone === 'this' ? c.accentText : c.text }}>
        {body}
      </ThemedText>
    </View>
  );
  const arrow = (key: string) => <Ionicons key={key} name="arrow-forward" size={14} color={c.textTertiary} />;
  return (
    <View style={styles.chainWrap}>
      <View style={styles.chain}>
        {prev && box('prev', `앞 수유 ${hhmm(prev.startAt)}`, feedTitle(prev, now), 'plain')}
        {prev && arrow('a1')}
        {box('this', `이번 ${hhmm(session.startAt)}`, feedTitle(session, now), 'this')}
        {(next || guess) && arrow('a2')}
        {next && box('next', `다음 수유 ${hhmm(next.startAt)}`, feedTitle(next, now), 'plain')}
        {!next && guess && box('guess', '다음 수유', `${hhmm(guess)}쯤`, 'guess')}
      </View>
      {gapBefore !== null && (
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          앞 수유와 {durationLabel(gapBefore)} 간격이에요
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kv: { flexDirection: 'row', gap: 12 },
  k: { width: 44 },
  chainWrap: { gap: 6 },
  chain: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  box: { flex: 1, minWidth: 0, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  parts: { gap: 6 },
  part: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, minHeight: 40 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
