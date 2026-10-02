/**
 * 사용자 설정을 화면들이 함께 보는 자리 — 마이에서 바꾸면 홈이 바로 따라 바뀐다.
 * 값은 기기 settings 테이블에 둔다(backend 「기기 DB 스키마」).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readSetting, writeSetting } from './db';

/** 홈 「챙길 것」에서 생활 항목을 빼고 접종·검진만 보기 (SPEC-HOME-02 생활 항목) */
const SCHEDULE_ONLY_KEY = 'todo_schedule_only';

type PreferencesValue = {
  scheduleOnly: boolean;
  setScheduleOnly: (on: boolean) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [scheduleOnly, setValue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readSetting(SCHEDULE_ONLY_KEY).then((stored) => {
      if (!cancelled) setValue(stored === 'true');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setScheduleOnly = useCallback(async (on: boolean) => {
    setValue(on);
    await writeSetting(SCHEDULE_ONLY_KEY, on ? 'true' : 'false');
  }, []);

  const value = useMemo(() => ({ scheduleOnly, setScheduleOnly }), [scheduleOnly, setScheduleOnly]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences 는 PreferencesProvider 안에서만 쓸 수 있어요');
  return value;
}
