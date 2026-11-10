/**
 * 물어보기 — 문장으로 적고 묻고 고치는 채팅 (SPEC-MAIN-12 · 13, task today/019 · 022, decisions/039 · 040).
 *
 * 하루 흐름 오른쪽 아래 단추로 연다. 위에는 흐름이 그대로 보이고, 이 창은 아래쪽을 덮는다(흐름은 계속 스크롤된다).
 * 처음 한 번 「지금 보는 날의 기록도 함께 읽을까요?」를 묻는다. 함께 읽으면 창 위에 「11월 6일 하루」와, 흐름에서 누른 기록 「선택 · …」이 칩으로 붙는다.
 * 묻는 말이면 기기 안 기록으로 답하고 그 기록을 흐름에서 비춘다. 기록하는 말이면 바로 저장하고 「되돌리기」 · 「수정」.
 * 「이거」, 「옮겨 줘」처럼 화면을 가리키거나 고치는 말, 규칙으로 못 읽은 말은 서버의 에이전트(/v1/agent)에게 보낸다.
 * 에이전트가 고치기 · 지우기 · 일정을 돌려주면 변경 카드로 보이고 「모두 적용」을 눌러야 반영한다. 적용한 뒤에도 「되돌리기」가 있다.
 * 변경 카드가 열려 있는 동안 바뀔 값은 흐름의 그 노드에 「초안」으로 먼저 보인다(SPEC-MAIN-16).
 * 「오늘 하루 기록 초안으로 작성해 줘」라고 하면 말한 기록과 지난 7일의 평소 시각으로 하루 초안을 만들어 흐름에 점선 노드로 놓고 「초안 8개」 카드를 보인다.
 * 초안은 흐름에서 눌러 고치거나 「오후 낮잠은 안 잤어」처럼 말로 고치고, 「모두 저장」을 눌러야 기록이 된다(decisions/041).
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ZzIcon } from '@/components/baby-icons';
import { NodeIcon, nodeTone, type ItemKind } from '@/components/flow/flow-graph';
import { MemoSheet } from '@/components/growth/memo-sheet';
import { KIND_UI } from '@/components/log/kinds';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { FontFamily } from '@/constants/theme';
import { parseAdd, type AddResult } from '@/data/add-parse';
import { answerText, asksPlan, changesFrom, dayContext, lastTurns, MAX_CONTEXT, onlyAdds, planFromText, pointsOrEdits, selectedLabel, sourceOfKey, ymd, type Change, type CtxSource, type DayContext, type Turn } from '@/data/agent';
import { askAgent, type AgentResponse } from '@/data/api';
import { answerFor, asksAverage, copula, followUp, HEALTH_REPLY, isHealth, isQuestion, looksMulti, queryFromServer, splitRecords, type Answer, type ParsedInput } from '@/data/ask';
import { asksDaySummary, daySummaryAnswer, findAnswer, knowsTerm, questionFits, type LocalAnswer, type LocalData } from '@/data/ask-local';
import { saveAskConsent, useAskConsent } from '@/data/ask-consent';
import { useBaby } from '@/data/baby-context';
import { applyChangeToDrafts, asksDraft, dayDrafts, draftContext, draftSummary, draftWhen, negatedDrafts, stripDraftAsk, type Draft, type DraftSet } from '@/data/day-draft';
import { asksDiary } from '@/data/day-facts';
import { hhmm } from '@/data/day-flow';
import type { CareEvent, EventInput, EventKind } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { memberName } from '@/data/family';
import { parseFind, WHAT_LABEL } from '@/data/find-parse';
import { useMemos } from '@/data/memos-context';
import { useRoutines } from '@/data/routines-context';
import { dayNumber, weekOf } from '@/data/stage';
import { useTodos } from '@/data/todos-context';
import { useDayFacts } from '@/hooks/use-day-facts';
import { useTheme } from '@/hooks/use-theme';

import type { Highlight, Preview } from './day-view';

/** 적은 기록 하나 — 되돌릴 때 지울 것 */
type Saved = { kind: 'event' | 'routine' | 'memo'; id: string; title: string; at: number; item: ItemKind; key: string };

/** 변경 카드의 상태 — 보이는 중, 적용함, 되돌림, 취소 */
type ChangeState = 'open' | 'applied' | 'undone' | 'cancelled';

type Msg =
  | { id: string; from: 'me'; text: string }
  | { id: string; from: 'app'; type: 'text'; text: string; steps?: string[] }
  | { id: string; from: 'app'; type: 'answer'; answer: Answer; steps?: string[] }
  | { id: string; from: 'app'; type: 'saved'; saved: Saved[]; undone: boolean; steps?: string[] }
  | { id: string; from: 'app'; type: 'card'; result: AddResult; used: boolean }
  | { id: string; from: 'app'; type: 'changes'; changes: Change[]; reply: string | null; steps: string[]; state: ChangeState }
  /** 하루 초안 카드 — 초안 목록은 화면 상태(drafts)에서 읽고, 저장한 뒤에는 적은 기록을 둔다. replaced 는 새 카드로 바뀌어 보이지 않는 것 */
  | { id: string; from: 'app'; type: 'draft'; steps: string[]; state: 'open' | 'saved' | 'dropped' | 'replaced'; saved: Saved[]; undone: boolean };

let seq = 0;
const nextId = () => `m${++seq}`;

const DEFAULT_SUGGEST = ['이전 수유 언제 했어?', '오늘 분유 몇 ml?', '마지막 대변은?'];
const NOT_READ = '잘 알아듣지 못했어요. 「분유 120 먹였어」, 「마지막 대변은?」처럼 적어 보세요.';
/** 「일주일 보기로」를 붙이는 범위 */
const WEEK_RANGES = ['thisWeek', 'lastWeek', 'recent7'];

/** 아이콘 칸 — 흐름 노드와 같은 색. 잠은 zZ, 일정은 달력 */
type Tile = ItemKind | 'sleep' | 'plan';

const itemOf = (input: EventInput): Tile =>
  input.kind === 'diaper' ? (input.diaper === 'pee' ? 'pee' : input.diaper === 'both' ? 'both' : 'poo') : input.kind === 'sleep' ? 'sleep' : (input.kind as ItemKind);

const tileOfSource = (s: CtxSource): Tile => (s.type === 'event' ? itemOf(s.event) : s.type === 'routine' ? 'routine' : 'memo');

const tileOfInput = (p: ParsedInput): Tile => (p.type === 'event' ? itemOf(p.input) : p.type === 'routine' ? 'routine' : 'memo');

