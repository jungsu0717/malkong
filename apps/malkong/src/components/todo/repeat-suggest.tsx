/**
 * 반복 추천 카드 (SPEC-TOPIC-06, task topic/002) — 같은 할 일을 세 번 이상 완료했으면 「매달 1일에 반복할까요?」.
 * 「반복 설정」으로 반복 할 일을 만들고, 「다시 보지 않기」로 그 할 일은 더 묻지 않는다.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, tap } from '@/components/ui';
import { hasBatchim } from '@/data/briefing';
import { repeatLabel } from '@/data/repeat';
import type { RepeatSuggestion } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

export function RepeatSuggest({ suggestion }: { suggestion: RepeatSuggestion }) {
  const c = useTheme();
  const { acceptRepeat, dismissRepeat } = useTodos();
  const label = repeatLabel(suggestion.rule);
  // 「매일」 「3일마다」는 「~에」를 붙이지 않는다
  const when = suggestion.rule.kind === 'monthly' || suggestion.rule.kind === 'weekly' ? `${label}에` : label;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="repeat" size={20} color={c.accent} />
        <View style={styles.text}>
          <ThemedText type="body" style={{ fontWeight: 600 }}>
            {when} 반복할까요?
          </ThemedText>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {suggestion.title}
            {hasBatchim(suggestion.title) ? '을' : '를'} {suggestion.count}번 완료했어요
          </ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="다시 보지 않기" size="sm" variant="ghost" onPress={() => void dismissRepeat(suggestion.key)} />
        <Button
          label="반복 설정"
          size="sm"
          onPress={() => {
            tap('success');
            void acceptRepeat(suggestion, suggestion.rule);
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  text: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
