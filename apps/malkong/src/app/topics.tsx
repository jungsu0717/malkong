/**
 * 주제별 보기 (SPEC-TOPIC-01, task common/022) — 접종 · 검진, 기념일, 사이즈 바꾸기, 내 할 일. 할 일 탭의 「주제별 보기」 줄에서 들어온다.
 * 동그라미 아이콘 그리드에 지금 할 것의 수, 아래에 숨긴 주제와 「숨김 해제」. 누르면 그 주제 화면(전체 일정 · 완료한 것)으로 간다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopicGrid } from '@/components/todo/topic-grid';
import { iconOf } from '@/components/todo/topic-icons';
import { Card, ListRow } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { checkupGroups } from '@/data/checkup-todos';
import { useRecords } from '@/data/records-context';
import { isLegacyKind, nowCount, visibleTopics } from '@/data/todos';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

export default function TopicsScreen() {
  const c = useTheme();
  const { age } = useBaby();
  const { records } = useRecords();
  const { topics, todos, loading, updateTopic } = useTodos();
  const [showHidden, setShowHidden] = useState(false);
  const month = age?.month ?? 0;
  const dueCount = useMemo(() => checkupGroups(records, month).filter((g) => g.status === 'open').length, [records, month]);

  if (loading) return <ScreenLoading />;
  // 장보기와 직접 만든 목록(준비 목록)은 따로 본다
  const shown = visibleTopics(topics).filter((t) => t.kind !== 'shopping' && t.kind !== 'custom');
  // 사용자가 숨긴 주제만 — 예전 기본 주제(decisions/025)는 다시 보이지 않는다
  const hidden = topics.filter((t) => t.hidden && !isLegacyKind(t.kind) && t.kind !== 'custom');

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TopicGrid
          topics={shown.map((t) => ({
            id: t.id,
            title: t.title,
            icon: iconOf(t),
            count: nowCount(t, todos) + (t.kind === 'checkup' ? dueCount : 0),
          }))}
          onOpen={(id) => router.push({ pathname: '/topic/[id]', params: { id } })}
        />
        {hidden.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => setShowHidden((v) => !v)} style={styles.hiddenToggle}>
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              숨긴 주제 {hidden.length}개
            </ThemedText>
            <Ionicons name={showHidden ? 'chevron-up' : 'chevron-down'} size={14} color={c.textSecondary} />
          </Pressable>
        )}
        {showHidden && hidden.length > 0 && (
          <Card style={styles.rows}>
            {hidden.map((t, i) => (
              <ListRow
                key={t.id}
                divider={i > 0}
                icon={iconOf(t)}
                title={t.title}
                detail="숨김"
                right={
                  <Pressable accessibilityRole="button" onPress={() => void updateTopic(t.id, { hidden: false })} hitSlop={8}>
                    <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                      숨김 해제
                    </ThemedText>
                  </Pressable>
                }
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  rows: { paddingVertical: 2 },
  hiddenToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: 6 },
});
