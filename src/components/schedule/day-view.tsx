import { StyleSheet, View } from 'react-native';

import { BriefingCard } from '@/components/briefing-card';
import { MonthlyCard, WeeklyCard } from '@/components/schedule/period-cards';
import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Card, CardSection, Folded, ListRow, Tag } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ageFrom } from '@/data/baby';
import { todoOf } from '@/data/briefing';
import { dayKey, type MalkongMessage } from '@/data/chat';
import type { InboxCard } from '@/data/inbox';
import { coveredIds, fromDayKey, groupsToMark, type DayIndex } from '@/data/schedule';
import type { BabyRecord } from '@/data/records';
import { labelByKind, type GapGroup } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 달력에서 고른 날 (SPEC-GROW-01 고르기) — 그날의 데일리 · 주간 · 월간 브리핑 · 그날 무렵인 일정 · 그날 생긴 기록.
 * 지난날은 남은 것만, 앞날은 일정만 보인다. 일정은 거기서 바로 완료를 알린다(SPEC-HOME-02).
 */
export function DayView({
  date,
  today,
  birthDate,
  currentMonth,
  index,
  records,
  briefing,
  periods,
  onPick,
}: {
  date: Date;
  today: Date;
  birthDate: string;
  currentMonth: number;
  index: DayIndex;
  records: BabyRecord[];
  /** 그날의 데일리 브리핑 — 앱을 연 날에만 있다 */
  briefing: MalkongMessage | null;
  /** 그날 온 주간 · 월간 브리핑(알림함 줄) */
  periods: InboxCard[];
  onPick: (group: GapGroup) => void;
}) {
  const c = useTheme();
  const key = dayKey(date.toISOString());
  const isToday = key === dayKey(today.toISOString());
  const diff = Math.round((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  const dplus = ageFrom(birthDate, date).days;
  const due = index.due.get(key) ?? [];
  const covered = coveredIds(records);
  const open = groupsToMark(due, covered, currentMonth);
  const doneDue = due.filter((i) => covered.has(i.id));
  const written = index.records.get(key) ?? [];
  const nothing = !briefing && periods.length === 0 && due.length === 0 && written.length === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ThemedText type="heading" style={styles.flex}>
          {date.getMonth() + 1}월 {date.getDate()}일 {WEEKDAYS[date.getDay()]}요일
        </ThemedText>
        {isToday ? <Tag label="오늘" tone="accent" /> : <Tag label={diff > 0 ? `D-${diff}` : `${-diff}일 전`} />}
        {dplus >= 0 && (
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            D+{dplus}
          </ThemedText>
        )}
      </View>

      {briefing && <BriefingCard message={briefing} today={isToday} onPick={onPick} />}
      {periods.map((card) =>
        card.kind === 'weekly' && card.day ? (
          <WeeklyCard key={card.id} monday={fromDayKey(card.day) ?? date} onPick={onPick} />
        ) : card.kind === 'monthly' ? (
          <MonthlyCard key={card.id} month={Number(card.id.replace('monthly-', ''))} onPick={onPick} />
        ) : null,
      )}

      {due.length > 0 && (
        <Card style={styles.list}>
          <CardSection title="이날 무렵 일정" aside={`${due.length}`} first>
            <Folded>
              {open.map((g, i) => (
                <TodoRow key={g.key} todo={todoOf(g)} birthDate={birthDate} currentMonth={currentMonth} divider={i > 0} onPick={() => onPick(g)} />
              ))}
            </Folded>
            {doneDue.length > 0 && (
              <TodoRow
                todo={todoOf({ key: `done-${key}`, status: 'open', month: currentMonth, label: labelByKind(doneDue), items: doneDue })}
                birthDate={birthDate}
                currentMonth={currentMonth}
                done
                divider={open.length > 0}
                onPick={() => undefined}
              />
            )}
          </CardSection>
        </Card>
      )}

      {written.length > 0 && (
        <Card style={styles.list}>
          <CardSection title="이날 남긴 기록" aside={`${written.length}`} first>
            <Folded>
              {written.map((r, i) => (
                <ListRow key={r.id} divider={i > 0} icon="checkmark-done-outline" title={r.label} detail={r.whenLabel} />
              ))}
            </Folded>
          </CardSection>
        </Card>
      )}

      {nothing && (
        <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
          {diff > 0 ? '이날은 아직 잡힌 일정이 없어요' : '이날은 남은 브리핑도 기록도 없어요'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  list: { paddingVertical: 4 },
  empty: { paddingVertical: Spacing.two },
});
