import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ExternalLink } from '@/components/external-link';
import { DayNewsSheet } from '@/components/log/day-news-card';
import { KIND_UI } from '@/components/log/kinds';
import { useLogActions } from '@/components/log/use-log-actions';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ListRow, SectionHeader, Tag, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { dayNews } from '@/data/day-news';
import { reminderPlan } from '@/data/care-reminders';
import {
  agoLabel,
  clockLabel,
  durationLabel,
  eventTime,
  eventTitle,
  feedReminderAt,
  lastDays,
  lastFeed,
  lastFeedStart,
  latestOf,
  startOfDay,
  todayStats,
  usual,
} from '@/data/event-summary';
import { EVENT_KINDS, runningOf, type CareEvent } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { useFamily } from '@/data/family-context';
import { itemById } from '@/data/l1';
import { useMemos } from '@/data/memos-context';
import { usePreferences } from '@/data/preferences-context';
import { poseOf } from '@/data/stage';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const DAY = 24 * 60 * 60 * 1000;
/** 날짜를 몇 날 전까지 넘겨 볼 수 있나 */
const MAX_DAYS_BACK = 60;

/** 재는 중 시계 — 「12:05」 · 「1:02:05」 */
function stopwatch(from: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/**
 * 기록 — 홈의 빠른 기록 「전체 ›」에서 들어오는 화면 (SPEC-LOG-01~07, decisions/023 · 036, task log/003 · 004).
 * 위에서부터 재는 중 · 마지막 수유와 오늘 합계 · (가족에 먼저 들어간 폰이면) 기록도 함께 보기 동의 · 기록 단추 일곱 · 날짜별 기록(누가 남겼는지)과
 * 그날 「소식 보내기」(SPEC-LOG-06) · 기록 알림 한 줄 · 광고(바닥, 단추와 멀리).
 */
export default function LogScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { events, loading } = useEvents();
  const { careReminders } = usePreferences();
  const family = useFamily();
  const { memos } = useMemos();
  const actions = useLogActions();
  const [sharing, setSharing] = useState(false);
  const breast = runningOf(events, 'breast');
  const sleep = runningOf(events, 'sleep');
  const now = useNow(!!breast || !!sleep);
  const [daysBack, setDaysBack] = useState(0);

  const today = todayStats(events, now);
  const week = useMemo(() => usual(lastDays(events, 8, now)), [events, now]);
  const last = lastFeed(events);
  const lastStart = lastFeedStart(events);
  const plan = reminderPlan(age?.month ?? 0, events, now);
  const reminder = feedReminderAt(events, careReminders ? plan.feed.minutes : null, now);
  const warns = careWarnings(events, age?.month ?? null, now);

  const dayStart = useMemo(() => {
    const d = startOfDay(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack);
  }, [now, daysBack]);
  const dayEvents = useMemo(() => {
    const from = dayStart.getTime();
    const to = from + DAY;
    return events
      .filter((e) => {
        const t = new Date(e.startAt).getTime();
        return t >= from && t < to;
      })
      .reverse();
  }, [events, dayStart]);

  if (loading || !baby) return <ScreenLoading />;
  const name = baby.name ?? DEFAULT_BABY_NAME;
  const { open, press, start, stop } = actions;
  const news = dayNews(events, memos, baby.birthDate, dayStart, now);
  const dayTitle = daysBack === 0 ? '오늘' : daysBack === 1 ? '어제' : `${dayStart.getMonth() + 1}월 ${dayStart.getDate()}일`;

  return (
    <ThemedView style={styles.container}>
      {/* 마이 → 기록에서 들어오는 화면(decisions/027) — 제목은 머리줄에 */}
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              {name} · 함께한 지 {(age?.days ?? 0) + 1}일
            </ThemedText>
          </View>

          {/* 위험 신호 — 체온 · 변 기록이 기준에 닿으면 고정 안내(헌장 5, L1 위험 신호 항목) */}
          {warns.map((id) => (
            <WarnCard key={id} id={id} />
          ))}

          {/* 재는 중 (SPEC-LOG-02) */}
          {breast && (
            <Card style={[styles.running, { borderColor: c.accent }]}>
              <View style={styles.flex}>
                <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                  모유 {breast.side === 'right' ? '오른쪽' : '왼쪽'} · {clockLabel(breast.startAt)}부터
                </ThemedText>
                <ThemedText type="display" style={styles.timer}>
                  {stopwatch(breast.startAt, now)}
                </ThemedText>
              </View>
              <View style={styles.runningActions}>
                <Button label="종료" size="md" onPress={() => void stop(breast)} />
                <Button
                  label="반대쪽"
                  size="sm"
                  variant="secondary"
                  onPress={() => void start('breast', breast.side === 'right' ? 'left' : 'right')}
                />
              </View>
            </Card>
          )}
          {sleep && (
            <Card style={[styles.running, { borderColor: c.accent }]}>
              <View style={styles.flex}>
                <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                  자는 중 · {clockLabel(sleep.startAt)}부터
                </ThemedText>
                <ThemedText type="display" style={styles.timer}>
                  {stopwatch(sleep.startAt, now)}
                </ThemedText>
              </View>
              <Button label="수면 종료" size="md" onPress={() => void stop(sleep)} />
            </Card>
          )}

          {/* 마지막 수유와 오늘 합계 (SPEC-LOG-03) */}
          <Card tone="filled" style={styles.summary}>
            <ThemedText type="heading">
              {last && lastStart ? `마지막 수유 ${agoLabel(lastStart, now)}` : '수유를 기록하면 다음 수유 시간을 알려 드려요'}
            </ThemedText>
            {last && (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {eventTitle(last, now)} · {clockLabel(lastStart ?? last.startAt)}
                {last.by ? ` · ${last.by}` : ''}
                {reminder ? ` · 알림 ${clockLabel(reminder)}` : ''}
              </ThemedText>
            )}
            <View style={styles.totals}>
              <Total label="수유" value={`${today.feeds}번`} usual={week ? `${Math.round(week.feeds)}번` : null} />
              <Total label="기저귀" value={`${today.diapers}번`} usual={week ? `${Math.round(week.diapers)}번` : null} />
              <Total label="잠" value={durationLabel(today.sleepMin)} usual={week ? durationLabel(week.sleepMin) : null} />
            </View>
          </Card>

          {/* 가족에 2026-10-30 전에 들어간 폰 — 동의 문장에 기록이 없어서 따로 묻는다(SPEC-LOG-07) */}
          {family.status === 'member' && !family.eventsOk && (
            <Card style={styles.consent}>
              <ThemedText type="heading">가족과 기록도 함께 볼까요?</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                이 폰의 수유 · 기저귀 · 잠 · 체온 · 키 · 몸무게 기록을 육아버디 서버에 저장하고, 가족 폰에서도 보여요.
              </ThemedText>
              <Button label="동의하고 함께 보기" size="md" onPress={() => void family.allowEvents()} />
            </Card>
          )}

          {/* 기록 단추 일곱 (SPEC-LOG-01) */}
          <View style={styles.grid}>
            {EVENT_KINDS.map((kind) => {
              const on = (kind === 'breast' && !!breast) || (kind === 'sleep' && !!sleep);
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={`${KIND_UI[kind].label} 기록`}
                  onPress={() => press(kind)}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: on ? c.accentSoft : pressed ? c.surfaceStrong : c.surface },
                  ]}>
                  <Ionicons name={KIND_UI[kind].icon} size={24} color={on ? c.accent : c.text} />
                  <ThemedText type="label" style={{ color: on ? c.accentText : c.text, fontWeight: 600 }}>
                    {kind === 'sleep' && sleep ? '수면 종료' : KIND_UI[kind].label}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="일주일 그래프"
              onPress={() => router.push('/log-stats')}
              style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
              <Ionicons name="bar-chart-outline" size={24} color={c.text} />
              <ThemedText type="label" style={{ fontWeight: 600 }}>
                그래프
              </ThemedText>
            </Pressable>
          </View>

          {/* 날짜별 기록 — 누르면 고치기 · 지우기 (SPEC-LOG-03) */}
          <View style={styles.section}>
            <View style={styles.dayHead}>
              <View style={styles.flex}>
                <SectionHeader title={dayTitle} aside={dayEvents.length > 0 ? `${dayEvents.length}개` : undefined} />
              </View>
              <View style={styles.dayNav}>
                <DayButton
                  icon="chevron-back"
                  label="전날"
                  disabled={daysBack >= MAX_DAYS_BACK}
                  onPress={() => setDaysBack((d) => d + 1)}
                />
                <DayButton icon="chevron-forward" label="다음 날" disabled={daysBack === 0} onPress={() => setDaysBack((d) => d - 1)} />
              </View>
            </View>
            <Card style={styles.rows}>
              {dayEvents.length === 0 ? (
                <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
                  {daysBack === 0
                    ? '위 버튼을 누르면 바로 기록돼요. 기록이 쌓이면 평소와 비교해 보여 드려요'
                    : '이날은 남긴 기록이 없어요'}
                </ThemedText>
              ) : (
                dayEvents.map((e, i) => (
                  <ListRow
                    key={e.id}
                    divider={i > 0}
                    icon={KIND_UI[e.kind].icon}
                    iconTone={e.endAt === null && (e.kind === 'breast' || e.kind === 'sleep') ? 'accent' : 'neutral'}
                    title={eventTitle(e, now)}
                    detail={e.by ? `${eventTime(e)} · ${e.by}` : eventTime(e)}
                    right={e.endAt === null && (e.kind === 'breast' || e.kind === 'sleep') ? <Tag label="기록 중" tone="accent" /> : undefined}
                    onPress={() => open(e.kind, e)}
                  />
                ))
              )}
            </Card>
            {/* 그날 소식을 카드로 보내기 (SPEC-LOG-06) — 보낼 것이 있는 날만 */}
            {news && (
              <Button
                label={`${dayTitle} 소식 보내기`}
                icon="share-outline"
                variant="secondary"
                size="md"
                onPress={() => {
                  tap();
                  setSharing(true);
                }}
              />
            )}
            <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} hitSlop={8}>
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                기록 알림 {careReminders ? `켜짐 · 수유는 마지막 수유 ${durationLabel(plan.feed.minutes)} 뒤` : '꺼짐'} · 변경
              </ThemedText>
            </Pressable>
          </View>

        </ScrollView>
        {/* 광고는 화면 바닥에 붙인다 — 하루 여러 번 여는 첫 화면이라 늘 보이게, 기록 단추와는 멀리(app-design 「광고 자리」) */}
        <AdBanner anchored />
      </SafeAreaView>

      {actions.sheets}
      <DayNewsSheet news={sharing ? news : null} title={`${dayTitle} 소식`} pose={poseOf(age?.month ?? 0)} onClose={() => setSharing(false)} />
    </ThemedView>
  );
}

