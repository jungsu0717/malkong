/**
 * 성장 탭 카드 둘 (SPEC-STAGE-06, task growth/009) — 줄을 눌러 들어가지 않아도 탭에서 바로 하는 것.
 *
 * - 발달 체크: 지금 단계에서 아직 안 한 것 둘과 가장 최근에 한 것 하나(`checkPreview`). 「했어요」를 누르면 발달 체크 화면처럼 그날 날짜를 메모에 적는다
 * - 이맘때 챙기면 좋은 일: 할 일 추천(SPEC-TOPIC-13)의 지금 시기 묶음에서 셋(`prepPreview`), 「+」 한 번으로 내 할 일에 들어간다.
 *   아래에 다음 시기 미리 보기 한 줄
 * 카드 머리(이름 · 「전체 ›」)를 누르면 상세 화면(발달 체크 · 할 일 추천)이 열린다.
 * 방금 누른 줄은 자리를 지킨다 — 누르자마자 줄이 사라지거나 아래로 내려가면 무엇이 됐는지 놓친다. 순서는 화면을 다시 열 때 바뀐다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { type KnowledgeItem } from '@/data/l1';
import { useMemos } from '@/data/memos-context';
import { prepPreview, type TodoRecommend } from '@/data/recommend';
import { happyMoment } from '@/data/review';
import { titleKey } from '@/data/routine';
import { checkPreview, dayNumber } from '@/data/stage';
import { useTodos } from '@/data/todos-context';
import { useTheme } from '@/hooks/use-theme';

/** 카드 머리 — 굵은 이름과 작은 설명, 오른쪽에 숫자와 「전체 ›」 */
function Head({ title, sub, right, onPress }: { title: string; sub: string; right?: ReactNode; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} 전체`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.head, pressed && { opacity: 0.6 }]}>
      <View style={styles.flex}>
        <ThemedText type="body" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {sub}
        </ThemedText>
      </View>
      {right}
      <View style={styles.more}>
        <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
          전체
        </ThemedText>
        <Ionicons name="chevron-forward" size={14} color={c.accentText} />
      </View>
    </Pressable>
  );
}

export function CheckCard({ birthDate, checkpoint, checks }: { birthDate: string; checkpoint: number; checks: KnowledgeItem[] }) {
  const c = useTheme();
  const { memos, toggleCheck } = useMemos();
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const doneAt = new Map(memos.filter((m) => m.ref).map((m) => [m.ref as string, m.at]));
  const done = checks.filter((i) => doneAt.has(i.id)).length;
  // 방금 누른 것은 안 한 것으로 쳐서 순서를 정하고, 보이는 상태는 실제 기록을 따른다
  const order = new Map([...doneAt].filter(([id]) => !touched.has(id)));
  const rows = checkPreview(checks, order).map(({ item }) => ({ item, at: doneAt.get(item.id) ?? null }));

  return (
    <View style={[styles.card, { borderColor: c.border }]}>
      <Head
        title="발달 체크"
        sub={`${checkpoint}개월까지 대부분 하는 것`}
        right={
          <ThemedText type="label" style={{ color: done > 0 ? c.accentText : c.textSecondary, fontWeight: 700 }}>
            {done} / {checks.length}
          </ThemedText>
        }
        onPress={() => router.push('/growth-check')}
      />
      {rows.map(({ item, at }) => (
        <View key={item.id} style={[styles.row, { borderTopColor: c.divider }]}>
          <ThemedText type="body" style={[styles.flex, at ? { color: c.textSecondary } : null]}>
            {item.title}
          </ThemedText>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!at }}
            accessibilityLabel={`${item.title}, 했어요`}
            hitSlop={6}
            onPress={() => {
              tap(at ? 'light' : 'success');
              setTouched((prev) => new Set(prev).add(item.id));
              void toggleCheck(item.id, item.title);
              // 좋은 순간 — 쌓이면 스토어 별점 창(SPEC-MY-09)
              if (!at) void happyMoment();
            }}
            style={({ pressed }) => [
              styles.pill,
              at ? { backgroundColor: c.accentSoft, borderColor: c.accentSoft } : { borderColor: c.text },
              pressed && { opacity: 0.6 },
            ]}>
            <ThemedText type="label" style={{ color: at ? c.accentText : c.text, fontWeight: 700 }}>
              {at ? `D+${dayNumber(birthDate, new Date(at))}` : '했어요'}
            </ThemedText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function PrepCard({ rec }: { rec: TodoRecommend }) {
  const c = useTheme();
  const { topics, todos, add } = useTodos();
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const general = topics.find((t) => t.kind === 'general');
  if (!general) return null;
  const have = new Set(todos.filter((t) => t.topicId === general.id).map((t) => titleKey(t.title)));
  const order = new Set([...have].filter((k) => !touched.has(k)));
  const rows = prepPreview(rec, order).map(({ title }) => ({ title, added: have.has(titleKey(title)) }));
  if (rows.length === 0) return null;

  return (
    <View style={[styles.card, { borderColor: c.border }]}>
      <Head title="이맘때 챙기면 좋은 일" sub={rec.label} onPress={() => router.push('/todo-recommend')} />
      {rows.map(({ title, added }) => (
        <View key={title} style={[styles.row, { borderTopColor: c.divider }]}>
          <ThemedText type="body" style={[styles.flex, added ? { color: c.textSecondary } : null]}>
            {title}
          </ThemedText>
          {added ? (
            <View accessibilityLabel={`${title}, 할 일에 있음`} style={[styles.round, { backgroundColor: c.accent }]}>
              <Ionicons name="checkmark" size={16} color={c.onInk} />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${title}, 할 일에 추가`}
              hitSlop={6}
              onPress={() => {
                tap('success');
                setTouched((prev) => new Set(prev).add(titleKey(title)));
                void add({ title, topicId: general.id });
              }}
              style={({ pressed }) => [styles.round, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
              <Ionicons name="add" size={18} color={c.text} />
            </Pressable>
          )}
        </View>
      ))}
      {rec.next ? (
        <View style={[styles.next, { backgroundColor: c.surface }]}>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            <ThemedText type="small" style={{ color: c.text, fontWeight: 700 }}>
              다음 · {rec.next.label}
            </ThemedText>{' '}
            {rec.next.groups.map((g) => g.title).join(', ')}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.end} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 8 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontWeight: 700, fontSize: 16 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  pill: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  round: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  next: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4, marginBottom: 12 },
  end: { height: 4 },
});
