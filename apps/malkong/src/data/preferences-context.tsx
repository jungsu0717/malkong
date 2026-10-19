/**
 * 사용자 설정을 화면들이 함께 보는 자리 — 마이에서 바꾸면 다른 화면이 바로 따라 바뀐다.
 * 값은 기기 settings 테이블에 둔다(backend 「기기 DB 스키마」).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readSetting, writeSetting } from './db';
import { cancelRecordAlerts } from './notifications';

/**
 * 아침 알림 시각 `HH:MM`, 끄면 'off'. 정한 적이 없으면 오전 8시(SPEC-TOPIC-09).
 * 알림을 거는 것은 그날 할 일을 아는 todos-context 가 이 값을 보고 한다(task topic/002)
 */
const BRIEFING_TIME_KEY = 'briefing_time';
export const DEFAULT_BRIEFING_TIME = '08:00';

type PreferencesValue = {
  /** 기기에서 읽어오는 중 */
  loading: boolean;
  /** 아침 알림 시각. null 이면 끔 */
  briefingTime: string | null;
  /** 바꾸면 todos-context 가 알림을 다시 건다 — 허락은 부르는 쪽이 먼저 받는다 */
  setBriefingTime: (time: string | null) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [briefingTime, setTime] = useState<string | null>(DEFAULT_BRIEFING_TIME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // 예전 기록 알림을 걸어 둔 폰이 있다 — 기록 기능을 뺐으니 지운다(decisions/030)
    void cancelRecordAlerts().catch(() => undefined);
    readSetting(BRIEFING_TIME_KEY)
      .then((time) => {
        if (!cancelled) setTime(time === 'off' ? null : (time ?? DEFAULT_BRIEFING_TIME));
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
  }, []);

  const value = useMemo(() => ({ loading, briefingTime, setBriefingTime }), [loading, briefingTime, setBriefingTime]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences 는 PreferencesProvider 안에서만 쓸 수 있어요');
  return value;
}