const tileOfChange = (ch: Change): Tile => {
  if (ch.op === 'plan') return 'plan';
  if (ch.op === 'add') return tileOfInput(ch.input);
  return tileOfSource(ch.src);
};

/** 「분유 140ml를」 「소변을」 */
const objectOf = (word: string) => (copula(word) === '이에요' ? '을' : '를');

/** 규칙으로 읽은 기록 하나 — 다 적힌 것만 */
function recordOf(text: string, now: Date): ParsedInput[] {
  const r = parseAdd(text, now);
  return r?.type === 'record' && r.complete ? [{ type: 'event', input: r.input, complete: true, title: r.title }] : [];
}

/** 변경 카드가 열려 있는 동안 흐름에 먼저 보일 것 — 시각을 옮기면 「~~13:50~~ 13:40」, 지우면 「삭제」와 줄 긋기 */
function previewsOf(changes: Change[]): Preview[] {
  return changes.flatMap((ch): Preview[] => {
    if (ch.op === 'delete') return [{ key: ch.src.key, badge: '삭제', tone: 'danger', strike: true }];
    if (ch.op !== 'update') return [];
    const p = ch.patch;
    const src = ch.src;
    if (src.type === 'event' && 'startAt' in p && p.startAt) return [{ key: src.key, badge: '초안', subFrom: hhmm(src.event.startAt), sub: hhmm(p.startAt) }];
    if (src.type === 'routine' && 'at' in p) return [{ key: src.key, badge: '초안', subFrom: hhmm(src.log.at), sub: hhmm(p.at) }];
    return [{ key: src.key, badge: '초안' }];
  });
}

/** 앞 대화 — 에이전트가 「그 수유」를 알아듣게 */
function turnsOf(list: Msg[], drafts: Draft[]): Turn[] {
  return list.flatMap((m): Turn[] => {
    if (m.from === 'me') return [{ role: 'user', text: m.text }];
    if (m.type === 'text') return [{ role: 'app', text: m.text }];
    if (m.type === 'answer') return [{ role: 'app', text: m.answer.text }];
    if (m.type === 'saved') return [{ role: 'app', text: `${m.undone ? '되돌림' : '적음'}: ${m.saved.map((s) => `${hhmm(s.at)} ${s.title}`).join(', ')}` }];
    if (m.type === 'changes') {
      const what = m.changes.map((ch) => (ch.op === 'plan' ? `일정 ${ch.title} ${ch.when}` : ch.op === 'update' ? `${ch.title} ${ch.from} → ${ch.to}` : `${ch.op === 'add' ? '추가' : '삭제'} ${ch.title}`));
      const state = m.state === 'applied' ? '적용함' : m.state === 'undone' ? '되돌림' : m.state === 'cancelled' ? '취소함' : '확인 기다림';
      return [{ role: 'app', text: `바꿀 것(${state}): ${what.join(', ')}` }];
    }
    if (m.type === 'draft') {
      if (m.state === 'open') return drafts.length ? [{ role: 'app', text: `${draftSummary(drafts)}(확인 기다림)` }] : [];
      if (m.state === 'saved') return [{ role: 'app', text: `초안 ${m.saved.length}개를 저장함` }];
      return m.state === 'dropped' ? [{ role: 'app', text: '초안을 버림' }] : [];
    }
    return [];
  });
}

