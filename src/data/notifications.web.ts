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

export async function scheduleBriefing(_time: string | null): Promise<void> {}

export async function scheduleRecordNudge(_at: Date | null): Promise<void> {}

export function onRecordNudgeOpened(_listener: () => void): () => void {
  return () => undefined;
}

export async function scheduleFeedReminder(_at: Date | null, _afterLabel: string): Promise<void> {}

export function onBriefingOpened(_listener: () => void): () => void {
  return () => undefined;
}

export async function scheduleDiaperReminder(_at: Date | null, _afterLabel: string): Promise<void> {}

export async function scheduleSleepReminder(_at: Date | null, _afterLabel: string): Promise<void> {}

export async function scheduleTempReminders(_hours: number[] | null): Promise<void> {}
