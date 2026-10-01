import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { BABY, getGaps } from '@/data/timeline';

const RECENT_QUESTIONS = ['밤중 수유는 언제부터 줄여도 되나요?', '분유량이 갑자기 줄었는데 괜찮나요?'];

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { missed, upcoming } = getGaps();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText type="small" style={{ color: colors.accent, fontWeight: '700' }}>
            말콩
          </ThemedText>

          {/* 아기 카드 */}
          <View style={[styles.babyCard, { backgroundColor: colors.accentSoft }]}>
            <ThemedText type="title">우리 아기</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              태어난 지 {BABY.days}일 · {BABY.month}개월차
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.accent, marginTop: Spacing.two }}>
              이 시기 아기는 목을 가누기 시작하고 옹알이가 늘어나요
            </ThemedText>
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
                    {month === BABY.month ? '이번 달' : `${month}개월 차에 다가와요`}
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
            <ThemedText>엎드려서 고개를 45~90도 들어요</ThemedText>
            <ThemedText>손을 펴고 물건에 뻗기 시작해요</ThemedText>
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
