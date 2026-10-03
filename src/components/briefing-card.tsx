/**
 * 아침 브리핑 (SPEC-HOME-06, task home/004 · 005 · 006).
 * - `BriefingSummary` — 대화 속에는 요약만: 「오늘의 브리핑이 도착했어요」 + 남은 수 + 「확인하러 가기」
 * - `BriefingCard` — 브리핑함의 자세한 카드. 두 묶음: ① 챙길 것(할 일) ② 하루 기록(어제 수유량 · 수유 간격 · 몸무게 · 특이사항)
 * 했는지는 저장된 목록이 아니라 지금의 기록(L2)으로 센다 — 어디서 완료해도 같은 모습이 보인다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Button, Card, ListRow, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ageFrom } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { todoDone, todosOf, type BriefingTodo } from '@/data/briefing';
import { logsFor, valueOf, type LogEntry, type LogKey } from '@/data/daily-log';
import type { MalkongMessage } from '@/data/chat';
import { itemById } from '@/data/l1';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';
import type { GapGroup, L1Item } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const LOG_ICONS: Record<LogKey, IconName> = {
  'feed-total': 'water-outline',
  'feed-interval': 'time-outline',
  weight: 'trending-up-outline',
  note: 'create-outline',
};

export function groupOf(todo: BriefingTodo): GapGroup {
  return {
    key: todo.key,
    status: todo.status,
    month: todo.month,
    label: todo.label,
    items: todo.itemIds.map((id) => itemById(id)).filter((i): i is L1Item => !!i),
  };
}

/** 하루 기록 한 줄 — 적었으면 값, 아직이면 「적기」. 글 기록(특이사항)은 값을 줄 아래에 */
function LogRow({ entry, divider, onPress }: { entry: LogEntry; divider: boolean; onPress?: () => void }) {
  const c = useTheme();
  const { def, record } = entry;
  const value = record ? valueOf(def, record) : null;
  const text = def.unit === null;
  return (
    <ListRow
      divider={divider}
      icon={record ? 'checkmark' : LOG_ICONS[def.key]}
      title={def.title}
      detail={value === null ? def.hint : text ? value : null}
      onPress={onPress}
      right={
        value !== null ? (
          text ? undefined : (
            <ThemedText type="body" style={{ fontWeight: 700, color: c.text }}>
              {value}
            </ThemedText>
          )
        ) : onPress ? (
          <Button label="적기" size="sm" variant="secondary" onPress={onPress} />
        ) : null
      }
    />
  );
}

