import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';

/**
 * 우리 아기 기록(L2) 보기·고치기 (SPEC-MY-02, task my/002).
 * 고치거나 지우면 records-context 를 거쳐 홈 추천과 답변에 보내는 기록이 바로 따라 바뀐다.
 */
export default function RecordsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { age } = useBaby();
  const { records, add } = useRecords();
  const [draft, setDraft] = useState('');

  if (!age) return <ScreenLoading />;

  const addDraft = async () => {
    const label = draft.trim();
    if (!label) return;
    setDraft('');
    await add({ kind: '기록', label, covers: [], whenLabel: `D+${age.days}에 적음` });
  };

  const newestFirst = [...records].reverse();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" style={{ color: colors.textSecondary }}>
          말콩이가 대화와 홈에서 모은 기록이에요. 틀린 건 고치고, 필요 없는 건 지울 수 있어요. 기록은 이 기기
          안에만 저장돼요.
        </ThemedText>

        <View style={[styles.addRow, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="직접 적기 (예: 몸무게 6.4kg)"
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            returnKeyType="done"
          />
          <Pressable onPress={addDraft} disabled={!draft.trim()} hitSlop={8}>
            <ThemedText type="label" style={{ color: draft.trim() ? colors.accent : colors.textSecondary }}>
              추가
            </ThemedText>
          </Pressable>
        </View>

        {newestFirst.length === 0 && (
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            아직 기록이 없어요. 홈에서 챙길 것을 완료하거나 말콩이에게 물어보면 여기에 쌓여요.
          </ThemedText>
        )}
        {newestFirst.map((record) => (
          <RecordRow key={record.id} record={record} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function RecordRow({ record }: { record: BabyRecord }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { remove, update } = useRecords();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    const label = editing?.trim();
    if (label && label !== record.label) await update(record.id, label);
    setEditing(null);
  };

  const meta = [record.kind, record.whenLabel, record.stale ? '다시 확인이 필요해요' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <ThemedView type="surface" style={styles.card}>
      {editing !== null ? (
        <TextInput
          style={[styles.editInput, { color: colors.text, borderColor: colors.accent }]}
          value={editing}
          onChangeText={setEditing}
          onSubmitEditing={save}
          autoFocus
          returnKeyType="done"
        />
      ) : (
        <ThemedText>{record.label}</ThemedText>
      )}
      <ThemedText type="small" style={{ color: record.stale ? colors.danger : colors.textSecondary }}>
        {meta}
      </ThemedText>

      <View style={styles.actions}>
        {editing !== null ? (
          <>
            <Action label="저장" color={colors.accent} onPress={save} />
            <Action label="취소" color={colors.textSecondary} onPress={() => setEditing(null)} />
          </>
        ) : confirming ? (
          <>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              지우면 이 기록을 근거로 한 추천도 바뀌어요
            </ThemedText>
            <Action label="지우기" color={colors.danger} onPress={() => remove(record.id)} />
            <Action label="취소" color={colors.textSecondary} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            <Action label="고치기" color={colors.accent} onPress={() => setEditing(record.label)} />
            <Action label="지우기" color={colors.danger} onPress={() => setConfirming(true)} />
            {record.sourceMessageId && (
              <Action
                label="대화 보기"
                color={colors.textSecondary}
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
    </ThemedView>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <ThemedText type="label" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.three },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  editInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
});
