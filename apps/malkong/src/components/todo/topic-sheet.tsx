/**
 * 주제 만들기 · 편집 · 숨기기 (SPEC-TOPIC-01 · 12). 숨겨도 지우지 않는다 — 할 일 탭 아래 「숨긴 주제」에서 숨김 해제한다.
 *
 * 만들 때는 위에 추천 주제(어린이집 준비 · 여행 짐 · 외출 가방)가 있고, 누르면 할 일이 채워진 주제가 바로 생긴다.
 * 아래에서 이름과 아이콘을 골라 직접 만들 수도 있다. 이미 같은 이름의 주제가 있는 추천은 뺀다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, tap, type IconName } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { CUSTOM_ICONS, TOPIC_TEMPLATES, titleKey, type Topic } from '@/data/todos';
import { useTheme } from '@/hooks/use-theme';

export function TopicSheet({
  open,
  topic,
  existingTitles = [],
  onClose,
  onSave,
  onHide,
}: {
  open: boolean;
  /** 편집할 주제 — 없으면 새로 만들기 */
  topic: Topic | null;
  /** 이미 있는 주제 이름 — 같은 이름의 추천은 뺀다 */
  existingTitles?: string[];
  onClose: () => void;
  /** 추천 주제면 `items` 에 채울 할 일 제목들 */
  onSave: (title: string, icon: string | null, items?: string[]) => void;
  onHide?: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(topic?.title ?? '');
  const [icon, setIcon] = useState<string | null>(topic?.icon ?? null);
  // 직접 만든 주제와 새 주제만 아이콘을 고른다 — 기본 주제는 kind 의 아이콘 그대로
  const pickIcon = !topic || topic.kind === 'custom';
  const have = new Set(existingTitles.map(titleKey));
  const templates = topic ? [] : TOPIC_TEMPLATES.filter((t) => !have.has(titleKey(t.title)));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="title">{topic ? '주제 편집' : '새 주제'}</ThemedText>

            {templates.length > 0 && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  추천 주제
                </ThemedText>
                {templates.map((t) => (
                  <Pressable
                    key={t.title}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.title} 추가, 할 일 ${t.items.length}개`}
                    onPress={() => {
                      tap('success');
                      onSave(t.title, t.icon, t.items);
                    }}
                    style={({ pressed }) => [styles.template, { backgroundColor: c.surface }, pressed && { opacity: 0.6 }]}>
                    <Ionicons name={t.icon as IconName} size={22} color={c.text} />
                    <View style={styles.flex}>
                      <ThemedText type="body" style={{ fontWeight: 600 }}>
                        {t.title}
                      </ThemedText>
                      <ThemedText type="caption" numberOfLines={1} style={{ color: c.textSecondary }}>
                        {t.items.slice(0, 3).join(', ')} 외 {t.items.length - 3}개
                      </ThemedText>
                    </View>
                    <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                      추가
                    </ThemedText>
                  </Pressable>
                ))}
                <ThemedText type="label" style={[styles.or, { color: c.textSecondary }]}>
                  직접 만들기
                </ThemedText>
              </>
            )}

            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder="이름 (예: 이사 준비)"
              placeholderTextColor={c.textTertiary}
              maxLength={30}
            />
            {pickIcon && (
              <View style={styles.icons}>
                {CUSTOM_ICONS.map((name, i) => {
                  const selected = (icon ?? CUSTOM_ICONS[0]) === name;
                  return (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`아이콘 ${i + 1}`}
                      onPress={() => setIcon(name)}
                      style={[styles.icon, { backgroundColor: selected ? c.ink : c.surface }]}>
                      <Ionicons name={name} size={20} color={selected ? c.onInk : c.text} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
          <Button
            size="lg"
            label={topic ? '저장' : '만들기'}
            disabled={!title.trim()}
            onPress={() => onSave(title.trim(), pickIcon ? (icon ?? CUSTOM_ICONS[0]) : null)}
          />
          {topic && onHide && <Button variant="ghost" size="sm" label="이 주제 숨기기" onPress={onHide} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
    gap: Spacing.two,
    maxHeight: '90%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  content: { gap: Spacing.two, paddingBottom: Spacing.two },
  template: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.md, padding: Spacing.three },
  or: { paddingTop: Spacing.two },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
