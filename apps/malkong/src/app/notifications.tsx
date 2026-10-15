/**
 * 알림 설정 — 마이의 「알림」 한 줄에서 들어오는 상세 (SPEC-LOG-05 기록 알림 · SPEC-TOPIC-09 아침 알림).
 *
 * 큰 묶음 둘만 켜고 끈다(Julian, 2026-10-12). 할 일 알림은 할 일에 시각을 넣으면 따로 켤 것 없이 온다. 언제 보내는지는 부모가 고르지 않고 아기 월령의 공공 기준으로 앱이 정하며,
 * 스위치 아래에 어떤 기준으로 보내는지만 작게 적는다(care-reminders.ts).
 */

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ListRow, Toggle } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { timeLabel } from '@/data/briefing';
import { planLines, reminderPlan } from '@/data/care-reminders';
import { useEvents } from '@/data/events-context';
import { askNotifications, notificationsAllowed, notificationsSupported } from '@/data/notifications';
import { DEFAULT_BRIEFING_TIME, usePreferences } from '@/data/preferences-context';
import { useTheme } from '@/hooks/use-theme';

export default function NotificationsScreen() {
  const c = useTheme();
  const { briefingTime, setBriefingTime, careReminders, setCareReminders } = usePreferences();
  const { age } = useBaby();
  const { events } = useEvents();
  /** 폰의 알림 허락 — 설정 앱에서 바꾸고 돌아오면 다시 읽는다 */
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const supported = notificationsSupported();
  const month = age?.month ?? 0;
  const plan = reminderPlan(month, events);

  useEffect(() => {
    if (!supported) return;
    const read = () => void notificationsAllowed().then(setAllowed);
    read();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => sub.remove();
  }, [supported]);

  /** 켤 때 허락을 묻는다 — 거절했으면 켜지 않는다 */
  const turnOn = async (apply: () => Promise<void>) => {
    const ok = await askNotifications();
    setAllowed(ok);
    if (ok) await apply();
  };

  const careOn = careReminders && allowed === true;
  const briefingOn = briefingTime !== null && allowed === true;
  /** 켜 두었는데 폰 설정에서 막혀 있으면 「설정 열기」 */
  const blocked = supported && allowed === false && (briefingTime !== null || careReminders);
  const blockedText = !supported ? '이 폰에서는 알림을 받을 수 없어요' : '폰 설정에서 알림이 꺼져 있어요';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.rows}>
          <ListRow
            icon="create-outline"
            title="기록 알림"
            detail={!supported || (allowed === false && careReminders) ? blockedText : careOn ? '켜짐' : '안 받아요'}
            right={
              supported ? (
                <Toggle
                  label="기록 알림"
                  value={careOn}
                  onChange={(on) => void (on ? turnOn(() => setCareReminders(true)) : setCareReminders(false))}
                />
              ) : null
            }
          />
          {/* 어떤 기준으로 보내는지 — 고르는 칸이 아니라 알려 주는 글 */}
          <View style={styles.basis}>
            {planLines(plan).map((line) => (
              <ThemedText key={line} type="caption" style={{ color: careOn ? c.textSecondary : c.textTertiary }}>
                {line}
              </ThemedText>
            ))}
            <ThemedText type="caption" style={{ color: c.textTertiary }}>
              시간은 {month === 0 ? '첫 달' : `${month}개월`}에 맞춰 정했고, 아기가 자라면 저절로 바뀌어요
            </ThemedText>
          </View>

          <ListRow
            divider
            icon="notifications-outline"
            title="아침 알림"
            detail={
              !supported || (allowed === false && briefingTime !== null)
                ? blockedText
                : briefingOn
                  ? `매일 ${timeLabel(briefingTime!)} · 오늘 할 일`
                  : '안 받아요'
            }
            right={
              supported ? (
                <Toggle
                  label="아침 알림"
                  value={briefingOn}
                  onChange={(on) =>
                    void (on ? turnOn(() => setBriefingTime(briefingTime ?? DEFAULT_BRIEFING_TIME)) : setBriefingTime(null))
                  }
                />
              ) : null
            }
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
  basis: { gap: 3, paddingLeft: 48, paddingBottom: 14 },
  settingsButton: { alignSelf: 'flex-start', marginBottom: 14 },
});
