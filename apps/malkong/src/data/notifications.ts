/**
 * 기기가 스스로 띄우는 로컬 알림 — 아침 알림(SPEC-TOPIC-09, 일주일 치를 날짜마다), 할 일 알림(SPEC-TOPIC-09), 기록 알림(SPEC-LOG-05).
 *
 * 서버 푸시가 아니다 — 기기 토큰을 서버에 두지 않는다. 아침 알림과 할 일 알림을 누르면 할 일 탭으로 연다.
 * 알림 본문에는 아기 이름과 기록 내용을 넣지 않는다 — 잠금 화면에 보이므로. 할 일 알림은 사용자가 적은 할 일 제목만 보인다.
 * 웹은 notifications.web.ts.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** 2026-10-15 까지 매일 같은 글로 걸던 아침 알림 — 지우기만 한다 */
const BRIEFING_ID = 'morning-briefing';
/** 날짜마다 따로 거는 아침 알림의 앞머리(task topic/002) */
const MORNING_PREFIX = 'morning-day-';
const CHANNEL_ID = 'briefing';
const NUDGE_ID = 'record-nudge';
const NUDGE_CHANNEL_ID = 'record-nudge';
/** 알림의 data.type — 누르면 이것으로 알아보고 카드를 연다 */
const NUDGE_TYPE = 'record-nudge';
const BRIEFING_TYPE = 'briefing';
const TODO_TYPE = 'todo';
const TODO_PREFIX = 'todo-';
const TODO_CHANNEL_ID = 'todo-reminder';
/** 한 번에 걸어 두는 할 일 알림 수 — iOS 는 앱 하나에 걸어 둘 수 있는 알림 수에 한도가 있어 가까운 것부터 */
const TODO_LIMIT = 40;
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

/** 아침 알림 하루 치 — 그날 0시와 그날 할 일 제목들 */
export type MorningDay = { day: Date; titles: string[] };

/** 아침 알림 글에 이름을 넣는 할 일 수 — 나머지는 「외 N개」 */
const MORNING_TITLES = 3;

/**
 * 아침 알림 (SPEC-TOPIC-09) — 날짜마다 따로, 그날 할 일 제목을 넣어 건다. `time` 이 null 이면 모두 끈다.
 * 할 일이 없는 날과 이미 지난 시각은 걸지 않는다. 허락이 없으면 걸지 않는다.
 * 예전에 매일 같은 글로 걸던 알림(BRIEFING_ID)도 함께 지운다.
 */
export async function scheduleMorningAlerts(time: string | null, days: MorningDay[]): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(() => undefined);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(MORNING_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
    }
  }
  if (!time || !(await notificationsAllowed())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '아침 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const [hour, minute] = time.split(':').map(Number);
  const now = Date.now();
  for (const { day, titles } of days) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
    if (titles.length === 0 || at.getTime() <= now) continue;
    const rest = titles.length - MORNING_TITLES;
    await Notifications.scheduleNotificationAsync({
      identifier: `${MORNING_PREFIX}${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`,
      content: {
        title: `오늘 할 일 ${titles.length}개`,
        body: titles.slice(0, MORNING_TITLES).join(', ') + (rest > 0 ? ` 외 ${rest}개` : ''),
        // 누르면 할 일 탭으로 연다
        data: { type: BRIEFING_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  }
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

/** 아침 알림 · 할 일 알림을 눌러 앱이 열리면 `listener` 를 부른다 — 할 일 탭으로 보내려고. 돌려주는 함수로 그만 듣는다 */
export function onTodoAlertOpened(listener: () => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const type = response?.notification.request.content.data?.type;
    if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER || (type !== BRIEFING_TYPE && type !== TODO_TYPE)) {
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

/**
 * 할 일 알림 (SPEC-TOPIC-09) — 시각을 정한 할 일마다 한 번. 할 일이 바뀔 때마다 통째로 다시 건다.
 * 허락이 없으면 걸지 않는다. 가까운 것부터 TODO_LIMIT 개까지.
 */
export async function scheduleTodoReminders(items: { id: string; at: Date; title: string }[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(TODO_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
    }
  }
  if (items.length === 0 || !(await notificationsAllowed())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TODO_CHANNEL_ID, {
      name: '할 일 알림',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const upcoming = [...items].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, TODO_LIMIT);
  for (const item of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${TODO_PREFIX}${item.id}`,
      content: { title: '할 일', body: item.title, data: { type: TODO_TYPE } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: TODO_CHANNEL_ID },
    });
  }
}
