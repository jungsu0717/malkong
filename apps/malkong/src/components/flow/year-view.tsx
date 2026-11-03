/**
 * 1년 보기 (SPEC-MAIN-11, task today/013, decisions/037) — 태어난 날부터 돌(돌이 지나면 두 돌)까지 한 줄 흐름.
 *
 * 지난 쪽은 태어난 날 · 지난 기념일 · 완료한 접종 · 검진, 「지금」 노드는 지금 시기의 버디와 키 · 몸무게 · 발달 체크(예전 성장 탭),
 * 그 뒤는 앱이 생일로 채운 아기 일정(예전 할 일 탭의 아기 일정 칸 — 줄과 시트는 `useBabyRows`)과 50일 · 100일 · 돌.
 * 기념일 당일에만 지금 노드에 「기념 카드 보내기」가 있다(SPEC-STAGE-07). 축하 장면은 두지 않는다.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChipButton, FlowRow, FutureCard, type Port, type Segment } from '@/components/flow/flow-node';
import { MoreSheet, type MoreRow } from '@/components/flow/more-sheet';
import { POSES } from '@/components/growth/growth-hero';
import { MilestoneSheet } from '@/components/growth/milestone-card';
import { KIND_UI } from '@/components/log/kinds';
import { useLogActions } from '@/components/log/use-log-actions';
import { ThemedText } from '@/components/themed-text';
import { useBabyRows, type BabyRowData } from '@/components/todo/baby-schedule';
import { Button, tap, type IconName } from '@/components/ui';
import { birthOf, milestoneDays } from '@/data/auto-todos';
import { useBaby } from '@/data/baby-context';
import { todoOf } from '@/data/briefing';
import { latestOf } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { itemById, itemsByIds } from '@/data/l1';
import { useMemos } from '@/data/memos-context';
import { useRecords } from '@/data/records-context';
import { checklistIds, checkpointFor, poseOf, stageWindow } from '@/data/stage';
import { ddayText } from '@/data/upcoming';
import { useTheme } from '@/hooks/use-theme';

const isCheckup = (id: string) => {
  const kind = itemById(id)?.kind;
  return kind === '접종' || kind === '검진';
};
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

const GROWTH_ROWS: MoreRow[] = [
  { title: '몸무게 기록', icon: KIND_UI.weight.icon, action: { kind: 'weight' } },
  { title: '키 기록', icon: KIND_UI.height.icon, action: { kind: 'height' } },
];

type Row = { key: string; port: Port; node: ReactNode; portTop?: number };

export function YearView({ now }: { now: Date }) {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { events } = useEvents();
  const { records } = useRecords();
  const { memos } = useMemos();
  const schedule = useBabyRows(now);
  const log = useLogActions();
  const [showMissed, setShowMissed] = useState(false);
  const [growthSheet, setGrowthSheet] = useState(false);
  const [sharing, setSharing] = useState(false);
  if (!baby || !age) return null;

  const birth = birthOf(baby.birthDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = milestoneDays(birth);
  const firstYear = days.find((d) => d.label === '돌')!.date;
  const end = (today < firstYear.getTime() ? firstYear : days.find((d) => d.label === '두 돌')!.date).getTime();
  const pose = poseOf(age.month);
  const stage = stageWindow(baby.birthDate, now);

  // 지난 쪽 — 태어난 날, 지난 기념일, 완료한 접종 · 검진(기록의 covers)
  const past: { key: string; at: number; title: string; meta: string; done: boolean }[] = [
    { key: 'birth', at: birth.getTime(), title: '태어난 날', meta: md(birth), done: false },
    ...days.filter((d) => d.date.getTime() <= today).map((d) => ({ key: `day-${d.label}`, at: d.date.getTime(), title: d.label, meta: md(d.date), done: false })),
    ...records
      .filter((r) => r.covers.some(isCheckup))
      .map((r) => {
        const at = new Date(r.createdAt);
        return { key: r.id, at: at.getTime(), title: r.label, meta: md(at), done: true };
      }),
  ].sort((a, b) => a.at - b.at);

  // 지금 노드 — 키와 몸무게, 발달 체크
  const height = latestOf(events, 'height');
  const weight = latestOf(events, 'weight');
  const lastBody = [height, weight].filter((e) => e !== null).sort((a, b) => b!.startAt.localeCompare(a!.startAt))[0] ?? null;
  const body =
    height || weight
      ? [height?.amount != null ? `키 ${trim(height.amount, 1)}cm` : null, weight?.amount != null ? `몸무게 ${trim(weight.amount, 2)}kg` : null]
          .filter(Boolean)
          .join(', ') + (lastBody ? ` · ${new Date(lastBody.startAt).getMonth() + 1}월 ${new Date(lastBody.startAt).getDate()}일` : '')
      : '키와 몸무게를 기록해 보세요';
  const checks = itemsByIds(checklistIds(checkpointFor(age.month)));
  const doneIds = new Set(memos.filter((m) => m.ref).map((m) => m.ref as string));
  const checked = checks.filter((i) => doneIds.has(i.id)).length;

  // 앞쪽 — 아기 일정 줄(지금 기간인 것 포함)과 앞으로 올 기념일
  const ahead: (BabyRowData & { milestone?: boolean })[] = [
    ...schedule.rows.filter((r) => r.at <= end),
    ...days
      .filter((d) => d.date.getTime() > today && d.date.getTime() <= end)
      .map((d) => ({
        key: `day-${d.label}`,
        at: d.date.getTime(),
        title: d.label,
        tag: '기념일',
        meta: `${d.date.getMonth() + 1}월 ${d.date.getDate()}일`,
        right: ddayText(d.date.getTime(), today),
        future: true,
        milestone: true,
      })),
  ].sort((a, b) => a.at - b.at);
  const missedRows: BabyRowData[] = schedule.missed.map((g) => ({
    key: g.key,
    at: 0,
    title: g.label,
    tag: todoOf(g).category,
    meta: '했다면 체크해 주세요',
    right: null,
    future: false,
    group: g,
  }));

  const rows: Row[] = [];
  for (const p of past) {
    rows.push({ key: p.key, port: p.done ? 'routine' : 'sleep', node: <PastPill title={p.title} meta={p.meta} done={p.done} /> });
  }
  if (missedRows.length > 0 && !showMissed) {
    rows.push({ key: 'missed', port: 'start', node: <ChipButton label={`지난 접종 · 검진 ${missedRows.length}개`} icon="chevron-down" onPress={() => setShowMissed(true)} /> });
  }
  if (showMissed) for (const r of missedRows) rows.push({ key: `missed-${r.key}`, port: 'future', node: <ScheduleCard row={r} onCheck={() => schedule.check(r)} onOpen={() => schedule.open(r)} /> });

  const nowIndex = rows.length;
  rows.push({
    key: 'now',
    port: 'now',
    portTop: 24,
    node: (
      <View style={[styles.now, { backgroundColor: c.card, borderColor: c.accent }]}>
        <View style={styles.nowHead}>
          <View style={[styles.buddy, { backgroundColor: c.hero }]}>
            <Image source={POSES[pose].src} style={styles.buddyImg} contentFit="contain" accessibilityLabel="버디" />
          </View>
          <View style={styles.flex}>
            <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700 }}>
              지금
            </ThemedText>
            <ThemedText type="heading" style={{ fontWeight: 700 }}>
              생후 {age.month}개월, {age.days + 1}일
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {body}
            </ThemedText>
          </View>
        </View>
        <View style={styles.nowButtons}>
          <Button
            label={checks.length > 0 ? `발달 체크 ${checked}/${checks.length}` : '발달 체크'}
            size="sm"
            variant="secondary"
            style={styles.flex}
            onPress={() => router.push('/growth-check')}
          />
          <Button label="키, 몸무게 기록" size="sm" variant="secondary" style={styles.flex} onPress={() => setGrowthSheet(true)} />
        </View>
        {stage.today && <Button label="기념 카드 보내기" icon="share-outline" size="sm" variant="accent" onPress={() => setSharing(true)} />}
        <View style={styles.links}>
          <LinkChip icon="book-outline" label="성장 일기" onPress={() => router.push('/memos')} />
          <LinkChip icon="sparkles-outline" label="해 주면 좋아요" onPress={() => router.push('/growth-tips')} />
          <LinkChip icon="information-circle-outline" label="알아 두면 좋아요" onPress={() => router.push('/growth-know')} />
        </View>
      </View>
    ),
  });
  for (const r of ahead) {
    rows.push({
      key: `ahead-${r.key}`,
      port: 'future',
      node: r.milestone ? (
        <FutureCard icon="gift-outline" tone="accent" title={r.title} sub={r.meta} right={<DDay text={r.right} />} />
      ) : (
        <ScheduleCard row={r} onCheck={() => schedule.check(r)} onOpen={() => schedule.open(r)} />
      ),
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.flow}>
        {rows.map((row, i) => {
          const above: Segment = i === 0 ? 'none' : i > nowIndex ? 'dashed' : 'solid';
          const below: Segment = i === rows.length - 1 ? 'none' : i >= nowIndex ? 'dashed' : 'solid';
          return (
            <FlowRow key={row.key} port={row.port} above={above} below={below} portTop={row.portTop}>
              {row.node}
            </FlowRow>
          );
        })}
      </View>

      {schedule.sheets}
      {log.sheets}
      <MoreSheet
        open={growthSheet}
        rows={GROWTH_ROWS}
        onClose={() => setGrowthSheet(false)}
        onPick={(a) => {
          setGrowthSheet(false);
          if ('kind' in a) log.open(a.kind);
        }}
      />
      <MilestoneSheet stop={sharing ? stage.today : null} pose={pose} date={now} onClose={() => setSharing(false)} />
    </View>
  );
}

/** 지난 쪽 한 줄 — 태어난 날 · 기념일 · 완료한 접종 · 검진 */
function PastPill({ title, meta, done }: { title: string; meta: string; done: boolean }) {
  const c = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: c.card, borderColor: c.border }]}>
      {done && <Ionicons name="checkmark-circle" size={16} color={c.textSecondary} />}
      <ThemedText type="label" numberOfLines={1} style={[styles.flexShrink, { fontWeight: 600 }]}>
        {title}
      </ThemedText>
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        {meta}
      </ThemedText>
    </View>
  );
}

