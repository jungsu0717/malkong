/**
 * 기기가 스스로 띄우는 로컬 알림 — 아침 알림(SPEC-TOPIC-09, 일주일 치를 날짜마다), 할 일 알림(SPEC-TOPIC-09), 루틴 알림(SPEC-MAIN-04),
 * 성장 소식(SPEC-STAGE-06, 주차 · 달이 바뀌는 날 아침), 기록 알림(SPEC-LOG-05 — 수유 · 기저귀 · 잠).
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
/** 예전 기록 요청 알림 — 지우기만 한다(decisions/030) */
const NUDGE_ID = 'record-nudge';
const BRIEFING_TYPE = 'briefing';
const TODO_TYPE = 'todo';
const TODO_PREFIX = 'todo-';
const TODO_CHANNEL_ID = 'todo-reminder';
/**
 * 한 번에 걸어 두는 할 일 알림 수 — iOS 는 앱 하나에 걸어 둘 수 있는 알림이 64개라 가까운 것부터.
 * 아침 7 · 전날 저녁 3 · 루틴(사흘 치) · 받으셨나요 · 미룬 것을 더해도 넘지 않게(task topic/006 · today/001)
 */
const TODO_LIMIT = 20;
/** 루틴 알림(task today/001) */
const ROUTINE_PREFIX = 'routine-';
const ROUTINE_TYPE = 'routine';
const ROUTINE_CATEGORY = 'routineActions';
const GROWTH_PREFIX = 'growth-';
const GROWTH_TYPE = 'growth';

/** 성장 소식을 누르고 들어오면 성장 탭으로 */
export function onGrowthAlertOpened(listener: () => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER || response.notification.request.content.data?.type !== GROWTH_TYPE) return;
    Notifications.clearLastNotificationResponse();
    listener();
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

