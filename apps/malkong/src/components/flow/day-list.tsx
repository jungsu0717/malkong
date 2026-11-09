/**
 * 하루 목록 보기 (SPEC-MAIN-08, task today/018) — 베이비타임처럼 기록을 한 줄씩, 최근 것이 위.
 *
 * 맨 위에 다음 수유 예상(흐린 줄)과 「지금 14:20, 먹은 지 30분」, 그 아래 기록과 잠이 시간 역순으로 쌓인다.
 * 한 줄에 시각, 기록 아이콘(흐름과 같은 색), 이름, 누가와 자세한 내용, 오른쪽에 같은 기록끼리 간격. 묶음과 묶음 사이에는 「2시간 10분 기록 없음」.
 * 물어보기가 답한 기록은 코랄 테두리와 짧은 표시로 비춘다. 줄을 누르면 그 시간의 기록 화면이 열린다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { NodeIcon, nodeTone, type ItemKind } from '@/components/flow/flow-graph';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { hhmm, sleepTitle, spanRange, type Block, type DayFlow, type SleepSpan, type SubItem } from '@/data/day-flow';
import { STOOL_COLOR_LABEL, durationLabel } from '@/data/event-summary';
import type { StoolColor } from '@/data/events';
import { useTheme } from '@/hooks/use-theme';

const MIN = 60 * 1000;

export type ListItemInfo = { kind: ItemKind; title: string; stool: StoolColor | null; by: string | null };

type Line =
  | { type: 'item'; key: string; at: number; item: SubItem; block: Block }
  | { type: 'sleep'; key: string; at: number; sleep: SleepSpan }
  | { type: 'quiet'; key: string; minutes: number };

/** 흐름의 토막을 최근 것이 위인 줄로 */
function linesOf(flow: DayFlow): Line[] {
  const out: Line[] = [];
  flow.parts.forEach((p, i) => {
    if (p.type === 'sleep') {
      out.push({ type: 'sleep', key: p.sleep.event.id, at: p.sleep.from, sleep: p.sleep });
      return;
    }
    const prev = i > 0 ? flow.parts[i - 1] : null;
    if (prev && prev.type === 'block') out.push({ type: 'quiet', key: `quiet-${p.block.key}`, minutes: (p.block.from - prev.block.to) / MIN });
    for (const it of p.block.items) out.push({ type: 'item', key: it.key, at: it.at, item: it, block: p.block });
  });
  return out.reverse();
}

