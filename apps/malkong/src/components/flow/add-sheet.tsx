/**
 * 「추가」 — 한 줄로 적기 (SPEC-MAIN-12, task today/015). 바닥 기록 줄의 「추가」에서 연다.
 *
 * 적은 말을 add-parse.ts 가 규칙으로 읽고, 맞는 카드와 단추를 보인다 — 이름만이면 「완료로 기록」 · 「오늘 할 일로 추가」,
 * 날짜나 시각이 있으면 할 일, 반복이면 루틴, 기록 이름이 있으면 그 기록. 누르기 전에는 아무것도 저장하지 않는다.
 * 아래에 체온 · 몸무게 · 키 단추. 루틴 관리와 기록 알림은 마이에 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottleIcon } from '@/components/baby-icons';
import { KIND_UI } from '@/components/log/kinds';
import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { FontFamily, Spacing } from '@/constants/theme';
import { parseAdd, type AddResult } from '@/data/add-parse';
import type { EventKind } from '@/data/events';
import { useEvents } from '@/data/events-context';
import { memberName } from '@/data/family';
import { useRoutines } from '@/data/routines-context';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

export function AddSheet({ open, onClose, onOpenKind }: { open: boolean; onClose: () => void; onOpenKind: (kind: EventKind) => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const result = parseAdd(text);
  const { add: addEvent } = useEvents();
  const { add: addTodo, update: updateTodo } = useTodos();
  const { addRoutine } = useRoutines();

  const close = () => {
    setText('');
    onClose();
  };
  const done = () => {
    tap('success');
    close();
  };

  const today0 = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const saveRecord = async (r: Extract<AddResult, { type: 'record' }>) => {
    if (!r.complete) {
      close();
      onOpenKind(r.kind);
      return;
    }
    await addEvent(r.input);
    done();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={close} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">추가</ThemedText>
          <View style={[styles.field, { borderColor: c.ink, backgroundColor: c.card }]}>
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder="예: 오후 3시 산책"
              placeholderTextColor={c.textTertiary}
              returnKeyType="done"
              accessibilityLabel="추가할 것"
              style={[styles.input, { color: c.text }]}
            />
            {text.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="지우기" hitSlop={8} onPress={() => setText('')} style={styles.clear}>
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </Pressable>
            )}
          </View>

          {result?.type === 'record' && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${result.title}, ${result.when}. 눌러서 자세히 적기`}
                onPress={() => {
                  close();
                  onOpenKind(result.kind);
                }}
                style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surface : c.card, borderColor: c.border }]}>
                <View style={[styles.cardIcon, { backgroundColor: result.kind === 'breast' || result.kind === 'formula' ? c.accent : result.kind === 'sleep' ? c.ink : c.surfaceStrong }]}>
                  {result.kind === 'formula' ? (
                    <BottleIcon size={20} color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name={result.kind === 'breast' ? 'heart' : result.kind === 'sleep' ? 'moon' : KIND_UI[result.kind].icon}
                      size={19}
                      color={result.kind === 'breast' || result.kind === 'sleep' ? '#FFFFFF' : c.text}
                    />
                  )}
                </View>
                <View style={styles.flex}>
                  <ThemedText type="heading" style={styles.cardTitle}>
                    {result.title}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    {result.when}
                  </ThemedText>
                </View>
                <Ionicons name="create-outline" size={18} color={c.textSecondary} />
              </Pressable>
              <Button size="lg" icon={result.complete ? 'checkmark' : undefined} label={result.complete ? '저장' : '자세히 적기'} onPress={() => void saveRecord(result)} />
            </>
          )}

          {result?.type === 'todo' && (
            <>
              <Preview icon={<RoutineIcon title={result.title} size={19} color={c.text} />} title={result.title} sub={result.when} />
              <Button
                size="lg"
                icon="add"
                label="할 일로 추가"
                onPress={() => void addTodo({ title: result.title, dueAt: result.dueAt.toISOString(), hasTime: result.hasTime, repeat: result.repeat }).then(done)}
              />
            </>
          )}

          {result?.type === 'routine' && (
            <>
              <Preview icon={<RoutineIcon title={result.title} size={19} color={c.text} />} title={result.title} sub={result.when} />
              <Button size="lg" icon="repeat" label="루틴으로 추가" onPress={() => void addRoutine(result.routine).then(done)} />
            </>
          )}

          {result?.type === 'plain' && (
            <View style={styles.buttons}>
              <Button
                size="lg"
                icon="checkmark"
                label="완료로 기록"
                onPress={() =>
                  void (async () => {
                    // 오늘 할 일을 만들고 바로 지금 완료로 — 흐름에서 체크 동그라미가 된다
                    const todo = await addTodo({ title: result.title, dueAt: today0().toISOString(), hasTime: false });
                    if (todo) await updateTodo(todo.id, { doneAt: new Date().toISOString(), doneBy: await memberName() });
                    done();
                  })()
                }
              />
              <Button size="lg" variant="secondary" label="오늘 할 일로 추가" onPress={() => void addTodo({ title: result.title, dueAt: today0().toISOString(), hasTime: false }).then(done)} />
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: c.divider }]} />
          <View style={styles.kinds}>
            {(['temp', 'weight', 'height'] as EventKind[]).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${KIND_UI[k].label} 기록`}
                onPress={() => {
                  close();
                  onOpenKind(k);
                }}
                style={({ pressed }) => [styles.kind, { borderColor: c.border, backgroundColor: pressed ? c.surface : c.card }]}>
                <Ionicons name={KIND_UI[k].icon} size={17} color={c.text} />
                <ThemedText type="label" style={{ fontWeight: 600 }}>
                  {KIND_UI[k].label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Preview({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.cardIcon, { backgroundColor: c.surfaceStrong }]}>{icon}</View>
      <View style={styles.flex}>
        <ThemedText type="heading" style={styles.cardTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {sub}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1, minWidth: 0 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.three },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 4 },
  field: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 14, borderWidth: 2, paddingLeft: 14, paddingRight: 6 },
  input: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 17, paddingVertical: 0 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: 700 },
  buttons: { gap: 8 },
  divider: { height: 1 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
