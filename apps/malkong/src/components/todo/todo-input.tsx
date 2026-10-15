/**
 * 할 일 적는 칸 (SPEC-TOPIC-03) — 화면 바닥에 늘 있다. 칸을 누르고 쓰고 완료, 두 번 터치로 한 줄이 생긴다.
 * 「내일 오전 10시」 같은 말은 바로 읽어 칸 위에 미리 보여 주고, 적은 뒤에도 칸을 비워 둔 채 키보드를 남겨 이어 적게 한다.
 * 주제 칩을 주면(할 일 탭 첫 화면) 어느 주제에 넣을지 고를 수 있다 — 고르지 않으면 제목으로 짐작한다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { dueLabel, parseDue, type ParsedDue } from '@/data/due-parse';
import { repeatLabel } from '@/data/repeat';
import type { Topic } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function TodoInput({
  placeholder,
  onAdd,
  topics,
  topicId,
  onTopic,
}: {
  placeholder: string;
  onAdd: (parsed: ParsedDue) => void;
  /** 고를 수 있는 주제 — 주면 칸 위에 칩으로 보인다 */
  topics?: Topic[];
  /** 고른 주제 — null 이면 짐작 */
  topicId?: string | null;
  onTopic?: (id: string | null) => void;
}) {
  const c = useTheme();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const parsed = text.trim() ? parseDue(text) : null;
  const canAdd = !!parsed;

  const submit = () => {
    if (!parsed) return;
    tap('success');
    onAdd(parsed);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      {topics && onTopic && focused && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          <Chip label="자동 분류" selected={!topicId} onPress={() => onTopic(null)} />
          {topics.map((t) => (
            <Chip key={t.id} label={t.title} selected={topicId === t.id} onPress={() => onTopic(t.id)} />
          ))}
        </ScrollView>
      )}
      {parsed?.dueAt && (
        <ThemedText type="caption" style={[styles.preview, { color: c.accentText }]}>
          {parsed.repeat
            ? `${repeatLabel(parsed.repeat)} 반복 · ${dueLabel(parsed.dueAt, parsed.hasTime)}부터`
            : parsed.hasTime
              ? `${dueLabel(parsed.dueAt, true)}에 알려 드려요`
              : `기한 ${dueLabel(parsed.dueAt, false)}`}
        </ThemedText>
      )}
      <View style={[styles.box, { backgroundColor: c.surface }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: c.text }]}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          submitBehavior="submit"
          returnKeyType="done"
          maxLength={200}
          {...(Platform.OS === 'web' ? { numberOfLines: 1 } : {})}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="할 일 추가"
          accessibilityState={{ disabled: !canAdd }}
          disabled={!canAdd}
          onPress={submit}
          style={[styles.send, { backgroundColor: canAdd ? c.ink : c.surfaceStrong }]}>
          <Ionicons name="add" size={22} color={canAdd ? c.onInk : c.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.one, paddingBottom: Spacing.two, gap: 6 },
  chips: { paddingHorizontal: Spacing.three, gap: 6 },
  preview: { paddingHorizontal: Spacing.four, fontWeight: 600 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  // minWidth 0 — 웹의 한 줄 입력칸은 기본 너비가 있어 줄지 않으면 넣기 단추를 밀어낸다
  input: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: FontFamily.regular, lineHeight: 22, paddingVertical: 9 },
  send: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
