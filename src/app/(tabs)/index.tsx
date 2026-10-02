import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { AskFab } from '@/components/ask-fab';
import { MarkDoneSheet } from '@/components/mark-done-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { itemsForMonth, itemsOfKind } from '@/data/l1';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';
import {
  getGaps,
  groupGaps,
  groupLabel,
  headlineOf,
  type GapGroup,
  type L1Item,
} from '@/data/timeline';

const RECENT_QUESTIONS = ['밤중 수유는 언제부터 줄여도 되나요?', '분유량이 갑자기 줄었는데 괜찮나요?'];

/** 한 번에 보여주는 「챙길 것」 수 — 빨간 표시가 한꺼번에 쏟아지면 불안만 준다 */
const VISIBLE_TODOS = 3;

/** 발달 포인트가 비었을 때 — 첫 이정표보다 어리면 그게 언제인지 알려준다 (SPEC-HOME-03 조건) */
function emptyPointsText(currentMonth: number): string {
  const starts = itemsOfKind('발달').map((i) => i.months[0]);
  const first = starts.length > 0 ? Math.min(...starts) : null;
  if (first !== null && currentMonth < first) return `첫 발달 이정표는 ${first}개월이에요`;
  return '이 월령의 표준 지식은 아직 준비 중이에요';
}

