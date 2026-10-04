import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Card } from '@/components/ui';
import { ageFrom } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { monthlyBriefing, weeklyBriefing } from '@/data/period-briefing';
import { usePreferences } from '@/data/preferences-context';
import { useRecords } from '@/data/records-context';
import { coveredIds, groupsToMark } from '@/data/schedule';
import { getGaps, groupGaps, labelByKind, type GapGroup, type L1Item } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

const md = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

function Head({ kind, range, title }: { kind: string; range: string; title: string }) {
  const c = useTheme();
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
          {kind}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {range}
        </ThemedText>
      </View>
      <ThemedText type="heading">{title}</ThemedText>
    </View>
  );
}

function Section({ title }: { title: string }) {
  const c = useTheme();
  return (
    <ThemedText type="caption" style={[styles.section, { color: c.textSecondary, borderTopColor: c.divider }]}>
      {title}
    </ThemedText>
  );
}

/** 할 것 줄 — 남은 것은 완료 알리기, 한 것은 흐리게 한 줄 */
function ItemRows({ items, onPick, empty }: { items: L1Item[]; onPick: (g: GapGroup) => void; empty: string }) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  if (!baby) return null;
  const currentMonth = ageFrom(baby.birthDate).month;
  const covered = coveredIds(records);
  const open = groupsToMark(items, covered, currentMonth);
  const done = items.filter((i) => covered.has(i.id));
  if (items.length === 0) {
    return (
      <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
        {empty}
      </ThemedText>
    );
  }
  return (
    <>
      {open.map((g, i) => (
        <TodoRow key={g.key} todo={todoOf(g)} birthDate={baby.birthDate} currentMonth={currentMonth} divider={i > 0} onPick={() => onPick(g)} />
      ))}
      {done.length > 0 && (
        <TodoRow
          todo={todoOf({ key: 'done', status: 'open', month: done[0].months[0], label: labelByKind(done), items: done })}
          birthDate={baby.birthDate}
          currentMonth={currentMonth}
          done
          divider={open.length > 0}
          onPick={() => undefined}
        />
      )}
    </>
  );
}

/** 주간 브리핑 (SPEC-HOME-08 주간) — 그 주(월~일)에 무렵인 일정과 아직 안 한 것 */
export function WeeklyCard({ monday, onPick }: { monday: Date; onPick: (g: GapGroup) => void }) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  if (!baby) return null;
  const currentMonth = ageFrom(baby.birthDate).month;
  const week = weeklyBriefing(monday, baby.birthDate, records, currentMonth);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return (
    <Card style={styles.card}>
      <Head kind="주간 브리핑" range={`${md(monday)} ~ ${md(sunday)}`} title="이번 주 일정" />
      <Section title="이번 주 무렵" />
      <ItemRows items={week.due} onPick={onPick} empty="이번 주에 무렵인 접종 · 검진은 없어요" />
      {week.left.length > 0 && (
        <>
          <Section title="아직 안 한 것" />
          {week.left.map((g, i) => (
            <TodoRow key={g.key} todo={todoOf(g)} birthDate={baby.birthDate} currentMonth={currentMonth} divider={i > 0} onPick={() => onPick(g)} />
          ))}
        </>
      )}
      <ThemedText type="caption" style={[styles.foot, { color: c.textTertiary }]}>
        날짜는 생일로 계산한 무렵이에요
      </ThemedText>
    </Card>
  );
}

/** 월간 브리핑 (SPEC-HOME-08 월간) — 이번 달 챙길 것 · 발달 포인트 · 다음 달 미리 보기 */
export function MonthlyCard({ month, onPick }: { month: number; onPick: (g: GapGroup) => void }) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  const { scheduleOnly } = usePreferences();
  if (!baby) return null;
  const m = monthlyBriefing(month, baby.birthDate, records, { scheduleOnly });
  const currentMonth = ageFrom(baby.birthDate).month;
  // 지금 달의 월간이면 지난 달에서 남은 것도 — 놓친 것은 단정하지 않고 묻는다(SPEC-HOME-02)
  const leftover =
    month === currentMonth
      ? groupGaps(getGaps(currentMonth, records, { scheduleOnly }).filter((g) => g.status !== 'soon' && g.item.months[0] < month))
      : [];
  const nextStart = new Date(m.start.getFullYear(), m.start.getMonth() + 1, m.start.getDate());
  return (
    <Card style={styles.card}>
      <Head
        kind="월간 브리핑"
        range={`${md(m.start)}부터`}
        title={month === 0 ? '세상에 온 첫 달' : `${month}개월이 됐어요${m.headline ? ` — ${m.headline}` : ''}`}
      />
      <Section title="이번 달 챙길 것" />
      <ItemRows items={m.items} onPick={onPick} empty="이번 달에 새로 시작하는 챙길 것은 없어요" />
      {leftover.length > 0 && (
        <>
          <Section title="아직 안 한 것" />
          {leftover.map((g, i) => (
            <TodoRow key={g.key} todo={todoOf(g)} birthDate={baby.birthDate} currentMonth={currentMonth} divider={i > 0} onPick={() => onPick(g)} />
          ))}
        </>
      )}
      <Section title="이번 달 발달 포인트" />
      {m.points.length > 0 ? (
        m.points.map((p) => (
          <View key={p.id} style={styles.point}>
            <View style={[styles.dot, { backgroundColor: c.accent }]} />
            <ThemedText type="small" style={styles.flex}>
              {p.title}
            </ThemedText>
          </View>
        ))
      ) : (
        <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
          {m.pointsNote ?? '이 월령의 발달 포인트는 아직 준비 중이에요'}
        </ThemedText>
      )}
      {m.next.length > 0 && (
        <>
          <Section title="다음 달 미리 보기" />
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            {month + 1}개월({md(nextStart)} 무렵) · {labelByKind(m.next)}
          </ThemedText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { paddingVertical: 4 },
  head: { gap: 2, paddingTop: 12, paddingBottom: 4 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: {
    fontWeight: 600,
    paddingTop: 12,
    paddingBottom: 2,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  empty: { paddingVertical: 10 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  foot: { paddingVertical: 10 },
});

