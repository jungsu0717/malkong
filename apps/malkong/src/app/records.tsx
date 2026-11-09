/**
 * 그 시간의 기록 (SPEC-MAIN-08, task today/014) — 하루 흐름의 잠 노드나 잠과 잠 사이 노드를 누르면 열린다.
 *
 * Zapier 실행 기록처럼 그 시간에 남긴 기록이 시간순으로 쌓이고, 하나를 누르면 펼쳐진다.
 * 수유는 그날 수유를 보이는 작은 막대(이 수유만 진하게) · 쪽마다 먹인 시간이나 양 · 앞 수유와 간격, 루틴과 할 일은 완료한 시간(바퀴로 바꾸기) · 완료 취소.
 * 길: `/records?from=&to=&open=` (to 가 비면 지금까지) 또는 `/records?sleep=<잠 기록 id>`.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { BottleIcon, ZzIcon } from '@/components/baby-icons';
import { MemoSheet } from '@/components/growth/memo-sheet';
import { DiaperGlyph, diaperTone } from '@/components/log/diaper-glyph';
import { useLogActions } from '@/components/log/use-log-actions';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimeRuler } from '@/components/log/ruler';
import { Button, tap } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import {
  feedNeighbors,
  feedSessions,
  feedTitle,
  hhmm,
  isNightStart,
  itemsBetween,
  sidesLine,
  sleepTitle,
  spanRange,
  type RoutineDone,
  type SubItem,
  type TodoDone,
} from '@/data/day-flow';
import { STOOL_COLOR_LABEL, durationLabel, eventTitle, startOfDay } from '@/data/event-summary';
import type { CareEvent } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { useMemos } from '@/data/memos-context';
import { useRoutines } from '@/data/routines-context';
import { useTodos } from '@/data/todos-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const t = (iso: string) => new Date(iso).getTime();

type Row = { key: string; at: number; item: SubItem | { type: 'sleep'; key: string; at: number; event: CareEvent } };

export default function RecordsScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string; to?: string; open?: string; sleep?: string }>();
  const now = useNow(false);
  const { events, remove } = useEvents();
  const { routines, logs, moveLog, removeLog } = useRoutines();
  const { todos, topics, update, toggleDone, remove: removeTodo } = useTodos();
  const log = useLogActions();
  const { memos, updateMemo, removeMemo } = useMemos();
  const [memoEdit, setMemoEdit] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(params.open ?? params.sleep ?? null);
  const general = topics.find((x) => x.kind === 'general')?.id ?? null;

  const sleep = params.sleep ? (events.find((e) => e.id === params.sleep) ?? null) : null;
  const from = sleep ? t(sleep.startAt) : Number(params.from ?? 0);
  const to = sleep ? (sleep.endAt ? t(sleep.endAt) : null) : params.to ? Number(params.to) : null;
  const until = to ?? now.getTime();

  const rows = useMemo<Row[]>(() => {
    const dones: RoutineDone[] = logs
      .filter((l) => l.step == null && !l.skip)
      .flatMap((l) => {
        const r = routines.find((x) => x.id === l.routineId);
        return r ? [{ routineId: r.id, logId: l.id, title: r.title, at: l.at, by: l.by }] : [];
      });
    const doneTodos: TodoDone[] = todos.filter((x) => x.topicId === general && x.doneAt).map((x) => ({ todoId: x.id, title: x.title, at: x.doneAt as string, by: x.doneBy }));
    const list: Row[] = sleep ? [{ key: sleep.id, at: t(sleep.startAt), item: { type: 'sleep', key: sleep.id, at: t(sleep.startAt), event: sleep } }] : [];
    const dayMemos = memos.filter((m) => m.ref === null).map((m) => ({ memoId: m.id, text: m.text, at: m.at }));
    for (const it of itemsBetween(events, dones, doneTodos, from, until + 1, dayMemos)) list.push({ key: it.key, at: it.at, item: it });
    return list.sort((a, b) => a.at - b.at);
  }, [events, logs, routines, todos, general, sleep, from, until, memos]);
  const editing = memoEdit ? (memos.find((m) => m.id === memoEdit) ?? null) : null;

  const dayStart = startOfDay(new Date(from)).getTime();
  const day = new Date(from);
  const minutes = (until - from) / 60000;
  const title = sleep ? sleepTitle({ event: sleep, from, to, night: isNightStart(from) }, now) : spanRange(from, to, dayStart);
  const sub = `${day.getMonth() + 1}월 ${day.getDate()}일 ${WEEKDAYS[day.getDay()]}${sleep ? `, ${spanRange(from, to, dayStart)}` : `, ${to === null ? `${durationLabel(minutes)}째` : durationLabel(minutes)}`}`;

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={styles.flex}>
          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {sub}
          </ThemedText>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
        {rows.length === 0 && (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            이 시간에는 남긴 기록이 없어요
          </ThemedText>
        )}
        {rows.map((row, i) => (
          <RecordRow
            key={row.key}
            row={row}
            last={i === rows.length - 1}
            open={open === row.key}
            now={now}
            events={events}
            onToggle={() => {
              tap();
              setOpen((k) => (k === row.key ? null : row.key));
            }}
            onEdit={(e) => log.open(e.kind, e)}
            onDelete={(ids) => {
              setOpen(null);
              for (const id of ids) void remove(id);
            }}
            onMoveRoutine={(logId, at) => void moveLog(logId, at)}
            onUndoRoutine={(logId) => {
              setOpen(null);
              void removeLog(logId);
            }}
            onEditRoutine={(id) => router.push({ pathname: '/routine-form', params: { id } })}
            onMoveTodo={(id, at) => void update(id, { doneAt: at.toISOString() })}
            onUndoTodo={(id) => {
              setOpen(null);
              void toggleDone(id);
            }}
            onDeleteTodo={(id) => {
              setOpen(null);
              void removeTodo(id);
            }}
            onEditMemo={(id) => setMemoEdit(id)}
          />
        ))}
      </ScrollView>
      <AdBanner anchored />
      {log.sheets}
      <MemoSheet
        open={editing !== null}
        memo={editing}
        dayText={editing ? hhmm(editing.at) : ''}
        onSave={(text) => {
          if (editing) void updateMemo(editing.id, text);
          setMemoEdit(null);
        }}
        onDelete={() => {
          if (editing) void removeMemo(editing.id);
          setMemoEdit(null);
          setOpen(null);
        }}
        onClose={() => setMemoEdit(null)}
      />
    </ThemedView>
  );
}

function RecordRow({
  row,
  last,
  open,
  now,
  events,
  onToggle,
  onEdit,
  onDelete,
  onMoveRoutine,
  onUndoRoutine,
  onEditRoutine,
  onMoveTodo,
  onUndoTodo,
  onDeleteTodo,
  onEditMemo,
}: {
  row: Row;
  last: boolean;
  open: boolean;
  now: Date;
  events: CareEvent[];
  onToggle: () => void;
  onEdit: (e: CareEvent) => void;
  onDelete: (ids: string[]) => void;
  onMoveRoutine: (logId: string, at: Date) => void;
  onUndoRoutine: (logId: string) => void;
  onEditRoutine: (routineId: string) => void;
  onMoveTodo: (id: string, at: Date) => void;
  onEditMemo: (id: string) => void;
  onUndoTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}) {
  const c = useTheme();
  const it = row.item;
  const icon = (() => {
    if (it.type === 'feed')
      return it.session.kind === 'formula' ? (
        <Tile bg={c.accent}>
          <BottleIcon size={16} color="#FFFFFF" />
        </Tile>
      ) : (
        <Tile bg={c.accent}>
          <Ionicons name="heart" size={15} color="#FFFFFF" />
        </Tile>
      );
    if (it.type === 'sleep')
      return (
        <Tile bg={c.ink}>
          <ZzIcon size={16} color={c.onInk} />
        </Tile>
      );
    if (it.type === 'routine' || it.type === 'todo')
      return (
        <Tile bg={c.doneBg}>
          <RoutineIcon title={it.title} size={16} color={c.doneFg} />
        </Tile>
      );
    if (it.type === 'memo')
      return (
        <Tile bg={c.memoBg}>
          <Ionicons name="document-text-outline" size={16} color={c.memoFg} />
        </Tile>
      );
    const k = it.event.kind;
    if (k === 'diaper' && it.event.diaper)
      return (
        <Tile bg={diaperTone(it.event.diaper, c).backgroundColor}>
          <DiaperGlyph diaper={it.event.diaper} color={it.event.color} size={16} />
        </Tile>
      );
    return (
      <Tile bg={k === 'temp' ? c.tempBg : c.surfaceStrong}>
        <Ionicons name={k === 'temp' ? 'thermometer-outline' : k === 'weight' ? 'scale-outline' : 'resize-outline'} size={16} color={k === 'temp' ? c.tempFg : c.text} />
      </Tile>
    );
  })();
  const name =
    it.type === 'feed'
      ? feedTitle(it.session, now)
      : it.type === 'sleep'
        ? sleepTitle({ event: it.event, from: t(it.event.startAt), to: it.event.endAt ? t(it.event.endAt) : null, night: isNightStart(t(it.event.startAt)) }, now)
        : it.type === 'routine' || it.type === 'todo'
          ? it.title
          : it.type === 'memo'
            ? it.text.split('\n')[0]
          : it.event.kind === 'diaper'
            ? it.event.diaper === 'pee'
              ? '소변'
              : it.event.diaper === 'poo'
                ? '대변'
                : '소변, 대변'
            : eventTitle(it.event, now);
  const by = it.type === 'feed' ? it.session.by : it.type === 'routine' || it.type === 'todo' ? it.by : it.type === 'memo' ? null : it.event.by;
  const extra = it.type === 'side' && it.event.kind === 'diaper' && it.event.color && it.event.diaper !== 'pee' ? STOOL_COLOR_LABEL[it.event.color] : null;
  const meta = [hhmm(row.at), extra, by].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {!last && <View style={[styles.line, { backgroundColor: c.divider }]} />}
        <View style={[styles.dot, { borderColor: c.flowLine, backgroundColor: c.card }]} />
      </View>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: open ? c.flowLine : c.border }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${name}, ${meta}`} onPress={onToggle} style={styles.cardHead}>
          {icon}
          <View style={styles.flex}>
            <ThemedText type="heading" style={styles.name}>
              {name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {meta}
            </ThemedText>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
        </Pressable>
        {open && (
          <View style={styles.body}>
            {it.type === 'feed' && <FeedBody session={it.session} events={events} now={now} onEdit={onEdit} onDelete={onDelete} />}
            {(it.type === 'sleep' || it.type === 'side') && <PlainBody event={it.event} now={now} onEdit={onEdit} onDelete={onDelete} />}
            {it.type === 'routine' && it.logId && (
              <DoneBody
                at={new Date(it.at)}
                onMove={(at) => onMoveRoutine(it.logId!, at)}
                actions={
                  <>
                    <Button label="완료 취소" variant="secondary" size="sm" style={styles.flex} onPress={() => onUndoRoutine(it.logId!)} />
                    <Button label="루틴 편집" variant="secondary" size="sm" style={styles.flex} onPress={() => onEditRoutine(it.routineId)} />
                  </>
                }
              />
            )}
            {it.type === 'memo' && (
              <>
                <ThemedText type="body">{it.text}</ThemedText>
                <View style={styles.actions}>
                  <Button label="편집" variant="secondary" size="sm" style={styles.flex} onPress={() => onEditMemo(it.memoId)} />
                </View>
              </>
            )}
            {it.type === 'todo' && (
              <DoneBody
                at={new Date(it.at)}
                onMove={(at) => onMoveTodo(it.todoId, at)}
                actions={
                  <>
                    <Button label="완료 취소" variant="secondary" size="sm" style={styles.flex} onPress={() => onUndoTodo(it.todoId)} />
                    <Button label="삭제" variant="secondary" size="sm" style={styles.flex} onPress={() => onDeleteTodo(it.todoId)} />
                  </>
                }
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function Tile({ bg, children }: { bg: string; children: ReactNode }) {
  return <View style={[styles.tile, { backgroundColor: bg }]}>{children}</View>;
}

/** 편집 · 삭제 — 삭제는 한 번 더 눌러야 지워진다 */
function EditDelete({ onEdit, onDelete }: { onEdit: (() => void) | null; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.actions}>
      {confirming ? (
        <>
          <Button label="취소" variant="secondary" size="sm" style={styles.flex} onPress={() => setConfirming(false)} />
          <Button label="삭제" variant="danger" size="sm" style={styles.flex} onPress={onDelete} />
        </>
      ) : (
        <>
          {onEdit && <Button label="편집" icon="create-outline" variant="secondary" size="sm" style={styles.flex} onPress={onEdit} />}
          <Button label="삭제" icon="trash-outline" variant="secondary" size="sm" style={styles.flex} onPress={() => setConfirming(true)} />
        </>
      )}
    </View>
  );
}