/** 「챙길 것」 한 줄의 시점 안내. 지난 것은 놓침으로 단정하지 않고 묻는다 (SPEC-HOME-02) */
function todoWhen({ status, month }: GapGroup, currentMonth: number): string {
  if (status === 'missed') return `${month}개월 차 항목인데 기록이 없어요 — 완료했다면 알려주세요`;
  if (status === 'soon') return `${month}개월에 다가와요`;
  return month === currentMonth ? '이번 달' : `${month}개월부터 챙길 시기예요`;
}

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { baby, age } = useBaby();
  const { records, add, remove } = useRecords();
  const [showAllTodos, setShowAllTodos] = useState(false);
  /** 완료를 알리려고 연 줄 */
  const [picking, setPicking] = useState<GapGroup | null>(null);
  /** 방금 만든 기록 — 무엇을 기록했는지 보여주고 되돌릴 수 있게 둔다 (SPEC-HOME-02 저장 표시) */
  const [justSaved, setJustSaved] = useState<BabyRecord | null>(null);

  if (!age) return <ScreenLoading />;

  // 놓친 것 → 지금 → 다음 달 순서로, 같은 날 챙길 것은 한 줄로. 길면 접어 두고 눌러서 펼친다
  const todos = groupGaps(getGaps(age.month, records));
  const shownTodos = showAllTodos ? todos : todos.slice(0, VISIBLE_TODOS);
  const hiddenTodoCount = todos.length - shownTodos.length;
  const headline = headlineOf(age.month);

  const markDone = async (items: L1Item[]) => {
    setPicking(null);
    // 날짜는 묻지 않는다 — 기록의 시점은 알린 날이다
    const record = await add({
      kind: '기록',
      label: `${groupLabel(items)} 완료`,
      covers: items.map((i) => i.id),
      whenLabel: `D+${age.days}에 알림`,
    });
    setJustSaved(record);
  };

  const undo = async () => {
    if (!justSaved) return;
    await remove(justSaved.id);
    setJustSaved(null);
  };
  // 발달·생활 항목이 이번 달 발달 포인트가 된다 (접종·검진은 위의 「챙길 것」이 맡는다)
  // 이정표 요약과 조기 상담 안내 (SPEC-HOME-03). 생활 팁은 「챙길 것」의 몫이라 여기 넣지 않는다
  const points = itemsForMonth(age.month).filter((i) => i.kind === '발달');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText type="small" style={{ color: colors.accent, fontWeight: '700' }}>
            말콩
          </ThemedText>

          {/* 아기 카드 — 월령은 저장된 생일에서 계산한다 (SPEC-HOME-01) */}
          <View style={[styles.babyCard, { backgroundColor: colors.accentSoft }]}>
            <ThemedText type="title">{baby?.name ?? DEFAULT_BABY_NAME}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              태어난 지 {age.days}일 · 만 {age.month}개월
            </ThemedText>
            {headline && (
              <ThemedText type="small" style={{ color: colors.accent, marginTop: Spacing.two }}>
                {headline}
              </ThemedText>
            )}
          </View>

          {/* 지금 챙길 것 — 표준(L1) 대비 우리 아기 기록(L2)의 차집합 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">지금 챙길 것</ThemedText>
            {justSaved && (
              <View style={[styles.savedNotice, { backgroundColor: colors.accentSoft }]}>
                <ThemedText type="small" style={styles.savedText}>
                  「{justSaved.label}」로 기록했어요
                </ThemedText>
                <Pressable onPress={undo} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: colors.accent }}>
                    되돌리기
                  </ThemedText>
                </Pressable>
              </View>
            )}
            {shownTodos.map((todo) => (
              <Pressable
                key={todo.key}
                accessibilityRole="button"
                accessibilityHint="완료했다면 눌러서 알려 주세요"
                style={styles.todoRow}
                onPress={() => setPicking(todo)}>
                <ThemedText
                  style={todo.status === 'missed' ? styles.missedMark : { color: colors.accent }}>
                  {todo.status === 'missed' ? '!' : '○'}
                </ThemedText>
                <View style={styles.todoLabel}>
                  <ThemedText>{todo.label}</ThemedText>
                  <ThemedText
                    type="small"
                    style={
                      todo.status === 'missed' ? styles.missedMark : { color: colors.textSecondary }
                    }>
                    {todoWhen(todo, age.month)}
                  </ThemedText>
                </View>
                <View style={[styles.doneChip, { borderColor: colors.accent }]}>
                  <ThemedText type="small" style={{ color: colors.accent }}>
                    완료
                  </ThemedText>
                </View>
              </Pressable>
            ))}
            {hiddenTodoCount > 0 && (
              <Pressable onPress={() => setShowAllTodos(true)}>
                <ThemedText type="small" style={{ color: colors.accent }}>
                  {hiddenTodoCount}건 더 보기
                </ThemedText>
              </Pressable>
            )}
            {todos.length === 0 && (
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                지금은 챙길 게 없어요 🎉
              </ThemedText>
            )}
          </ThemedView>

          {/* 배너는 첫 화면 안에 보이도록 핵심 카드 바로 뒤에 둔다 — 아기 카드와 「챙길 것」보다
              위로는 올리지 않는다(첫인상이 광고가 되지 않게) */}
          <AdBanner />

          {/* 이번 달 발달 포인트 (성장 타임라인 요약) */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">이번 달 발달 포인트</ThemedText>
            {points.length > 0 ? (
              points.map((item) => <ThemedText key={item.id}>{item.title}</ThemedText>)
            ) : (
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {emptyPointsText(age.month)}
              </ThemedText>
            )}
            <ThemedText type="small" style={{ color: colors.accent }}>
              성장 타임라인에서 전체 흐름 보기 →
            </ThemedText>
          </ThemedView>

          {/* 최근 질문 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">말콩이에게 물어본 것</ThemedText>
            {RECENT_QUESTIONS.map((q) => (
              <ThemedText key={q} style={styles.questionRow}>
                💬 {q}
              </ThemedText>
            ))}
            <ThemedText type="small" style={{ color: colors.accent }}>
              이어서 물어보기 →
            </ThemedText>
          </ThemedView>

          <ThemedText type="small" style={[styles.disclaimer, { color: colors.textSecondary }]}>
            말콩의 정보는 공공 의료·육아 지식을 근거로 제공되는 참고 자료예요
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      <AskFab />
      <MarkDoneSheet
        key={picking?.key ?? 'closed'}
        group={picking}
        onClose={() => setPicking(null)}
        onConfirm={markDone}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.five * 2,
  },
  babyCard: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  todoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  todoLabel: { flex: 1, gap: Spacing.half },
  doneChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.half,
  },
  savedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  savedText: { flex: 1 },
  missedMark: { color: '#F04452', fontWeight: '700' },
  questionRow: {},
  disclaimer: { textAlign: 'center' },
});
