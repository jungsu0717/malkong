/**
 * 함께 보는 달력 (SPEC-MAIN-14, task today/021) — 하루 흐름 오른쪽 위 달력 단추에서 연다.
 *
 * 날마다 점(보라는 메모, 코랄은 일정), 오늘은 먹색 동그라미. 날을 누르면 아래에 그날 메모와 일정이 시간순으로 보이고, 누르면 고치거나 지운다.
 * 메모는 「우리 아기 메모」(그날의 일기 — 하루 흐름에 메모 노드로 보인다), 일정은 날짜가 있는 할 일이다. 가족과 함께 보기를 켜면 둘 다 가족 폰과 맞춘다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MemoSheet } from '@/components/growth/memo-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { INLINE_WHEEL, pickTime, TimeWheel } from '@/components/time-picker';
import { TodoSheet } from '@/components/todo/todo-sheet';
import { Button, tap } from '@/components/ui';
import { FontFamily, MaxContentWidth } from '@/constants/theme';
import { startOfDay } from '@/data/event-summary';
import { useMemos } from '@/data/memos-context';
import { timeLabel } from '@/data/briefing';
import { useTodos } from '@/data/todos-context';
import { useDayFacts } from '@/hooks/use-day-facts';
import { useTheme } from '@/hooks/use-theme';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DAY = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

type Entry = { key: string; at: number; kind: 'memo' | 'plan'; title: string; meta: string; id: string };

export default function CalendarScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { memos, addMemo, updateMemo, removeMemo } = useMemos();
  const { todos, topics, add: addTodo, update: updateTodo, remove: removeTodo } = useTodos();
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDay] = useState(today);
  const [memoOpen, setMemoOpen] = useState<{ id: string | null } | null>(null);
  const [todoEdit, setTodoEdit] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  // 날짜마다 메모와 일정 — 메모는 사람이 쓴 것만(발달 체크 줄은 뺀다)
  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const m of memos.filter((x) => x.ref === null)) {
      const at = new Date(m.at);
      out.push({ key: `memo-${m.id}`, at: at.getTime(), kind: 'memo', title: m.text.split('\n')[0], meta: hm(at), id: m.id });
    }
    for (const t of todos.filter((x) => x.dueAt)) {
      const at = new Date(t.dueAt!);
      const when = t.hasTime ? timeLabel(hm(at)) : '하루 종일';
      out.push({ key: `todo-${t.id}`, at: at.getTime(), kind: 'plan', title: t.title, meta: t.doneAt ? `${when} · 완료` : when, id: t.id });
    }
    return out.sort((a, b) => a.at - b.at);
  }, [memos, todos]);

  const marks = (d: Date) => {
    const from = d.getTime();
    const list = entries.filter((e) => e.at >= from && e.at < from + DAY);
    return { memo: list.some((e) => e.kind === 'memo'), plan: list.some((e) => e.kind === 'plan') };
  };
  const dayList = entries.filter((e) => e.at >= day.getTime() && e.at < day.getTime() + DAY);

  // 달력 칸 — 첫 주의 빈칸, 그달 날들
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);

  const moveMonth = (n: number) => {
    tap();
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  };
  // 메모를 쓰는 때 — 오늘이면 지금, 다른 날이면 그날 낮 12시
  const memoAt = () => (day.getTime() === today.getTime() ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12));
  const editingMemo = memoOpen?.id ? (memos.find((m) => m.id === memoOpen.id) ?? null) : null;
  // 메모 창 위의 그날 기록 칩 — 고치는 메모면 그 메모의 날(SPEC-STAGE-03, decisions/042)
  const memoFacts = useDayFacts(memoOpen ? (editingMemo ? new Date(editingMemo.at) : day) : null);
  const editingTodo = todoEdit ? (todos.find((t) => t.id === todoEdit) ?? null) : null;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.head, { paddingTop: insets.top + 4 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={styles.monthNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="지난달" hitSlop={8} onPress={() => moveMonth(-1)} style={styles.iconBtn}>
            <Ionicons name="chevron-back-outline" size={20} color={c.text} />
          </Pressable>
          <ThemedText type="heading" style={styles.month}>
            {`${month.getFullYear()}년 ${month.getMonth() + 1}월`}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="다음 달" hitSlop={8} onPress={() => moveMonth(1)} style={styles.iconBtn}>
            <Ionicons name="chevron-forward-outline" size={20} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.grid}>
          {WEEK.map((w, i) => (
            <ThemedText key={w} type="caption" style={[styles.week, { color: i === 0 ? c.tempFg : c.textSecondary }]}>
              {w}
            </ThemedText>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />;
            const on = d.getTime() === day.getTime();
            const isToday = d.getTime() === today.getTime();
            const m = marks(d);
            return (
              <Pressable
                key={d.toDateString()}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일${m.plan ? ', 일정' : ''}${m.memo ? ', 메모' : ''}`}
                onPress={() => {
                  tap();
                  setDay(d);
                }}
                style={styles.cell}>
                <View style={[styles.num, isToday && { backgroundColor: c.ink }, on && !isToday && { borderWidth: 2, borderColor: c.ink }]}>
                  <ThemedText type="label" style={{ fontWeight: isToday || on ? 700 : 500, color: isToday ? c.onInk : d.getDay() === 0 ? c.tempFg : c.text, fontVariant: ['tabular-nums'] }}>
                    {d.getDate()}
                  </ThemedText>
                </View>
                <View style={styles.dots}>
                  {m.memo && <View style={[styles.dot, { backgroundColor: c.memoFg }]} />}
                  {m.plan && <View style={[styles.dot, { backgroundColor: c.accent }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <ThemedText type="heading" style={styles.dayTitle}>
          {`${day.getMonth() + 1}월 ${day.getDate()}일 ${WEEKDAYS[day.getDay()]}`}
        </ThemedText>
        {dayList.length === 0 && (
          <ThemedText type="small" style={{ color: c.textSecondary, paddingVertical: 12 }}>
            이날은 메모와 일정이 없어요
          </ThemedText>
        )}
        {dayList.map((e) => (
          <Pressable
            key={e.key}
            accessibilityRole="button"
            accessibilityLabel={`${e.kind === 'memo' ? '메모' : '일정'} ${e.title}, ${e.meta}`}
            onPress={() => {
              tap();
              if (e.kind === 'memo') setMemoOpen({ id: e.id });
              else setTodoEdit(e.id);
            }}
            style={({ pressed }) => [styles.row, { borderTopColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.tile, { backgroundColor: e.kind === 'memo' ? c.memoBg : c.accentSoft }]}>
              <Ionicons name={e.kind === 'memo' ? 'document-text-outline' : 'calendar-outline'} size={19} color={e.kind === 'memo' ? c.memoFg : c.accent} />
            </View>
            <View style={styles.flex}>
              <ThemedText type="heading" numberOfLines={2} style={styles.rowTitle}>
                {e.title}
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {e.meta}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12, backgroundColor: c.background }]}>
        <Button label="메모 쓰기" icon="document-text-outline" size="lg" style={styles.flex} onPress={() => setMemoOpen({ id: null })} />
        <Button label="일정 추가" icon="calendar-outline" variant="secondary" size="lg" style={styles.flex} onPress={() => setPlanOpen(true)} />
      </View>

      <MemoSheet
        key={memoOpen ? `memo-${memoOpen.id ?? 'new'}` : 'memo-closed'}
        open={memoOpen !== null}
        memo={editingMemo}
        dayText={`${day.getMonth() + 1}월 ${day.getDate()}일`}
        facts={memoFacts.facts}
        summary={memoFacts.summary}
        factsLabel={memoFacts.label}
        onSave={(text) => {
          if (editingMemo) void updateMemo(editingMemo.id, text);
          else void addMemo(text, memoAt());
          setMemoOpen(null);
        }}
        onDelete={editingMemo ? () => void removeMemo(editingMemo.id).then(() => setMemoOpen(null)) : undefined}
        onClose={() => setMemoOpen(null)}
      />
      {editingTodo && (
        <TodoSheet
          todo={editingTodo}
          topics={topics}
          onClose={() => setTodoEdit(null)}
          onSave={(patch) => {
            void updateTodo(editingTodo.id, patch);
            setTodoEdit(null);
          }}
          onDelete={() => {
            void removeTodo(editingTodo.id);
            setTodoEdit(null);
          }}
        />
      )}
      <PlanSheet
        open={planOpen}
        day={day}
        onClose={() => setPlanOpen(false)}
        onSave={(title, time) => {
          const [h, m] = time ? time.split(':').map(Number) : [0, 0];
          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
          void addTodo({ title, dueAt: at.toISOString(), hasTime: time !== null });
          setPlanOpen(false);
        }}
      />
    </ThemedView>
  );
}

/** 일정 추가 — 이름과 시각(선택). 날짜는 달력에서 고른 날 */
function PlanSheet({ open, day, onClose, onSave }: { open: boolean; day: Date; onClose: () => void; onSave: (title: string, time: string | null) => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState<string | null>(null);
  const close = () => {
    setTitle('');
    setTime(null);
    onClose();
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={close} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: 24 + insets.bottom }]}>
          <ThemedText type="title">{`${day.getMonth() + 1}월 ${day.getDate()}일 일정`}</ThemedText>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="예: 할머니 오시는 날"
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="일정 이름"
            style={[styles.field, { backgroundColor: c.surface, color: c.text }]}
          />
          <View style={[styles.timeRow, { borderColor: c.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={time ? `시각 ${timeLabel(time)}, 눌러서 바꾸기` : '시각 정하기'}
              onPress={() => {
                tap();
                if (!time) setTime('10:00');
                else if (!INLINE_WHEEL) pickTime(time, setTime);
              }}
              style={styles.timePick}>
              <Ionicons name="time-outline" size={18} color={c.textSecondary} />
              <ThemedText type="label" style={[styles.flex, { fontWeight: 600 }]}>
                {time ? timeLabel(time) : '하루 종일'}
              </ThemedText>
            </Pressable>
            {time && (
              <Pressable accessibilityRole="button" accessibilityLabel="시각 지우기" hitSlop={8} onPress={() => setTime(null)}>
                <Ionicons name="close-circle" size={18} color={c.textSecondary} />
              </Pressable>
            )}
          </View>
          {time && INLINE_WHEEL && <TimeWheel value={time} onChange={setTime} />}
          <Button label="추가" size="lg" disabled={!title.trim()} onPress={() => onSave(title.trim(), time)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 17, fontVariant: ['tabular-nums'] },
  body: { paddingHorizontal: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  week: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', gap: 3 },
  num: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayTitle: { marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, gap: 14 },
  field: { height: 52, borderRadius: 12, paddingHorizontal: 14, fontFamily: FontFamily.semibold, fontSize: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  timePick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48 },
});
