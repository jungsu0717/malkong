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

import { LOG_ICONS } from '@/components/record-nudge-card';
import { ThemedText } from '@/components/themed-text';
import { kindColor, TodoRow } from '@/components/todo-row';
import { Button, Card, CardSection, Chip, Folded, ListRow, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { ageFrom } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { briefingSummary, tipTitle, todoDone, todoOf, todosOf, type BriefingTodo } from '@/data/briefing';
import type { CareCheck, ParentCheck, SuggestKey } from '@/data/care-signals';
import { dayKey, type MalkongMessage } from '@/data/chat';
import { DAILY_LOGS, latestLog, suggestAsk, valueOf, writtenAgo } from '@/data/daily-log';
import type { InboxCard } from '@/data/inbox';
import { useInbox } from '@/data/inbox-context';
import { itemById } from '@/data/l1';
import { useRecords } from '@/data/records-context';
import { coveredIds, dueDate, groupsToMark, inboxCardHref } from '@/data/schedule';
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
        <>
          <ThemedText type="small" style={{ color: c.accentText }}>
            {chosen.label} · {chosen.reply}
          </ThemedText>
          {/* 부모 돌봄 L1 — 승인된 것만 나온다(의료 게이트, task common/013) */}
          {(chosen.tips ?? [])
            .map((id) => itemById(id))
            .filter((tip): tip is L1Item => !!tip)
            .map((tip) => (
              <View key={tip.id} style={[styles.warn, { borderTopColor: c.border }]}>
                <Ionicons name={tip.red_flag ? 'alert-circle-outline' : 'leaf-outline'} size={15} color={c.accentText} />
                <ThemedText type="caption" style={[styles.flex, { color: c.accentText }]}>
                  {tip.title} · {tip.source.name}
                </ThemedText>
              </View>
            ))}
        </>
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

/** 그날 온 주간 · 월간 줄의 짧은 이름 — 「이번 주 일정」 「5개월 일정」 */
function periodLabel(card: InboxCard): string {
  return card.kind === 'weekly' ? '이번 주 일정' : `${card.id.replace('monthly-', '')}개월 일정`;
}

/** 요약 카드의 한 줄 — 내용 문장이 제목, 종류 · 시점이 작은 글씨 */
type SummaryRow = {
  key: string;
  icon: IconName;
  color?: string;
  title: string;
  detail: string;
  onPress?: () => void;
};

/**
 * 대화 속 브리핑 — 인사 · 안부 · 「오늘 브리핑」 요약. 오늘 것만 크게, 지난 것은 한 줄. 누르면 일정 탭의 그날.
 * 요약은 내용 문장을 줄이지 않고 한 줄씩 보인다 — 「도착했어요」 같은 알림 문구를 되풀이하지 않는다(task home/010)
 */
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

  const rows: SummaryRow[] = [];
  if (todos.length > 0) {
    rows.push({
      key: 'todos',
      icon: 'checkbox-outline',
      title:
        left.length === 0 ? `${todos.length}개 모두 했어요` : left.length === 1 ? left[0].label : `${left[0].label} 외 ${left.length - 1}개`,
      detail: '챙길 것',
    });
  }
  for (const id of briefing.tips ?? []) {
    const tip = itemById(id);
    if (tip) rows.push({ key: id, icon: TIP_ICONS[tip.kind] ?? 'sunny-outline', title: tipTitle(id), detail: `오늘 챙기면 좋을 것 · ${tip.kind}` });
  }
  // 오늘의 기록 — 하루 기록 넷을 브리핑에서 적는다(SPEC-HOME-06 ④). 안부와 이어지는 기록이 있으면 그것부터
  const logsToday = DAILY_LOGS.filter((def) => {
    const last = latestLog(def, records);
    return !!last && dayKey(last.createdAt) === briefing.day;
  }).length;
  rows.push({
    key: 'log',
    icon: 'create-outline',
    title: '오늘의 기록',
    detail: briefing.suggest
      ? `${SUGGEST_NAMES[briefing.suggest]}부터 적어 두면 좋아요`
      : logsToday > 0
        ? `${logsToday}가지 적었어요`
        : '안 적어도 괜찮아요 · 필요하면 대화에서 물어봐요',
    onPress: onOpen,
  });
  const week = (briefing.week ?? []).map((id) => itemById(id)).filter((i): i is L1Item => !!i);
  if (week.length > 0) {
    const due = dueDate(baby.birthDate, week[0]);
    rows.push({
      key: 'week',
      icon: week[0].kind === '검진' ? 'clipboard-outline' : 'medkit-outline',
      color: kindColor(week[0].kind),
      title: labelByKind(week),
      detail: `다가오는 일정 · ${due.getMonth() + 1}월 ${due.getDate()}일 무렵`,
    });
  }
  for (const card of periods) {
    rows.push({
      key: card.id,
      icon: card.kind === 'weekly' ? 'calendar-outline' : 'ribbon-outline',
      title: card.summary,
      detail: periodLabel(card),
      onPress: () => {
        void markRead([card.id]);
        const href = inboxCardHref(card);
        if (href) router.navigate(href);
      },
    });
  }
  const date = `${made.getMonth() + 1}월 ${made.getDate()}일 ${WEEKDAYS[made.getDay()]}요일`;

  return (
    <View style={styles.wrap}>
      <View style={styles.hello}>
        <ThemedText type="display" style={styles.greeting}>
          {briefing.greeting}
        </ThemedText>
        <ThemedText type="heading">{briefing.headline}</ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {date} · 만 {month}개월
        </ThemedText>
      </View>
      <Checks message={message} answerable />
      <Card style={styles.summary}>
        <ThemedText type="caption" style={[styles.summaryLabel, { color: c.textSecondary, fontWeight: 600 }]}>
          오늘 브리핑
        </ThemedText>
        {rows.length > 0 ? (
          rows.map((row, i) => (
            <ListRow
              key={row.key}
              divider={i > 0}
              icon={row.icon}
              iconColor={row.color}
              iconTone={row.onPress ? 'accent' : 'neutral'}
              title={row.title}
              detail={row.detail}
              onPress={row.onPress}
            />
          ))
        ) : (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            오늘은 따로 챙길 게 없어요. 궁금한 게 생기면 언제든 물어보세요
          </ThemedText>
        )}
        <View style={styles.summaryButton}>
          <Button label="자세히 보기" icon="arrow-forward" onPress={onOpen} />
        </View>
      </Card>
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
      <CardSection
        key="todos"
        title="챙길 것"
        aside={`${todos.filter((t) => todoDone(t, records)).length}/${todos.length}`}
        first={sections.length === 0}>
        <Folded>
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
        </Folded>
      </CardSection>,
    );
  }
  if (tips.length > 0) {
    sections.push(
      <CardSection key="tips" title="오늘 챙기면 좋을 것" first={sections.length === 0}>
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
      </CardSection>,
    );
  }
  if (today) {
    // 오늘의 기록 (SPEC-HOME-06 ④ · SPEC-BABY-07) — 안부와 이어지는 기록이 있으면 맨 앞, 그 아래 하루 기록 넷
    const key = briefing.suggest;
    sections.push(
      <CardSection
        key="log"
        title="오늘의 기록"
        note="안 적어도 괜찮아요. 필요하면 대화에서 버디가 물어봐요"
        first={sections.length === 0}>
        {key && (
          <ListRow
            icon="thermometer-outline"
            iconTone="accent"
            title={SUGGEST_NAMES[key]}
            detail={suggestAsk(key).hint}
            right={<Button label="적기" size="sm" variant="secondary" onPress={() => ask(suggestAsk(key))} />}
          />
        )}
        {DAILY_LOGS.map((def, i) => {
          const last = latestLog(def, records);
          return (
            <ListRow
              key={def.key}
              divider={!!key || i > 0}
              icon={LOG_ICONS[def.key]}
              title={def.title}
              detail={last ? `${valueOf(def, last)} · ${writtenAgo(last)} 적음` : def.hint}
              right={<Button label="적기" size="sm" variant="secondary" onPress={() => ask(def)} />}
            />
          );
        })}
      </CardSection>,
    );
  }
  if (weekAll.length > 0) {
    const groups = groupsToMark(weekLeft, covered, currentMonth);
    sections.push(
      <CardSection
        key="week"
        title="다가오는 일정 · 일주일 안"
        aside={weekAll.length > weekLeft.length ? `${weekAll.length - weekLeft.length}/${weekAll.length} 했어요` : null}
        first={sections.length === 0}>
        <Folded>
          {groups.map((g, i) => (
            <TodoRow key={g.key} todo={todoOf(g)} birthDate={baby.birthDate} currentMonth={currentMonth} divider={i > 0} onPick={() => onPick(g)} />
          ))}
        </Folded>
        {groups.length === 0 && (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            다가오는 일정은 다 챙겼어요
          </ThemedText>
        )}
      </CardSection>,
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
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
  tipIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 12 },
  summary: { paddingVertical: 4 },
  summaryLabel: { paddingTop: 10 },
  summaryButton: { paddingTop: Spacing.two, paddingBottom: Spacing.two },
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
