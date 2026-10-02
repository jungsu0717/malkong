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
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AnswerBubble,
  DateDivider,
  DoneTrace,
  ErrorBubble,
  FollowupBubble,
  RedflagCard,
  UserBubble,
} from '@/components/chat-bubbles';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThinkingStatus, type ThinkingStep } from '@/components/thinking-status';
import { Colors, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { dayKey, dayLabel } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { useRecords } from '@/data/records-context';
import { useMalkong, type AskFailure } from '@/hooks/use-malkong';

const SUGGESTED = [
  '밤중 수유는 언제부터 줄여도 되나요?',
  '이번 달 예방접종 뭐가 있죠?',
  '열이 38도예요. 병원에 가야 하나요?',
  '수면 교육은 언제부터 시작하나요?',
];

// 기다리는 동안의 단계 — 서버가 단계를 보내 주기 전까지는 순환 문구가 헤더를 맡는다(ask.md 처리 현황 블록)
const PENDING_STEPS: ThinkingStep[] = [
  { id: 'l2', title: '우리 아기 기록 확인', done: false },
  { id: 'l1', title: '표준 지식 찾기', done: false },
  { id: 'compose', title: '답변 정리', done: false },
];

/** 플로팅 버튼에서 넘어온 주소가 이보다 오래됐으면 새로 고침으로 남은 것이라 다시 보내지 않는다 */
const PARAM_FRESH_MS = 30_000;

function failureText(failure: AskFailure): string {
  if (failure.status === 0) return '인터넷 연결이 불안정해서 답을 받지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
  if (failure.status === 503) return '말콩이가 지금 답을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  if (failure.status === 422) return '질문을 알아듣지 못했어요. 조금 바꿔서 다시 물어봐 주세요.';
  return '잠깐 문제가 생겼어요. 다시 시도해 주세요.';
}

export default function AskScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { age, baby } = useBaby();
  const { loading } = useChat();
  const { records, remove } = useRecords();
  const { messages, pendingId, failure, openFollowup, send, reply, retry } = useMalkong();
  // 다른 탭의 플로팅 버튼에서 넘어온 질문 (SPEC-ASK-07). t 는 같은 질문을 다시 보냈을 때의 구분값이다
  const { q, t, focus, ft } = useLocalSearchParams<{
    q?: string;
    t?: string;
    /** 홈의 최근 질문에서 넘어온 질문 말풍선 id (SPEC-HOME-04) */
    focus?: string;
    ft?: string;
  }>();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const handledParam = useRef<string | null>(null);
  /** 말풍선 위치 — 최근 질문에서 넘어오면 그 자리로 스크롤한다 */
  const positions = useRef<Record<string, number>>({});
  const focusedKey = useRef<string | null>(null);
  /** 새 말풍선이 붙을 때 맨 끝을 따라갈지. 지난 질문 자리로 가 있는 동안은 끌어내리지 않는다 */
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

  // 넘어온 질문은 한 번만 보낸다 — 보낸 뒤 주소에서 지워 새로 고침해도 다시 나가지 않게 한다
  useEffect(() => {
    if (!q || loading || !age) return;
    const key = t ?? q;
    if (handledParam.current === key) return;
    handledParam.current = key;
    router.setParams({ q: undefined, t: undefined });
    if (t && Date.now() - Number(t) > PARAM_FRESH_MS) return;
    stickToEnd.current = true;
    void send(q);
  }, [q, t, loading, age, send]);

  if (!age || loading) return <ScreenLoading />;

  const submit = () => {
    if (!input.trim() || pendingId) return;
    stickToEnd.current = true;
    void send(input);
    setInput('');
  };

  // 타임라인 — 날짜가 바뀌는 자리마다 구분선(SPEC-ASK-10)
  const rows: React.ReactNode[] = [];
  let lastDay = '';
  for (const m of messages) {
    const day = dayKey(m.createdAt);
    if (day !== lastDay) {
      rows.push(<DateDivider key={`d-${day}`} label={dayLabel(m.createdAt, baby?.birthDate ?? null)} />);
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
    rows.push(<DoneTrace key={`t-${m.id}`} trace={m.meta.trace} />);
    rows.push(
      m.meta.type === 'answer' ? (
        <AnswerBubble key={m.id} message={m} records={records} onRemoveRecord={remove} />
      ) : (
        <FollowupBubble
          key={m.id}
          message={m}
          open={m.id === openFollowup?.id && !pendingId}
          onChip={(chip) => {
            stickToEnd.current = true;
            void reply(m, chip);
          }}
        />
      ),
    );
  }
  if (pendingId) {
    rows.push(<ThinkingStatus key={`p-${pendingId}`} steps={PENDING_STEPS} done={false} />);
  } else if (failure) {
    rows.push(<ErrorBubble key="error" text={failureText(failure)} onRetry={() => void retry()} />);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <ThemedText type="title">말콩이</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              만 {age.month}개월 아기 기준으로 답해요
            </ThemedText>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (messages.length && stickToEnd.current) scrollRef.current?.scrollToEnd({ animated: true });
            }}>
            {/* 말콩이 인사 말풍선 */}
            <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText>
                안녕하세요, 말콩이예요 🌱{'\n'}만 {age.month}개월에 맞춰서 답해드릴게요. 무엇이든
                물어보세요.
              </ThemedText>
            </View>

            {messages.length === 0 && (
              <>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  이런 걸 많이 물어봐요 — 누르면 입력창에 담겨요
                </ThemedText>
                <View style={styles.chipWrap}>
                  {SUGGESTED.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.chip, { backgroundColor: colors.accentSoft }]}
                      onPress={() => setInput(s)}>
                      <ThemedText type="small" style={{ color: colors.accent }}>
                        {s}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {rows}
          </ScrollView>

          {/* 입력 바 */}
          <View style={[styles.inputBar, { backgroundColor: colors.backgroundElement }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={openFollowup ? '답을 입력하거나 위에서 골라 주세요' : '말콩이에게 물어보세요'}
              placeholderTextColor={colors.textSecondary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: colors.accent, opacity: pendingId || !input.trim() ? 0.4 : 1 },
              ]}
              disabled={!!pendingId || !input.trim()}
              onPress={submit}>
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>
          <ThemedText type="small" style={[styles.disclaimer, { color: colors.textSecondary }]}>
            답변은 참고용이에요. 응급 상황은 119 또는 병원으로 연락하세요.
          </ThemedText>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.half,
  },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  bubble: {
    borderRadius: 20,
    borderTopLeftRadius: Spacing.one,
    padding: Spacing.four,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    borderRadius: 999,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