function SectionHead({ title, note, first }: { title: string; note?: string | null; first: boolean }) {
  const c = useTheme();
  return (
    <View style={[styles.section, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}>
      <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600 }}>
        {title}
      </ThemedText>
      {note ? (
        <ThemedText type="caption" style={{ color: c.textTertiary }}>
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** 대화 속 브리핑 — 요약만. 누르면 브리핑함에서 자세히 본다. 오늘 것은 인사와 함께, 지난 것은 한 줄 */
export function BriefingSummary({
  message,
  today,
  onOpen,
}: {
  message: MalkongMessage;
  today: boolean;
  onOpen: () => void;
}) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  if (message.meta.type !== 'briefing' || !baby) return null;
  const { greeting, headline, items } = message.meta;
  const made = new Date(message.createdAt);
  const { month } = ageFrom(baby.birthDate, made);
  const todos = todosOf(items);
  const left = todos.filter((t) => !todoDone(t, records));
  const logs = logsFor(made, records);
  const logged = logs.filter((l) => l.record).length;

  if (!today) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.pastRow, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.background }]}>
        <Ionicons name="file-tray-outline" size={18} color={c.textSecondary} />
        <ThemedText type="small" style={[styles.flex, { color: c.textSecondary }]}>
          {made.getMonth() + 1}월 {made.getDate()}일 브리핑 · 챙길 것 {todos.length - left.length}/{todos.length} · 하루 기록{' '}
          {logged}/{logs.length}
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
      </Pressable>
    );
  }

  const todoLine =
    todos.length === 0
      ? '오늘은 챙길 게 없어요'
      : left.length === 0
        ? `${todos.length}개 모두 했어요`
        : left.length === 1
          ? left[0].label
          : `${left[0].label} 외 ${left.length - 1}개`;
  const date = `${made.getMonth() + 1}월 ${made.getDate()}일 ${WEEKDAYS[made.getDay()]}요일`;

  return (
    <View style={styles.wrap}>
      <View style={styles.hello}>
        <ThemedText type="display" style={styles.greeting}>
          {greeting}.{'\n'}
          {headline}
        </ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {date} · 만 {month}개월
        </ThemedText>
      </View>
      <Card style={styles.summary}>
        <View style={styles.summaryHead}>
          <View style={[styles.mailIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="mail-unread-outline" size={20} color={c.accent} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="heading">오늘의 브리핑이 도착했어요</ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              버디가 정리했어요
            </ThemedText>
          </View>
        </View>
        <View style={[styles.summaryLines, { backgroundColor: c.surface }]}>
          <SummaryLine
            icon="checkbox-outline"
            title="챙길 것"
            value={todos.length === 0 ? '없음' : left.length === 0 ? '완료' : `${left.length}개 남음`}
            detail={todoLine}
            done={left.length === 0}
          />
          <SummaryLine
            icon="create-outline"
            title="하루 기록"
            value={`${logged}/${logs.length}`}
            detail={logged === logs.length ? '오늘 기록 끝!' : '어제 수유량 · 수유 간격 · 몸무게 · 특이사항'}
            done={logged === logs.length}
          />
        </View>
        <Button label="확인하러 가기" icon="arrow-forward" onPress={onOpen} />
      </Card>
    </View>
  );
}

function SummaryLine({
  icon,
  title,
  value,
  detail,
  done,
}: {
  icon: IconName;
  title: string;
  value: string;
  detail: string;
  done: boolean;
}) {
  const c = useTheme();
  return (
    <View style={styles.summaryLine}>
      <Ionicons name={done ? 'checkmark-circle' : icon} size={18} color={done ? c.textSecondary : c.text} />
      <View style={styles.flex}>
        <ThemedText type="body" style={{ fontWeight: 600 }}>
          {title}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
      <ThemedText type="label" style={{ fontWeight: 700, color: done ? c.textSecondary : c.accentText }}>
        {value}
      </ThemedText>
    </View>
  );
}

export function BriefingCard({
  message,
  today,
  onPick,
  onLog,
  justSaved,
  onUndo,
}: {
  message: MalkongMessage;
  /** 오늘 것 — 하루 기록을 적을 수 있다. 지난 것은 적은 기록만 보인다 */
  today: boolean;
  onPick: (group: GapGroup) => void;
  /** 하루 기록 줄을 누르면 */
  onLog?: (entry: LogEntry) => void;
  justSaved?: BabyRecord | null;
  onUndo?: () => void;
}) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  if (message.meta.type !== 'briefing' || !baby) return null;
  const { headline, items } = message.meta;
  const made = new Date(message.createdAt);
  const todos = todosOf(items);
  const doneTodos = todos.filter((t) => todoDone(t, records)).length;
  // 하루 기록은 그날만 적는다 — 지난 브리핑에는 적어 둔 것만 남는다
  const logs = logsFor(made, records).filter((l) => today || l.record);
  const logsLeft = logs.filter((l) => !l.record).length;

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
            {today ? '오늘의 브리핑' : `${made.getMonth() + 1}월 ${made.getDate()}일 브리핑`}
          </ThemedText>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {today ? '버디가 정리했어요' : headline}
          </ThemedText>
        </View>
        <SectionHead title="챙길 것" note={todos.length > 0 ? `${doneTodos}/${todos.length}` : null} first />
        {todos.length > 0 ? (
          todos.map((todo, i) => (
            <TodoRow
              key={todo.key}
              todo={todo}
              birthDate={baby.birthDate}
              currentMonth={ageFrom(baby.birthDate).month}
              done={todoDone(todo, records)}
              divider={i > 0}
              onPick={() => onPick(groupOf(todo))}
            />
          ))
        ) : (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            지금은 챙길 게 없어요. 궁금한 게 생기면 언제든 물어보세요
          </ThemedText>
        )}
        {justSaved && (
          <View style={[styles.saved, { backgroundColor: c.surface }]}>
            <ThemedText type="caption" style={{ flex: 1 }}>
              「{justSaved.label}」로 기록했어요
            </ThemedText>
            {onUndo && (
              <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button">
                <ThemedText type="label" style={{ fontWeight: 700 }}>
                  되돌리기
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
        {logs.length > 0 && (
          <>
            <SectionHead
              title="하루 기록"
              note={today ? (logsLeft > 0 ? '적어 두면 버디가 되묻지 않고 바로 답해요' : '오늘 기록 끝!') : null}
              first={false}
            />
            {logs.map((entry, i) => (
              <LogRow
                key={entry.def.key}
                entry={entry}
                divider={i > 0}
                onPress={today && onLog ? () => onLog(entry) : undefined}
              />
            ))}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  hello: { gap: 6, paddingTop: Spacing.two },
  greeting: { fontSize: 26, lineHeight: 35 },
  card: { paddingVertical: 4 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: 10,
    paddingBottom: 4,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: 12,
    paddingBottom: 2,
  },
  empty: { paddingVertical: 12 },
  flex: { flex: 1 },
  summary: { gap: Spacing.three, paddingVertical: Spacing.three },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mailIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summaryLines: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
});
