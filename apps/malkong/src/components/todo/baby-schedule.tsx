/**
 * 할 일 탭의 「아기 일정」 칸 (SPEC-TOPIC-02 · 07 · 11, task topic/009) — 앱이 채우는 일만 모은다.
 *
 * 접종 · 검진(공공 일정), 기념일 · 사이즈 바꾸기(생일로 계산)를 날짜순으로 「이번 달 · 다음 달 · 그 뒤」에 나눈다.
 * 줄은 내 할 일과 같은 모양 — 동그라미 · 이름 · 작은 이름표와 날짜 · 오른쪽 D-day. 아직 목록에 생기지 않은 앞날 일정은 동그라미 대신 달력.
 * 접종 · 검진의 동그라미는 무엇을 했는지 고르는 시트를 연다.
 * 맨 위 「지난 일정」에는 지난달까지 기한이었는데 아직 안 한 앱 할 일(「지남」)을 두고, 놓친 접종 · 검진은 그 아래 「지난 접종 · 검진 N개 보기」로 접어 둔다(task common/026).
 * 줄을 만드는 일(`useBabyRows`)과 줄 모양(`BabyRow`)은 홈 「다가오는 일」 카드도 같이 쓴다(SPEC-MAIN-08, task today/007).
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { Card, SectionHeader, tap } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { birthOf, upcomingAuto } from '@/data/auto-todos';
import { useBaby } from '@/data/baby-context';
import { monthStart, todoOf, whenText } from '@/data/briefing';
import { checkupGroups } from '@/data/checkup-todos';
import { dueLabel } from '@/data/due-parse';
import { useRecords } from '@/data/records-context';
import type { GapGroup } from '@/data/timeline';
import type { Todo, TopicKind } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { ddayText } from '@/data/upcoming';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const TAGS: Partial<Record<TopicKind, string>> = { milestone: '기념일', size: '사이즈' };
/** 「그 뒤」는 이만큼까지 */
const LATER_LIMIT = 4;

export type BabyRowData = {
  key: string;
  at: number;
  title: string;
  tag: string;
  meta: string;
  /** 「D-3」 「지금」 */
  right: string | null;
  /** 아직 목록에 없는 앞날 일정 — 체크할 수 없다 */
  future: boolean;
  group?: GapGroup;
  todo?: Todo;
};

/** 오늘 챙길 아기 일정 수 — 칸 이름 옆 숫자 */
export function useBabyScheduleCount(): number {
  const { age } = useBaby();
  const { records } = useRecords();
  const { topics, todos } = useTodos();
  const month = age?.month ?? 0;
  const auto = new Set(topics.filter((t) => t.kind === 'milestone' || t.kind === 'size').map((t) => t.id));
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const open = checkupGroups(records, month).filter((g) => g.status === 'open').length;
  const due = todos.filter((t) => auto.has(t.topicId) && !t.doneAt && t.dueAt && new Date(t.dueAt).getTime() < end).length;
  return open + due;
}

/**
 * 아기 일정 줄 — 날짜순 줄(`at` 은 그날 0시, 지금 기간인 접종 · 검진은 어제)과 놓친 접종 · 검진,
 * 동그라미 · 이름을 누를 때의 흐름, 그때 여는 시트(`sheets` 를 화면에 한 번 둔다).
 */
export function useBabyRows(now: Date) {
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, toggleDone, update, remove, autoRemoved } = useTodos();
  const markDone = useMarkDone();
  const [editing, setEditing] = useState<Todo | null>(null);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = age ? checkupGroups(records, age.month) : [];
  const kindOf = new Map(topics.map((t) => [t.id, t.kind]));
  const autoTodos = todos.filter((t) => (kindOf.get(t.topicId) === 'milestone' || kindOf.get(t.topicId) === 'size') && !t.doneAt);
  const have = new Set([...todos.map((t) => t.ref).filter((r): r is string => !!r), ...autoRemoved]);

  const rows: BabyRowData[] =
    !baby || !age
      ? []
      : [
          ...groups
            .filter((g) => g.status === 'open' || g.status === 'soon')
            .map((g) => {
              const w = whenText(todoOf(g), baby.birthDate, age.month, now);
              const at = monthStart(baby.birthDate, g.month).getTime();
              return {
                key: g.key,
                at: Math.max(at, g.status === 'open' ? today - 1 : at),
                title: g.label,
                tag: todoOf(g).category,
                // 지금 기간인 것은 「이번 달」 — 「0개월부터」처럼 읽히지 않게
                meta: g.status === 'open' && g.month < age.month ? '이번 달' : w.text,
                right: g.status === 'open' ? '지금' : ddayText(at, today),
                future: false,
                group: g,
              };
            }),
          ...autoTodos.map((t) => {
            const at = t.dueAt ? new Date(t.dueAt).getTime() : today;
            return {
              key: t.id,
              at,
              title: t.title,
              tag: TAGS[kindOf.get(t.topicId) as TopicKind] ?? '',
              meta: t.dueAt ? dueLabel(new Date(t.dueAt), t.hasTime, now) : '',
              right: t.dueAt ? (ddayText(at, today) ?? '지남') : null,
              future: false,
              todo: t,
            };
          }),
          ...(['milestone', 'size'] as const).flatMap((k) =>
            upcomingAuto(k, birthOf(baby.birthDate), now, have).map((u) => ({
              key: u.rule.ref,
              at: u.due.getTime(),
              title: u.rule.title,
              tag: TAGS[k] ?? '',
              meta: dueLabel(u.due, false, now),
              right: ddayText(u.due.getTime(), today),
              future: true,
            })),
          ),
        ].sort((a, b) => a.at - b.at);
  const missed = groups.filter((g) => g.status === 'missed');

  const check = (r: BabyRowData) => {
    if (r.group) markDone.pick(r.group);
    else if (r.todo) {
      tap('success');
      void toggleDone(r.todo.id);
    }
  };
  const open = (r: BabyRowData) => {
    if (r.group) markDone.pick(r.group);
    else if (r.todo) setEditing(r.todo);
  };

  const sheets = (
    <>
      {markDone.sheet}
      <TodoSheet
        key={editing?.id ?? 'none'}
        todo={editing}
        topics={topics.filter((t) => !t.hidden)}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) void update(editing.id, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) void remove(editing.id);
          setEditing(null);
        }}
      />
    </>
  );

  return { rows, missed, today, check, open, sheets };
}

