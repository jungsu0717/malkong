/** 웹 미리보기에는 알림이 없다 — 화면은 「이 기기에서는 알림을 쓸 수 없어요」로 보인다 */

export function notificationsSupported(): boolean {
  return false;
}

export async function notificationsAllowed(): Promise<boolean> {
  return false;
}

export async function askNotifications(): Promise<boolean> {
  return false;
}

export type MorningDay = { day: Date; titles: string[] };

export async function scheduleMorningAlerts(_time: string | null, _days: MorningDay[]): Promise<void> {}

export async function cancelRecordAlerts(): Promise<void> {}

export function onTodoAlertOpened(_listener: () => void): () => void {
  return () => undefined;
}

export type TodoReminder = { id: string; at: Date; title: string; body?: string | null; silent?: boolean };
export type AlertAction = 'done' | 'snooze';

export async function scheduleTodoReminders(_items: TodoReminder[]): Promise<void> {}

export async function snoozeTodo(_id: string, _title: string, _body: string | null, _routine = false): Promise<void> {}

export async function scheduleRoutineReminders(
  _items: { id: string; routineId: string; at: Date; title: string; body: string }[],
): Promise<void> {}

export async function cancelSnooze(_todoId: string): Promise<void> {}

export async function scheduleEveningAlerts(_on: boolean, _days: MorningDay[], _hour: number): Promise<void> {}

export async function scheduleDeliveryChecks(_items: { id: string; title: string; at: Date }[]): Promise<void> {}

export function onAlertAction(
  _target: 'todo' | 'routine',
  _listener: (action: AlertAction, id: string, title: string, body: string | null) => void,
): () => void {
  return () => undefined;
}
