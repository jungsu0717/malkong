import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BabyRunLoading } from '@/components/baby-loading';
import { NoAdsCard } from '@/components/no-ads-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { storedDeviceKey } from '@/data/api';
import { useBaby } from '@/data/baby-context';
import { unitFromL1, unitFromRecord } from '@/data/knowledge';
import { allItems, L1_VERSION, pendingReviewCount } from '@/data/l1';
import { usePreferences } from '@/data/preferences-context';
import { useRecords } from '@/data/records-context';

// 본문은 src/data/legal.ts (SPEC-MY-03). 알림 설정·공지사항은 그 기능이 생길 때 다시 넣는다
const MENU_SECTIONS: { title: string; items: { label: string; doc: string }[] }[] = [
  { title: '도움말', items: [{ label: '자주 묻는 질문', doc: 'faq' }] },
  {
    title: '약관',
    items: [
      { label: '이용약관', doc: 'terms' },
      { label: '개인정보 처리방침', doc: 'privacy' },
      { label: '의학 정보 출처와 한계 고지', doc: 'medical' },
    ],
  },
];

export default function MyScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { scheduleOnly, setScheduleOnly } = usePreferences();
  /** 버전을 길게 누르면 보이는 기기 키 — 운영자(가족) 기기로 등록할 때 쓴다(backend 「운영자 기기」) */
  const [deviceKey, setDeviceKey] = useState<string | null>(null);

  // 두 층을 같은 겉모양으로 본다 (src/data/knowledge.ts 유닛 계약)
  const units = [...allItems().map(unitFromL1), ...records.map(unitFromRecord)];
  const standardCount = units.filter((u) => u.layer === 'L1').length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText type="display">마이</ThemedText>

          {/* 아기 프로필 — 저장된 생일과 거기서 계산한 월령 (SPEC-MY-02) */}
          {baby && age && (
            <Pressable
              style={[styles.profileCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/onboarding?edit=1')}>
              <View style={styles.profileText}>
                <ThemedText type="title">{baby.name ?? DEFAULT_BABY_NAME}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  {baby.birthDate.replace(/-/g, '. ')} · 태어난 지 {age.days}일 · 만 {age.month}개월
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: colors.accent }}>
                수정
              </ThemedText>
            </Pressable>
          )}

          {/* 우리 아기 기록(L2) 보기·고치기 (SPEC-MY-02) */}
          <Pressable
            style={[styles.profileCard, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/records')}>
            <View style={styles.profileText}>
              <ThemedText type="title">우리 아기 기록</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {records.length > 0
                  ? `${records.length}건 — 보고 고치거나 지울 수 있어요`
                  : '대화와 홈에서 모은 기록이 여기 쌓여요'}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>

          {/* 광고 없이 쓰기 — 구매·복원 (SPEC-MY-06) */}
          <NoAdsCard />

          {/* 로그인 유도 카드 — 로그인은 가족 공유·기기 이전과 함께 들인다(SPEC-MY-04). 그 전엔 누를 단추를 두지 않는다 */}
          <View style={[styles.loginCard, { backgroundColor: colors.accentSoft }]}>
            <ThemedText type="title">가족과 함께 보기 · 준비 중</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              로그인하면 기기를 바꿔도 기록을 옮기고, 가족과 같은 아기를 함께 볼 수 있게 할 거예요. 지금은
              로그인 없이 모든 기능을 쓸 수 있어요.
            </ThemedText>
          </View>

          {/* 설정 — 홈 「챙길 것」에서 생활 항목을 뺄 수 있다 (SPEC-HOME-02 생활 항목) */}
          <View style={styles.section}>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              설정
            </ThemedText>
            <ThemedView type="surface" style={styles.menuCard}>
              <View style={styles.menuRow}>
                <View style={styles.profileText}>
                  <ThemedText>「챙길 것」에 생활 항목도 보기</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    끄면 접종·검진만 보여요
                  </ThemedText>
                </View>
                <Switch
                  value={!scheduleOnly}
                  onValueChange={(on) => void setScheduleOnly(!on)}
                  trackColor={{ true: colors.accent }}
                />
              </View>
            </ThemedView>
          </View>

          {MENU_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {section.title}
              </ThemedText>
              <ThemedView type="surface" style={styles.menuCard}>
                {section.items.map((item) => (
                  <Pressable
                    key={item.doc}
                    style={styles.menuRow}
                    onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: item.doc } })}>
                    <ThemedText>{item.label}</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </ThemedView>
            </View>
          ))}

          {/* 구축 중에만 두는 칸 — 로딩 모션 시안과 L1 지식 쌓인 정도. 개발 빌드에서만 보인다 */}
          {__DEV__ && (
            <View style={styles.section}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                구축 현황 (임시)
              </ThemedText>
              <ThemedView type="surface" style={[styles.menuCard, styles.loadingPreview]}>
                <BabyRunLoading label="말콩이가 달려오고 있어요…" />
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  지식 유닛 {units.length}건 — 표준 {standardCount}건(승인 대기 {pendingReviewCount()}건) ·
                  우리 아기 {units.length - standardCount}건 · 판 {L1_VERSION}
                </ThemedText>
              </ThemedView>
            </View>
          )}

          <Pressable
            onLongPress={async () => setDeviceKey((await storedDeviceKey()) || '아직 없어요')}
            delayLongPress={800}>
            <ThemedText type="small" style={[styles.version, { color: colors.textSecondary }]}>
              말콩 v1.0.0
            </ThemedText>
          </Pressable>
          {deviceKey && (
            <ThemedText selectable type="small" style={[styles.version, { color: colors.textSecondary }]}>
              기기 키 {deviceKey}
            </ThemedText>
          )}
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
