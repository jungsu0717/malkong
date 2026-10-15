import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BabyFaceIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, ListRow, SectionHeader, Toggle } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { storedDeviceKey } from '@/data/api';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { timeLabel } from '@/data/briefing';
import { useBaby } from '@/data/baby-context';
import { useEntitlements } from '@/data/entitlements-context';
import { useFamily } from '@/data/family-context';
import { allItems, l1Version, pendingReviewCount } from '@/data/l1';
import { usePreferences } from '@/data/preferences-context';
import { useTheme } from '@/hooks/use-theme';

// 본문은 src/data/legal.ts (SPEC-MY-03)
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

/** 마이 — 프로필 · 알림 · 가족 · 도움말 · 약관 (task my/005). 광고 없이 쓰기(SPEC-MY-06)는 나중 */
export default function MyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { briefingTime, careReminders } = usePreferences();
  /**
   * 버전을 길게 누르면 열리는 숨은 메뉴 — 기기 키(가족 기기로 등록할 때 쓴다)와, 가족 기기면 「일반 사용자로 보기」
   * 스위치(backend 「운영자 기기」 · task common/015). 다시 길게 누르면 닫힌다
   */
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const { operator, asUser, setAsUser } = useEntitlements();
  const family = useFamily();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 제목 줄 — 오른쪽 끝에 「육아버디 스토리」(만화 다섯 컷, SPEC-MY-07) */}
          <View style={styles.titleRow}>
            <ThemedText type="display">마이</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="육아버디 스토리 — 만화 보기" hitSlop={8} onPress={() => router.push('/intro')}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                육아버디 스토리
              </ThemedText>
            </Pressable>
          </View>

          {/* 아기 프로필 — 저장된 생일과 거기서 계산한 월령 (SPEC-MY-02) */}
          {baby && age && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="아기 정보를 수정해요"
              onPress={() => router.push('/onboarding?edit=1')}>
              <Card style={styles.profile}>
                <View style={[styles.avatar, { backgroundColor: c.surface }]}>
                  <BabyFaceIcon size={30} color={c.text} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="heading">{baby.name ?? DEFAULT_BABY_NAME}</ThemedText>
                  <ThemedText type="caption" style={{ color: c.textSecondary }}>
                    {baby.birthDate.replace(/-/g, '. ')}생 · 만 {age.month}개월
                  </ThemedText>
                </View>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  수정
                </ThemedText>
              </Card>
            </Pressable>
          )}

          {/* 알림은 한 줄 요약만 — 켜고 끄기 · 시간은 상세(src/app/notifications.tsx)에서 (task common/020) */}
          <View style={styles.section}>
            <SectionHeader title="알림" />
            <Card style={styles.rows}>
              <ListRow
                icon="notifications-outline"
                title="알림"
                detail={`기록 알림 ${careReminders ? '켜짐' : '꺼짐'} · 아침 알림 ${briefingTime ? timeLabel(briefingTime) : '꺼짐'}`}
                onPress={() => router.push('/notifications')}
              />
            </Card>
          </View>

          {/* 가족 공유 — 초대 코드로, 로그인 없이 (SPEC-MY-05, task my/007) */}
          <View style={styles.section}>
            <SectionHeader title="가족" />
            <Card style={styles.rows}>
              <ListRow
                icon="people-outline"
                title="가족과 함께 보기"
                detail={
                  family.status === 'member' && family.state
                    ? `함께 보는 폰 ${family.state.info.members}대 · 초대 코드 ${family.state.info.inviteCode}`
                    : '초대 코드로 같은 아기를 함께 봐요'
                }
                onPress={() => router.push('/family')}
              />
            </Card>
          </View>

          {MENU_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <SectionHeader title={section.title} />
              <Card style={styles.rows}>
                {section.items.map((item, i) => (
                  <ListRow
                    key={item.doc}
                    divider={i > 0}
                    title={item.label}
                    onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: item.doc } })}
                  />
                ))}
              </Card>
            </View>
          ))}

          {/* 구축 중에만 두는 칸 — L1 지식이 쌓인 정도. 개발 빌드에서만 보인다 */}
          {__DEV__ && (
            <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
              개발 빌드 · 공공 지식 {allItems().length}개(승인 대기 {pendingReviewCount()}개) · 판{' '}
              {l1Version()}
            </ThemedText>
          )}

          <Pressable
            onLongPress={async () =>
              setDeviceKey(deviceKey ? null : (await storedDeviceKey()) || '아직 없어요')
            }
            delayLongPress={800}>
            <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
              육아버디 v1.0.0
            </ThemedText>
          </Pressable>
          {deviceKey && operator && (
            <Card style={styles.rows}>
              <ListRow
                title="일반 사용자로 보기"
                detail={asUser ? '일반 사용자처럼 한도 · 광고 있음' : '가족 폰 · 한도 없음'}
                right={<Toggle label="일반 사용자로 보기" value={asUser} onChange={(on) => void setAsUser(on)} />}
              />
            </Card>
          )}
          {deviceKey && (
            <ThemedText selectable type="caption" style={[styles.center, { color: c.textSecondary }]}>
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
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rows: { paddingVertical: 2 },
  center: { textAlign: 'center' },
});
