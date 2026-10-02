import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AskFab } from '@/components/ask-fab';
import { BabyRunLoading } from '@/components/baby-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { useEntitlements } from '@/data/entitlements-context';
import { unitFromL1, unitFromRecord } from '@/data/knowledge';
import { allItems, L1_VERSION, pendingReviewCount } from '@/data/l1';
import { useRecords } from '@/data/records-context';

const MENU_SECTIONS: { title: string; items: string[] }[] = [
  { title: '내 정보', items: ['알림 설정'] },
  { title: '소식', items: ['공지사항', '자주 묻는 질문'] },
  { title: '약관', items: ['이용약관', '개인정보 처리방침', '의학 정보 출처와 한계 고지'] },
];

export default function MyScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const { baby, age } = useBaby();
  const { ads } = useEntitlements();
  const { records } = useRecords();

  // 두 층을 같은 겉모양으로 본다 (src/data/knowledge.ts 유닛 계약)
  const units = [...allItems().map(unitFromL1), ...records.map(unitFromRecord)];
  const standardCount = units.filter((u) => u.layer === 'L1').length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText type="title">마이</ThemedText>

          {/* 아기 프로필 — 저장된 생일과 거기서 계산한 월령 (SPEC-MY-02) */}
          {baby && age && (
            <Pressable
              style={[styles.profileCard, { backgroundColor: colors.backgroundElement }]}
              onPress={() => router.push('/onboarding?edit=1')}>
              <View style={styles.profileText}>
                <ThemedText type="subtitle">{baby.name ?? DEFAULT_BABY_NAME}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  {baby.birthDate.replace(/-/g, '. ')} · 태어난 지 {age.days}일 · 만 {age.month}개월
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: colors.accent }}>
                수정
              </ThemedText>
            </Pressable>
          )}

          {/* 광고 제거 — 결제 SDK 는 EAS 개발 빌드 단계에서 붙인다 (SPEC-MY-06) */}
          {ads && (
            <Pressable style={[styles.profileCard, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.profileText}>
                <ThemedText type="subtitle">광고 없이 쓰기</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  한 번 결제하면 배너와 전면 광고가 모두 사라져요
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: colors.accent }}>
                준비 중
              </ThemedText>
            </Pressable>
          )}

          {/* 로그인 유도 카드 */}
          <View style={[styles.loginCard, { backgroundColor: colors.accentSoft }]}>
            <ThemedText type="subtitle">로그인하고 시작하세요</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              아기 프로필과 질문 기록을 안전하게 보관해요
            </ThemedText>
            <Pressable style={[styles.loginButton, { backgroundColor: colors.accent }]}>
              <ThemedText style={styles.loginButtonText}>로그인 · 가입</ThemedText>
            </Pressable>
          </View>

          {MENU_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {section.title}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.menuCard}>
                {section.items.map((item) => (
                  <Pressable key={item} style={styles.menuRow}>
                    <ThemedText>{item}</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </ThemedView>
            </View>
          ))}

          {/* 구축 중에만 두는 칸 — 로딩 모션 시안과 L1 지식 쌓인 정도. 완성되면 통째로 뺀다 */}
          <View style={styles.section}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              구축 현황 (임시)
            </ThemedText>
            <ThemedView type="backgroundElement" style={[styles.menuCard, styles.loadingPreview]}>
              <BabyRunLoading label="말콩이가 달려오고 있어요…" />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                지식 유닛 {units.length}건 — 표준 {standardCount}건(승인 대기 {pendingReviewCount()}건) ·
                우리 아기 {units.length - standardCount}건 · 판 {L1_VERSION}
              </ThemedText>
            </ThemedView>
          </View>

          <ThemedText type="small" style={[styles.version, { color: colors.textSecondary }]}>
            말콩 v1.0.0
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
  profileCard: {
    borderRadius: 20,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  profileText: { flex: 1, gap: Spacing.half },
  loginCard: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  loginButton: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  loginButtonText: { color: '#ffffff', fontWeight: '600' },
  section: { gap: Spacing.two },
  menuCard: {
    borderRadius: 20,
    paddingHorizontal: Spacing.four,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three + Spacing.one,
  },
  loadingPreview: { paddingVertical: Spacing.three },
  version: { textAlign: 'center' },
});