/** 성장 소식(SPEC-STAGE-06) — 주차 · 달이 바뀌는 날 아침. 걸린 것을 지우고 다시 건다. `items` 가 비면 끈 것 */
export async function scheduleGrowthNotices(items: { id: string; at: Date; title: string; body: string }[]): Promise<void> {
  await cancelPrefix(GROWTH_PREFIX);
  if (items.length === 0 || !(await notificationsAllowed())) return;
  for (const item of items) {
    if (item.at.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${GROWTH_PREFIX}${item.id}`,
      content: { title: item.title, body: item.body, data: { type: GROWTH_TYPE } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL_ID },
    });
  }
}

/** 전날 저녁 미리(task topic/006) */
const EVENING_PREFIX = 'evening-day-';
/** 받으셨나요(SPEC-SHOP-04) */
const DELIVERY_PREFIX = 'delivery-';
const DELIVERY_TYPE = 'delivery';
/** 「1시간 뒤」로 미룬 할 일 알림 — 할 일 알림을 다시 걸 때 지우지 않게 앞머리를 따로 둔다 */
const SNOOZE_PREFIX = 'snooze-';
/** 알림 단추 묶음(카테고리) — 이름에 「-」 「:」를 쓰지 않는다(Expo 문서) */
const TODO_CATEGORY = 'todoActions';
const DELIVERY_CATEGORY = 'deliveryActions';
export type AlertAction = 'done' | 'snooze';
const FEED_ID = 'feed-reminder';
const DIAPER_ID = 'diaper-reminder';
const SLEEP_ID = 'sleep-reminder';
/** 예전 체온 알림(매일 아침 · 저녁) — 2026-10-30 기록을 되살리면서 다시 걸지 않는다. 지우기만 한다 */
const TEMP_IDS = ['temp-morning', 'temp-evening'] as const;
const FEED_CHANNEL_ID = 'feed-reminder';
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

/**
 * 예전 기록 요청 · 체온 알림을 지운다 — 2026-10-19 에 뺐고, 기록을 되살린 뒤(decisions/036)에도 다시 걸지 않는다.
 * 그 전에 걸어 둔 폰이 있어 앱을 열 때 한 번 부른다
 */
export async function cancelRecordAlerts(): Promise<void> {
  for (const id of [NUDGE_ID, ...TEMP_IDS]) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
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
      body: '수유할 시간인지 확인해 보세요',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: FEED_CHANNEL_ID },
  });
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
  await scheduleOnce(DIAPER_ID, at, `기저귀를 간 지 ${afterLabel}이 지났어요`, '기저귀를 확인해 보세요');
}

/** 잠 알림 (SPEC-LOG-05) — 깬 뒤 평소 깨어 있던 시간 */
export async function scheduleSleepReminder(at: Date | null, afterLabel: string): Promise<void> {
  await scheduleOnce(SLEEP_ID, at, `잠에서 깬 지 ${afterLabel}이 지났어요`, '졸려하는지 살펴보세요');
}

/** 아침 알림 · 할 일 알림을 눌러 앱이 열리면 `listener` 를 부른다 — 할 일 탭으로 보내려고. 돌려주는 함수로 그만 듣는다 */
export function onTodoAlertOpened(listener: () => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const type = response?.notification.request.content.data?.type;
    if (
      response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
      (type !== BRIEFING_TYPE && type !== TODO_TYPE && type !== DELIVERY_TYPE && type !== ROUTINE_TYPE)
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

/** 알림 단추 — 할 일 · 루틴: 완료 · 1시간 뒤, 배송: 수령 완료. 앱을 열지 않고 처리한다 */
let categoriesReady = false;
async function ensureCategories(): Promise<void> {
  if (categoriesReady) return;
  await Notifications.setNotificationCategoryAsync(TODO_CATEGORY, [
    { identifier: 'done', buttonTitle: '완료', options: { opensAppToForeground: false } },
    { identifier: 'snooze', buttonTitle: '1시간 뒤', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync(DELIVERY_CATEGORY, [
    { identifier: 'done', buttonTitle: '수령 완료', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync(ROUTINE_CATEGORY, [
    { identifier: 'done', buttonTitle: '완료', options: { opensAppToForeground: false } },
    { identifier: 'snooze', buttonTitle: '1시간 뒤', options: { opensAppToForeground: false } },
  ]);
  categoriesReady = true;
}

async function todoChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TODO_CHANNEL_ID, {
    name: '할 일 알림',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export type TodoReminder = {
  id: string;
  at: Date;
  title: string;
  /** 반복 할 일이면 「마지막으로 한 지 7일 지났어요」 */
  body?: string | null;
  /** 아기가 자는 중이면 소리 없이(task topic/006) */
  silent?: boolean;
};

/**
 * 할 일 알림 (SPEC-TOPIC-09) — 시각을 정한 할 일마다 한 번, 「완료」 · 「1시간 뒤」 단추와 함께. 할 일이 바뀔 때마다 통째로 다시 건다.
 * 허락이 없으면 걸지 않는다. 가까운 것부터 TODO_LIMIT 개까지.
 */
export async function scheduleTodoReminders(items: TodoReminder[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(TODO_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
    }
  }
  if (items.length === 0 || !(await notificationsAllowed())) return;
  await todoChannel();
  await ensureCategories().catch(() => undefined);
  const upcoming = [...items].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, TODO_LIMIT);
  for (const item of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${TODO_PREFIX}${item.id}`,
      content: {
        title: item.title,
        body: item.body ?? '할 일 시간이에요',
        data: { type: TODO_TYPE, todoId: item.id },
        categoryIdentifier: TODO_CATEGORY,
        sound: item.silent ? false : 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: TODO_CHANNEL_ID },
    });
  }
}

/** 「1시간 뒤」 — 같은 알림을 한 시간 뒤에 한 번 더. 루틴이면 `routine` 을 true 로 */
export async function snoozeTodo(id: string, title: string, body: string | null, routine = false): Promise<void> {
  if (!(await notificationsAllowed())) return;
  await todoChannel();
  await ensureCategories().catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: `${SNOOZE_PREFIX}${id}`,
    content: {
      title,
      body: body ?? '할 일 시간이에요',
      data: routine ? { type: ROUTINE_TYPE, routineId: id } : { type: TODO_TYPE, todoId: id },
      categoryIdentifier: routine ? ROUTINE_CATEGORY : TODO_CATEGORY,
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 60 * 60 * 1000), channelId: TODO_CHANNEL_ID },
  });
}

