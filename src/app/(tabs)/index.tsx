import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BuddyMark } from '@/components/brand';
import { BriefingCard } from '@/components/briefing-card';
import {
  AnswerBubble,
  DateDivider,
  DoneTrace,
  ErrorBubble,
  FollowupBubble,
  LimitBubble,
  RedflagCard,
  UserBubble,
} from '@/components/chat-bubbles';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThinkingStatus, type ThinkingStep } from '@/components/thinking-status';
import { Chip, IconButton, tap } from '@/components/ui';
import { FontFamily, Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { canOfferRewardedAd } from '@/data/ads';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { dayKey, dayLabel } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useDraft } from '@/data/draft-context';
import { useEntitlements } from '@/data/entitlements-context';
import { useRecords } from '@/data/records-context';
import { useDailyBriefing } from '@/hooks/use-daily-briefing';
import { useMalkong, type AskFailure } from '@/hooks/use-malkong';
import { useMarkDone } from '@/hooks/use-mark-done';
import { useTheme } from '@/hooks/use-theme';

/** 입력창 위의 빠른 질문 — 누르면 입력창에 담긴다(SPEC-ASK-04). 고쳐서 보낼 수 있게 바로 보내지 않는다 */
const QUICK = [
  '이번 달 예방접종 뭐가 있죠?',
  '밤중 수유는 언제부터 줄여도 되나요?',
  '낮잠을 30분밖에 안 자요',
  '열이 38도예요. 병원에 가야 하나요?',
  '수면 교육은 언제부터 시작하나요?',
];

// 기다리는 동안의 단계 — 서버가 단계를 보내 주기 전까지는 순환 문구가 머리를 맡는다(ask.md 처리 현황 블록)
const PENDING_STEPS: ThinkingStep[] = [
  { id: 'l2', title: '우리 아기 기록 확인', done: false },
  { id: 'l1', title: '표준 지식 찾기', done: false },
  { id: 'compose', title: '답변 정리', done: false },
];

function failureText(failure: AskFailure): string {
  if (failure.status === 0) return '인터넷 연결이 불안정해서 답을 받지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
  if (failure.status === 503) return '버디가 지금 답을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  if (failure.status === 422) return '질문을 알아듣지 못했어요. 조금 바꿔서 다시 물어봐 주세요.';
  return '잠깐 문제가 생겼어요. 다시 시도해 주세요.';
}

