import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BabyFaceIcon } from '@/components/baby-icons';
import { NoAdsCard } from '@/components/no-ads-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, ListRow, SectionHeader, Toggle } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { storedDeviceKey } from '@/data/api';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { BRIEFING_TIMES, timeLabel } from '@/data/briefing';
import { useBaby } from '@/data/baby-context';
import { useEntitlements } from '@/data/entitlements-context';
import { allItems, L1_VERSION, pendingReviewCount } from '@/data/l1';
import { askNotifications, notificationsAllowed, notificationsSupported } from '@/data/notifications';
import { DEFAULT_BRIEFING_TIME, usePreferences } from '@/data/preferences-context';
import { useRecords } from '@/data/records-context';
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

/** 마이 — 프로필 · 알림 · 설정 · 광고 없이 쓰기 · 약관 (task my/005 · baby/003) */
export default function MyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const {
    scheduleOnly,
    setScheduleOnly,
    briefingTime,
    setBriefingTime,
    nudgePush,
    setNudgePush,
    nudgeCard,
    setNudgeCard,
  } = usePreferences();
  /**
   * 버전을 길게 누르면 열리는 숨은 메뉴 — 기기 키(가족 기기로 등록할 때 쓴다)와, 가족 기기면 「일반 사용자로 보기」
   * 스위치(backend 「운영자 기기」 · task common/015). 다시 길게 누르면 닫힌다
   */
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const { operator, asUser, setAsUser } = useEntitlements();
  /** 기기 알림 허락 — 설정 앱에서 바꾸고 돌아오면 다시 읽는다 */
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const supported = notificationsSupported();

  useEffect(() => {
    if (!supported) return;
    const read = () => void notificationsAllowed().then(setAllowed);
    read();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => sub.remove();
  }, [supported]);

  const briefingOn = briefingTime !== null && allowed === true;

  const toggleBriefing = async (on: boolean) => {
    if (!on) return setBriefingTime(null);
    const ok = await askNotifications();
    setAllowed(ok);
    if (ok) await setBriefingTime(briefingTime ?? DEFAULT_BRIEFING_TIME);
  };

  // 기록 요청 알림(SPEC-BABY-07) — 거는 것은 record-nudge.tsx 가 이 값을 보고 한다
  const nudgePushOn = nudgePush && allowed === true;
  const toggleNudgePush = async (on: boolean) => {
    if (!on) return setNudgePush(false);
    const ok = await askNotifications();
    setAllowed(ok);
    if (ok) await setNudgePush(true);
  };
  /** 켜 두었는데 휴대폰 설정에서 막혀 있으면 「설정 열기」 */
  const blocked = supported && allowed === false && (briefingTime !== null || nudgePush);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText type="display">마이</ThemedText>

          {/* 아기 프로필 — 저장된 생일과 거기서 계산한 월령 (SPEC-MY-02) */}
          {baby && age && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="아기 정보를 고쳐요"
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
                  고치기
                </ThemedText>
              </Card>
            </Pressable>
          )}

          <View style={styles.section}>
            <SectionHeader title="우리 아기" />
            <Card style={styles.rows}>
              <ListRow
                icon="document-text-outline"
                title="우리 아기 기록"
                detail={records.length > 0 ? `${records.length}건 · 보고 고치거나 지울 수 있어요` : '대화와 챙길 것에서 모은 기록이 여기 쌓여요'}
                onPress={() => router.push('/records')}
              />
            </Card>
          </View>

          {/* 아침 브리핑 알림(SPEC-HOME-06 — 꺼도 브리핑은 앱을 열면 생긴다) · 기록 요청 알림과 카드(SPEC-BABY-07) */}
          <View style={styles.section}>
            <SectionHeader title="알림" />
            <Card style={styles.rows}>
              <ListRow
                icon="notifications-outline"
                title="아침 브리핑 알림"
                detail={
                  !supported
                    ? '이 기기에서는 알림을 쓸 수 없어요'
                    : allowed === false && briefingTime !== null
                      ? '휴대폰 설정에서 알림이 꺼져 있어요'
                      : briefingOn
                        ? `매일 ${timeLabel(briefingTime!)}에 알려 드려요`
                        : '꺼도 브리핑은 앱을 열면 그대로 생겨요'
                }
                right={
                  supported ? (
                    <Toggle label="아침 브리핑 알림" value={briefingOn} onChange={(on) => void toggleBriefing(on)} />
                  ) : null
                }
              />
              {briefingOn && (
                <View style={styles.times}>
                  {BRIEFING_TIMES.map((t) => (
                    <Chip key={t} label={timeLabel(t)} selected={t === briefingTime} onPress={() => void setBriefingTime(t)} />
                  ))}
                </View>
              )}
              <ListRow
                divider
                icon="create-outline"
                title="기록이 비면 알림"
                detail={
                  !supported
                    ? '이 기기에서는 알림을 쓸 수 없어요'
                    : allowed === false && nudgePush
                      ? '휴대폰 설정에서 알림이 꺼져 있어요'
                      : nudgePushOn
                        ? '하루 기록이 사흘째 비면 저녁 8시에 한 번 알려 드려요'
                        : '꺼도 우리 아기 탭에서 언제든 적을 수 있어요'
                }
                right={
                  supported ? (
                    <Toggle label="기록이 비면 알림" value={nudgePushOn} onChange={(on) => void toggleNudgePush(on)} />
                  ) : null
                }
              />
              <ListRow
                divider
                icon="albums-outline"
                title="기록이 비면 카드 띄우기"
                detail={nudgeCard ? '앱을 열 때 적을 칸을 모아 보여 드려요' : '적지 않은 것은 대화하다 버디가 물어봐요'}
                right={<Toggle label="기록이 비면 카드 띄우기" value={nudgeCard} onChange={(on) => void setNudgeCard(on)} />}
              />
              {blocked && (
                <Button
                  label="설정 열기"
                  size="sm"
                  variant="secondary"
                  style={styles.settingsButton}
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </Card>
          </View>

          {/* 챙길 것에서 생활 항목을 뺄 수 있다 (SPEC-HOME-02 생활 항목) */}
          <View style={styles.section}>
            <SectionHeader title="설정" />
            <Card style={styles.rows}>
              <ListRow
                icon="leaf-outline"
                title="챙길 것에 생활 항목도 보기"
                detail="끄면 접종·검진만 보여요"
                right={
                  <Toggle label="챙길 것에 생활 항목도 보기" value={!scheduleOnly} onChange={(on) => void setScheduleOnly(!on)} />
                }
              />
            </Card>
          </View>

          {/* 광고 없이 쓰기 — 구매·복원 (SPEC-MY-06) */}
          <NoAdsCard />

          {/* 로그인은 가족 공유·기기 이전과 함께 들인다(SPEC-MY-04). 그 전엔 누를 단추를 두지 않는다 */}
          <Card tone="filled" style={styles.soon}>
            <ThemedText type="heading" style={{ fontSize: 15 }}>
              가족과 함께 보기 · 준비 중
            </ThemedText>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              로그인하면 기기를 바꿔도 기록을 옮기고, 가족과 같은 아기를 함께 볼 수 있게 할 거예요. 지금은 로그인 없이
              모든 기능을 쓸 수 있어요.
            </ThemedText>
          </Card>

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
              개발 빌드 · 표준 지식 {allItems().length}건(승인 대기 {pendingReviewCount()}건) · 기록 {records.length}건 · 판{' '}
              {L1_VERSION}
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
                detail={asUser ? '일반 사용자와 같은 한도 · 광고로 써요' : '가족 기기라 한도 없이 써요'}
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
  rows: { paddingVertical: 2 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 14 },
  settingsButton: { alignSelf: 'flex-start', marginBottom: 14 },
  soon: { gap: 6 },
  center: { textAlign: 'center' },
});
