/**
 * 하루 보기 (SPEC-MAIN-08, task today/012, decisions/037) — 하루 시계 아래로 그날 기록이 시간순 노드로 이어지고,
 * 오늘이면 「지금」 노드와 예정 노드(다음 수유 예상 · 오늘 할 루틴 · 그날 아기 일정 · 오늘 소식 · 가족과 함께 보기)가 뒤따른다.
 *
 * 기록 노드를 누르면 그 자리에서 펼쳐지고(event-detail), 다른 노드는 흐려지며 하루 시계도 그 기록만 또렷하다.
 * 지난날(일주일 보기에서 고른 날)은 지금 노드와 예정 노드 없이 그날 기록 전부를 보인다.
 * 입력 · 루틴 · 아기 일정 시트는 이 보기가 한 번씩 둔다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { careWarnings, WarnCard } from '@/components/flow/care-warn';
import { DayClock } from '@/components/flow/day-clock';
import { EventDetail } from '@/components/flow/event-detail';
import {
  ChipButton,
  FeedCard,
  FlowRow,
  FutureCard,
  GapLabel,
  RoutinePill,
  SidePill,
  SleepCard,
  type Port,
  type Segment,
} from '@/components/flow/flow-node';
import { MoreSheet } from '@/components/flow/more-sheet';
import { NowNode } from '@/components/flow/now-node';
import { BottleIcon } from '@/components/baby-icons';
import { DayNewsSheet } from '@/components/log/day-news-card';
import { useLogActions } from '@/components/log/use-log-actions';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { useRoutineActions } from '@/components/routine/use-routine-actions';
import { ThemedText } from '@/components/themed-text';
import { useBabyRows } from '@/components/todo/baby-schedule';
import { Button, Card, tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import { dayNews } from '@/data/day-news';
import { dayItems, dayMarks, hhmm, nextFeedGuess, type FlowItem, type RoutineDone } from '@/data/day-flow';
import { readSetting, writeSetting } from '@/data/db';
import { durationLabel, startOfDay, statsBetween } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { useFamily } from '@/data/family-context';
import { useMemos } from '@/data/memos-context';
import { logsOn, todayPlan } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { poseOf } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
/** 지금 앞에 보이는 노드 수 — 그 앞은 「이전 기록 N개」로 접는다 */
const RECENT = 3;
/** 가족 노드를 닫았는지 — 'yes' 면 이 폰에서 다시 보이지 않는다(예전 홈 가족 초대 카드와 같은 설정값) */
const FAMILY_HIDDEN_KEY = 'home.familyCardHidden';

type Row = { key: string; port: Port; node: ReactNode; portTop?: number; dimmable: boolean };

