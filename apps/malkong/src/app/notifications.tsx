/**
 * 알림 설정 — 마이의 「알림」 한 줄에서 들어오는 상세 (SPEC-TOPIC-09 아침 알림과 전날 저녁 알림, SPEC-STAGE-06 성장 소식).
 *
 * 켜고 끄는 것은 아침 알림과 성장 소식(주차 · 달이 바뀌는 날 아침) 둘이다. 루틴 · 할 일 알림은 시각을 정하면 따로 켜지 않아도 온다(SPEC-MAIN-04 · SPEC-TOPIC-09).
 */

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ListRow, Toggle } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { timeLabel } from '@/data/briefing';
import { askNotifications, notificationsAllowed, notificationsSupported } from '@/data/notifications';
import { DEFAULT_BRIEFING_TIME, usePreferences } from '@/data/preferences-context';
import { useTheme } from '@/hooks/use-theme';

export default function NotificationsScreen() {
  const c = useTheme();
  const { briefingTime, setBriefingTime, growthAlerts, setGrowthAlerts } = usePreferences();
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
  const growthOn = growthAlerts && allowed === true;
  /** 폰 설정에서 막혀 있으면 「폰 설정 열기」 */
  const blocked = supported && allowed === false;
  const blockedText = !supported ? '이 폰에서는 알림을 받을 수 없어요' : '폰 설정에서 알림이 꺼져 있어요';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.rows}>
          <ListRow
            icon="notifications-outline"
            title="아침 알림"
            detail={
              !supported || (allowed === false && briefingTime !== null)
                ? blockedText
                : briefingOn
                  ? `${timeLabel(briefingTime!)} 오늘 할 일 · 저녁 8시 내일 할 일`
                  : '꺼짐'
            }
            right={
              supported ? (
                <Toggle
                  label="아침 알림"
                  value={briefingOn}
                  onChange={(on) =>
                    void (on
                      ? askNotifications().then(async (ok) => {
                          setAllowed(ok);
                          if (ok) await setBriefingTime(briefingTime ?? DEFAULT_BRIEFING_TIME);
                        })
                      : setBriefingTime(null))
                  }
                />
              ) : null
            }
          />
          <ListRow
            icon="leaf-outline"
            title="성장 소식"
            detail={!supported || (allowed === false && growthAlerts) ? blockedText : growthOn ? '주차 · 달이 바뀌는 날 아침' : '꺼짐'}
            right={
              supported ? (
                <Toggle
                  label="성장 소식"
                  value={growthOn}
                  onChange={(on) =>
                    void (on
                      ? askNotifications().then(async (ok) => {
                          setAllowed(ok);
                          if (ok) await setGrowthAlerts(true);
                        })
                      : setGrowthAlerts(false))
                  }
                />
              ) : null
            }
          />
          {blocked && (
            <Button label="폰 설정 열기" size="sm" variant="secondary" style={styles.settingsButton} onPress={() => void Linking.openSettings()} />
          )}
        </Card>
        <View style={styles.note}>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            루틴과 할 일 알림은 시각을 정하면 따로 켜지 않아도 와요.
          </ThemedText>
        </View>
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
    gap: Spacing.two,
  },
  rows: { paddingVertical: 2 },
  note: { paddingHorizontal: 4 },
  settingsButton: { alignSelf: 'flex-start', marginBottom: 14 },
});
