/**
 * 아침 브리핑 알림 (SPEC-HOME-06, task home/004) — 기기가 매일 정한 시각에 스스로 띄우는 로컬 알림.
 *
 * 서버 푸시가 아니다 — 기기 토큰을 서버에 두지 않는다. 알림을 누르면 앱이 열리고, 그날 첫 화면에서
 * 브리핑이 만들어진다(use-daily-briefing). 알림 본문에는 아기 정보를 넣지 않는다 — 잠금 화면에 보이므로.
 * 독촉 알림은 보내지 않는다(SPEC-HOME-06) — 하루 한 번뿐이다. 웹은 notifications.web.ts.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const BRIEFING_ID = 'morning-briefing';
const CHANNEL_ID = 'briefing';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function notificationsSupported(): boolean {
  return true;
}

export async function notificationsAllowed(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** 허락을 묻는다 — 이미 거절했으면 시스템이 다시 묻지 않으므로 false 가 온다(설정 앱에서 켜야 한다) */
export async function askNotifications(): Promise<boolean> {
  if (await notificationsAllowed()) return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** `HH:MM` 이면 그 시각에 매일, null 이면 끈다. 허락이 없으면 걸지 않는다 */
export async function scheduleBriefing(time: string | null): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(() => undefined);
  if (!time || !(await notificationsAllowed())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '아침 브리핑',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const [hour, minute] = time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: BRIEFING_ID,
    content: {
      title: '오늘의 브리핑',
      body: '오늘 챙길 것을 버디가 정리해 뒀어요',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}