export function DayView({ date, now }: { date: Date; now: Date }) {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { events, remove } = useEvents();
  const { routines, logs } = useRoutines();
  const family = useFamily();
  const { memos } = useMemos();
  const log = useLogActions();
  const routine = useRoutineActions(now);
  const schedule = useBabyRows(now);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [more, setMore] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [familyHidden, setFamilyHidden] = useState(true);
  useEffect(() => {
    void readSetting(FAMILY_HIDDEN_KEY).then((v) => setFamilyHidden(v === 'yes'));
  }, []);

  const dayStart = startOfDay(date).getTime();
  const isToday = dayStart === startOfDay(now).getTime();

  // 그날 완료한 루틴 — 단계 줄과 건너뛴 줄은 빼고 첫 완료만
  const dones = useMemo<RoutineDone[]>(
    () =>
      routines.flatMap((r) => {
        const first = logsOn(r.id, logs, date).find((l) => l.step == null && !l.skip);
        return first ? [{ routineId: r.id, title: r.title, at: first.at, by: first.by }] : [];
      }),
    [routines, logs, date],
  );
  const items = useMemo(() => dayItems(events, dones, date, now), [events, dones, date, now]);
  const marks = useMemo(() => dayMarks(events, date, now), [events, date, now]);
  const stats = statsBetween(events, new Date(dayStart), new Date(dayStart + DAY), now);
  const news = baby ? dayNews(events, memos, baby.birthDate, date, now) : null;

  if (!baby || !age) return null;

  const open = items.find((i) => i.key === openKey) ?? null;
  const pick = open ? (open.type === 'feed' ? open.session.id : open.type === 'routine' ? null : open.event.id) : null;
  const dimOthers = open !== null;

  // 지난 쪽 노드
  const hidden = isToday && !showAll && items.length > RECENT + 1 ? items.length - RECENT : 0;
  const shown = items.slice(hidden);
  const past: Row[] = [];
  if (hidden > 0) {
    past.push({
      key: 'more',
      port: 'start',
      dimmable: true,
      node: <ChipButton label={`이전 기록 ${hidden}개`} icon="chevron-up" onPress={() => setShowAll(true)} />,
    });
  }
  for (const it of shown) {
    if (it.type === 'sleep' && it.awakeBefore !== null) {
      past.push({ key: `gap-${it.key}`, port: 'none', dimmable: true, node: <GapLabel text={`깨어 있음 ${durationLabel(it.awakeBefore)}`} /> });
    }
    if (openKey === it.key && it.type !== 'routine') {
      past.push({
        key: it.key,
        port: it.type === 'sleep' ? 'sleep' : it.type === 'feed' ? 'feed' : 'side',
        portTop: 28,
        dimmable: false,
        node: (
          <EventDetail
            item={it}
            events={events}
            now={now}
            onClose={() => setOpenKey(null)}
            onEdit={(e) => log.open(e.kind, e)}
            onDelete={(ids) => {
              setOpenKey(null);
              for (const id of ids) void remove(id);
            }}
          />
        ),
      });
      continue;
    }
    past.push(pastRow(it));
  }

  function pastRow(it: FlowItem): Row {
    const toggle = () => setOpenKey((k) => (k === it.key ? null : it.key));
    switch (it.type) {
      case 'feed':
        return { key: it.key, port: 'feed', dimmable: true, node: <FeedCard session={it.session} now={now} onPress={toggle} /> };
      case 'sleep':
        return { key: it.key, port: 'sleep', dimmable: true, node: <SleepCard event={it.event} now={now} dayStart={dayStart} onPress={toggle} /> };
      case 'side':
        return { key: it.key, port: 'side', dimmable: true, node: <SidePill event={it.event} now={now} onPress={toggle} /> };
      case 'routine':
        return {
          key: it.key,
          port: 'routine',
          dimmable: true,
          node: <RoutinePill title={it.title} at={it.at} by={it.by} icon={<RoutineIcon title={it.title} size={12} color={c.textSecondary} />} />,
        };
    }
  }

  // 지금 뒤 — 시각이 있는 것끼리 시간순, 그다음 시각이 없는 것
  const future: (Row & { at: number })[] = [];
  if (isToday) {
    const guess = nextFeedGuess(events, now);
    if (guess) {
      future.push({
        key: 'next-feed',
        at: guess.at.getTime(),
        port: 'futureFeed',
        dimmable: true,
        node: (
          <FutureCard
            icon={<BottleIcon size={18} color={c.accent} />}
            tone="accent"
            title={`다음 수유 ${hhmm(guess.at)}쯤`}
            sub={`평소 간격 ${durationLabel(guess.gap)}`}
            right={
              <Pressable accessibilityRole="button" accessibilityLabel="기록 알림" hitSlop={8} onPress={() => router.push('/notifications')} style={styles.endButton}>
                <Ionicons name="notifications-outline" size={20} color={c.text} />
              </Pressable>
            }
          />
        ),
      });
    }
    const plan = todayPlan(routines, logs, now);
    for (const x of plan.today.filter((y) => !y.s.done)) {
      const [h, m] = (x.r.time ?? '').split(':').map(Number);
      const at = x.r.time ? dayStart + (h * 60 + m) * 60 * 1000 : Number.MAX_SAFE_INTEGER - 4;
      future.push({
        key: `todo-${x.r.id}`,
        at,
        port: 'future',
        dimmable: true,
        node: (
          <FutureCard
            icon={<RoutineIcon title={x.r.title} size={18} color={c.textSecondary} />}
            title={x.r.title}
            sub={[x.r.time ?? '하루 중', '루틴', x.s.skipped ? '오늘은 건너뜀' : null].filter(Boolean).join(' · ')}
            label={`${x.r.title} 완료`}
            onPress={() => {
              tap();
              routine.onCheck(x.r.id);
            }}
            onLongPress={() => routine.edit(x.r)}
            right={<Ionicons name="ellipse-outline" size={26} color={c.text} />}
          />
        ),
      });
    }
    for (const r of schedule.rows.filter((row) => row.at >= dayStart && row.at < dayStart + DAY)) {
      // 병원 예약 · 할 일에 시각을 적었으면 그 시각에, 아니면 시각 없는 루틴 뒤에
      const timed = r.appt?.hasTime ? r.appt.dueAt : r.todo?.hasTime ? r.todo.dueAt : null;
      future.push({
        key: `baby-${r.key}`,
        at: timed ? new Date(timed).getTime() : Number.MAX_SAFE_INTEGER - 3,
        port: 'future',
        dimmable: true,
        node: (
          <FutureCard
            icon="calendar-clear-outline"
            title={r.title}
            sub={[r.tag, r.meta].filter(Boolean).join(' · ')}
            onPress={() => schedule.open(r)}
            right={
              r.future ? undefined : (
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`${r.title} 완료`} hitSlop={8} onPress={() => schedule.check(r)}>
                  <Ionicons name="ellipse-outline" size={26} color={c.text} />
                </Pressable>
              )
            }
          />
        ),
      });
    }
    future.sort((a, b) => a.at - b.at);
  }
  if (news) {
    future.push({
      key: 'news',
      at: Number.MAX_SAFE_INTEGER - 1,
      port: 'future',
      dimmable: true,
      node: (
        <FutureCard
          icon="share-outline"
          title={isToday ? '오늘 소식 보내기' : '이날 소식 보내기'}
          sub="기록을 카드 한 장으로 가족에게 보내요"
          onPress={() => {
            tap();
            setSharing(true);
          }}
        />
      ),
    });
  }
  if (isToday && family.status === 'none' && !familyHidden) {
    future.push({
      key: 'family',
      at: Number.MAX_SAFE_INTEGER,
      port: 'future',
      dimmable: true,
      node: (
        <FutureCard
          icon="people-outline"
          title="가족과 함께 보기"
          sub="할머니, 할아버지도 함께 봐요"
          onPress={() => router.push('/family')}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="가족과 함께 보기 닫기"
              hitSlop={10}
              onPress={() => {
                setFamilyHidden(true);
                void writeSetting(FAMILY_HIDDEN_KEY, 'yes');
              }}
              style={styles.endButton}>
              <Ionicons name="close" size={18} color={c.textTertiary} />
            </Pressable>
          }
        />
      ),
    });
  }

  // 줄 잇기 — 지난 쪽은 실선, 지금 뒤는 점선
  const nowRow: Row | null = isToday
    ? {
        key: 'now',
        port: 'now',
        portTop: 22,
        dimmable: true,
        node: (
          <NowNode
            events={events}
            onPress={log.press}
            onStop={(e) => void log.stop(e)}
            onStart={(kind, side) => void log.start(kind, side)}
            onMore={() => setMore(true)}
          />
        ),
      }
    : null;
  const rows: { row: Row; above: Segment; below: Segment }[] = [];
  const all = [...past, ...(nowRow ? [nowRow] : []), ...future];
  const nowIndex = nowRow ? past.length : -1;
  all.forEach((row, i) => {
    const after = nowIndex >= 0 && i > nowIndex;
    const above: Segment = i === 0 ? 'none' : after ? 'dashed' : 'solid';
    const below: Segment = i === all.length - 1 ? 'none' : nowIndex >= 0 && i >= nowIndex ? 'dashed' : 'solid';
    rows.push({ row, above, below });
  });

  const warns = isToday ? careWarnings(events, age.month, now) : [];
  const weekday = WEEKDAYS[date.getDay()];

  return (
    <View style={styles.wrap}>
      <DayClock
        marks={marks}
        pick={pick}
        center={isToday ? { small: '지금', big: hhmm(now) } : { small: weekday, big: `${date.getMonth() + 1}월 ${date.getDate()}일` }}
        stats={{ sleepMin: stats.sleepMin, feeds: stats.feeds, diapers: stats.diapers }}
      />

      {warns.map((id) => (
        <WarnCard key={id} id={id} />
      ))}

      {/* 가족에 2026-10-30 전에 들어간 폰 — 동의 문장에 기록이 없어서 따로 묻는다(SPEC-LOG-07) */}
      {family.status === 'member' && !family.eventsOk && (
        <Card tone="raised" style={styles.consent}>
          <ThemedText type="heading">가족과 기록도 함께 볼까요?</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            이 폰의 수유 · 기저귀 · 잠 · 체온 · 키 · 몸무게 기록을 육아버디 서버에 저장하고, 가족 폰에서도 보여요.
          </ThemedText>
          <Button label="동의하고 함께 보기" size="md" onPress={() => void family.allowEvents()} />
        </Card>
      )}

      <View style={styles.flow}>
        <DotGrid />
        {rows.length === 0 ? (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            이날은 남긴 기록이 없어요
          </ThemedText>
        ) : (
          rows.map(({ row, above, below }) => (
            <FlowRow key={row.key} port={row.port} above={above} below={below} portTop={row.portTop} dim={dimOthers && row.dimmable}>
              {row.node}
            </FlowRow>
          ))
        )}
      </View>

      {log.sheets}
      {routine.sheets}
      {schedule.sheets}
      <MoreSheet
        open={more}
        onClose={() => setMore(false)}
        onPick={(a) => {
          setMore(false);
          if ('kind' in a) log.open(a.kind);
          else router.push(a.go === 'routines' ? '/routines' : '/notifications');
        }}
      />
      <DayNewsSheet
        news={sharing ? news : null}
        title={isToday ? '오늘 소식' : `${date.getMonth() + 1}월 ${date.getDate()}일 소식`}
        pose={poseOf(age.month)}
        onClose={() => setSharing(false)}
      />
    </View>
  );
}

/** 흐름 바탕의 모눈 점 — n8n 캔버스처럼 */
function DotGrid() {
  const c = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="flowDots" width={16} height={16} patternUnits="userSpaceOnUse">
            <Rect width={16} height={16} fill={c.page} />
            <Circle cx={8} cy={8} r={1} fill={c.flowDot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#flowDots)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  consent: { gap: 8 },
  flow: { paddingTop: 2, paddingBottom: 8, marginHorizontal: -4, paddingHorizontal: 4 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  endButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
