/**
 * 폰 홈 화면 위젯에 보일 것을 밀어 넣고, 위젯에서 누른 루틴을 받아 반영하는 자리 (SPEC-MAIN-09, task today/008).
 *
 * 루트 레이아웃에 한 번 둔다. 루틴 · 할 일 · 기록 · 생일이 바뀔 때마다 오늘부터 일주일 치(widget-data.ts)를 다시 넣어서
 * 자정이 지나도 앱 없이 날짜 · 수 · 그날 루틴이 바뀐다. 앱이 처음 열릴 때와 앞으로 올 때는 먼저 위젯의 `pending` 을 읽어 `check` 로 반영하고, 그다음에 넣는다 —
 * 순서가 바뀌면 누른 것이 지워진다. Expo Go · 웹에는 위젯이 없어 아무것도 하지 않는다(widgets-native.ts).
 */

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { ageFrom } from './baby';
import { useBaby } from './baby-context';
import { babyRows } from './baby-rows';
import { useRecords } from './records-context';
import { todayPlan } from './routine';
import { useRoutines } from './routines-context';
import { useTodos } from './todos-context';
import { emptyWidgetProps, widgetDays, widgetProps, type WidgetEntry } from './widget-data';
import { androidWidgets, iosWidgets, widgetsAvailable } from './widgets-native';

const HOME_URL = Linking.createURL('/');
const ROUTINES_URL = Linking.createURL('/routines');

async function takePending(): Promise<string[]> {
  try {
    if (Platform.OS === 'ios') return (await iosWidgets()?.takeIosPending()) ?? [];
    if (Platform.OS === 'android') return (await androidWidgets()?.takeAndroidPending()) ?? [];
  } catch {
    // 위젯 저장소를 못 읽어도 앱은 그대로 간다
  }
  return [];
}

async function push(entries: WidgetEntry[]): Promise<void> {
  try {
    if (Platform.OS === 'ios') iosWidgets()?.pushIosWidgets(entries);
    else if (Platform.OS === 'android') await androidWidgets()?.pushAndroidWidgets(entries);
  } catch {
    // 위젯이 없는 폰(옛 iOS)이어도 앱은 그대로 간다
  }
}

export function WidgetSync() {
  const { baby } = useBaby();
  const { records } = useRecords();
  const { topics, todos, autoRemoved, loading: todosLoading } = useTodos();
  const { routines, logs, loading, check } = useRoutines();
  const [face, setFace] = useState('');
  /** 위젯에서 누른 것을 반영한 횟수 — 0이면 아직 안 읽어서 밀어 넣지 않는다 */
  const [reconciled, setReconciled] = useState(0);

  // 버디 얼굴을 위젯 공유 폴더에 한 번
  useEffect(() => {
    if (!widgetsAvailable || Platform.OS !== 'ios') return;
    void iosWidgets()
      ?.ensureFace()
      .then(setFace)
      .catch(() => setFace(''));
  }, []);

  // 위젯에서 누른 루틴 — 처음 한 번과 앱이 앞으로 올 때마다
  useEffect(() => {
    if (!widgetsAvailable || loading) return;
    let alive = true;
    const apply = async () => {
      const ids = await takePending();
      for (const id of ids) if (routines.some((r) => r.id === id)) await check(id);
      if (alive) setReconciled((n) => n + 1);
    };
    void apply();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void apply();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [loading, routines, check]);

  // 일주일 치 밀어 넣기 — 바뀐 뒤 잠깐 모아서 한 번
  useEffect(() => {
    if (!widgetsAvailable || loading || todosLoading || reconciled === 0) return;
    const timer = setTimeout(() => {
      const entries: WidgetEntry[] = widgetDays(new Date()).map((day) => {
        if (!baby) return { date: day.getTime(), props: emptyWidgetProps(HOME_URL, face, day) };
        const { rows } = babyRows({ baby, age: ageFrom(baby.birthDate, day), records, topics, todos, autoRemoved }, day);
        const plan = todayPlan(routines, logs, day);
        return { date: day.getTime(), props: widgetProps({ birthDate: baby.birthDate, rows, plan, home: HOME_URL, routinesUrl: ROUTINES_URL, face }, day) };
      });
      void push(entries);
    }, 250);
    return () => clearTimeout(timer);
  }, [baby, records, topics, todos, autoRemoved, routines, logs, loading, todosLoading, face, reconciled]);

  return null;
}
