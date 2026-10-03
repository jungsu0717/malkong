/**
 * 사용자 설정을 화면들이 함께 보는 자리 — 마이에서 바꾸면 홈이 바로 따라 바뀐다.
 * 값은 기기 settings 테이블에 둔다(backend 「기기 DB 스키마」).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readSetting, writeSetting } from './db';
import { scheduleBriefing } from './notifications';

/** 홈 「챙길 것」에서 생활 항목을 빼고 접종·검진만 보기 (SPEC-HOME-02 생활 항목) */
const SCHEDULE_ONLY_KEY = 'todo_schedule_only';

/** 아침 브리핑 알림 시각 `HH:MM`, 끄면 'off'. 정한 적이 없으면 오전 8시(SPEC-HOME-06) */
const BRIEFING_TIME_KEY = 'briefing_time';
export const DEFAULT_BRIEFING_TIME = '08:00';

/** 하루 기록이 비었을 때 묻는 알림과 카드 (SPEC-BABY-07) — 'on' · 'off', 정한 적이 없으면 켜짐 */
const NUDGE_PUSH_KEY = 'record_nudge_push';
const NUDGE_CARD_KEY = 'record_nudge_card';

type PreferencesValue = {
  /** 기기에서 읽어오는 중 */
  loading: boolean;
  scheduleOnly: boolean;
  setScheduleOnly: (on: boolean) => Promise<void>;
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
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [scheduleOnly, setValue] = useState(false);
  const [briefingTime, setTime] = useState<string | null>(DEFAULT_BRIEFING_TIME);
  const [nudgePush, setPush] = useState(true);
  const [nudgeCard, setCard] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readSetting(SCHEDULE_ONLY_KEY),
      readSetting(BRIEFING_TIME_KEY),
      readSetting(NUDGE_PUSH_KEY),
      readSetting(NUDGE_CARD_KEY),
    ])
      .then(([only, time, push, card]) => {
        if (cancelled) return;
        setValue(only === 'true');
        setPush(push !== 'off');
        setCard(card !== 'off');
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

  const setScheduleOnly = useCallback(async (on: boolean) => {
    setValue(on);
    await writeSetting(SCHEDULE_ONLY_KEY, on ? 'true' : 'false');
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

  const value = useMemo(
    () => ({
      loading,
      scheduleOnly,
      setScheduleOnly,
      briefingTime,
      setBriefingTime,
      nudgePush,
      setNudgePush,
      nudgeCard,
      setNudgeCard,
    }),
    [loading, scheduleOnly, setScheduleOnly, briefingTime, setBriefingTime, nudgePush, setNudgePush, nudgeCard, setNudgeCard],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences 는 PreferencesProvider 안에서만 쓸 수 있어요');
  return value;
}
