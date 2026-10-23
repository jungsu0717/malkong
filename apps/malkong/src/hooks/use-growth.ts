/**
 * 성장 탭 고도화를 앱에 잇는 자리 (SPEC-STAGE-04 · 06, task growth/007) — 놀이 묶음과 성장 소식 알림.
 * 계산은 `growth-plus.ts`(순수 함수), 여기서는 승인된 공공 지식(L1)과 기기 설정을 붙인다.
 */

import { router } from 'expo-router';
import { useEffect } from 'react';

import { useBaby } from '@/data/baby-context';
import { growthNotices, monthIndexAt, todayPlayIndex } from '@/data/growth-plus';
import { itemsByIds, type KnowledgeItem } from '@/data/l1';
import { onGrowthAlertOpened, scheduleGrowthNotices } from '@/data/notifications';
import { usePreferences } from '@/data/preferences-context';
import { checklistIds, checkpointFor, dayNumber, forMonth, splitTitle, tipIds } from '@/data/stage';

/** 그 개월의 놀이 묶음 — 「해 주면 좋아요」(터미타임 포함) 가운데 개월이 맞는 것 */
export function playPool(month: number): (KnowledgeItem & { approved: boolean })[] {
  return forMonth(itemsByIds(tipIds(checkpointFor(month))), month);
}

/** 놀이의 짧은 이름 — 「아기 소리를 따라 하며 주고받기」 */
export function playName(item: KnowledgeItem): string {
  return splitTitle(item.title).head;
}

/** 그날의 놀이 하나 — 성장 탭 카드와 주차 알림이 같은 것을 고른다 */
export function playFor(birthDate: string, day: Date, offset = 0): (KnowledgeItem & { approved: boolean }) | null {
  const pool = playPool(monthIndexAt(birthDate, day));
  const i = todayPlayIndex(pool.length, dayNumber(birthDate, day), offset);
  return i < 0 ? null : pool[i];
}

/** 성장 소식 — 앱을 열 때마다 앞으로 35일 치를 다시 건다. 끄면 모두 지운다 */
export function useGrowthAlerts(): void {
  const { baby } = useBaby();
  const { loading, growthAlerts, briefingTime } = usePreferences();
  const birthDate = baby?.birthDate ?? null;

  useEffect(() => {
    if (loading || !birthDate) return;
    // 아침 알림 시각에 맞춘다 — 아침 알림을 껐으면 오전 9시
    const [hour, minute] = (briefingTime ?? '09:00').split(':').map(Number);
    const items = growthAlerts
      ? growthNotices({
          birthDate,
          hour,
          minute,
          playFor: (day) => {
            const item = playFor(birthDate, day);
            return item ? playName(item) : null;
          },
          checkpointOpens: (month) => {
            const cp = checkpointFor(month);
            return month > 0 && cp !== checkpointFor(month - 1) && checklistIds(cp).length > 0 ? cp : null;
          },
        })
      : [];
    void scheduleGrowthNotices(items).catch(() => undefined);
  }, [loading, birthDate, growthAlerts, briefingTime]);

  // 성장 소식을 누르고 들어오면 성장 탭으로
  useEffect(() => onGrowthAlertOpened(() => router.navigate('/growth')), []);
}