/** 펼친 수유 — 그날 수유를 보이는 작은 막대, 쪽마다 시간, 앞 수유와 간격 */
function FeedBody({
  session,
  events,
  now,
  onEdit,
  onDelete,
}: {
  session: ReturnType<typeof feedSessions>[number];
  events: CareEvent[];
  now: Date;
  onEdit: (e: CareEvent) => void;
  onDelete: (ids: string[]) => void;
}) {
  const c = useTheme();
  const D0 = startOfDay(new Date(session.startAt)).getTime();
  const sameDay = feedSessions(events).filter((s) => t(s.startAt) >= D0 && t(s.startAt) < D0 + 24 * 3600 * 1000);
  const { gapBefore } = feedNeighbors(session, events, now);
  const sides = sidesLine(session, now);
  const amount = session.kind === 'formula' && session.parts[0].amount !== null ? `${Math.round(session.parts[0].amount)}ml` : null;
  return (
    <>
      <View style={styles.strip} accessible accessibilityLabel={`이날 수유 ${sameDay.length}번`}>
        <View style={[styles.stripLine, { backgroundColor: c.surfaceStrong }]} />
        {sameDay.map((s) => {
          const left = ((t(s.startAt) - D0) / (24 * 3600 * 1000)) * 100;
          const me = s.id === session.id;
          return <View key={s.id} style={[styles.stripMark, { left: `${left}%`, backgroundColor: me ? c.accent : c.accentSoft, height: me ? 18 : 10, top: me ? 0 : 4, width: me ? 6 : 4 }]} />;
        })}
        <View style={styles.stripHours}>
          {['0시', '12시', '24시'].map((h) => (
            <ThemedText key={h} type="caption" style={{ color: c.textTertiary, fontSize: 10 }}>
              {h}
            </ThemedText>
          ))}
        </View>
      </View>
      {(sides || amount) && <ThemedText type="small">{sides ?? amount}</ThemedText>}
      {session.parts.some((p) => p.note) && (
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {session.parts
            .map((p) => p.note)
            .filter(Boolean)
            .join('\n')}
        </ThemedText>
      )}
      {gapBefore !== null && (
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          앞 수유와 {durationLabel(Math.round(gapBefore))} 간격
        </ThemedText>
      )}
      {session.parts.length > 1 &&
        session.parts.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${eventTitle(p, now)} 편집`} onPress={() => onEdit(p)} style={({ pressed }) => [styles.part, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
            <ThemedText type="small" style={styles.flex}>
              {eventTitle(p, now)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {p.endAt ? `${hhmm(p.startAt)}~${hhmm(p.endAt)}` : hhmm(p.startAt)}
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
          </Pressable>
        ))}
      <EditDelete onEdit={session.parts.length === 1 ? () => onEdit(session.parts[0]) : null} onDelete={() => onDelete(session.parts.map((p) => p.id))} />
    </>
  );
}

function PlainBody({ event, now, onEdit, onDelete }: { event: CareEvent; now: Date; onEdit: (e: CareEvent) => void; onDelete: (ids: string[]) => void }) {
  const c = useTheme();
  return (
    <>
      {event.note ? (
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {event.note}
        </ThemedText>
      ) : null}
      {event.kind === 'sleep' && event.endAt === null && (
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {`${hhmm(event.startAt)}부터 ${durationLabel(Math.max(1, (now.getTime() - t(event.startAt)) / 60000))}째`}
        </ThemedText>
      )}
      <EditDelete onEdit={() => onEdit(event)} onDelete={() => onDelete([event.id])} />
    </>
  );
}

/** 루틴과 할 일 — 완료한 시간을 기록 시트와 같은 눈금으로 바꾸고(날짜는 시각 글자를 눌러), 완료를 취소한다 */
function DoneBody({ at, onMove, actions }: { at: Date; onMove: (at: Date) => void; actions: ReactNode }) {
  const [value, setValue] = useState(at);
  const changed = Math.abs(value.getTime() - at.getTime()) >= 60 * 1000;
  return (
    <>
      <TimeRuler label="완료한 시간" value={value} onChange={setValue} caption={null} />
      {changed && (
        <Button
          label="이 시간으로 바꾸기"
          size="sm"
          onPress={() => {
            tap('success');
            onMove(value);
          }}
        />
      )}
      <View style={styles.actions}>{actions}</View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 8, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  empty: { paddingVertical: 32, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  rail: { width: 16, alignItems: 'center' },
  line: { position: 'absolute', top: 30, bottom: -14, width: 2 },
  dot: { marginTop: 23, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  card: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  name: { fontWeight: 700 },
  tile: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 12, paddingBottom: 12, paddingLeft: 54, gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  part: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  strip: { height: 34 },
  stripLine: { position: 'absolute', left: 0, right: 0, top: 8, height: 2 },
  stripMark: { position: 'absolute', borderRadius: 2, marginLeft: -2 },
  stripHours: { position: 'absolute', left: 0, right: 0, top: 20, flexDirection: 'row', justifyContent: 'space-between' },
});
