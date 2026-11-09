/**
 * 물어보기 — 문장으로 적고 묻는 채팅 (SPEC-MAIN-12 · 13, task today/019, decisions/039).
 *
 * 하루 흐름 오른쪽 아래 단추로 연다. 위에는 흐름이 그대로 보이고, 이 창은 아래쪽을 덮는다(흐름은 계속 스크롤된다).
 * 묻는 말이면 기기 안 기록으로 답하고 그 기록을 흐름에서 비춘다. 기록하는 말이면 바로 저장하고 「되돌리기」 · 「수정」.
 * 할 일 · 루틴 · 이름만 있는 말은 예전 「추가」 시트처럼 카드를 눌러야 저장한다. 규칙으로 못 읽거나 기록이 여럿이면 서버의 모델로 읽는다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NodeIcon, nodeTone, type ItemKind } from '@/components/flow/flow-graph';
import { KIND_UI } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { FontFamily } from '@/constants/theme';
import { parseAdd, type AddResult } from '@/data/add-parse';
import { parseSentence } from '@/data/api';
import { answerFor, followUp, HEALTH_REPLY, inputsFromServer, isHealth, isQuestion, looksMulti, queryFromServer, splitRecords, type Answer, type ParsedInput } from '@/data/ask';
import { hhmm } from '@/data/day-flow';
import type { CareEvent, EventInput, EventKind } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { memberName } from '@/data/family';
import { parseFind, WHAT_LABEL } from '@/data/find-parse';
import { useMemos } from '@/data/memos-context';
import { useRoutines } from '@/data/routines-context';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

import type { Highlight } from './day-view';

/** 적은 기록 하나 — 되돌릴 때 지울 것 */
type Saved = { kind: 'event' | 'routine' | 'memo'; id: string; title: string; at: number; item: ItemKind; key: string };

type Msg =
  | { id: string; from: 'me'; text: string }
  | { id: string; from: 'app'; type: 'text'; text: string }
  | { id: string; from: 'app'; type: 'answer'; answer: Answer }
  | { id: string; from: 'app'; type: 'saved'; saved: Saved[]; undone: boolean }
  | { id: string; from: 'app'; type: 'card'; result: AddResult; used: boolean };

let seq = 0;
const nextId = () => `m${++seq}`;

const DEFAULT_SUGGEST = ['이전 수유 언제 했어?', '오늘 분유 몇 ml?', '마지막 대변은?'];

const itemOf = (input: EventInput): ItemKind =>
  input.kind === 'diaper' ? (input.diaper === 'pee' ? 'pee' : input.diaper === 'both' ? 'both' : 'poo') : (input.kind as ItemKind);