/** 버디 탭 — 대화가 첫 화면이다 (decisions/012, 모양은 task ask/005) */
export default function ChatScreen() {
  const c = useTheme();
  const { age, baby, loading: babyLoading } = useBaby();
  const { records, remove } = useRecords();
  const { loading } = useChat();
  // 그날 처음 열면 브리핑이 첫 메시지로 생긴다(SPEC-HOME-06)
  const today = useDailyBriefing();
  const { pick, justSaved, undo, sheet } = useMarkDone();
  const {
    messages,
    pendingId,
    failure,
    openFollowup,
    send,
    reply,
    retry,
    answerInEco,
    refillWithAd,
  } = useMalkong();
  /** 광고를 보는 중 — 한도 줄의 단추를 잠근다 */
  const [watching, setWatching] = useState(false);
  const [refillMissed, setRefillMissed] = useState(false);
  const { dailyLimit, remaining } = useEntitlements();
  // 기록 화면의 「대화 보기」에서 넘어온 질문 말풍선 id. ft 는 같은 줄을 다시 눌렀을 때의 구분값이다
  const { focus, ft } = useLocalSearchParams<{ focus?: string; ft?: string }>();
  // 입력창 글은 다른 탭이 말머리를 담을 수 있게 한곳에 둔다(draft-context)
  const { draft: input, setDraft: setInput, focusRequest } = useDraft();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** 줄 위치 — 「대화 보기」로 넘어오면 그 자리로 스크롤한다 */
  const positions = useRef<Record<string, number>>({});
  const focusedKey = useRef<string | null>(null);
  /** 새 줄이 붙을 때 맨 끝을 따라갈지. 지난 질문 자리로 가 있는 동안은 끌어내리지 않는다 */
  const stickToEnd = useRef(true);

  const scrollToFocus = (id: string) => {
    const key = `${focus}-${ft}`;
    if (id !== focus || focusedKey.current === key) return;
    const y = positions.current[id];
    if (y === undefined) return;
    focusedKey.current = key;
    stickToEnd.current = false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.four), animated: true });
  };

  // 이미 그려진 화면으로 넘어온 경우 — 위치를 알고 있으니 바로 간다. 처음 그려질 때는 onLayout 이 맡는다
  useEffect(() => {
    if (focus) scrollToFocus(focus);
  });

  // 다른 탭에서 말머리를 담아 넘어오면 입력창에 커서를 둔다
  useEffect(() => {
    if (focusRequest) setTimeout(() => inputRef.current?.focus(), 300);
  }, [focusRequest]);

  if (babyLoading || !age || loading) return <ScreenLoading />;

  const name = baby?.name ?? DEFAULT_BABY_NAME;
  const canSend = !!input.trim() && !pendingId;

  const submit = () => {
    if (!canSend) return;
    tap();
    stickToEnd.current = true;
    void send(input);
    setInput('');
  };

  // 타임라인 — 날짜가 바뀌는 자리마다 구분선(SPEC-ASK-10)
  const rows: React.ReactNode[] = [];
  // 답 → 그 답이 답한 원래 질문(되묻기 답을 거쳤으면 되묻기가 기억한 질문) — 피드백에 함께 보낼 때 쓴다
  const textOf = new Map(messages.map((m) => [m.id, m.content]));
  const questionOf = (questionId: string): string | null => {
    const asked = messages.find((m) => m.id === questionId);
    if (asked?.role === 'user' && asked.meta.replyTo) {
      const followup = messages.find((m) => m.id === asked.meta.replyTo);
      if (followup?.role === 'malkong' && followup.meta.type === 'followup') return followup.meta.question;
    }
    return textOf.get(questionId) ?? null;
  };
  let lastDay = '';
  for (const m of messages) {
    const day = dayKey(m.createdAt);
    const briefing = m.role === 'malkong' && m.meta.type === 'briefing';
    if (day !== lastDay) {
      // 하루가 브리핑으로 시작하면 브리핑이 날짜를 말하므로 구분선을 따로 긋지 않는다
      if (!briefing) {
        rows.push(<DateDivider key={`d-${day}`} label={dayLabel(m.createdAt, baby?.birthDate ?? null)} />);
      }
      lastDay = day;
    }
    if (m.role === 'user') {
      const id = m.id;
      rows.push(
        <View
          key={id}
          onLayout={(e) => {
            positions.current[id] = e.nativeEvent.layout.y;
            scrollToFocus(id);
          }}>
          <UserBubble text={m.content} />
        </View>,
      );
      continue;
    }
    if (m.meta.type === 'redflag') {
      rows.push(<RedflagCard key={m.id} message={m} />);
      continue;
    }
    if (m.meta.type === 'briefing') {
      const isToday = m.meta.day === today;
      rows.push(
        <BriefingCard
          key={m.id}
          message={m}
          today={isToday}
          onPick={pick}
          onPrompt={(text) => {
            setInput(text);
            inputRef.current?.focus();
          }}
          justSaved={isToday ? justSaved : null}
          onUndo={undo}
        />,
      );
      continue;
    }
    rows.push(
      <View key={m.id} style={styles.malkong}>
        <DoneTrace trace={m.meta.trace} />
        {m.meta.type === 'answer' ? (
          <AnswerBubble
            message={m}
            question={questionOf(m.meta.questionId)}
            records={records}
            onRemoveRecord={remove}
          />
        ) : (
          <FollowupBubble
            message={m}
            open={m.id === openFollowup?.id && !pendingId}
            onChip={(chip) => {
              stickToEnd.current = true;
              void reply(m, chip);
            }}
          />
        )}
      </View>,
    );
  }
  if (pendingId) {
    rows.push(<ThinkingStatus key={`p-${pendingId}`} steps={PENDING_STEPS} done={false} />);
  } else if (failure?.code === 'LIMIT_EXCEEDED') {
    rows.push(
      <LimitBubble
        key="limit"
        dailyLimit={dailyLimit}
        busy={watching}
        note={refillMissed ? '충전을 확인하지 못했어요. 광고를 끝까지 봤다면 잠시 뒤 다시 눌러 주세요' : null}
        onEco={() => {
          stickToEnd.current = true;
          void answerInEco();
        }}
        onReward={
          failure.limit?.rewardAvailable && canOfferRewardedAd()
            ? async () => {
                setWatching(true);
                setRefillMissed(false);
                stickToEnd.current = true;
                const ok = await refillWithAd();
                setWatching(false);
                setRefillMissed(!ok);
              }
            : undefined
        }
      />,
    );
  } else if (failure) {
    rows.push(<ErrorBubble key="error" text={failureText(failure)} onRetry={() => void retry()} />);
  }

  const showQuick = !input && !pendingId && !openFollowup;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <BuddyMark size={24} />
            <ThemedText type="heading" style={styles.brand}>
              육아버디
            </ThemedText>
            {/* 남은 정밀 답변 — 평소엔 숨기고 3회 이하일 때만 조용히(ask.md 한도 표시) */}
            {remaining !== null && remaining <= 3 && (
              <View style={[styles.pill, { backgroundColor: c.surface }]}>
                <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 500 }}>
                  {remaining > 0 ? `정밀 답변 ${remaining}회 남음` : '오늘 정밀 답변 끝 · 0시에 채워져요'}
                </ThemedText>
              </View>
            )}
            <IconButton icon="file-tray-full-outline" label="지난 브리핑" onPress={() => router.push('/briefings')} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => {
              if (messages.length && stickToEnd.current) scrollRef.current?.scrollToEnd({ animated: true });
            }}>
            {messages.length === 0 && (
              <View style={styles.hello}>
                <ThemedText type="display">
                  안녕하세요,{'\n'}버디예요
                </ThemedText>
                <ThemedText type="body" style={{ color: c.textSecondary }}>
                  만 {age.month}개월 {name} 기준으로 답해요. 이야기해 주신 건 기록해 두고, 다음 답에 반영할게요.
                </ThemedText>
              </View>
            )}
            {rows}
          </ScrollView>

          <View style={styles.composer}>
            {showQuick && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.quick}>
                {QUICK.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    onPress={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                  />
                ))}
              </ScrollView>
            )}
            <View style={[styles.inputBox, { backgroundColor: c.surface }]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: c.text }]}
                placeholder={openFollowup ? '답을 입력하거나 위에서 골라 주세요' : `${name}에 대해 무엇이든 물어보세요`}
                placeholderTextColor={c.textTertiary}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={submit}
                submitBehavior="submit"
                returnKeyType="send"
                multiline
                // 웹의 textarea 는 기본 두 줄 높이라 한 줄로 시작하게 한다
                {...(Platform.OS === 'web' ? { numberOfLines: 1 } : {})}
                maxLength={500}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="보내기"
                accessibilityState={{ disabled: !canSend }}
                style={[styles.send, { backgroundColor: canSend ? c.ink : c.surfaceStrong }]}
                disabled={!canSend}
                onPress={submit}>
                <Ionicons name="arrow-up" size={20} color={canSend ? c.onInk : c.textTertiary} />
              </Pressable>
            </View>
            <ThemedText type="caption" style={[styles.disclaimer, { color: c.textSecondary }]}>
              답변은 참고용이에요 · 응급 상황은 119 또는 병원으로
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {sheet}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    minHeight: 52,
  },
  brand: { flex: 1, fontWeight: 700 },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: 20,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hello: { gap: Spacing.two, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  malkong: { gap: 6 },
  composer: { paddingTop: Spacing.one, gap: Spacing.two },
  quick: { paddingHorizontal: Gutter - 4, gap: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    maxHeight: 120,
    paddingTop: 9,
    paddingBottom: 9,
  },
  send: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { textAlign: 'center', paddingBottom: Spacing.two },
});