function Total({ label, value, usual: avg }: { label: string; value: string; usual: string | null }) {
  const c = useTheme();
  return (
    <View style={styles.total}>
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        오늘 {label}
      </ThemedText>
      <ThemedText type="heading">{value}</ThemedText>
      {avg && (
        <ThemedText type="caption" style={{ color: c.textTertiary }}>
          평소 {avg}
        </ThemedText>
      )}
    </View>
  );
}

function DayButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.dayButton, { borderColor: c.border, opacity: disabled ? 0.35 : 1 }]}>
      <Ionicons name={icon} size={16} color={c.text} />
    </Pressable>
  );
}

/**
 * 기록이 위험 신호 기준에 닿았는가 — 진단이 아니라 고정 안내다(헌장 5). 기준은 L1 위험 신호 항목 그대로.
 * - 12시간 안의 마지막 체온: 40℃ 이상은 누구나(k-warn-0002), 3개월 미만은 38℃ 이상(k-warn-0001)
 * - 24시간 안에 빨간 변을 적었으면 피 섞인 변(k-warn-0008)
 */
function careWarnings(events: CareEvent[], month: number | null, now: Date): string[] {
  const ids: string[] = [];
  const temp = latestOf(events, 'temp');
  if (temp && temp.amount !== null && now.getTime() - new Date(temp.startAt).getTime() <= 12 * 60 * 60 * 1000) {
    if (temp.amount >= 40) ids.push('k-warn-0002');
    else if (month !== null && month < 3 && temp.amount >= 38) ids.push('k-warn-0001');
  }
  const red = events.some(
    (e) => e.kind === 'diaper' && e.color === 'red' && now.getTime() - new Date(e.startAt).getTime() <= DAY,
  );
  if (red) ids.push('k-warn-0008');
  return ids;
}

