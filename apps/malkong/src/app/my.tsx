import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BabyFaceIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, ListRow, Toggle } from '@/components/ui';
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
const DOCS: { label: string; doc: string }[] = [
  { label: '자주 묻는 질문', doc: 'faq' },
  { label: '이용약관', doc: 'terms' },
  { label: '개인정보 처리방침', doc: 'privacy' },
  { label: '의학 정보 출처와 한계 고지', doc: 'medical' },
];

/** 마이 — 아기 정보, 알림 · 가족, 도움말 · 약관 (task my/005 · common/022). 기록 · 만화는 뺐다(decisions/030) */
export default function MyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { briefingTime } = usePreferences();
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
          <ThemedText type="display">마이</ThemedText>

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

          {/* 알림 · 가족 — 한 줄 요약만, 켜고 끄기는 상세에서 (task common/020) */}
          <Card style={styles.rows}>
            <ListRow
              icon="notifications-outline"
              title="알림"
              detail={`아침 알림 ${briefingTime ? timeLabel(briefingTime) : '꺼짐'}`}
              onPress={() => router.push('/notifications')}
            />
            <ListRow
              divider
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

          {/* 도움말 · 약관 */}
          <Card style={styles.rows}>
            {DOCS.map((item, i) => (
              <ListRow
                key={item.doc}
                divider={i > 0}
                title={item.label}
                onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: item.doc } })}
              />
            ))}
          </Card>

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
                detail={asUser ? '일반 사용자처럼 광고 있음' : '가족 폰 · 광고 없음'}
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
  rows: { paddingVertical: 2 },
  center: { textAlign: 'center' },
});