export function AskSheet({
  open,
  day,
  selectedKey,
  onClearSelected,
  onClose,
  onHighlight,
  onOpenKind,
  onShowWeek,
  drafts,
  onDrafts,
  onPreview,
}: {
  open: boolean;
  /** 보고 있는 날 — 함께 읽기에 동의했으면 이날 기록을 보낸다 */
  day: Date;
  /** 창을 연 채 흐름 · 목록에서 누른 기록의 key */
  selectedKey: string | null;
  onClearSelected: () => void;
  onClose: () => void;
  /** 답한 기록이나 새 기록을 흐름에서 비춘다 — 창을 닫으면 null */
  onHighlight: (h: Highlight | null) => void;
  /** 모자란 기록이나 「+」의 체온 · 몸무게 · 키 — 그 입력 시트, 고칠 기록이 있으면 같이 */
  onOpenKind: (kind: EventKind, editing?: CareEvent) => void;
  /** 「일주일 보기로」 */
  onShowWeek: () => void;
  /** 하루 초안 — 흐름(DayView)과 같이 보는 화면 상태(SPEC-MAIN-16) */
  drafts: DraftSet | null;
  onDrafts: (next: DraftSet | null) => void;
  /** 변경 카드가 열려 있는 동안 흐름에 먼저 보일 것 */
  onPreview: (list: Preview[]) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const consent = useAskConsent();
  const { events, add: addEvent, update: updateEvent, remove: removeEvent } = useEvents();
  const { routines, logs, addRoutine, logTitle, logAt, moveLog, removeLog } = useRoutines();
  const { memos, addMemo, updateMemo, removeMemo } = useMemos();
  const { todos, topics, add: addTodo, update: updateTodo, remove: removeTodo } = useTodos();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [plus, setPlus] = useState(false);
  /** 「오늘 일기 써 줘」로 연 메모 창 — 그날 기록 칩은 창이 열려 있을 때만 센다 */
  const [diary, setDiary] = useState(false);
  const { baby } = useBaby();
  const diaryFacts = useDayFacts(diary ? day : null);
  const [lastAnswer, setLastAnswer] = useState<Answer | null>(null);
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  /** 적용한 변경 카드를 되돌리는 방법 — 메시지 id 별로 */
  const undos = useRef(new Map<string, () => Promise<void>>());

  if (!open) return null;

  const routineLogs = logs.flatMap((l) => {
    const r = routines.find((x) => x.id === l.routineId);
    return r ? [{ log: l, title: r.title }] : [];
  });
  const dayKey = ymd(day);
  const draftItems: Draft[] = drafts && drafts.day === dayKey ? drafts.items : [];
  /** 하루 초안이 열려 있는가 — 기록하는 말은 초안에 넣고, 입력 칸 안내가 바뀐다 */
  const drafting = draftItems.length > 0;
  // 함께 읽기로 했으면 그날 기록, 초안이 있으면 그 뒤에 이어 번호를 붙여 — 모델이 「그 낮잠」을 가리켜 초안을 고치게
  const context = (now: Date): DayContext | null => {
    if (consent !== 'yes') return null;
    const ctx = dayContext(day, events, routineLogs, memos, now);
    if (!draftItems.length) return ctx;
    const extra = draftContext(draftItems.slice(0, Math.max(0, MAX_CONTEXT - ctx.records.length)), ctx.records.length + 1);
    return { ...ctx, records: [...ctx.records, ...extra.records], sources: [...ctx.sources, ...extra.sources] };
  };
  const shown = consent === 'yes' ? context(new Date()) : null;
  const selected = shown ? sourceOfKey(shown, selectedKey) : null;
  const dayLabel = `${day.getMonth() + 1}월 ${day.getDate()}일`;

  const push = (...m: Msg[]) => setMsgs((prev) => [...prev, ...m]);
  const setMsg = (id: string, patch: Partial<Extract<Msg, { type: 'changes' }>> | Partial<Extract<Msg, { type: 'draft' }>> | { undone: boolean }) =>
    setMsgs((prev) => prev.map((x) => (x.id === id ? ({ ...x, ...patch } as Msg) : x)));
  const close = () => {
    onHighlight(null);
    onClearSelected();
    setPlus(false);
    onClose();
  };

  /** 초안 카드를 맨 아래에 다시 — 앞 카드는 보이지 않게 하고, 단계 줄(「✓ 초안에서 … 뺐어요」)을 위에 둔다 */
  const showDraftCard = (steps: string[]) =>
    setMsgs((prev) => [...prev.map((m) => (m.from === 'app' && m.type === 'draft' && m.state === 'open' ? { ...m, state: 'replaced' as const } : m)), { id: nextId(), from: 'app', type: 'draft', steps, state: 'open', saved: [], undone: false }]);

  const answer = (a: Answer, steps?: string[]) => {
    setLastAnswer(a);
    push({ id: nextId(), from: 'app', type: 'answer', answer: a, steps });
    onHighlight(a.keys.length ? { keys: a.keys, label: a.label } : null);
  };

  /** 기기 안에서 바로 답한 것 — 하루 전체, 루틴 · 할 일 · 메모를 이름으로 찾기(ask-local, 모델을 부르지 않는다) */
  const local = (): LocalData => ({ events, routines, logs, todos, generalTopic: topics.find((t) => t.kind === 'general')?.id ?? null, memos });
  const localReply = (a: LocalAnswer) => {
    setLastAnswer(null);
    push({ id: nextId(), from: 'app', type: 'text', text: a.text });
    onHighlight(a.keys.length ? { keys: a.keys, label: a.label } : null);
  };

  /** 루틴 이름으로 완료 한 줄 — 없는 이름이면 매일 체크 루틴을 만든다 */
  const doneRoutine = async (title: string, at: Date): Promise<Saved> => {
    const id = await logTitle(title, at);
    return { kind: 'routine', id, title, at: at.getTime(), item: 'routine', key: `routine-${id}` };
  };

  /** 기록들을 저장하고 「N개 적었어요」 — 모자란 것은 그 입력 시트를 연다 */
  const saveAll = async (list: ParsedInput[], steps?: string[]) => {
    const saved: Saved[] = [];
    let missing: EventKind | null = null;
    for (const x of list) {
      if (x.type === 'event') {
        if (!x.complete) {
          missing = missing ?? x.input.kind;
          continue;
        }
        const e = await addEvent(x.input);
        saved.push({ kind: 'event', id: e.id, title: x.title, at: new Date(e.startAt).getTime(), item: itemOf(x.input) as ItemKind, key: e.id });
      } else if (x.type === 'routine') {
        saved.push(await doneRoutine(x.title, new Date(x.at)));
      } else {
        const m = await addMemo(x.text, new Date(x.at));
        if (m) saved.push({ kind: 'memo', id: m.id, title: x.text.split('\n')[0], at: new Date(m.at).getTime(), item: 'memo', key: `memo-${m.id}` });
      }
    }
    if (saved.length) {
      tap('success');
      push({ id: nextId(), from: 'app', type: 'saved', saved, undone: false, steps });
      onHighlight({ keys: saved.map((s) => s.key), label: '새 기록' });
    }
    if (missing) {
      push({ id: nextId(), from: 'app', type: 'text', text: `${KIND_UI[missing].label}은 더 적을 것이 있어서 입력 창을 열게요.` });
      onOpenKind(missing);
    }
    if (!saved.length && !missing) push({ id: nextId(), from: 'app', type: 'text', text: NOT_READ });
  };

  /** 에이전트가 안 되거나 알아듣지 못했을 때 — 규칙으로 읽은 만큼 */
  const fallback = (s: string, now: Date, failed: boolean) => {
    if (pointsOrEdits(s)) {
      const why = consent !== 'yes' ? '기록을 고치려면 그날 기록을 함께 읽어야 해요. 마이에서 켤 수 있어요.' : failed ? '지금은 기록을 고칠 수 없어요. 잠시 뒤에 다시 해 보세요.' : '어느 기록인지 모르겠어요. 흐름에서 그 기록을 누르고 다시 말해 주세요.';
      push({ id: nextId(), from: 'app', type: 'text', text: why });
      return;
    }
    if (isQuestion(s)) {
      push({ id: nextId(), from: 'app', type: 'text', text: '찾는 기록이 없어요. 수유, 기저귀, 잠처럼 기록 이름을 넣어 보세요.' });
      return;
    }
    const split = looksMulti(s) ? splitRecords(s, now) : [];
    if (split.length) return void saveAll(split);
    const r = parseAdd(s, now);
    if (r?.type === 'record' && r.complete) return void saveAll([{ type: 'event', input: r.input, complete: true, title: r.title }]);
    if (r) push({ id: nextId(), from: 'app', type: 'card', result: r, used: false });
    else push({ id: nextId(), from: 'app', type: 'text', text: NOT_READ });
  };

  /** 서버의 에이전트에게 — 동의했으면 보는 날의 기록과 선택한 기록을 함께 */
  const viaAgent = async (s: string, now: Date) => {
    const ctx = context(now);
    const sel = ctx ? sourceOfKey(ctx, selectedKey) : null;
    setBusy(true);
    let res: AgentResponse | null = null;
    try {
      res = await askAgent({ text: s, history: lastTurns(turnsOf(msgs, draftItems)), day: ctx?.day ?? null, records: ctx?.records ?? [], selected: sel?.ref ?? null }, now);
    } catch {
      res = null;
    }
    setBusy(false);
    if (!res) return fallback(s, now, true);
    const steps = ctx ? [`${dayLabel} 기록 ${ctx.records.length}개를 읽었어요`] : [];
    if (res.type === 'health') {
      push({ id: nextId(), from: 'app', type: 'text', text: HEALTH_REPLY });
      return;
    }
    if (res.type === 'question') {
      const q = queryFromServer(res.question, now);
      // 물음에 없는 기록 종류를 고르면 쓰지 않는다 — 「손톱 잘랐나?」에 기저귀 답이 나왔다(빌드 15 피드백)
      if (q && questionFits(s, q.what)) return answer(answerFor(q, events, now, 0, asksAverage(s)));
    }
    if (res.type === 'changes') {
      let changes = changesFrom(res.actions, ctx, now, s);
      // 에이전트가 일정을 빠뜨렸으면 앱 규칙으로 문장에서 날짜와 이름을 읽는다
      if (asksPlan(s) && !changes.some((ch) => ch.op === 'plan')) {
        const plan = planFromText(s, now);
        if (plan) changes.push(plan);
      }
      // 하루 초안이 열려 있으면 — 초안을 가리킨 고치기 · 지우기는 초안에 바로, 새 기록은 초안에 넣는다
      if (drafting) {
        let items = draftItems;
        const lines: string[] = [];
        const rest: Change[] = [];
        for (const ch of changes) {
          const r = applyChangeToDrafts(items, ch);
          if (r) {
            items = r.items;
            lines.push(r.line);
          } else rest.push(ch);
        }
        const added = dayDrafts({ events: [], day, now, said: rest.flatMap((ch) => (ch.op === 'add' ? [ch.input] : [])), fill: false });
        if (added.length) {
          items = [...items, ...added].sort((a, b) => a.at - b.at);
          lines.push(...added.map((d) => `초안에 ${draftWhen(d)} ${d.title}${objectOf(d.title)} 넣었어요`));
        }
        changes = rest.filter((ch) => ch.op !== 'add');
        if (lines.length) {
          tap();
          onDrafts({ day: dayKey, items });
          showDraftCard(lines);
          if (!changes.length) return;
        }
      }
      if (onlyAdds(changes)) return saveAll(changes.flatMap((ch) => (ch.op === 'add' ? [ch.input] : [])), steps.length ? steps : undefined);
      if (changes.length) {
        tap();
        const previews = previewsOf(changes);
        push({ id: nextId(), from: 'app', type: 'changes', changes, reply: null, steps: [...steps, previews.length ? '바꿀 것을 흐름에 먼저 표시했어요' : `바꿀 것 ${changes.length}개를 정했어요`], state: 'open' });
        onPreview(previews);
        const keys = changes.flatMap((ch) => (ch.op === 'update' || ch.op === 'delete' ? [ch.src.key] : []));
        onHighlight(keys.length ? { keys, label: '바꿀 기록' } : null);
        return;
      }
    }
    // 답 — 에이전트는 기록만 고르고 문장은 앱이 그 기록으로 쓴다(헌장 13)
    if (res.type === 'answer' && ctx) {
      const a = answerText(res.highlight, ctx, s, dayLabel, now);
      push({ id: nextId(), from: 'app', type: 'text', text: a.text, steps });
      onHighlight(a.keys.length ? { keys: a.keys, label: '찾은 기록' } : null);
      return;
    }
    fallback(s, now, false);
  };

  /** 「오늘 하루 기록 초안으로 작성해 줘. 10시 반에 분유 140 먹었어」 — 말한 기록은 규칙으로 읽고(못 읽으면 에이전트에게 문장만), 나머지 때는 평소 기록으로 채운다 */
  const makeDraft = async (s: string, now: Date) => {
    const rest = stripDraftAsk(s);
    let said: ParsedInput[] = [];
    if (rest) {
      said = looksMulti(rest) ? splitRecords(rest, now) : recordOf(rest, now);
      if (!said.length) {
        setBusy(true);
        try {
          const res = await askAgent({ text: rest, history: [], day: null, records: [], selected: null }, now);
          if (res?.type === 'changes') said = changesFrom(res.actions, null, now, rest).flatMap((ch) => (ch.op === 'add' ? [ch.input] : []));
        } catch {
          said = [];
        }
        setBusy(false);
      }
    }
    const items = dayDrafts({ events, day, now, said, fill: true });
    if (!items.length) {
      push({ id: nextId(), from: 'app', type: 'text', text: `${dayLabel}에 초안으로 넣을 것이 없어요. 「10시 반에 분유 140 먹었어」처럼 적어 보세요.` });
      return;
    }
    const read = dayContext(day, events, routineLogs, memos, now).records.length;
    const guessed = items.filter((d) => d.guessed).length;
    tap();
    onDrafts({ day: dayKey, items });
    onHighlight(null);
    showDraftCard([`${dayLabel} 기록 ${read}개를 읽었어요`, ...(guessed ? ['말하지 않은 때는 지난 7일 기록을 보고 채웠어요'] : [])]);
  };

  /** 초안이 열린 채 기록하는 말 — 저장하지 않고 초안에 넣는다 */
  const addToDraft = (said: ParsedInput[], now: Date) => {
    const added = dayDrafts({ events: [], day, now, said, fill: false });
    if (!added.length) return push({ id: nextId(), from: 'app', type: 'text', text: NOT_READ });
    tap();
    onDrafts({ day: dayKey, items: [...draftItems, ...added].sort((a, b) => a.at - b.at) });
    showDraftCard(added.map((d) => `초안에 ${draftWhen(d)} ${d.title}${objectOf(d.title)} 넣었어요`));
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
    // 「오늘 일기 써 줘」 — 글은 사람이 쓴다. 메모 창을 열고 그날 기록을 칩으로 보인다(decisions/042)
    if (asksDiary(s)) {
      setDiary(true);
      push({ id: nextId(), from: 'app', type: 'text', text: '메모 창을 열었어요' });
      return;
    }
    if (asksDraft(s)) return makeDraft(s, now);
    if (drafting) {
      // 「오후 낮잠은 안 잤어」 — 규칙으로 정해지면 초안에서 바로 뺀다, 못 정하면 에이전트에게
      const gone = negatedDrafts(s, draftItems);
      if (gone.length) {
        tap();
        onDrafts({ day: dayKey, items: draftItems.filter((d) => !gone.includes(d)) });
        showDraftCard(gone.map((d) => `초안에서 ${draftWhen(d)} ${d.title}${objectOf(d.title)} 뺐어요`));
        return;
      }
      if (/안 |않았|없었|없어|아니/.test(s)) return viaAgent(s, now);
      // 기록하는 말은 저장하지 않고 초안에 넣는다
      if (!pointsOrEdits(s) && !isQuestion(s)) {
        const said = looksMulti(s) ? splitRecords(s, now) : recordOf(s, now);
        if (said.length) return addToDraft(said, now);
      }
    }

    // 화면을 가리키거나 고치는 말은 규칙으로 읽지 않는다
    if (!pointsOrEdits(s)) {
      // 「오늘 뭐 했어?」 · 「하루 요약해 줘」 — 그날 합계와 루틴을 앱이 바로(빌드 15 피드백)
      if (asksDaySummary(s)) return localReply(daySummaryAnswer(s, local(), day, now));
      if (isQuestion(s)) {
        // 「비타민D 먹였나?」 — 루틴 · 할 일 · 메모에 그 이름이 있으면 수유 찾기보다 먼저
        if (knowsTerm(s, local())) {
          const a = findAnswer(s, local(), day, now);
          if (a) return localReply(a);
        }
        const f = followUp(s, lastAnswer, now);
        if (f) return answer(answerFor(f.query, events, now, f.offset));
        const q = parseFind(s, now);
        if (q) return answer(answerFor(q, events, now, 0, asksAverage(s)));
        // 「오늘 손톱 잘랐나?」 — 기록 이름이 없는 물음은 모델에게 보내지 않고 이름으로 찾아 없으면 없다고
        const a = findAnswer(s, local(), day, now);
        if (a) return localReply(a);
      } else {
        // 기록하는 말 — 규칙으로 하나를 읽을 수 있고 여럿이 아니면 바로
        const r = parseAdd(s, now);
        if (r && !looksMulti(s)) {
          if (r.type === 'record' && r.complete) return saveAll([{ type: 'event', input: r.input, complete: true, title: r.title }]);
          if (r.type !== 'plain' || !/비타민|유산균|영양제|약/.test(s)) {
            push({ id: nextId(), from: 'app', type: 'card', result: r, used: false });
            return;
          }
        }
      }
    }
    await viaAgent(s, now);
  };

  const undo = async (m: Extract<Msg, { type: 'saved' }>) => {
    tap();
    for (const s of m.saved) {
      if (s.kind === 'event') await removeEvent(s.id);
      else if (s.kind === 'routine') await removeLog(s.id);
      else await removeMemo(s.id);
    }
    setMsg(m.id, { undone: true });
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

  /** 변경 하나 반영 — 되돌리는 방법과 비출 key */
  const applyOne = async (ch: Change): Promise<{ undo: () => Promise<void>; key: string | null } | null> => {
    if (ch.op === 'plan') {
      const t = await addTodo({ title: ch.title, dueAt: ch.at.toISOString(), hasTime: ch.hasTime });
      return t ? { undo: () => removeTodo(t.id), key: null } : null;
    }
    if (ch.op === 'add') {
      const x = ch.input;
      if (x.type === 'event') {
        const e = await addEvent(x.input);
        return { undo: () => removeEvent(e.id), key: e.id };
      }
      if (x.type === 'routine') {
        const id = await logTitle(x.title, new Date(x.at));
        return { undo: () => removeLog(id), key: `routine-${id}` };
      }
      const m = await addMemo(x.text, new Date(x.at));
      return m ? { undo: () => removeMemo(m.id), key: `memo-${m.id}` } : null;
    }
    const src = ch.src;
    if (ch.op === 'delete') {
      if (src.type === 'event') {
        const e = src.event;
        await removeEvent(e.id);
        return { undo: async () => void (await addEvent({ kind: e.kind, startAt: e.startAt, endAt: e.endAt, amount: e.amount, side: e.side, diaper: e.diaper, color: e.color, note: e.note, by: e.by })), key: null };
      }
      if (src.type === 'routine') {
        const l = src.log;
        await removeLog(l.id);
        return { undo: async () => void (await logAt(l.routineId, new Date(l.at), l.endAt ? new Date(l.endAt) : null)), key: null };
      }
      const m = src.memo;
      await removeMemo(m.id);
      return { undo: async () => void (await addMemo(m.text, new Date(m.at))), key: null };
    }
    const p = ch.patch;
    if (src.type === 'event' && !('at' in p) && !('text' in p)) {
      const e = src.event;
      const before = Object.fromEntries(Object.keys(p).map((k) => [k, e[k as keyof CareEvent]]));
      await updateEvent(e.id, p);
      return { undo: () => updateEvent(e.id, before), key: src.key };
    }
    if (src.type === 'routine' && 'at' in p) {
      const moved = await moveLog(src.log.id, new Date(p.at));
      return moved ? { undo: async () => void (await moveLog(moved, new Date(src.log.at))), key: `routine-${moved}` } : null;
    }
    if (src.type === 'memo' && 'text' in p) {
      const old = src.memo.text;
      await updateMemo(src.memo.id, p.text);
      return { undo: () => updateMemo(src.memo.id, old), key: src.key };
    }
    return null;
  };

  const applyChanges = async (m: Extract<Msg, { type: 'changes' }>) => {
    if (busy) return;
    tap('success');
    setBusy(true);
    const backs: (() => Promise<void>)[] = [];
    const keys: string[] = [];
    for (const ch of m.changes) {
      try {
        const done = await applyOne(ch);
        if (done) {
          backs.push(done.undo);
          if (done.key) keys.push(done.key);
        }
      } catch {
        // 하나가 안 되어도 나머지는 반영한다
      }
    }
    undos.current.set(m.id, async () => {
      for (const b of backs.reverse()) await b().catch(() => undefined);
    });
    setBusy(false);
    setMsg(m.id, { state: 'applied' });
    onPreview([]);
    onHighlight(keys.length ? { keys, label: '바꾼 기록' } : null);
  };

  const undoChanges = async (m: Extract<Msg, { type: 'changes' }>) => {
    tap();
    const back = undos.current.get(m.id);
    undos.current.delete(m.id);
    if (back) await back();
    setMsg(m.id, { state: 'undone' });
    onPreview([]);
    onHighlight(null);
  };

  /** 「모두 저장」 — 초안을 기록으로. 한 번에 되돌릴 수 있다 */
  const saveDraft = async (m: Extract<Msg, { type: 'draft' }>) => {
    if (busy || !draftItems.length) return;
    tap('success');
    setBusy(true);
    const saved: Saved[] = [];
    for (const d of draftItems) {
      try {
        const p = d.input;
        if (p.type === 'event') {
          const e = await addEvent(p.input);
          saved.push({ kind: 'event', id: e.id, title: d.title, at: new Date(e.startAt).getTime(), item: itemOf(p.input) as ItemKind, key: e.id });
        } else if (p.type === 'routine') saved.push(await doneRoutine(p.title, new Date(p.at)));
        else {
          const mm = await addMemo(p.text, new Date(p.at));
          if (mm) saved.push({ kind: 'memo', id: mm.id, title: d.title, at: new Date(mm.at).getTime(), item: 'memo', key: `memo-${mm.id}` });
        }
      } catch {
        // 하나가 안 되어도 나머지는 저장한다
      }
    }
    setBusy(false);
    onDrafts(null);
    setMsg(m.id, { state: 'saved', saved });
    onHighlight(saved.length ? { keys: saved.map((x) => x.key), label: '새 기록' } : null);
  };

  const dropDraft = (m: Extract<Msg, { type: 'draft' }>) => {
    tap();
    onDrafts(null);
    setMsg(m.id, { state: 'dropped' });
    onHighlight(null);
  };

  const undoDraft = async (m: Extract<Msg, { type: 'draft' }>) => {
    tap();
    for (const x of m.saved) {
      if (x.kind === 'event') await removeEvent(x.id);
      else if (x.kind === 'routine') await removeLog(x.id);
      else await removeMemo(x.id);
    }
    setMsg(m.id, { undone: true });
    onHighlight(null);
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

  // 선택한 기록이 있으면 그 기록에 할 말, 아니면 지난 답에 이어 묻기. 초안이 열려 있으면 단추 대신 입력 칸 안내만
  const suggest: { label: string; fill?: string }[] = drafting
    ? []
    : selected
      ? [{ label: '10분 앞으로 옮겨 줘' }, ...(selected.type === 'event' ? [{ label: '메모 남겨 줘', fill: '이 기록에 메모: ' }] : []), { label: '지워 줘' }]
      : (lastAnswer?.query ? [`그 전 ${WHAT_LABEL[lastAnswer.query.what]}${copula(WHAT_LABEL[lastAnswer.query.what]) === '이에요' ? '은' : '는'}?`, ...DEFAULT_SUGGEST.filter((x) => !x.includes(WHAT_LABEL[lastAnswer.query!.what]))].slice(0, 3) : DEFAULT_SUGGEST).map((label) => ({ label }));

  if (consent === null) {
    return (
      <View pointerEvents="box-none" style={styles.wrap}>
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: 10 + insets.bottom, shadowColor: c.text }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <View style={styles.head}>
            <View style={styles.headTitle} />
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={close} style={styles.close}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.consent}>
            <ThemedText type="title" style={styles.consentTitle}>
              {'지금 보는 날의 기록도\n함께 읽을까요?'}
            </ThemedText>
            <ThemedText type="body" style={{ color: c.textSecondary }}>
              그날 기록을 읽으면 「그 수유」, 「이거」 같은 말도 알아듣고 바로 고쳐 드려요.
            </ThemedText>
            <View>
              {[
                ['보내는 것', '지금 보는 날의 기록과 적은 문장'],
                ['받는 곳', 'Google Gemini (미국 등)'],
                ['쓰는 곳', '묻는 말에 답하고 기록을 고치는 데만'],
                ['보관', '육아버디 서버에 저장하지 않아요'],
              ].map(([k, v]) => (
                <View key={k} style={[styles.consentRow, { borderTopColor: c.border }]}>
                  <ThemedText type="label" style={[styles.consentKey, { color: c.textSecondary }]}>
                    {k}
                  </ThemedText>
                  <ThemedText type="body" style={styles.flex}>
                    {v}
                  </ThemedText>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.consentButtons}>
            <Button size="lg" label="동의하고 함께 읽기" onPress={() => void saveAskConsent('yes')} />
            <Button variant="ghost" label="문장만 읽기" onPress={() => void saveAskConsent('no')} />
          </View>
        </View>
      </View>
    );
  }

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
        {consent === 'yes' && (
          <View style={styles.ctxRow}>
            <View style={[styles.ctx, { backgroundColor: c.surface }]}>
              <Ionicons name="calendar-outline" size={14} color={c.textSecondary} />
              <ThemedText type="caption" style={styles.ctxText}>{`${dayLabel} 하루`}</ThemedText>
            </View>
            {selected && (
              <View style={[styles.ctx, styles.ctxSel, { backgroundColor: c.surface }]}>
                <RecTile tile={tileOfSource(selected)} title={selected.label} size={20} />
                <ThemedText type="caption" numberOfLines={1} style={[styles.ctxText, styles.shrink]}>
                  {`선택 · ${selectedLabel(selected)}`}
                </ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel="선택 풀기" hitSlop={8} onPress={onClearSelected} style={styles.ctxX}>
                  <Ionicons name="close" size={14} color={c.textSecondary} />
                </Pressable>
              </View>
            )}
          </View>
        )}

        <ScrollView
          ref={scroll}
          style={styles.msgs}
          contentContainerStyle={styles.msgsContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {msgs.length === 0 && (
            <ThemedText type="small" style={[styles.hint, { color: c.textSecondary }]}>
              {consent === 'yes'
                ? '「분유 120 먹였어」처럼 적으면 기록하고,\n흐름에서 기록을 누르고 「10분 앞으로 옮겨 줘」처럼 말하면 고쳐요.\n「오늘 하루 기록 초안으로 작성해 줘」, 「오늘 일기 써 줘」라고 해도 돼요.'
                : '「분유 120 먹였어」처럼 적으면 기록하고,\n「이전 수유 언제 했어?」처럼 물으면 답해요.\n「오늘 하루 기록 초안으로 작성해 줘」, 「오늘 일기 써 줘」라고 해도 돼요.'}
            </ThemedText>
          )}
          {msgs.map((m) => {
            if (m.from === 'app' && m.type === 'draft' && m.state === 'replaced') return null;
            if (m.from === 'me') {
              return (
                <View key={m.id} style={[styles.me, { backgroundColor: c.ink }]}>
                  <ThemedText type="body" style={{ color: c.onInk }}>
                    {m.text}
                  </ThemedText>
                </View>
              );
            }
            // 변경 카드와 초안 카드는 말풍선 대신 단계 줄과 넓은 카드로 — 흐름을 고치는 일이라 한눈에 보이게
            if (m.type === 'changes' || m.type === 'draft') {
              return (
                <View key={m.id} style={styles.wide}>
                  {m.steps.length > 0 && <Steps steps={m.steps} />}
                  <View style={[styles.cardBox, { borderColor: c.border, backgroundColor: c.card }]}>
                    {m.type === 'changes' ? (
                      <ChangesBody m={m} busy={busy} onApply={() => void applyChanges(m)} onCancel={() => (tap(), setMsg(m.id, { state: 'cancelled' }), onHighlight(null), onPreview([]))} onUndo={() => void undoChanges(m)} />
                    ) : (
                      <DraftBody m={m} items={draftItems} busy={busy} onSave={() => void saveDraft(m)} onDrop={() => dropDraft(m)} onUndo={() => void undoDraft(m)} />
                    )}
                  </View>
                </View>
              );
            }
            return (
              <View key={m.id} style={[styles.app, { backgroundColor: c.surface }]}>
                {'steps' in m && m.steps && m.steps.length > 0 && <Steps steps={m.steps} />}
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
                    {!m.answer.open && m.answer.query && WEEK_RANGES.includes(m.answer.query.range.key) && (
                      <SmallButton
                        label="일주일 보기로"
                        accent
                        onPress={() => {
                          close();
                          onShowWeek();
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
                          <RecTile tile={s.item} title={s.title} size={28} />
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
        ) : suggest.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {suggest.map((x) => (
              <Chip
                key={x.label}
                label={x.label}
                onPress={() => {
                  if (!x.fill) return void send(x.label);
                  setText(x.fill);
                  input.current?.focus();
                }}
              />
            ))}
          </ScrollView>
        ) : null}

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
            ref={input}
            value={text}
            onChangeText={setText}
            placeholder={drafting ? '고칠 것을 말해 주세요' : '기록하거나 물어보세요'}
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
      <MemoSheet
        key={diary ? 'diary-open' : 'diary-closed'}
        open={diary}
        memo={null}
        dayText={baby ? `D+${dayNumber(baby.birthDate, day)} · ${weekOf(dayNumber(baby.birthDate, day) - 1)}주차` : dayLabel}
        facts={diaryFacts.facts}
        summary={diaryFacts.summary}
        factsLabel={diaryFacts.label}
        onSave={(t) => {
          setDiary(false);
          // 오늘이면 지금, 지난날이면 그날 정오로 — 저장 카드와 되돌리기는 다른 기록과 같다
          const at = ymd(day) === ymd(new Date()) ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
          void saveAll([{ type: 'memo', text: t.trim(), at: at.toISOString() }]);
        }}
        onClose={() => setDiary(false)}
      />
    </KeyboardAvoidingView>
  );
}

/** 「✓ 11월 6일 기록 12개를 읽었어요」 — 점과 선으로 이어진 단계 줄(흐름처럼) */
function Steps({ steps }: { steps: string[] }) {
  const c = useTheme();
  return (
    <View style={styles.steps}>
      {steps.length > 1 && <View pointerEvents="none" style={[styles.stepLine, { backgroundColor: c.border }]} />}
      {steps.map((s) => (
        <View key={s} style={styles.step}>
          <View style={[styles.stepDot, { backgroundColor: c.ink }]}>
            <Ionicons name="checkmark" size={9} color={c.onInk} />
          </View>
          <ThemedText type="caption" style={[styles.flex, { color: c.textSecondary }]}>
            {s}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** 하루 초안 카드 — 「초안 8개」와 줄 셋(「모두 보기」로 다), 「모두 저장」 · 「버리기」. 저장한 뒤에는 「N개 적었어요」와 「되돌리기」 */
function DraftBody({ m, items, busy, onSave, onDrop, onUndo }: { m: Extract<Msg, { type: 'draft' }>; items: Draft[]; busy: boolean; onSave: () => void; onDrop: () => void; onUndo: () => void }) {
  const c = useTheme();
  const [all, setAll] = useState(false);
  if (m.state === 'dropped') return <ThemedText type="body">초안을 버렸어요.</ThemedText>;
  if (m.state === 'saved') {
    return (
      <>
        <ThemedText type="body">{m.undone ? '되돌렸어요.' : `초안 ${m.saved.length}개를 적었어요.`}</ThemedText>
        {!m.undone && <SmallButton label="되돌리기" onPress={onUndo} />}
      </>
    );
  }
  if (!items.length) return <ThemedText type="body">초안에 남은 것이 없어요. 「10시 반에 분유 140 먹었어」처럼 적으면 초안에 넣어요.</ThemedText>;
  const rows = all || items.length <= 4 ? items : items.slice(0, 3);
  return (
    <>
      <View style={styles.cardHead}>
        <ThemedText type="heading">{`초안 ${items.length}개`}</ThemedText>
        {items.length > 4 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: all }}
            hitSlop={6}
            onPress={() => {
              tap();
              setAll((v) => !v);
            }}
            style={styles.more}>
            <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 600 }}>
              {all ? '접기' : '모두 보기'}
            </ThemedText>
            <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={14} color={c.textSecondary} />
          </Pressable>
        )}
      </View>
      <View>
        {rows.map((d) => (
          <View key={d.id} style={styles.draftRow}>
            <RecTile tile={tileOfInput(d.input)} title={d.title} size={24} />
            <ThemedText type="label" style={[styles.draftTime, { color: c.textSecondary }]}>
              {draftWhen(d)}
            </ThemedText>
            <ThemedText type="label" numberOfLines={1} style={[styles.flex, { fontWeight: 700 }]}>
              {d.title}
            </ThemedText>
            {d.edited && (
              <View style={[styles.edited, { backgroundColor: c.accentSoft }]}>
                <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700 }}>
                  고침
                </ThemedText>
              </View>
            )}
          </View>
        ))}
        {rows.length < items.length && (
          <ThemedText type="caption" style={[styles.draftMore, { color: c.textSecondary }]}>
            {`… ${items.length - rows.length}개 더`}
          </ThemedText>
        )}
      </View>
      <View style={styles.row}>
        <SmallButton label="모두 저장" ink disabled={busy} onPress={onSave} />
        <SmallButton label="버리기" onPress={onDrop} />
      </View>
    </>
  );
}

/** 흐름 노드와 같은 색의 아이콘 칸 */
function RecTile({ tile, title, size }: { tile: Tile; title: string; size: number }) {
  const c = useTheme();
  const icon = Math.round(size * 0.54);
  if (tile === 'plan')
    return (
      <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3 }, nodeTone('routine', c)]}>
        <Ionicons name="calendar-outline" size={icon} color={c.doneFg} />
      </View>
    );
  if (tile === 'sleep')
    return (
      <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.surfaceStrong }]}>
        <ZzIcon size={icon} color={c.text} />
      </View>
    );
  const round = tile === 'pee' || tile === 'poo' || tile === 'both';
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: round ? size / 2 : size * 0.3 }, nodeTone(tile, c)]}>
      <NodeIcon kind={tile} title={title} stool={null} size={icon} />
    </View>
  );
}

