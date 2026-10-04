/**
 * 데일리 브리핑 (SPEC-HOME-06, task home/004 · 006 · 008).
 * - `BriefingSummary` — 대화 속: 인사 · 안부(칩으로 답하기) · 「오늘의 브리핑이 도착했어요」 요약 · 그날 온 주간 · 월간 브리핑 ·
 *   「확인하러 가기」
 * - `BriefingCard` — 일정 탭 고른 날의 자세한 카드: 안부 · 오늘 챙기면 좋을 것 · 기록하면 좋을 것 · 다가오는 일정
 * 했는지는 저장된 목록이 아니라 지금의 기록(L2)으로 센다 — 어디서 완료해도 같은 모습이 보인다.
 * 2026-10-04 전 브리핑은 챙길 것 목록(items)을 들고 있어 그 모양 그대로 그린다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Button, Card, Chip, ListRow, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { ageFrom } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { briefingSummary, tipTitle, todoDone, todoOf, todosOf, type BriefingTodo } from '@/data/briefing';
import type { CareCheck, ParentCheck, SuggestKey } from '@/data/care-signals';
import { dayKey, type MalkongMessage } from '@/data/chat';
import { suggestAsk } from '@/data/daily-log';
import { useInbox } from '@/data/inbox-context';
import { itemById } from '@/data/l1';
import { useRecords } from '@/data/records-context';
import { coveredIds, dueDate, groupsToMark, scheduleDayHref } from '@/data/schedule';
import { labelByKind, type GapGroup, type L1Item } from '@/data/timeline';
import { useBriefingAnswer } from '@/hooks/use-briefing-answer';
import { useQuickAsk } from '@/hooks/use-quick-ask';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const TIP_ICONS: Record<string, IconName> = {
  수유: 'nutrition-outline',
  수면: 'moon-outline',
  생활: 'happy-outline',
  안전: 'shield-checkmark-outline',
};

const SUGGEST_NAMES: Record<SuggestKey, string> = {
  temperature: '체온',
  'feed-total': '어제 총 수유량',
  note: '특이사항',
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

/** 아기 안부 — 묻는 말 · 칩 · 관련 위험 신호 한 줄. 답하면 칩 대신 고른 답 */
function CareCheckView({ care, onAnswer }: { care: CareCheck; onAnswer: ((label: string) => void) | null }) {
  const c = useTheme();
  const warn = care.warnId ? itemById(care.warnId) : null;
  const chosen = care.options.find((o) => o.label === care.answer) ?? null;
  return (
    <View style={[styles.check, { backgroundColor: c.surface }]}>
      <View style={styles.checkHead}>
        <Ionicons name="heart-outline" size={18} color={c.accent} />
        <ThemedText type="body" style={[styles.flex, { fontWeight: 600 }]}>
          {care.question}
        </ThemedText>
      </View>
      {chosen ? (
        <View style={styles.answered}>
          <Ionicons name="checkmark-circle" size={16} color={c.textSecondary} />
          <ThemedText type="small" style={[styles.flex, { color: c.textSecondary }]}>
            {chosen.label}
            {chosen.prefill ? ' — 대화창에 담았어요. 이어서 말해 주세요' : chosen.record ? ' — 기록했어요' : ''}
          </ThemedText>
        </View>
      ) : onAnswer ? (
        <View style={styles.chips}>
          {care.options.map((o) => (
            <Chip key={o.label} label={o.label} onPress={() => onAnswer(o.label)} />
          ))}
        </View>
      ) : null}
      {warn && (
        <View style={[styles.warn, { borderTopColor: c.divider }]}>
          <Ionicons name="alert-circle-outline" size={15} color={c.danger} />
          <ThemedText type="caption" style={[styles.flex, { color: c.textSecondary }]}>
            이럴 땐 바로 병원: {warn.title} · {warn.source.name}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

/** 부모 안부 — 친정엄마처럼. 답하면 버디가 한 마디 */
function ParentCheckView({ parent, onAnswer }: { parent: ParentCheck; onAnswer: ((label: string) => void) | null }) {
  const c = useTheme();
  const chosen = parent.options.find((o) => o.label === parent.answer) ?? null;
  return (
    <View style={[styles.check, { backgroundColor: c.accentSoft }]}>
      <View style={styles.checkHead}>
        <Ionicons name="cafe-outline" size={18} color={c.accentText} />
        <ThemedText type="body" style={[styles.flex, { fontWeight: 600, color: c.accentText }]}>
          {parent.question}
        </ThemedText>
      </View>
      {chosen ? (
        <ThemedText type="small" style={{ color: c.accentText }}>
          {chosen.label} · {chosen.reply}
        </ThemedText>
      ) : onAnswer ? (
        <View style={styles.chips}>
          {parent.options.map((o) => (
            <Chip key={o.label} label={o.label} onPress={() => onAnswer(o.label)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 안부 둘 — 대화와 브리핑 카드가 같이 쓴다. 오늘 것만 답할 수 있다 */
function Checks({ message, answerable }: { message: MalkongMessage; answerable: boolean }) {
  const { answerCare, answerParent } = useBriefingAnswer();
  if (message.meta.type !== 'briefing') return null;
  const { care, parent } = message.meta;
  return (
    <>
      {care && (
        <CareCheckView
          care={care}
          onAnswer={
            answerable
              ? (label) => {
                  const option = care.options.find((o) => o.label === label);
                  if (option) void answerCare(message, option);
                }
              : null
          }
        />
      )}
      {parent && (
        <ParentCheckView
          parent={parent}
          onAnswer={
            answerable
              ? (label) => {
                  const option = parent.options.find((o) => o.label === label);
                  if (option) void answerParent(message, option);
                }
              : null
          }
        />
      )}
    </>
  );
}

/** 다가오는 일정 한 줄 — 「DTaP·폴리오 2차 · 10월 29일 무렵」 */
function weekLine(ids: string[], birthDate: string): string | null {
  const items = ids.map((id) => itemById(id)).filter((i): i is L1Item => !!i);
  if (items.length === 0) return null;
  const due = dueDate(birthDate, items[0]);
  return `${labelByKind(items)} · ${due.getMonth() + 1}월 ${due.getDate()}일 무렵`;
}

/** 대화 속 브리핑 — 인사 · 안부 · 요약. 오늘 것만 크게, 지난 것은 한 줄. 누르면 일정 탭의 그날 */
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
  const { cards, markRead } = useInbox();
  if (message.meta.type !== 'briefing' || !baby) return null;
  const briefing = message.meta;
  const made = new Date(message.createdAt);
  const { month } = ageFrom(baby.birthDate, made);
  const todos = todosOf(briefing.items);
  const left = todos.filter((t) => !todoDone(t, records));
  // 그날 함께 온 주간 · 월간 브리핑(SPEC-HOME-08) — 누르면 그 브리핑이 놓인 날로
  const periods = cards.filter((card) => (card.kind === 'weekly' || card.kind === 'monthly') && dayKey(card.createdAt) === briefing.day);

  if (!today) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.pastRow, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.background }]}>
        <Ionicons name="file-tray-outline" size={18} color={c.textSecondary} />
        <ThemedText type="small" style={[styles.flex, { color: c.textSecondary }]} numberOfLines={1}>
          {made.getMonth() + 1}월 {made.getDate()}일 브리핑 · {briefingSummary(briefing)}
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
      </Pressable>
    );
  }

  const tips = briefing.tips ?? [];
  const week = weekLine(briefing.week ?? [], baby.birthDate);
  const lines: { icon: IconName; title: string; detail: string }[] = [];
  if (todos.length > 0) {
    lines.push({
      icon: 'checkbox-outline',
      title: '챙길 것',
      detail:
        left.length === 0 ? `${todos.length}개 모두 했어요` : left.length === 1 ? left[0].label : `${left[0].label} 외 ${left.length - 1}개`,
    });
  }
  if (tips.length > 0) {
    lines.push({
      icon: 'sunny-outline',
      title: '오늘 챙기면 좋을 것',
      detail: tips.length > 1 ? `${tipTitle(tips[0])} 외 ${tips.length - 1}가지` : tipTitle(tips[0]),
    });
  }
  if (briefing.suggest) lines.push({ icon: 'create-outline', title: '기록하면 좋을 것', detail: SUGGEST_NAMES[briefing.suggest] });
  if (week) lines.push({ icon: 'calendar-outline', title: '다가오는 일정', detail: week });
  const date = `${made.getMonth() + 1}월 ${made.getDate()}일 ${WEEKDAYS[made.getDay()]}요일`;

  return (
    <View style={styles.wrap}>
      <View style={styles.hello}>
        <ThemedText type="display" style={styles.greeting}>
          {briefing.greeting}.{'\n'}
          {briefing.headline}
        </ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {date} · 만 {month}개월
        </ThemedText>
      </View>
      <Checks message={message} answerable />
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
        {lines.length > 0 ? (
          <View style={[styles.summaryLines, { backgroundColor: c.surface }]}>
            {lines.map((line) => (
              <View key={line.title} style={styles.summaryLine}>
                <Ionicons name={line.icon} size={18} color={c.text} />
                <View style={styles.flex}>
                  <ThemedText type="caption" style={{ color: c.textSecondary }}>
                    {line.title}
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: 600 }} numberOfLines={1}>
                    {line.detail}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            오늘은 따로 챙길 게 없어요. 궁금한 게 생기면 언제든 물어보세요
          </ThemedText>
        )}
        {periods.map((card) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            onPress={() => {
              void markRead([card.id]);
              if (card.day) router.navigate(scheduleDayHref(card.day));
            }}
            style={({ pressed }) => [styles.period, { borderColor: c.border }, pressed && { opacity: 0.6 }]}>
            <Ionicons name={card.kind === 'weekly' ? 'calendar-outline' : 'ribbon-outline'} size={18} color={c.accent} />
            <View style={styles.flex}>
              <ThemedText type="body" style={{ fontWeight: 600 }}>
                {card.title}
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
                {card.summary}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
          </Pressable>
        ))}
        <Button label="확인하러 가기" icon="arrow-forward" onPress={onOpen} />
      </Card>
    </View>
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

/** 일정 탭 고른 날의 브리핑 — 안부 · 오늘 챙기면 좋을 것(확인) · 기록하면 좋을 것(적기) · 다가오는 일정(완료 알리기) */
export function BriefingCard({
  message,
  today,
  onPick,
}: {
  message: MalkongMessage;
  /** 오늘 것 — 안부에 답하고 적을 수 있다. 지난 것은 남은 모습만 */
  today: boolean;
  onPick: (group: GapGroup) => void;
}) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  const { ask, sheet } = useQuickAsk();
  if (message.meta.type !== 'briefing' || !baby) return null;
  const briefing = message.meta;
  const made = new Date(message.createdAt);
  const currentMonth = ageFrom(baby.birthDate).month;
  const covered = coveredIds(records);
  const todos = todosOf(briefing.items);
  const tips = (briefing.tips ?? []).map((id) => itemById(id)).filter((i): i is L1Item => !!i);
  const weekAll = (briefing.week ?? []).map((id) => itemById(id)).filter((i): i is L1Item => !!i);
  const weekLeft = weekAll.filter((i) => !covered.has(i.id));
  const sections: ReactNode[] = [];

  if (todos.length > 0) {
    sections.push(
      <View key="todos">
        <SectionHead title="챙길 것" note={`${todos.filter((t) => todoDone(t, records)).length}/${todos.length}`} first={sections.length === 0} />
        {todos.map((todo, i) => (
          <TodoRow
            key={todo.key}
            todo={todo}
            birthDate={baby.birthDate}
            currentMonth={currentMonth}
            done={todoDone(todo, records)}
            divider={i > 0}
            onPick={() => onPick(groupOf(todo))}
          />
        ))}
      </View>,
    );
  }
  if (tips.length > 0) {
    sections.push(
      <View key="tips">
        <SectionHead title="오늘 챙기면 좋을 것" first={sections.length === 0} />
        {tips.map((tip, i) => {
          const done = covered.has(tip.id);
          return (
            <View key={tip.id} style={[styles.tip, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.divider }]}>
              <View style={[styles.tipIcon, { backgroundColor: c.surface }]}>
                <Ionicons name={done ? 'checkmark' : (TIP_ICONS[tip.kind] ?? 'sunny-outline')} size={18} color={c.text} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="body" style={{ fontWeight: 600, color: done ? c.textSecondary : c.text }}>
                  {tip.title}
                </ThemedText>
                <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={3}>
                  {tip.body}
                </ThemedText>
                <ThemedText type="caption" style={{ color: c.textTertiary }}>
                  출처 · {tip.source.name}
                </ThemedText>
              </View>
              {!done && today && (
                <Button
                  label="확인"
                  size="sm"
                  variant="secondary"
                  onPress={() => onPick({ key: `tip-${tip.id}`, status: 'open', month: tip.months[0], label: tip.title, items: [tip] })}
                />
              )}
            </View>
          );
        })}
      </View>,
    );
  }
  if (briefing.suggest && today) {
    const key = briefing.suggest;
    sections.push(
      <View key="suggest">
        <SectionHead title="기록하면 좋을 것" note="적어 두면 버디가 흐름을 보고 답해요" first={sections.length === 0} />
        <ListRow
          icon="create-outline"
          title={SUGGEST_NAMES[key]}
          detail={suggestAsk(key).hint}
          right={<Button label="적기" size="sm" variant="secondary" onPress={() => ask(suggestAsk(key))} />}
        />
      </View>,
    );
  }
  if (weekAll.length > 0) {
    const groups = groupsToMark(weekLeft, covered, currentMonth);
    sections.push(
      <View key="week">
        <SectionHead
          title="다가오는 일정 · 7일 안"
          note={weekAll.length > weekLeft.length ? `${weekAll.length - weekLeft.length}/${weekAll.length} 했어요` : null}
          first={sections.length === 0}
        />
        {groups.map((g, i) => (
          <TodoRow key={g.key} todo={todoOf(g)} birthDate={baby.birthDate} currentMonth={currentMonth} divider={i > 0} onPick={() => onPick(g)} />
        ))}
        {groups.length === 0 && (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            다가오는 일정은 다 챙겼어요
          </ThemedText>
        )}
      </View>,
    );
  }

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
            {today ? '오늘의 브리핑' : `${made.getMonth() + 1}월 ${made.getDate()}일 브리핑`}
          </ThemedText>
          <ThemedText type="caption" style={[styles.flex, styles.right, { color: c.textSecondary }]} numberOfLines={1}>
            {today ? '버디가 정리했어요' : briefing.headline}
          </ThemedText>
        </View>
        {(briefing.care || briefing.parent) && (
          <View style={styles.checks}>
            <Checks message={message} answerable={today} />
          </View>
        )}
        {sections}
        {sections.length === 0 && !briefing.care && !briefing.parent && (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            이날은 따로 챙길 게 없었어요
          </ThemedText>
        )}
      </Card>
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  flex: { flex: 1 },
  right: { textAlign: 'right' },
  hello: { gap: 6, paddingTop: Spacing.two },
  greeting: { fontSize: 26, lineHeight: 35 },
  check: { borderRadius: Radius.lg, padding: 14, gap: 10 },
  checkHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  answered: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warn: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 10 },
  card: { paddingVertical: 4 },
  checks: { gap: 10, paddingBottom: 12 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: 10,
    paddingBottom: 8,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: 12,
    paddingBottom: 2,
  },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
  tipIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 12 },
  summary: { gap: Spacing.three, paddingVertical: Spacing.three },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mailIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summaryLines: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  period: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