const TAG_ICON: Record<string, IconName> = { 접종: 'medkit-outline', 검진: 'medkit-outline', 기념일: 'gift-outline', 사이즈: 'resize-outline' };

/** 아기 일정 한 줄 — 동그라미는 완료, 카드를 누르면 예약일 · 편집 시트 */
function ScheduleCard({ row, onCheck, onOpen }: { row: BabyRowData; onCheck: () => void; onOpen: () => void }) {
  const c = useTheme();
  return (
    <FutureCard
      icon={TAG_ICON[row.tag] ?? 'calendar-clear-outline'}
      title={row.title}
      sub={[row.tag, row.meta].filter(Boolean).join(' · ')}
      onPress={() => {
        tap();
        onOpen();
      }}
      right={
        <View style={styles.right}>
          <DDay text={row.right} />
          {!row.future && (
            <Pressable accessibilityRole="checkbox" accessibilityLabel={`${row.title} 완료`} hitSlop={8} onPress={onCheck}>
              <Ionicons name="ellipse-outline" size={24} color={c.text} />
            </Pressable>
          )}
        </View>
      }
    />
  );
}

function DDay({ text }: { text: string | null }) {
  const c = useTheme();
  if (!text) return null;
  return (
    <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
      {text}
    </ThemedText>
  );
}

function LinkChip({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.link, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
      <Ionicons name={icon} size={14} color={c.text} />
      <ThemedText type="caption" style={{ fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flow: { paddingTop: 4 },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  now: { borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 12 },
  nowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buddy: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buddyImg: { width: 58, height: 52 },
  nowButtons: { flexDirection: 'row', gap: 8 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, borderRadius: 15, paddingHorizontal: 10 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