const TAG: Record<Change['op'], string> = { add: '추가', plan: '추가', update: '수정', delete: '삭제' };

/** 변경 카드 — 「이렇게 바꿀게요.」, 카드들, 「모두 적용」 · 「취소」, 적용한 뒤 「되돌리기」 */
function ChangesBody({ m, busy, onApply, onCancel, onUndo }: { m: Extract<Msg, { type: 'changes' }>; busy: boolean; onApply: () => void; onCancel: () => void; onUndo: () => void }) {
  const c = useTheme();
  const head = m.state === 'applied' ? '바꿨어요.' : m.state === 'undone' ? '되돌렸어요.' : m.state === 'cancelled' ? '바꾸지 않았어요.' : (m.reply ?? '이렇게 바꿀게요.');
  return (
    <>
      <ThemedText type="body">{head}</ThemedText>
      {(m.state === 'open' || m.state === 'applied') &&
        m.changes.map((ch, i) => {
          const tagColor = ch.op === 'update' ? c.accentText : ch.op === 'delete' ? c.danger : c.doneFg;
          const detail = ch.op === 'plan' ? `${ch.when} · 일정` : ch.op === 'add' ? hhmm(ch.at) : ch.op === 'delete' ? ch.from : '';
          return (
            <View key={`${ch.op}-${i}`} style={[styles.rec, styles.change, { backgroundColor: c.surface }]}>
              <RecTile tile={tileOfChange(ch)} title={ch.title} size={30} />
              <View style={styles.flex}>
                <ThemedText type="caption" style={{ color: tagColor, fontWeight: 700 }}>
                  {TAG[ch.op]}
                </ThemedText>
                <ThemedText type="label" numberOfLines={1} style={[styles.recTitle, ch.op === 'delete' && styles.strike]}>
                  {ch.title}
                </ThemedText>
                {ch.op === 'update' ? (
                  <ThemedText type="caption" style={{ color: c.textSecondary, fontVariant: ['tabular-nums'] }}>
                    <ThemedText type="caption" style={[styles.strike, { color: c.textSecondary }]}>
                      {ch.from}
                    </ThemedText>
                    {' → '}
                    <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 700 }}>
                      {ch.to}
                    </ThemedText>
                  </ThemedText>
                ) : (
                  <ThemedText type="caption" style={{ color: c.textSecondary, fontVariant: ['tabular-nums'] }}>
                    {detail}
                  </ThemedText>
                )}
              </View>
            </View>
          );
        })}
      {m.state === 'open' && (
        <View style={styles.row}>
          <SmallButton label="모두 적용" ink disabled={busy} onPress={onApply} />
          <SmallButton label="취소" onPress={onCancel} />
        </View>
      )}
      {m.state === 'applied' && <SmallButton label="되돌리기" onPress={onUndo} />}
    </>
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

