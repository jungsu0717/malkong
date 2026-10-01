import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThinkingStatus, type ThinkingStep } from '@/components/thinking-status';
import { Colors, Spacing } from '@/constants/theme';

const SUGGESTED = [
  '밤중 수유는 언제부터 줄여도 되나요?',
  '이번 달 예방접종 뭐가 있죠?',
  '열이 38도예요. 병원에 가야 하나요?',
  '수면 교육은 언제부터 시작하나요?',
];

// 처리 현황 시연 대본 — 라벨은 ask.md의 단계 표를 따른다 (내부 이름 노출 금지)
const DEMO_STEPS = [
  { id: 'l2', title: '우리 아기 기록 확인', brief: '접종 기록 1건' },
  { id: 'l1', title: '표준 지식 찾기', brief: '질병관리청 외 3건' },
  { id: 'compose', title: '답변 정리' },
];
const DEMO_STEP_MS = 2600;
const DEFAULT_QUESTION = '이번 달 예방접종 뭐가 있죠?';

const VACCINE_ANSWER =
  '3개월에는 예정된 국가 예방접종이 없어요. 다음은 4개월 — DTaP 2차, 폴리오 2차, b형 헤모필루스(Hib) 2차예요. 2개월 접종을 마쳤다는 기록이 있으니 일정대로면 돼요.';
const DEMO_FALLBACK_ANSWER =
  '지금은 화면 시연 단계라 준비된 예시 답변만 보여드릴 수 있어요. 말콩이가 연결되면 이 질문에 우리 아기 기록과 출처를 근거로 답해드릴게요.';

/** 전송 1회 = 예시 대화 1개: 질문 버블 → 처리 현황(단계 진행) → 답변 (SPEC-ASK-05 시연) */
function DemoExchange({ question }: { question: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    const timers = DEMO_STEPS.map((_, i) =>
      setTimeout(() => setDoneCount(i + 1), (i + 1) * DEMO_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const done = doneCount >= DEMO_STEPS.length;
  const steps: ThinkingStep[] = DEMO_STEPS.slice(0, done ? DEMO_STEPS.length : doneCount + 1).map(
    (s, i) => ({ ...s, done: i < doneCount }),
  );
  const isVaccine = question.includes('접종');

  return (
    <>
      <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
        <ThemedText style={styles.userBubbleText}>{question}</ThemedText>
      </View>
      <ThinkingStatus steps={steps} done={done} />
      {done && (
        <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText>{isVaccine ? VACCINE_ANSWER : DEMO_FALLBACK_ANSWER}</ThemedText>
          {isVaccine && (
            <View style={styles.sourceRow}>
              <Ionicons name="link-outline" size={13} color={colors.textSecondary} />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                질병관리청 예방접종도우미
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </>
  );
}

export default function AskScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [input, setInput] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const send = () => {
    setSent(input.trim() || DEFAULT_QUESTION);
    setSendCount((c) => c + 1);
    setInput('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">말콩이</ThemedText>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            3개월 아기 기준으로 답해요
          </ThemedText>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (sent) scrollRef.current?.scrollToEnd({ animated: true });
          }}>
          {/* 말콩이 인사 말풍선 */}
          <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
            <ThemedText>
              안녕하세요, 말콩이예요 🌱{'\n'}우리 아기 3개월차에 맞춰서 답해드릴게요. 무엇이든
              물어보세요.
            </ThemedText>
          </View>

          {/* 기록 수집 패턴 시연 — 답변 전에 필요한 것만 되묻고, 답은 기록으로 저장한다 */}
          <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
            <ThemedText style={styles.userBubbleText}>분유를 갑자기 잘 안 먹어요</ThemedText>
          </View>
          <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
            <ThemedText>
              답하기 전에 하나만 확인할게요. 평소 수유 텀과 한 번에 먹는 양이 어떻게 되나요?
            </ThemedText>
            <View style={styles.quickChips}>
              {['3시간 · 160ml', '4시간 · 200ml', '잘 모르겠어요'].map((c) => (
                <Pressable key={c} style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
                  <ThemedText type="small" style={{ color: colors.accent }}>
                    {c}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              알려주시면 기록해 두고, 같은 건 다시 묻지 않아요
            </ThemedText>
          </View>

          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            이런 걸 많이 물어봐요 — 누르면 입력창에 담겨요
          </ThemedText>
          <View style={styles.chipWrap}>
            {SUGGESTED.map((q) => (
              <Pressable
                key={q}
                style={[styles.chip, { backgroundColor: colors.accentSoft }]}
                onPress={() => setInput(q)}>
                <ThemedText type="small" style={{ color: colors.accent }}>
                  {q}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* 처리 현황 시연 (SPEC-ASK-05) — 전송하면 질문 아래에서 지금 하는 일이 보이고, 끝나면 접힌다.
              key=전송 횟수라 같은 질문을 다시 보내도 처음부터 재생된다 */}
          {sent && <DemoExchange key={sendCount} question={sent} />}
        </ScrollView>

        {/* 입력 바 */}
        <View style={[styles.inputBar, { backgroundColor: colors.backgroundElement }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="말콩이에게 물어보세요"
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable style={[styles.sendButton, { backgroundColor: colors.accent }]} onPress={send}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
        <ThemedText type="small" style={[styles.disclaimer, { color: colors.textSecondary }]}>
          답변은 참고용이에요. 응급 상황은 119 또는 병원으로 연락하세요.
        </ThemedText>
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
  userBubble: {
    borderRadius: 20,
    borderTopRightRadius: Spacing.one,
    padding: Spacing.three,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  userBubbleText: { color: '#ffffff' },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
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
