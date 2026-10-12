/**
 * 사용자 설정을 화면들이 함께 보는 자리 — 마이에서 바꾸면 홈이 바로 따라 바뀐다.
 * 값은 기기 settings 테이블에 둔다(backend 「기기 DB 스키마」).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readSetting, writeSetting } from './db';
import { scheduleBriefing, scheduleTempReminders } from './notifications';

/** 아침 브리핑 알림 시각 `HH:MM`, 끄면 'off'. 정한 적이 없으면 오전 8시(SPEC-HOME-06) */
const BRIEFING_TIME_KEY = 'briefing_time';
export const DEFAULT_BRIEFING_TIME = '08:00';

/** 하루 기록이 비었을 때 묻는 알림과 카드 (SPEC-BABY-07) — 'on' · 'off', 정한 적이 없으면 켜짐 */
const NUDGE_PUSH_KEY = 'record_nudge_push';
const NUDGE_CARD_KEY = 'record_nudge_card';

/** 수유 알림 (SPEC-LOG-05) — 마지막 수유 시작 뒤 몇 분에 알릴지, 끄면 'off'. 정한 적이 없으면 3시간 */
const FEED_REMINDER_KEY = 'feed_reminder';
export const DEFAULT_FEED_REMINDER = 180;
/** 기저귀 알림 — 마지막 기저귀 뒤 몇 분, 끄면 'off'. 정한 적이 없으면 3시간 */
const DIAPER_REMINDER_KEY = 'diaper_reminder';
export const DEFAULT_DIAPER_REMINDER = 180;
/** 잠 알림 — 'on' · 'off', 정한 적이 없으면 켜짐 */
const SLEEP_REMINDER_KEY = 'sleep_reminder';
/** 체온 알림(아침 · 저녁) — 'on' · 'off', 정한 적이 없으면 켜짐 */
const TEMP_REMINDER_KEY = 'temp_reminder';

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
  /** 수유 알림 — 마지막 수유 시작 뒤 몇 분. null 이면 끔 */
  feedReminder: number | null;
  setFeedReminder: (minutes: number | null) => Promise<void>;
  /** 기저귀 알림 — 마지막 기저귀 뒤 몇 분. null 이면 끔 */
  diaperReminder: number | null;
  setDiaperReminder: (minutes: number | null) => Promise<void>;
  /** 잠 알림 — 깬 뒤 평소 깨어 있던 시간이 지나도록 잠 기록이 없으면 */
  sleepReminder: boolean;
  setSleepReminder: (on: boolean) => Promise<void>;
  /** 체온 알림 — 매일 아침 · 저녁 */
  tempReminder: boolean;
  setTempReminder: (on: boolean) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [briefingTime, setTime] = useState<string | null>(DEFAULT_BRIEFING_TIME);
  const [nudgePush, setPush] = useState(true);
  const [nudgeCard, setCard] = useState(true);
  const [feedReminder, setFeed] = useState<number | null>(DEFAULT_FEED_REMINDER);
  const [diaperReminder, setDiaper] = useState<number | null>(DEFAULT_DIAPER_REMINDER);
  const [sleepReminder, setSleep] = useState(true);
  const [tempReminder, setTemp] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readSetting(BRIEFING_TIME_KEY),
      readSetting(NUDGE_PUSH_KEY),
      readSetting(NUDGE_CARD_KEY),
      readSetting(FEED_REMINDER_KEY),
      readSetting(DIAPER_REMINDER_KEY),
      readSetting(SLEEP_REMINDER_KEY),
      readSetting(TEMP_REMINDER_KEY),
    ])
      .then(([time, push, card, feed, diaper, sleep, temp]) => {
        if (cancelled) return;
        setPush(push !== 'off');
        setCard(card !== 'off');
        setFeed(feed === 'off' ? null : Number(feed) || DEFAULT_FEED_REMINDER);
        setDiaper(diaper === 'off' ? null : Number(diaper) || DEFAULT_DIAPER_REMINDER);
        setSleep(sleep !== 'off');
        setTemp(temp !== 'off');
        void scheduleTempReminders(temp !== 'off').catch(() => undefined);
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

  const setFeedReminder = useCallback(async (minutes: number | null) => {
    setFeed(minutes);
    await writeSetting(FEED_REMINDER_KEY, minutes === null ? 'off' : String(minutes));
  }, []);

  const setDiaperReminder = useCallback(async (minutes: number | null) => {
    setDiaper(minutes);
    await writeSetting(DIAPER_REMINDER_KEY, minutes === null ? 'off' : String(minutes));
  }, []);

  const setSleepReminder = useCallback(async (on: boolean) => {
    setSleep(on);
    await writeSetting(SLEEP_REMINDER_KEY, on ? 'on' : 'off');
  }, []);

  const setTempReminder = useCallback(async (on: boolean) => {
    setTemp(on);
    await writeSetting(TEMP_REMINDER_KEY, on ? 'on' : 'off');
    await scheduleTempReminders(on).catch(() => undefined);
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
      feedReminder,
      setFeedReminder,
      diaperReminder,
      setDiaperReminder,
      sleepReminder,
      setSleepReminder,
      tempReminder,
      setTempReminder,
    }),
    [
      loading,
      briefingTime,
      setBriefingTime,
      nudgePush,
      setNudgePush,
      nudgeCard,
      setNudgeCard,
      feedReminder,
      setFeedReminder,
      diaperReminder,
      setDiaperReminder,
      sleepReminder,
      setSleepReminder,
      tempReminder,
      setTempReminder,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences 는 PreferencesProvider 안에서만 쓸 수 있어요');
  return value;
}
