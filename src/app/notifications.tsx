/**
 * 알림 설정 — 마이의 「알림」 한 줄에서 들어오는 상세 (SPEC-HOME-06 아침 브리핑 · SPEC-BABY-07 기록 요청, task common/020).
 * 마이 탭에는 요약 한 줄만 두고 켜고 끄기 · 시간 · 적을 칸은 여기서 한다(Julian, 2026-10-12 — 한눈 요약 + 상세 뎁스).
 */

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, ListRow, Toggle } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { BRIEFING_TIMES, timeLabel } from '@/data/briefing';
import { askNotifications, notificationsAllowed, notificationsSupported } from '@/data/notifications';
import { DEFAULT_BRIEFING_TIME, usePreferences } from '@/data/preferences-context';

export default function NotificationsScreen() {
  const { briefingTime, setBriefingTime, nudgePush, setNudgePush, nudgeCard, setNudgeCard } = usePreferences();
  /** 폰의 알림 허락 — 설정 앱에서 바꾸고 돌아오면 다시 읽는다 */
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

  /** 켜 두었는데 폰 설정에서 막혀 있으면 「설정 열기」 */
  const blocked = supported && allowed === false && (briefingTime !== null || nudgePush);
  const blockedText = !supported ? '이 폰에서는 알림을 받을 수 없어요' : '폰 설정에서 알림이 꺼져 있어요';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.rows}>
          <ListRow
            icon="notifications-outline"
            title="아침 브리핑"
            detail={
              !supported || (allowed === false && briefingTime !== null)
                ? blockedText
                : briefingOn
                  ? `매일 ${timeLabel(briefingTime!)}`
                  : '안 받아요'
            }
            right={supported ? <Toggle label="아침 브리핑" value={briefingOn} onChange={(on) => void toggleBriefing(on)} /> : null}
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
            title="기록이 비면 알려 주기"
            detail={
              !supported || (allowed === false && nudgePush)
                ? blockedText
                : nudgePushOn
                  ? '사흘째 비면 저녁 8시에 한 번'
                  : '안 받아요'
            }
            right={
              supported ? <Toggle label="기록이 비면 알려 주기" value={nudgePushOn} onChange={(on) => void toggleNudgePush(on)} /> : null
            }
          />
          <ListRow
            divider
            icon="albums-outline"
            title="기록이 비면 적을 칸 보여 주기"
            detail={nudgeCard ? '앱을 열 때' : '대화에서 버디가 물어봐요'}
            right={<Toggle label="기록이 비면 적을 칸 보여 주기" value={nudgeCard} onChange={(on) => void setNudgeCard(on)} />}
          />
          {blocked && (
            <Button label="폰 설정 열기" size="sm" variant="secondary" style={styles.settingsButton} onPress={() => void Linking.openSettings()} />
          )}
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  rows: { paddingVertical: 2 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 14 },
  settingsButton: { alignSelf: 'flex-start', marginBottom: 14 },
});