export function DayList({
  flow,
  dayStart,
  now,
  isToday,
  nowTitle,
  nowExtra,
  nextFeed,
  info,
  gapOf,
  awakeOf,
  lit,
  onOpenItem,
  onOpenSleep,
}: {
  flow: DayFlow;
  dayStart: number;
  now: Date;
  isToday: boolean;
  /** 「먹은 지 30분」 — 자는 중이면 잠든 지 */
  nowTitle: string;
  /** 모유를 재는 중이면 종료 · 반대쪽 단추 */
  nowExtra: ReactNode;
  nextFeed: { title: string; sub: string; onPress?: () => void } | null;
  info: (it: SubItem) => ListItemInfo;
  gapOf: (key: string) => string | null;
  awakeOf: (id: string) => string | null;
  lit: (key: string) => string | null;
  onOpenItem: (block: Block, key: string) => void;
  onOpenSleep: (s: SleepSpan) => void;
}) {
  const c = useTheme();
  const lines = linesOf(flow);

  return (
    <View style={[styles.list, { borderTopColor: c.border }]}>
      {isToday && nextFeed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nextFeed.title} ${nextFeed.sub}`}
          onPress={nextFeed.onPress}
          style={[styles.row, styles.ghost, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <ThemedText type="label" style={[styles.time, { color: c.textSecondary }]}>
            {nextFeed.sub.replace('쯤', '')}
          </ThemedText>
          <View style={[styles.tile, { borderColor: c.accent, borderStyle: 'dashed', borderWidth: 1.5 }]}>
            <BottleIcon size={18} color={c.accent} />
          </View>
          <View style={styles.text}>
            <ThemedText type="heading" style={styles.title}>
              {nextFeed.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {nextFeed.sub}
            </ThemedText>
          </View>
        </Pressable>
      )}
      {isToday && (
        <View style={[styles.now, { backgroundColor: c.accentSoft }]}>
          <View style={styles.nowHead}>
            {flow.sleeping ? <ZzIcon size={16} color={c.accentText} /> : <View style={[styles.nowDot, { backgroundColor: c.accent }]} />}
            <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
              {`지금 ${hhmm(now)}`}
            </ThemedText>
            <ThemedText type="label" style={{ color: c.accentText }}>
              {flow.sleeping ? sleepTitle(flow.sleeping, now) : nowTitle}
            </ThemedText>
          </View>
          {nowExtra}
        </View>
      )}
      {lines.length === 0 && (
        <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
          {isToday ? '첫 기록을 남겨 보세요' : '이날은 남긴 기록이 없어요'}
        </ThemedText>
      )}
      {lines.map((l) => {
        if (l.type === 'quiet') {
          return (
            <View key={l.key} style={[styles.quiet, { backgroundColor: c.page }]}>
              <View style={[styles.quietLine, { backgroundColor: c.border }]} />
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {`${durationLabel(Math.max(1, l.minutes))} 기록 없음`}
              </ThemedText>
              <View style={[styles.quietLine, { backgroundColor: c.border }]} />
            </View>
          );
        }
        if (l.type === 'sleep') {
          const s = l.sleep;
          const label = lit(s.event.id);
          const meta = [spanRange(s.from, s.to, dayStart), awakeOf(s.event.id)].filter(Boolean).join(' · ');
          return (
            <Row
              key={l.key}
              time={hhmm(s.from)}
              tile={
                <View style={[styles.tile, { backgroundColor: c.ink }]}>
                  <ZzIcon size={18} color={c.onInk} />
                </View>
              }
              title={sleepTitle(s, now)}
              meta={meta}
              gap={null}
              highlight={label}
              aria={`${hhmm(s.from)} ${sleepTitle(s, now)}, ${meta}`}
              onPress={() => onOpenSleep(s)}
            />
          );
        }
        const it = l.item;
        const x = info(it);
        // 시작과 끝이 다른 것만(모유) — 분유처럼 한 때인 것은 시각이 이미 왼쪽에 있다
        const end = it.type === 'feed' && it.session.endAt ? new Date(it.session.endAt).getTime() : it.type === 'routine' ? it.end : null;
        const range = end !== null && end - it.at >= MIN ? spanRange(it.at, end, dayStart) : null;
        const meta = [range, x.stool ? STOOL_COLOR_LABEL[x.stool] : null, x.by].filter(Boolean).join(' · ');
        const gap = gapOf(it.key);
        return (
          <Fragment key={l.key}>
            <Row
              time={hhmm(it.at)}
              tile={
                <View style={[styles.tile, nodeTone(x.kind, c), x.kind === 'pee' || x.kind === 'poo' || x.kind === 'both' ? styles.round : null]}>
                  <NodeIcon kind={x.kind} title={x.title} stool={x.stool} size={18} />
                </View>
              }
              title={x.title}
              meta={meta}
              gap={gap}
              highlight={lit(it.key)}
              done={x.kind === 'routine' || x.kind === 'todo'}
              aria={`${hhmm(it.at)} ${x.title}${meta ? `, ${meta}` : ''}${gap ? `, 앞 기록과 ${gap.replace('+', '')} 간격` : ''}`}
              onPress={() => onOpenItem(l.block, it.key)}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

function Row({
  time,
  tile,
  title,
  meta,
  gap,
  highlight,
  done = false,
  aria,
  onPress,
}: {
  time: string;
  tile: ReactNode;
  title: string;
  meta: string;
  gap: string | null;
  highlight: string | null;
  done?: boolean;
  aria: string;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={aria}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.surface : c.card, borderBottomColor: c.border },
        highlight ? { borderColor: c.accent, borderWidth: 2, borderRadius: 14, marginHorizontal: 8, marginVertical: 4 } : null,
      ]}>
      <ThemedText type="label" style={[styles.time, { color: c.textSecondary }]}>
        {time}
      </ThemedText>
      <View>
        {tile}
        {done && (
          <View pointerEvents="none" style={[styles.badge, { backgroundColor: c.ink, borderColor: c.card }]}>
            <Ionicons name="checkmark" size={9} color={c.onInk} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        {highlight ? (
          <View style={[styles.tag, { backgroundColor: c.accent }]}>
            <ThemedText type="caption" style={{ color: c.onInk, fontWeight: 700 }}>
              {highlight}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText type="heading" numberOfLines={2} style={styles.title}>
          {title}
        </ThemedText>
        {meta ? (
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      {gap ? (
        <ThemedText type="caption" style={[styles.gap, { color: c.accentText }]}>
          {gap}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** 흐름 | 목록 전환 — 흐름 맨 위 오른쪽 */
export function ViewToggle({ mode, onChange }: { mode: 'flow' | 'list'; onChange: (m: 'flow' | 'list') => void }) {
  const c = useTheme();
  const item = (key: 'flow' | 'list', icon: 'git-network-outline' | 'list-outline', label: string) => {
    const on = mode === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}으로 보기`}
        hitSlop={4}
        onPress={() => {
          if (on) return;
          tap();
          onChange(key);
        }}
        style={[styles.toggleItem, on && [styles.toggleOn, { backgroundColor: c.card }]]}>
        <Ionicons name={icon} size={14} color={on ? c.text : c.textSecondary} />
        <ThemedText type="caption" style={{ color: on ? c.text : c.textSecondary, fontWeight: on ? 700 : 500 }}>
          {label}
        </ThemedText>
      </Pressable>
    );
  };
  return (
    <View style={[styles.toggle, { backgroundColor: c.surfaceStrong }]}>
      {item('flow', 'git-network-outline', '흐름')}
      {item('list', 'list-outline', '목록')}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  ghost: { opacity: 0.75 },
  time: { width: 42, fontWeight: 600, fontVariant: ['tabular-nums'] },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 20 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 21 },
  gap: { fontWeight: 600, fontVariant: ['tabular-nums'] },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 17, height: 17, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, borderRadius: 9, marginBottom: 2 },
  now: { paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  nowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nowDot: { width: 10, height: 10, borderRadius: 5 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16 },
  quietLine: { flex: 1, height: 1 },
  empty: { paddingVertical: 32, textAlign: 'center' },
  toggle: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 17 },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 14 },
  toggleOn: { shadowColor: '#16161A', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
