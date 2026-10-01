import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { AskFab } from '@/components/ask-fab';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { getGaps, monthData } from '@/data/timeline';

const RECENT_QUESTIONS = ['밤중 수유는 언제부터 줄여도 되나요?', '분유량이 갑자기 줄었는데 괜찮나요?'];

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { baby, age } = useBaby();

  if (!age) return <ScreenLoading />;

  const { missed, upcoming } = getGaps(age.month);
  const thisMonth = monthData(age.month);
  // 발달·생활 항목이 이번 달 발달 포인트가 된다 (접종·검진은 위의 「챙길 것」이 맡는다)
  const points = (thisMonth?.l1 ?? []).filter((i) => i.kind === '발달' || i.kind === '생활');

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
            {thisMonth && (
              <ThemedText type="small" style={{ color: colors.accent, marginTop: Spacing.two }}>
                {thisMonth.headline}
              </ThemedText>
            )}
          </View>

          {/* 지금 챙길 것 — 표준(L1) 대비 우리 아기 기록(L2)의 차집합 */}
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            지금 챙길 것
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {missed.map(({ month, item }) => (
              <View key={item.label} style={styles.todoRow}>
                <ThemedText style={styles.missedMark}>!</ThemedText>
                <View style={styles.todoLabel}>
                  <ThemedText>{item.label}</ThemedText>
                  <ThemedText type="small" style={styles.missedMark}>
                    {month}개월 차 항목인데 기록이 없어요 — 완료했다면 알려주세요
                  </ThemedText>
                </View>
              </View>
            ))}
            {upcoming.map(({ month, item }) => (
              <View key={item.label} style={styles.todoRow}>
                <ThemedText style={{ color: colors.accent }}>○</ThemedText>
                <View style={styles.todoLabel}>
                  <ThemedText>{item.label}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    {month === age.month ? '이번 달' : `${month}개월에 다가와요`}
                  </ThemedText>
                </View>
              </View>
            ))}
            {missed.length === 0 && upcoming.length === 0 && (
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                지금은 챙길 게 없어요 🎉
              </ThemedText>
            )}
          </ThemedView>

          {/* 이번 달 발달 포인트 (성장 타임라인 요약) */}
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            이번 달 발달 포인트
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {points.length > 0 ? (
              points.map((item) => <ThemedText key={item.label}>{item.label}</ThemedText>)
            ) : (
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                이 월령의 표준 지식은 아직 준비 중이에요
              </ThemedText>
            )}
            <ThemedText type="small" style={{ color: colors.accent }}>
              성장 타임라인에서 전체 흐름 보기 →
            </ThemedText>
          </ThemedView>

          {/* 최근 질문 */}
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            말콩이에게 물어본 것
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {RECENT_QUESTIONS.map((q) => (
              <ThemedText key={q} style={styles.questionRow}>
                💬 {q}
              </ThemedText>
            ))}
            <ThemedText type="small" style={{ color: colors.accent }}>
              이어서 물어보기 →
            </ThemedText>
          </ThemedView>

          <AdBanner />

          <ThemedText type="small" style={[styles.disclaimer, { color: colors.textSecondary }]}>
            말콩의 정보는 공공 의료·육아 지식을 근거로 제공되는 참고 자료예요
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      <AskFab />
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
  sectionTitle: {
    marginTop: Spacing.two,
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
  missedMark: { color: '#F04452', fontWeight: '700' },
  questionRow: {},
  disclaimer: { textAlign: 'center' },
});
