/**
 * 사용자 설정을 화면들이 함께 보는 자리 — 마이에서 바꾸면 홈이 바로 따라 바뀐다.
 * 값은 기기 settings 테이블에 둔다(backend 「기기 DB 스키마」).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readSetting, writeSetting } from './db';
import { TEMP_HOURS } from './care-reminders';
import { scheduleBriefing, scheduleTempReminders } from './notifications';

/** 아침 브리핑 알림 시각 `HH:MM`, 끄면 'off'. 정한 적이 없으면 오전 8시(SPEC-HOME-06) */
const BRIEFING_TIME_KEY = 'briefing_time';
export const DEFAULT_BRIEFING_TIME = '08:00';

/** 하루 기록이 비었을 때 묻는 알림과 카드 (SPEC-BABY-07) — 'on' · 'off', 정한 적이 없으면 켜짐 */
const NUDGE_PUSH_KEY = 'record_nudge_push';
const NUDGE_CARD_KEY = 'record_nudge_card';

/**
 * 기록 알림 (SPEC-LOG-05) — 수유 · 기저귀 · 잠 · 체온 · 기록이 비었을 때를 한 스위치로. 'on' · 'off', 정한 적이 없으면 켜짐.
 * 때는 부모가 고르지 않고 월령 기준으로 앱이 정한다(care-reminders.ts)
 */
const CARE_REMINDERS_KEY = 'care_reminders';

type PreferencesValue = {
  /** 기기에서 읽어오는 중 */
  loading: boolean;
  /** 아침 브리핑 알림 시각. null 이면 끔 */
  briefingTime: string | null;
  /** 바꾸면 알림을 다시 건다 — 허락은 부르는 쪽이 먼저 받는다 */
  setBriefingTime: (time: string | null) => Promise<void>;
  /** 기록 요청 알림 — 거는 것은 record-nudge.tsx 가 이 값을 보고 한다. 허락은 부르는 쪽이 먼저 받는다 */
  nudgePush: boolean;
  setNudgePush: (on: boolean) => Promise<void>;
  /** 기록 요청 카드 — 앱을 열 때 저절로 띄우기 */
  nudgeCard: boolean;
  setNudgeCard: (on: boolean) => Promise<void>;
  /** 기록 알림 — 수유 · 기저귀 · 잠 · 체온 · 기록이 비었을 때 */
  careReminders: boolean;
  setCareReminders: (on: boolean) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [briefingTime, setTime] = useState<string | null>(DEFAULT_BRIEFING_TIME);
  const [nudgePush, setPush] = useState(true);
  const [nudgeCard, setCard] = useState(true);
  const [careReminders, setCare] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readSetting(BRIEFING_TIME_KEY),
      readSetting(NUDGE_PUSH_KEY),
      readSetting(NUDGE_CARD_KEY),
      readSetting(CARE_REMINDERS_KEY),
    ])
      .then(([time, push, card, care]) => {
        if (cancelled) return;
        setPush(push !== 'off');
        setCard(card !== 'off');
        setCare(care !== 'off');
        void scheduleTempReminders(care !== 'off' ? TEMP_HOURS : null).catch(() => undefined);
        const t = time === 'off' ? null : (time ?? DEFAULT_BRIEFING_TIME);
        setTime(t);
        // 시작할 때마다 다시 건다 — 허락을 설정 앱에서 나중에 켰어도 따라오게. 허락이 없으면 아무 일도 없다
        void scheduleBriefing(t).catch(() => undefined);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setBriefingTime = useCallback(async (time: string | null) => {
    setTime(time);
    await writeSetting(BRIEFING_TIME_KEY, time ?? 'off');
    await scheduleBriefing(time).catch(() => undefined);
  }, []);

  const setNudgePush = useCallback(async (on: boolean) => {
    setPush(on);
    await writeSetting(NUDGE_PUSH_KEY, on ? 'on' : 'off');
  }, []);

  const setNudgeCard = useCallback(async (on: boolean) => {
    setCard(on);
    await writeSetting(NUDGE_CARD_KEY, on ? 'on' : 'off');
  }, []);

  const setCareReminders = useCallback(async (on: boolean) => {
    setCare(on);
    await writeSetting(CARE_REMINDERS_KEY, on ? 'on' : 'off');
    await scheduleTempReminders(on ? TEMP_HOURS : null).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      briefingTime,
      setBriefingTime,
      nudgePush,
      setNudgePush,
      nudgeCard,
      setNudgeCard,
      careReminders,
      setCareReminders,
    }),
    [
      loading,
      briefingTime,
      setBriefingTime,
      nudgePush,
      setNudgePush,
      nudgeCard,
      setNudgeCard,
      careReminders,
      setCareReminders,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences 는 PreferencesProvider 안에서만 쓸 수 있어요');
  return value;
}
