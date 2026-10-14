/**
 * 기기가 스스로 띄우는 로컬 알림 둘 — 아침 브리핑(SPEC-HOME-06, task home/004)과 기록 요청(SPEC-BABY-07, task baby/003).
 *
 * 서버 푸시가 아니다 — 기기 토큰을 서버에 두지 않는다. 브리핑 알림을 누르면 앱이 열리고 그날 첫 화면에서
 * 브리핑이 만들어진다(use-daily-briefing). 기록 요청 알림을 누르면 적을 카드가 열린다(record-nudge.tsx).
 * 알림 본문에는 아기 정보를 넣지 않는다 — 잠금 화면에 보이므로.
 * 브리핑은 하루 한 번, 기록 요청은 하루 기록이 비었을 때 사흘에 한 번까지(`record-nudge.ts`). 웹은 notifications.web.ts.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const BRIEFING_ID = 'morning-briefing';
const CHANNEL_ID = 'briefing';
const NUDGE_ID = 'record-nudge';
const NUDGE_CHANNEL_ID = 'record-nudge';
/** 알림의 data.type — 누르면 이것으로 알아보고 카드를 연다 */
const NUDGE_TYPE = 'record-nudge';
const BRIEFING_TYPE = 'briefing';
const FEED_ID = 'feed-reminder';
const FEED_CHANNEL_ID = 'feed-reminder';
const DIAPER_ID = 'diaper-reminder';
const SLEEP_ID = 'sleep-reminder';
const TEMP_IDS = ['temp-morning', 'temp-evening'] as const;
/** 기록 알림 묶음의 안드로이드 채널 — 수유 말고는 한 채널에 둔다 */
const CARE_CHANNEL_ID = 'care-reminder';

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
      body: '버디가 오늘 안부와 챙길 것을 정리해 뒀어요',
      // 누르면 버디 탭으로 연다 — 첫 화면이 기록 탭이라서(decisions/023)
      data: { type: BRIEFING_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

/** 기록 요청 알림 — 정한 때 한 번. null 이면 끈다. 허락이 없으면 걸지 않는다 */
export async function scheduleRecordNudge(at: Date | null): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NUDGE_ID).catch(() => undefined);
  if (!at || !(await notificationsAllowed())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL_ID, {
      name: '기록 요청',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: NUDGE_ID,
    content: {
      title: '요 며칠 기록이 비었어요',
      body: '생각나는 것만 적어 주면 버디 답이 더 정확해져요',
      data: { type: NUDGE_TYPE },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: NUDGE_CHANNEL_ID },
  });
}

/**
 * 기록 요청 알림을 눌러 앱이 열리면 `listener` 를 부른다 — 앱이 꺼져 있다가 그 알림으로 열린 경우도.
 * 한 번 받은 누름은 지워 다시 열지 않는다. 돌려주는 함수로 듣기를 그만둔다.
 */
export function onRecordNudgeOpened(listener: () => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (
      response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
      response.notification.request.content.data?.type !== NUDGE_TYPE
    ) {
      return;
    }
    Notifications.clearLastNotificationResponse();
    listener();
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

/**
 * 수유 알림 (SPEC-LOG-05) — 정한 때 한 번. null 이면 끈다. 허락이 없으면 걸지 않는다.
 * 글에는 아기 정보 · 기록 내용을 넣지 않는다 — 잠금 화면에 보이므로. `afterLabel` 은 「3시간」 같은 정한 시간뿐이다
 */
export async function scheduleFeedReminder(at: Date | null, afterLabel: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FEED_ID).catch(() => undefined);
  if (!at || !(await notificationsAllowed())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(FEED_CHANNEL_ID, {
      name: '수유 알림',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: FEED_ID,
    content: {
      title: `마지막 수유 뒤 ${afterLabel}이 지났어요`,
      body: '배고플 때가 됐을 수 있어요',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: FEED_CHANNEL_ID },
  });
}

/** 아침 브리핑 알림을 눌러 앱이 열리면 `listener` 를 부른다 — 버디 탭으로 보내려고. 돌려주는 함수로 그만 듣는다 */
export function onBriefingOpened(listener: () => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (
      response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
      response.notification.request.content.data?.type !== BRIEFING_TYPE
    ) {
      return;
    }
    Notifications.clearLastNotificationResponse();
    listener();
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

async function careChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CARE_CHANNEL_ID, {
    name: '기록 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** 한 번 거는 기록 알림 — null 이면 끈다. 글에는 아기 정보 · 기록 내용을 넣지 않는다 */
async function scheduleOnce(id: string, at: Date | null, title: string, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  if (!at || !(await notificationsAllowed())) return;
  await careChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CARE_CHANNEL_ID },
  });
}

/** 기저귀 알림 (SPEC-LOG-05) — 마지막 기저귀 뒤 정한 시간 */
export async function scheduleDiaperReminder(at: Date | null, afterLabel: string): Promise<void> {
  await scheduleOnce(DIAPER_ID, at, `기저귀를 간 지 ${afterLabel}이 지났어요`, '한번 살펴볼 때가 됐을 수 있어요');
}

/** 잠 알림 (SPEC-LOG-05) — 깬 뒤 평소 깨어 있던 시간 */
export async function scheduleSleepReminder(at: Date | null, afterLabel: string): Promise<void> {
  await scheduleOnce(SLEEP_ID, at, `잠에서 깬 지 ${afterLabel}이 지났어요`, '졸려할 때가 됐을 수 있어요');
}

/** 체온 알림 (SPEC-LOG-05) — 매일 아침 · 저녁 정한 시(care-reminders). null 이면 둘 다 지운다 */
export async function scheduleTempReminders(hours: number[] | null): Promise<void> {
  for (const id of TEMP_IDS) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  if (!hours || !(await notificationsAllowed())) return;
  await careChannel();
  for (const [i, hour] of hours.slice(0, TEMP_IDS.length).entries()) {
    await Notifications.scheduleNotificationAsync({
      identifier: TEMP_IDS[i],
      content: {
        title: i === 0 ? '아침 체온을 재 볼 시간이에요' : '저녁 체온을 재 볼 시간이에요',
        body: '기록 탭에서 바로 남길 수 있어요',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CARE_CHANNEL_ID },
    });
  }
}
