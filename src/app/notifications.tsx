/**
 * 알림 설정 — 마이의 「알림」 한 줄에서 들어오는 상세 (SPEC-LOG-05 수유 알림 · SPEC-HOME-06 아침 브리핑 · SPEC-BABY-07 기록 요청, task common/020).
 * 마이 탭에는 요약 한 줄만 두고 켜고 끄기 · 시간 · 적을 칸은 여기서 한다(Julian, 2026-10-12 — 한눈 요약 + 상세 뎁스).
 */

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, ListRow, Toggle } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { BRIEFING_TIMES, timeLabel } from '@/data/briefing';
import { useBaby } from '@/data/baby-context';
import { defaultAwakeMinutes, durationLabel, usualAwakeMinutes } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { askNotifications, notificationsAllowed, notificationsSupported } from '@/data/notifications';
import { DEFAULT_BRIEFING_TIME, DEFAULT_DIAPER_REMINDER, DEFAULT_FEED_REMINDER, usePreferences } from '@/data/preferences-context';

/** 수유 알림 간격 — 분 */
const FEED_GAPS = [120, 150, 180, 210, 240];
/** 기저귀 알림 간격 — 분 */
const DIAPER_GAPS = [120, 180, 240, 300];

export default function NotificationsScreen() {
  const {
    briefingTime,
    setBriefingTime,
    nudgePush,
    setNudgePush,
    nudgeCard,
    setNudgeCard,
    feedReminder,
    setFeedReminder,
    diaperReminder,
    setDiaperReminder,
    sleepReminder,
    setSleepReminder,
    tempReminder,
    setTempReminder,
  } = usePreferences();
  const { age } = useBaby();
  const { events } = useEvents();
  // 잠 알림의 지금 기준 — 우리 아기의 평소 깨어 있던 시간, 모르면 월령 기본값
  const usualAwake = usualAwakeMinutes(events);
  const awake = usualAwake ?? defaultAwakeMinutes(age?.month ?? 0);
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

  // 수유 알림(SPEC-LOG-05) — 거는 것은 events-context 가 기록이 바뀔 때마다 한다
  const feedOn = feedReminder !== null && allowed === true;
  const toggleFeed = async (on: boolean) => {
    if (!on) return setFeedReminder(null);
    const ok = await askNotifications();
    setAllowed(ok);
    if (ok) await setFeedReminder(feedReminder ?? DEFAULT_FEED_REMINDER);
  };

  // 기저귀 · 잠 · 체온 알림 — 켤 때 허락을 묻는다
  const withPermission = async (turnOn: () => Promise<void>) => {
    const ok = await askNotifications();
    setAllowed(ok);
    if (ok) await turnOn();
  };
  const diaperOn = diaperReminder !== null && allowed === true;
  const sleepOn = sleepReminder && allowed === true;
  const tempOn = tempReminder && allowed === true;

  /** 켜 두었는데 폰 설정에서 막혀 있으면 「설정 열기」 */
  const blocked =
    supported &&
    allowed === false &&
    (briefingTime !== null || nudgePush || feedReminder !== null || diaperReminder !== null || sleepReminder || tempReminder);
  const blockedText = !supported ? '이 폰에서는 알림을 받을 수 없어요' : '폰 설정에서 알림이 꺼져 있어요';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.rows}>
          <ListRow
            icon="heart-outline"
            title="수유 알림"
            detail={
              !supported || (allowed === false && feedReminder !== null)
                ? blockedText
                : feedOn
                  ? `마지막 수유 ${durationLabel(feedReminder!)} 뒤에 한 번`
                  : '안 받아요'
            }
            right={supported ? <Toggle label="수유 알림" value={feedOn} onChange={(on) => void toggleFeed(on)} /> : null}
          />
          {feedOn && (
            <View style={styles.times}>
              {FEED_GAPS.map((m) => (
                <Chip key={m} label={durationLabel(m)} selected={m === feedReminder} onPress={() => void setFeedReminder(m)} />
              ))}
            </View>
          )}
          <ListRow
            divider
            icon="water-outline"
            title="기저귀 알림"
            detail={
              !supported || (allowed === false && diaperReminder !== null)
                ? blockedText
                : diaperOn
                  ? `마지막 기저귀 ${durationLabel(diaperReminder!)} 뒤에 한 번`
                  : '안 받아요'
            }
            right={
              supported ? (
                <Toggle
                  label="기저귀 알림"
                  value={diaperOn}
                  onChange={(on) =>
                    void (on ? withPermission(() => setDiaperReminder(diaperReminder ?? DEFAULT_DIAPER_REMINDER)) : setDiaperReminder(null))
                  }
                />
              ) : null
            }
          />
          {diaperOn && (
            <View style={styles.times}>
              {DIAPER_GAPS.map((m) => (
                <Chip key={m} label={durationLabel(m)} selected={m === diaperReminder} onPress={() => void setDiaperReminder(m)} />
              ))}
            </View>
          )}
          <ListRow
            divider
            icon="moon-outline"
            title="잠 알림"
            detail={
              !supported || (allowed === false && sleepReminder)
                ? blockedText
                : sleepOn
                  ? `깬 뒤 ${durationLabel(awake)} 동안 잠 기록이 없으면 · ${usualAwake ? '우리 아기 평소' : '월령 기본값, 기록이 쌓이면 우리 아기 평소로'}`
                  : '안 받아요'
            }
            right={
              supported ? (
                <Toggle
                  label="잠 알림"
                  value={sleepOn}
                  onChange={(on) => void (on ? withPermission(() => setSleepReminder(true)) : setSleepReminder(false))}
                />
              ) : null
            }
          />
          <ListRow
            divider
            icon="thermometer-outline"
            title="체온 알림"
            detail={
              !supported || (allowed === false && tempReminder) ? blockedText : tempOn ? '매일 오전 8시 · 오후 8시' : '안 받아요'
            }
            right={
              supported ? (
                <Toggle
                  label="체온 알림"
                  value={tempOn}
                  onChange={(on) => void (on ? withPermission(() => setTempReminder(true)) : setTempReminder(false))}
                />
              ) : null
            }
          />
          <ListRow
            divider
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
