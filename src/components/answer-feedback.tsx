/**
 * 답변 피드백 — 좋아요/별로예요와 선택 의견 (SPEC-ASK-06, task ask/003).
 *
 * 강요하지 않는다: 답 아래 작은 단추 둘뿐이고, 누르지 않아도 모든 기능을 쓴다.
 * 질문과 답 원문은 「함께 보내기」를 골랐을 때만 서버로 간다(api-contract `/v1/feedback`).
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { postFeedback } from '@/data/api';
import type { MalkongMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';

type Props = { message: MalkongMessage; question: string | null };

export function AnswerFeedback({ message, question }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { updateMeta } = useChat();
  const [writing, setWriting] = useState(false);
  const [comment, setComment] = useState('');
  const [share, setShare] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (message.meta.type !== 'answer') return null;
  const meta = message.meta;

  const send = async (rating: 'up' | 'down') => {
    setSending(true);
    setFailed(false);
    try {
      await postFeedback({
        answerId: message.id,
        rating,
        ...(comment.trim() ? { comment: comment.trim().slice(0, 500) } : {}),
        answer: { level: meta.level, sourceIds: meta.sources.map((s) => s.id), eco: meta.eco },
        ...(share && question ? { shared: { question, answer: message.content } } : {}),
      });
      await updateMeta(message.id, { ...meta, feedback: rating });
      setWriting(false);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (meta.feedback && !writing) {
    return (
      <View style={styles.row}>
        <Ionicons
          name={meta.feedback === 'up' ? 'thumbs-up' : 'thumbs-down'}
          size={14}
          color={colors.accent}
        />
        <ThemedText type="small" style={{ color: colors.textSecondary }}>
          의견 고마워요. 더 나은 답을 만드는 데 쓸게요
        </ThemedText>
      </View>
    );
  }

  if (writing) {
    return (
      <View style={styles.form}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
          placeholder="어떤 점이 아쉬웠나요? (선택)"
          placeholderTextColor={colors.textSecondary}
          value={comment}
          onChangeText={setComment}
          maxLength={500}
          multiline
        />
        <Pressable
          style={styles.row}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: share }}
          onPress={() => setShare((v) => !v)}>
          <Ionicons
            name={share ? 'checkbox' : 'square-outline'}
            size={18}
            color={share ? colors.accent : colors.textSecondary}
          />
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            질문과 답도 함께 보내기 — 답을 고치는 데만 써요
          </ThemedText>
        </Pressable>
        <View style={styles.row}>
          <Pressable disabled={sending} onPress={() => send('down')} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: colors.accent }}>
              {sending ? '보내는 중…' : '보내기'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setWriting(false)} hitSlop={8}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              그만두기
            </ThemedText>
          </Pressable>
          {failed && (
            <ThemedText type="small" style={{ color: colors.danger }}>
              보내지 못했어요
            </ThemedText>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="도움이 됐어요"
        disabled={sending}
        onPress={() => send('up')}
        hitSlop={8}>
        <Ionicons name="thumbs-up-outline" size={16} color={colors.textSecondary} />
      </Pressable>
      <Pressable accessibilityLabel="별로예요" onPress={() => setWriting(true)} hitSlop={8}>
        <Ionicons name="thumbs-down-outline" size={16} color={colors.textSecondary} />
      </Pressable>
      {failed && (
        <ThemedText type="small" style={{ color: colors.danger }}>
          보내지 못했어요 — 다시 눌러 주세요
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  form: { gap: Spacing.two, marginTop: Spacing.one },
  input: {
    borderRadius: 12,
    padding: Spacing.two,
    minHeight: 60,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
