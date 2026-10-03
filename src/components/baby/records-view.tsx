/**
 * 우리 아기 · 기록 — L2 보기·고치기·지우기·직접 적기 (SPEC-MY-02, task my/002 → 자리는 growth/001).
 * 고치거나 지우면 records-context 를 거쳐 챙길 것과 답변에 보내는 기록이 바로 따라 바뀐다.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, SectionHeader, tap } from '@/components/ui';
import { FontFamily, Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';
import { useTheme } from '@/hooks/use-theme';

export function RecordsView() {
  const c = useTheme();
  const { age } = useBaby();
  const { records, add } = useRecords();
  const [draft, setDraft] = useState('');
  if (!age) return null;

  const addDraft = async () => {
    const label = draft.trim();
    if (!label) return;
    tap('success');
    setDraft('');
    await add({ kind: '기록', label, covers: [], whenLabel: `D+${age.days}에 적음` });
  };

  const newestFirst = [...records].reverse();

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        버디가 대화와 챙길 것에서 모은 기록이에요. 다음 답에 반영되고, 이 기기 안에만 저장돼요.
      </ThemedText>

      <View style={[styles.addRow, { backgroundColor: c.surface }]}>
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder="직접 적기 (예: 몸무게 6.4kg)"
          placeholderTextColor={c.textTertiary}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addDraft}
          returnKeyType="done"
          maxLength={100}
        />
        <Pressable
          accessibilityRole="button"
          onPress={addDraft}
          disabled={!draft.trim()}
          style={[styles.addButton, { backgroundColor: draft.trim() ? c.ink : c.surfaceStrong }]}>
          <ThemedText type="label" style={{ color: draft.trim() ? c.onInk : c.textSecondary, fontWeight: 600 }}>
            추가
          </ThemedText>
        </Pressable>
      </View>

      {newestFirst.length === 0 ? (
        <EmptyState
          title="아직 기록이 없어요"
          detail="버디에게 물어보거나 챙길 것을 완료하면 여기에 쌓여요"
          action={{ label: '버디에게 물어보기', onPress: () => router.navigate('/') }}
        />
      ) : (
        <View style={styles.list}>
          <SectionHeader title="모은 기록" aside={`${newestFirst.length}건`} />
          {newestFirst.map((record) => (
            <RecordRow key={record.id} record={record} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function RecordRow({ record }: { record: BabyRecord }) {
  const c = useTheme();
  const { remove, update } = useRecords();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    const label = editing?.trim();
    if (label && label !== record.label) await update(record.id, label);
    setEditing(null);
  };

  const meta = [record.whenLabel, record.stale ? '다시 확인이 필요해요' : null].filter(Boolean).join(' · ');

  return (
    <Card style={styles.card}>
      {editing !== null ? (
        <TextInput
          style={[styles.editInput, { color: c.text, borderColor: c.text }]}
          value={editing}
          onChangeText={setEditing}
          onSubmitEditing={save}
          autoFocus
          returnKeyType="done"
        />
      ) : (
        <ThemedText type="body" style={{ fontWeight: 600 }}>
          {record.label}
        </ThemedText>
      )}
      {meta ? (
        <ThemedText type="caption" style={{ color: record.stale ? c.danger : c.textSecondary }}>
          {meta}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {editing !== null ? (
          <>
            <Action label="저장" color={c.text} onPress={save} />
            <Action label="취소" color={c.textSecondary} onPress={() => setEditing(null)} />
          </>
        ) : confirming ? (
          <>
            <ThemedText type="caption" style={[styles.flex, { color: c.textSecondary }]}>
              지우면 이 기록을 근거로 한 추천도 바뀌어요
            </ThemedText>
            <Action label="지우기" color={c.danger} onPress={() => remove(record.id)} />
            <Action label="취소" color={c.textSecondary} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            <Action label="고치기" color={c.text} onPress={() => setEditing(record.label)} />
            <Action label="지우기" color={c.textSecondary} onPress={() => setConfirming(true)} />
            {record.sourceMessageId && (
              <Action
                label="대화 보기"
                color={c.textSecondary}
                onPress={() =>
                  router.navigate({
                    pathname: '/',
                    params: { focus: record.sourceMessageId!, ft: String(Date.now()) },
                  })
                }
              />
            )}
          </>
        )}
      </View>
    </Card>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
      <ThemedText type="label" style={{ color, fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, fontFamily: FontFamily.regular, paddingVertical: 8 },
  addButton: { borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
  list: { gap: 10 },
  card: { gap: 4 },
  editInput: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 18, marginTop: 6 },
  flex: { flex: 1 },
});