/** 완료한 할 일의 미룬 알림을 지운다 */
export async function cancelSnooze(todoId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${SNOOZE_PREFIX}${todoId}`).catch(() => undefined);
}

/** 앞머리가 같은 알림을 모두 지운다 */
async function cancelPrefix(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(prefix)) await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
  }
}

/** 전날 저녁 미리(task topic/006) — `on` 이 false 면 모두 끈다. 할 일이 없는 저녁과 지난 때는 걸지 않는다 */
export async function scheduleEveningAlerts(on: boolean, days: MorningDay[], hour: number): Promise<void> {
  await cancelPrefix(EVENING_PREFIX);
  if (!on || !(await notificationsAllowed())) return;
  const now = Date.now();
  for (const { day, titles } of days) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
    if (titles.length === 0 || at.getTime() <= now) continue;
    const rest = titles.length - MORNING_TITLES;
    await Notifications.scheduleNotificationAsync({
      identifier: `${EVENING_PREFIX}${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`,
      content: {
        title: `내일 할 일 ${titles.length}개`,
        body: titles.slice(0, MORNING_TITLES).join(', ') + (rest > 0 ? ` 외 ${rest}개` : ''),
        data: { type: BRIEFING_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  }
}

/** 받으셨나요(SPEC-SHOP-04) — 도착 예정일 저녁에 아직 배송 중인 살 것마다 한 번, 「수령 완료」 단추와 함께 */
export async function scheduleDeliveryChecks(items: { id: string; title: string; at: Date }[]): Promise<void> {
  await cancelPrefix(DELIVERY_PREFIX);
  if (items.length === 0 || !(await notificationsAllowed())) return;
  await todoChannel();
  await ensureCategories().catch(() => undefined);
  for (const item of items) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${DELIVERY_PREFIX}${item.id}`,
      content: {
        title: `${item.title} 받으셨나요?`,
        body: '오늘 도착 예정이었어요. 받았다면 수령 완료를 눌러 주세요',
        data: { type: DELIVERY_TYPE, todoId: item.id },
        categoryIdentifier: DELIVERY_CATEGORY,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: TODO_CHANNEL_ID },
    });
  }
}

/** 루틴 알림(SPEC-MAIN-04) — 통째로 다시 건다. 「완료」 · 「1시간 뒤」 단추. 허락이 없으면 걸지 않는다 */
export async function scheduleRoutineReminders(items: { id: string; routineId: string; at: Date; title: string; body: string }[]): Promise<void> {
  await cancelPrefix(ROUTINE_PREFIX);
  if (items.length === 0 || !(await notificationsAllowed())) return;
  await todoChannel();
  await ensureCategories().catch(() => undefined);
  for (const item of items) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ROUTINE_PREFIX}${item.id}`,
      content: {
        title: item.title,
        body: item.body,
        data: { type: ROUTINE_TYPE, routineId: item.routineId },
        categoryIdentifier: ROUTINE_CATEGORY,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: TODO_CHANNEL_ID },
    });
  }
}

/**
 * 알림 단추(완료 · 1시간 뒤 · 수령 완료)를 누르면 `listener` 를 부른다. `target` 이 할 일이면 todoId, 루틴이면 routineId 를 본다.
 * 앱이 꺼져 있다가 그 단추로 깨어난 경우도 마지막 응답으로 한 번 본다. 돌려주는 함수로 그만 듣는다
 */
export function onAlertAction(
  target: 'todo' | 'routine',
  listener: (action: AlertAction, id: string, title: string, body: string | null) => void,
): () => void {
  const key = target === 'todo' ? 'todoId' : 'routineId';
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const action = response.actionIdentifier;
    if (action !== 'done' && action !== 'snooze') return;
    const content = response.notification.request.content;
    const todoId = content.data?.[key];
    if (typeof todoId !== 'string') return;
    Notifications.clearLastNotificationResponse();
    void Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
    listener(action, todoId, content.title ?? '', content.body ?? null);
  };
  handle(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