export function AskSheet({
  open,
  onClose,
  onHighlight,
  onOpenKind,
}: {
  open: boolean;
  onClose: () => void;
  /** 답한 기록이나 새 기록을 흐름에서 비춘다 — 창을 닫으면 null */
  onHighlight: (h: Highlight | null) => void;
  /** 모자란 기록이나 「+」의 체온 · 몸무게 · 키 — 그 입력 시트, 고칠 기록이 있으면 같이 */
  onOpenKind: (kind: EventKind, editing?: CareEvent) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { events, add: addEvent, remove: removeEvent } = useEvents();
  const { addRoutine, logTitle, removeLog } = useRoutines();
  const { addMemo, removeMemo } = useMemos();
  const { add: addTodo, update: updateTodo } = useTodos();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [plus, setPlus] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<Answer | null>(null);
  const scroll = useRef<ScrollView>(null);

  if (!open) return null;

  const push = (...m: Msg[]) => setMsgs((prev) => [...prev, ...m]);
  const close = () => {
    onHighlight(null);
    setPlus(false);
    onClose();
  };

  const answer = (a: Answer) => {
    setLastAnswer(a);
    push({ id: nextId(), from: 'app', type: 'answer', answer: a });
    onHighlight(a.keys.length ? { keys: a.keys, label: a.label } : null);
  };

  /** 루틴 이름으로 완료 한 줄 — 없는 이름이면 매일 체크 루틴을 만든다 */
  const doneRoutine = async (title: string, at: Date): Promise<Saved> => {
    const id = await logTitle(title, at);
    return { kind: 'routine', id, title, at: at.getTime(), item: 'routine', key: `routine-${id}` };
  };

  /** 기록들을 저장하고 「N개 적었어요」 — 모자란 것은 그 입력 시트를 연다 */
  const saveAll = async (list: ParsedInput[]) => {
    const saved: Saved[] = [];
    let missing: EventKind | null = null;
    for (const x of list) {
      if (x.type === 'event') {
        if (!x.complete) {
          missing = missing ?? x.input.kind;
          continue;
        }
        const e = await addEvent(x.input);
        saved.push({ kind: 'event', id: e.id, title: x.title, at: new Date(e.startAt).getTime(), item: itemOf(x.input), key: e.id });
      } else if (x.type === 'routine') {
        saved.push(await doneRoutine(x.title, new Date(x.at)));
      } else {
        const m = await addMemo(x.text, new Date(x.at));
        if (m) saved.push({ kind: 'memo', id: m.id, title: x.text.split('\n')[0], at: new Date(m.at).getTime(), item: 'memo', key: `memo-${m.id}` });
      }
    }
    if (saved.length) {
      tap('success');
      push({ id: nextId(), from: 'app', type: 'saved', saved, undone: false });
      onHighlight({ keys: saved.map((s) => s.key), label: '새 기록' });
    }
    if (missing) {
      push({ id: nextId(), from: 'app', type: 'text', text: `${KIND_UI[missing].label}은 더 적을 것이 있어서 입력 창을 열게요.` });
      onOpenKind(missing);
    }
    if (!saved.length && !missing) push({ id: nextId(), from: 'app', type: 'text', text: '잘 알아듣지 못했어요. 「분유 120 먹였어」, 「마지막 대변은?」처럼 적어 보세요.' });
  };

  /** 서버 모델로 읽기 — 안 되면 null */
  const viaServer = async (s: string) => {
    try {
      return await parseSentence(s);
    } catch {
      return null;
    }
  };

  const send = async (raw: string) => {
    const s = raw.trim();
    if (!s || busy) return;
    tap();
    setText('');
    setPlus(false);
    push({ id: nextId(), from: 'me', text: s });
    const now = new Date();

    if (isHealth(s)) {
      push({ id: nextId(), from: 'app', type: 'text', text: HEALTH_REPLY });
      return;
    }

    if (isQuestion(s)) {
      const f = followUp(s, lastAnswer, now);
      if (f) return answer(answerFor(f.query, events, now, f.offset));
      const q = parseFind(s, now);
      if (q) return answer(answerFor(q, events, now));
      setBusy(true);
      const res = await viaServer(s);
      setBusy(false);
      const sq = res?.type === 'question' ? queryFromServer(res.question, now) : null;
      if (res?.type === 'health') push({ id: nextId(), from: 'app', type: 'text', text: HEALTH_REPLY });
      else if (sq) answer(answerFor(sq, events, now));
      else push({ id: nextId(), from: 'app', type: 'text', text: '찾는 기록이 없어요. 수유, 기저귀, 잠처럼 기록 이름을 넣어 보세요.' });
      return;
    }

    // 기록하는 말 — 규칙으로 하나를 읽을 수 있고 여럿이 아니면 바로
    const r = parseAdd(s, now);
    if (r && !looksMulti(s)) {
      if (r.type === 'record' && r.complete) return saveAll([{ type: 'event', input: r.input, complete: true, title: r.title }]);
      if (r.type !== 'plain' || !/비타민|유산균|영양제|약/.test(s)) {
        push({ id: nextId(), from: 'app', type: 'card', result: r, used: false });
        return;
      }
    }
    setBusy(true);
    const res = await viaServer(s);
    setBusy(false);
    if (res?.type === 'health') {
      push({ id: nextId(), from: 'app', type: 'text', text: HEALTH_REPLY });
      return;
    }
    if (res?.type === 'records' && res.records.length) return saveAll(inputsFromServer(res.records, now));
    if (res?.type === 'question') {
      const sq = queryFromServer(res.question, now);
      if (sq) return answer(answerFor(sq, events, now));
    }
    // 서버가 안 되면 규칙으로 읽은 만큼 — 여럿이면 나눠 읽고, 하나면 그 기록이나 카드
    const split = looksMulti(s) ? splitRecords(s, now) : [];
    if (split.length) return saveAll(split);
    if (r?.type === 'record' && r.complete) return saveAll([{ type: 'event', input: r.input, complete: true, title: r.title }]);
    if (r) push({ id: nextId(), from: 'app', type: 'card', result: r, used: false });
    else push({ id: nextId(), from: 'app', type: 'text', text: '잘 알아듣지 못했어요. 「분유 120 먹였어」, 「마지막 대변은?」처럼 적어 보세요.' });
  };

  const undo = async (m: Extract<Msg, { type: 'saved' }>) => {
    tap();
    for (const s of m.saved) {
      if (s.kind === 'event') await removeEvent(s.id);
      else if (s.kind === 'routine') await removeLog(s.id);
      else await removeMemo(s.id);
    }
    setMsgs((prev) => prev.map((x) => (x.id === m.id && x.from === 'app' && x.type === 'saved' ? { ...x, undone: true } : x)));
    onHighlight(null);
  };

  const editSaved = (m: Extract<Msg, { type: 'saved' }>) => {
    tap();
    const first = m.saved[0];
    if (m.saved.length === 1 && first.kind === 'event') {
      const e = events.find((x) => x.id === first.id);
      if (e) return onOpenKind(e.kind, e);
    }
    const from = Math.min(...m.saved.map((s) => s.at));
    const to = Math.max(...m.saved.map((s) => s.at)) + 60 * 1000;
    close();
    router.push({ pathname: '/records', params: { from: String(from), to: String(to), open: first.key } });
  };

  const applyCard = async (m: Extract<Msg, { type: 'card' }>, act: 'todo' | 'routine' | 'done' | 'today' | 'detail') => {
    const r = m.result;
    const mark = (text: string) => setMsgs((prev) => [...prev.map((x) => (x.id === m.id && x.from === 'app' && x.type === 'card' ? { ...x, used: true } : x)), { id: nextId(), from: 'app' as const, type: 'text' as const, text }]);
    const today0 = () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };
    if (act === 'detail' && r.type === 'record') {
      onOpenKind(r.kind);
      return;
    }
    tap('success');
    if (act === 'todo' && r.type === 'todo') {
      await addTodo({ title: r.title, dueAt: r.dueAt.toISOString(), hasTime: r.hasTime, repeat: r.repeat });
      mark('할 일로 추가했어요.');
    } else if (act === 'routine' && r.type === 'routine') {
      await addRoutine(r.routine);
      mark('루틴으로 추가했어요.');
    } else if (act === 'done' && r.type === 'plain') {
      // 오늘 할 일을 만들고 바로 지금 완료로 — 흐름에서 체크 노드가 된다
      const todo = await addTodo({ title: r.title, dueAt: today0().toISOString(), hasTime: false });
      if (todo) await updateTodo(todo.id, { doneAt: new Date().toISOString(), doneBy: await memberName() });
      mark('완료로 기록했어요.');
    } else if (act === 'today' && r.type === 'plain') {
      await addTodo({ title: r.title, dueAt: today0().toISOString(), hasTime: false });
      mark('오늘 할 일로 추가했어요.');
    }
  };

  const suggest = lastAnswer?.query ? [`그 전 ${WHAT_LABEL[lastAnswer.query.what]}는?`, ...DEFAULT_SUGGEST.filter((x) => !x.includes(WHAT_LABEL[lastAnswer.query!.what]))].slice(0, 3) : DEFAULT_SUGGEST;

  return (
    <KeyboardAvoidingView pointerEvents="box-none" style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: 10 + insets.bottom, shadowColor: c.text }]}>
        <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
        <View style={styles.head}>
          <ThemedText type="heading" style={styles.headTitle}>
            물어보기
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={close} style={styles.close}>
            <Ionicons name="close" size={22} color={c.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          ref={scroll}
          style={styles.msgs}
          contentContainerStyle={styles.msgsContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {msgs.length === 0 && (
            <ThemedText type="small" style={[styles.hint, { color: c.textSecondary }]}>
              {'「분유 120 먹였어」처럼 적으면 기록하고,\n「이전 수유 언제 했어?」처럼 물으면 답해요.'}
            </ThemedText>
          )}
          {msgs.map((m) => {
            if (m.from === 'me') {
              return (
                <View key={m.id} style={[styles.me, { backgroundColor: c.ink }]}>
                  <ThemedText type="body" style={{ color: c.onInk }}>
                    {m.text}
                  </ThemedText>
                </View>
              );
            }
            return (
              <View key={m.id} style={[styles.app, { backgroundColor: c.surface }]}>
                {m.type === 'text' && <ThemedText type="body">{m.text}</ThemedText>}
                {m.type === 'answer' && (
                  <>
                    <ThemedText type="body">{m.answer.text}</ThemedText>
                    {m.answer.open && (
                      <SmallButton
                        label="이 기록 보기"
                        accent
                        onPress={() => {
                          const o = m.answer.open!;
                          close();
                          router.push({ pathname: '/records', params: o.kind === 'sleep' ? { sleep: o.key } : { from: String(o.at), to: String(o.at + 60 * 1000), open: o.key } });
                        }}
                      />
                    )}
                  </>
                )}
                {m.type === 'saved' && (
                  <>
                    <ThemedText type="body">{m.undone ? '되돌렸어요.' : m.saved.length === 1 ? '적었어요.' : `${m.saved.length}개 적었어요.`}</ThemedText>
                    {!m.undone &&
                      m.saved.map((s) => (
                        <View key={s.key} style={[styles.rec, { backgroundColor: c.card }]}>
                          <View style={[styles.recTile, nodeTone(s.item, c), s.item === 'pee' || s.item === 'poo' || s.item === 'both' ? styles.round : null]}>
                            <NodeIcon kind={s.item} title={s.title} stool={null} size={15} />
                          </View>
                          <ThemedText type="label" numberOfLines={1} style={styles.recTitle}>
                            {s.title}
                          </ThemedText>
                          <ThemedText type="caption" style={{ color: c.textSecondary, fontVariant: ['tabular-nums'] }}>
                            {hhmm(s.at)}
                          </ThemedText>
                        </View>
                      ))}
                    {!m.undone && (
                      <View style={styles.row}>
                        <SmallButton label="되돌리기" onPress={() => void undo(m)} />
                        <SmallButton label="수정" onPress={() => editSaved(m)} />
                      </View>
                    )}
                  </>
                )}
                {m.type === 'card' && <CardBody m={m} onUse={(act) => void applyCard(m, act)} />}
              </View>
            );
          })}
          {busy && (
            <View style={[styles.app, { backgroundColor: c.surface }]}>
              <ThemedText type="body" style={{ color: c.textSecondary }}>
                ···
              </ThemedText>
            </View>
          )}
        </ScrollView>

        {plus ? (
          <View style={styles.chips}>
            {(['temp', 'weight', 'height'] as EventKind[]).map((k) => (
              <Chip key={k} label={KIND_UI[k].label} icon={KIND_UI[k].icon} onPress={() => onOpenKind(k)} />
            ))}
            <Chip label="메모" icon="document-text-outline" onPress={() => setText((t) => (t ? t : '메모: '))} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {suggest.map((x) => (
              <Chip key={x} label={x} onPress={() => void send(x)} />
            ))}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="체온, 몸무게, 키, 메모 적기"
            accessibilityState={{ expanded: plus }}
            onPress={() => {
              tap();
              setPlus((p) => !p);
            }}
            style={[styles.round46, { borderColor: c.border, backgroundColor: plus ? c.surface : c.card }]}>
            <Ionicons name={plus ? 'close' : 'add'} size={22} color={c.text} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="기록하거나 물어보세요"
            placeholderTextColor={c.textTertiary}
            returnKeyType="send"
            onSubmitEditing={() => void send(text)}
            accessibilityLabel="기록하거나 물어볼 말"
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="보내기"
            disabled={!text.trim() || busy}
            onPress={() => void send(text)}
            style={[styles.round46, { backgroundColor: text.trim() && !busy ? c.ink : c.surfaceStrong, borderWidth: 0 }]}>
            <Ionicons name="arrow-up" size={22} color={text.trim() && !busy ? c.onInk : c.textSecondary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** 할 일 · 루틴 · 이름만 있는 말 · 모자란 기록 — 예전 「추가」 시트의 카드와 같은 단추 */
function CardBody({ m, onUse }: { m: Extract<Msg, { type: 'card' }>; onUse: (act: 'todo' | 'routine' | 'done' | 'today' | 'detail') => void }) {
  const r = m.result;
  if (m.used) return <ThemedText type="body">{r.title}</ThemedText>;
  if (r.type === 'record')
    return (
      <>
        <ThemedText type="body">{`${r.title}, ${r.when}. 더 적을 것이 있어요.`}</ThemedText>
        <SmallButton label="자세히 적기" onPress={() => onUse('detail')} />
      </>
    );
  if (r.type === 'todo')
    return (
      <>
        <ThemedText type="body">{`${r.title}, ${r.when}`}</ThemedText>
        <SmallButton label="할 일로 추가" onPress={() => onUse('todo')} />
      </>
    );
  if (r.type === 'routine')
    return (
      <>
        <ThemedText type="body">{`${r.title}, ${r.when}`}</ThemedText>
        <SmallButton label="루틴으로 추가" onPress={() => onUse('routine')} />
      </>
    );
  return (
    <>
      <ThemedText type="body">{r.title}</ThemedText>
      <View style={styles.row}>
        <SmallButton label="완료로 기록" onPress={() => onUse('done')} />
        <SmallButton label="오늘 할 일로 추가" onPress={() => onUse('today')} />
      </View>
    </>
  );
}

function SmallButton({ label, accent = false, onPress }: { label: string; accent?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.small, { borderColor: accent ? c.accent : c.border, backgroundColor: pressed ? c.surface : c.card }]}>
      <ThemedText type="label" style={{ fontWeight: 700, color: accent ? c.accentText : c.text }}>
        {label}
      </ThemedText>
      {accent && <Ionicons name="chevron-forward" size={14} color={c.accentText} />}
    </Pressable>
  );
}

function Chip({ label, icon, onPress }: { label: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card }]}>
      {icon && <Ionicons name={icon} size={15} color={c.text} />}
      <ThemedText type="label" style={{ fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 「버튼」 위치 — 하루 흐름 오른쪽 아래, 광고 위 */
export function AskButton({ onPress }: { onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="물어보기, 기록하거나 물어보기"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.fab, { backgroundColor: c.ink, shadowColor: c.text, opacity: pressed ? 0.9 : 1 }]}>
      <Ionicons name="chatbubble-ellipses-outline" size={20} color={c.onInk} />
      <ThemedText type="label" style={{ color: c.onInk, fontWeight: 700, fontSize: 15 }}>
        물어보기
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 20 },
  sheet: {
    maxHeight: '62%',
    minHeight: 360,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8 },
  headTitle: { flex: 1, fontSize: 17 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  msgs: { flexGrow: 1 },
  msgsContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  hint: { textAlign: 'center', paddingVertical: 16 },
  me: { alignSelf: 'flex-end', maxWidth: '80%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: 4 },
  app: { alignSelf: 'flex-start', maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomLeftRadius: 4, gap: 8 },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, minWidth: 200 },
  recTile: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 14 },
  recTitle: { flex: 1, fontWeight: 700 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  round46: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: 46, borderRadius: 23, borderWidth: 1.5, paddingHorizontal: 16, fontFamily: FontFamily.regular, fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingLeft: 16,
    paddingRight: 18,
    borderRadius: 26,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 10,
  },
});
