/**
 * 기록 요청을 띄우는 자리 (SPEC-BABY-07, task baby/003) — 루트 레이아웃에 한 번 둔다.
 *
 * 앱이 앞으로 올 때마다 셈해(`record-nudge.ts`) 물을 때면 카드를 띄우고, 다음 알림을 다시 건다.
 * 알림을 눌러 열리면 카드 스위치와 상관없이 카드를 연다 — 사용자가 직접 누른 것이므로.
 * 건너뛰기 · 바깥 누르기 · 적기 · 다시 보지 않기 모두 「물은 때」를 지금으로 두어 다시 사흘을 센다.
 */

import { useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { RecordNudgeCard, type LogEntryInput } from '@/components/record-nudge-card';
import { tap } from '@/components/ui';
import { useBaby } from '@/data/baby-context';
import { readSetting, writeSetting } from '@/data/db';
import { onRecordNudgeOpened, scheduleRecordNudge } from '@/data/notifications';
import { usePreferences } from '@/data/preferences-context';
import { nextNudgeAt, nudgeDue } from '@/data/record-nudge';
import { useRecords } from '@/data/records-context';

/** 마지막으로 물은 때(ISO) — 없으면 처음 연 지금으로 둔다. 깔자마자 묻지 않게 */
const SINCE_KEY = 'record_nudge_since';
/** 앱이 열리자마자 덮지 않게 첫 화면을 잠깐 보인 뒤 띄운다 */
const OPEN_DELAY_MS = 900;

export function RecordNudge() {
  const { baby, age } = useBaby();
  const { records, loading: recordsLoading, add } = useRecords();
  const { nudgePush, nudgeCard, setNudgePush, setNudgeCard, loading: prefsLoading } = usePreferences();
  const segments = useSegments();
  const [since, setSince] = useState<Date | null>(null);
  /** 셈의 기준 시각 — 앱이 앞으로 올 때마다 새로 */
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  /** 열 때마다 빈칸으로 */
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readSetting(SINCE_KEY).then((stored) => {
      if (cancelled) return;
      const at = stored ? new Date(stored) : new Date();
      setSince(Number.isNaN(at.getTime()) ? new Date() : at);
      if (!stored) void writeSetting(SINCE_KEY, at.toISOString());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  const openCard = useCallback(() => {
    setRound((r) => r + 1);
    setOpen(true);
  }, []);

  useEffect(() => onRecordNudgeOpened(openCard), [openCard]);

  const ready = !!baby && !recordsLoading && !prefsLoading;
  const onboarding = segments[0] === 'onboarding';
  const due = ready && since !== null && nudgeDue(records, since, now);

  // 물을 때면 카드 — 카드 스위치가 켜져 있을 때만
  useEffect(() => {
    if (!due || !nudgeCard || onboarding || open) return;
    const timer = setTimeout(openCard, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [due, nudgeCard, onboarding, open, openCard, now]);

  // 다음 알림 — 앱이 앞으로 올 때마다 다시 건다(설정 앱에서 알림을 나중에 허락해도 따라오게)
  const nextAt = ready && since !== null ? nextNudgeAt(records, since, now).getTime() : null;
  useEffect(() => {
    if (nextAt === null) return;
    void scheduleRecordNudge(nudgePush ? new Date(nextAt) : null).catch(() => undefined);
  }, [nextAt, nudgePush, now]);

  const asked = useCallback(() => {
    const at = new Date();
    setSince(at);
    setNow(at);
    void writeSetting(SINCE_KEY, at.toISOString());
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    asked();
  }, [asked]);

  const save = async (entries: LogEntryInput[]) => {
    tap('success');
    const today = new Date();
    for (const { def, value } of entries) {
      await add({ kind: '기록', label: def.label(value, today), covers: [], whenLabel: age ? `D+${age.days}에 알림` : null });
    }
    asked();
  };

  return (
    <RecordNudgeCard
      key={`nudge-${round}`}
      visible={open && ready && !onboarding}
      records={records}
      onSave={save}
      onSkip={close}
      onNeverAgain={() => {
        close();
        void setNudgeCard(false);
        void setNudgePush(false);
      }}
      onDone={close}
    />
  );
}