function SmallButton({ label, accent = false, ink = false, disabled = false, onPress }: { label: string; accent?: boolean; ink?: boolean; disabled?: boolean; onPress: () => void }) {
  const c = useTheme();
  const color = ink ? c.onInk : accent ? c.accentText : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.small,
        ink ? { borderColor: c.ink, backgroundColor: c.ink, opacity: pressed || disabled ? 0.8 : 1 } : { borderColor: accent ? c.accent : c.border, backgroundColor: pressed ? c.surface : c.card },
      ]}>
      <ThemedText type="label" style={{ fontWeight: 700, color }}>
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
/** AI 비서 아이콘 — 말풍선 안에 반짝임(빌드 15 피드백 「ai agent 비서같은 아이콘으로 … 물어보기 같은 텍스트는 빼고」) */
export function AssistantIcon({ size = 28, color, spark }: { size?: number; color: string; spark: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-6l-4.2 3.2c-.4.3-.8 0-.8-.4v-2.8H6A2.5 2.5 0 0 1 3.5 15V7A2.5 2.5 0 0 1 6 4.5Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 6.9c.38 2.05 1.4 3.07 3.45 3.45-2.05.38-3.07 1.4-3.45 3.45-.38-2.05-1.4-3.07-3.45-3.45 2.05-.38 3.07-1.4 3.45-3.45Z" fill={spark} />
      <Path d="M16.2 12.6c.15.8.55 1.2 1.35 1.35-.8.15-1.2.55-1.35 1.35-.15-.8-.55-1.2-1.35-1.35.8-.15 1.2-.55 1.35-1.35Z" fill={spark} />
    </Svg>
  );
}

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
      <AssistantIcon color={c.onInk} spark={c.heroAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 20 },
  sheet: {
    // 아래 절반이 대화, 위 절반에는 흐름이 계속 보인다(7판 시안)
    height: '56%',
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
  tile: { alignItems: 'center', justifyContent: 'center' },
  change: { alignItems: 'flex-start', paddingVertical: 10 },
  strike: { textDecorationLine: 'line-through' },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  steps: { gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLine: { position: 'absolute', left: 6.25, top: 9, bottom: 9, width: 1.5 },
  stepDot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  wide: { alignSelf: 'stretch', gap: 8 },
  cardBox: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 28, paddingLeft: 6 },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 32 },
  draftTime: { width: 60, fontVariant: ['tabular-nums'] },
  draftMore: { paddingLeft: 34, paddingTop: 2 },
  edited: { height: 18, paddingHorizontal: 6, borderRadius: 9, justifyContent: 'center' },
  ctxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  ctx: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingLeft: 10, paddingRight: 12, borderRadius: 15, maxWidth: '100%' },
  ctxSel: { paddingLeft: 5, paddingRight: 4 },
  ctxText: { fontWeight: 600 },
  ctxX: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  consent: { paddingHorizontal: 24, paddingTop: 4, gap: 14 },
  consentTitle: { fontSize: 21, lineHeight: 28, letterSpacing: -0.4 },
  consentRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1 },
  consentKey: { width: 64 },
  consentButtons: { paddingHorizontal: 24, paddingTop: 12, gap: 4 },
  recTitle: { flex: 1, fontWeight: 700 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  // 가로 ScrollView 는 기본이 flexGrow 1 · flexShrink 1 — 대화 칸과 높이를 나눠 갖다가 키보드가 오르면 눌려 칩이 잘린다(빌드 15 피드백)
  chipRow: { flexGrow: 0, flexShrink: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  round46: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: 46, borderRadius: 23, borderWidth: 1.5, paddingHorizontal: 16, fontFamily: FontFamily.regular, fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 10,
  },
});