export function BabySchedule() {
  const c = useTheme();
  const now = useNow(false);
  const { rows, missed, check, open, sheets } = useBabyRows(now);
  const [showPast, setShowPast] = useState(false);

  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const next1 = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const next2 = new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime();
  // 지난달까지 기한이었던 앱 할 일은 「이번 달」이 아니라 「지난 일정」에
  const overdue = rows.filter((r) => r.todo && r.at < thisStart);
  const thisMonth = rows.filter((r) => r.at < next1 && !overdue.includes(r));
  const nextMonth = rows.filter((r) => r.at >= next1 && r.at < next2);
  const later = rows.filter((r) => r.at >= next2).slice(0, LATER_LIMIT);

  const section = (title: string, list: BabyRowData[]): ReactNode =>
    list.length > 0 && (
      <View style={styles.section}>
        <SectionHeader title={title} />
        <Card style={styles.rows}>
          {list.map((r, i) => (
            <BabyRow key={r.key} row={r} divider={i > 0} onCheck={() => check(r)} onOpen={() => open(r)} />
          ))}
        </Card>
      </View>
    );

  return (
    <>
      {rows.length === 0 && missed.length === 0 ? (
        <Card>
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            다가오는 아기 일정이 없어요
          </ThemedText>
        </Card>
      ) : null}
      {section('지난 일정', [
        ...overdue,
        ...(showPast
          ? missed.map((g) => ({
              key: g.key,
              at: 0,
              title: g.label,
              tag: todoOf(g).category,
              meta: '했다면 체크해 주세요',
              right: null,
              future: false,
              group: g,
            }))
          : []),
      ])}
      {missed.length > 0 && !showPast && (
        <Pressable accessibilityRole="button" onPress={() => setShowPast(true)} style={styles.past}>
          <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
            지난 접종 · 검진 {missed.length}개 보기
          </ThemedText>
        </Pressable>
      )}
      {section('이번 달', thisMonth)}
      {section('다음 달', nextMonth)}
      {section('그 뒤', later)}

      {sheets}
    </>
  );
}

/** 아기 일정 한 줄 — 동그라미(앞날 일정은 달력) · 이름 · 작은 이름표와 날짜 · 오른쪽 D-day */
export function BabyRow({ row, divider, onCheck, onOpen }: { row: BabyRowData; divider: boolean; onCheck: () => void; onOpen: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.row, divider && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
      {row.future ? (
        <View style={styles.check}>
          <Ionicons name="calendar-clear-outline" size={22} color={c.textTertiary} />
        </View>
      ) : (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={row.title} hitSlop={8} onPress={onCheck} style={styles.check}>
          <Ionicons name="ellipse-outline" size={24} color={c.text} />
        </Pressable>
      )}
      <Pressable accessibilityRole="button" disabled={row.future} onPress={onOpen} style={({ pressed }) => [styles.text, pressed && { opacity: 0.6 }]}>
        <ThemedText type="body" lineBreakStrategyIOS="hangul-word" style={{ color: row.future ? c.textSecondary : c.text }}>
          {row.title}
        </ThemedText>
        <View style={styles.meta}>
          {row.tag ? (
            <View style={[styles.tag, { backgroundColor: c.surface }]}>
              <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600, fontSize: 11 }}>
                {row.tag}
              </ThemedText>
            </View>
          ) : null}
          {row.meta ? (
            <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
              {row.meta}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      {row.right ? (
        <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
          {row.right}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  rows: { paddingVertical: 2 },
  empty: { paddingVertical: Spacing.three },
  past: { alignSelf: 'center', paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 },
  check: { paddingVertical: 10 },
  text: { flex: 1, gap: 3, paddingVertical: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { height: 18, paddingHorizontal: 6, borderRadius: 9, justifyContent: 'center' },
});
