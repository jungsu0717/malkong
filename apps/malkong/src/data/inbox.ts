/**
 * 알림함 (SPEC-HOME-07, task home/007) — 브리핑이 온 것과 앱의 알림을 한곳에.
 *
 * 줄은 요약만 든다. 브리핑 내용은 볼 때마다 기록으로 다시 세므로(브리핑 · 일정 탭) 여기 저장하지 않는다.
 * 기기 안(inbox_card)에만 두고 서버로 보내지 않는다. 배지는 아직 열어 보지 않은 줄의 수.
 */

/** daily · weekly · monthly = 브리핑, nudge = 기록 요청(SPEC-BABY-07), family = 가족 공유 신청(나중) */
export type InboxKind = 'daily' | 'weekly' | 'monthly' | 'nudge' | 'family';

export type InboxCard = {
  /** 하루 · 한 주 · 한 달에 하나 — daily-<날짜> · weekly-<월요일> · monthly-<월령> · nudge-<날짜> */
  id: string;
  kind: InboxKind;
  title: string;
  /** 줄에 보이는 한 줄 */
  summary: string;
  /** 가리키는 날(`dayKey`) — 누르면 일정 탭의 그날로 */
  day: string | null;
  /** 열어 본 때 — 없으면 새 것 */
  readAt: string | null;
  createdAt: string;
};

export const BRIEFING_KINDS: InboxKind[] = ['daily', 'weekly', 'monthly'];

export const isBriefing = (card: InboxCard) => BRIEFING_KINDS.includes(card.kind);