function WarnCard({ id }: { id: string }) {
  const c = useTheme();
  const item = itemById(id);
  if (!item) return null;
  return (
    <View style={[styles.warn, { backgroundColor: c.dangerSoft }]}>
      <View style={styles.warnHead}>
        <Ionicons name="warning" size={18} color={c.danger} />
        <ThemedText type="heading" style={{ color: c.danger }}>
          바로 진료가 필요할 수 있어요
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ fontWeight: 600 }}>
        {item.title}
      </ThemedText>
      <ThemedText type="small">{item.body}</ThemedText>
      <ExternalLink href={item.source.url as `https://${string}`}>
        <ThemedText type="caption" style={{ color: c.textSecondary, textDecorationLine: 'underline' }}>
          {item.source.name}
        </ThemedText>
      </ExternalLink>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  head: { gap: 2 },
  running: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5 },
  runningActions: { alignItems: 'stretch', gap: Spacing.two },
  timer: { fontVariant: ['tabular-nums'] },
  summary: { gap: 4 },
  totals: { flexDirection: 'row', marginTop: Spacing.two },
  consent: { gap: Spacing.two },
  total: { flex: 1, gap: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '23%',
    flexGrow: 1,
    minHeight: 76,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  section: { gap: 10 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayNav: { flexDirection: 'row', gap: 6 },
  dayButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rows: { paddingVertical: 4 },
  empty: { paddingVertical: Spacing.three, textAlign: 'center' },
  warn: { borderRadius: Radius.lg, padding: Spacing.three, gap: 6 },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
