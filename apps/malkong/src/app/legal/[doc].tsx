import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DRAFT, legalDoc } from '@/data/legal';
import { useTheme } from '@/hooks/use-theme';

/** 약관·개인정보 처리방침·의학 정보 고지·자주 묻는 질문 (SPEC-MY-03, task my/003). 본문 정본은 src/data/legal.ts */
export default function LegalScreen() {
  const c = useTheme();
  const { doc: id } = useLocalSearchParams<{ doc: string }>();
  const doc = legalDoc(id);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: doc?.title ?? '안내' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!doc ? (
          <ThemedText>찾는 문서가 없어요.</ThemedText>
        ) : (
          <>
            {DRAFT && doc.id !== 'faq' && (
              <View style={[styles.draft, { backgroundColor: c.surface }]}>
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  초안이에요 — 출시 전에 검토해 확정해요
                </ThemedText>
              </View>
            )}
            {doc.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <ThemedText type="heading">{section.heading}</ThemedText>
                {section.body.map((p) => (
                  <ThemedText key={p} type="body" style={{ color: c.textSecondary }}>
                    {p}
                  </ThemedText>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Gutter,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  draft: { borderRadius: Radius.md, padding: 12 },
  section: { gap: Spacing.two },
});
