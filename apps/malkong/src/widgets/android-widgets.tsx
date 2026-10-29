/**
 * 안드로이드 위젯의 작업 처리기와 앱 쪽 밀어 넣기 (SPEC-MAIN-09, task today/008).
 *
 * 앱이 꺼져 있어도 위젯을 그려야 해서 보일 내용(일주일 치, widget-data.ts)은 설정값에 두고, 처리기는 그것만 읽어 그린다 —
 * 추가될 때 · 30분마다 · 크기가 바뀔 때. 루틴 줄을 누르면 설정값의 그 벌을 토글하고 `widget_pending` 에 적어 둔다(앱이 앞으로 오면 widget-sync 가 반영).
 * 이 모듈은 안드로이드 네이티브 빌드에서만 불러온다(widgets-native.ts, 뿌리 index.ts) — Expo Go 에는 네이티브 모듈이 없다.
 */

import { registerWidgetTaskHandler, requestWidgetUpdate, type WidgetInfo, type WidgetRepresentation, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { readSetting, writeSetting } from '@/data/db';
import { WIDGET_DATA_KEY, WIDGET_PENDING_KEY, emptyWidgetProps, pickEntry, toggleInWidget, type WidgetEntry } from '@/data/widget-data';

import { BuddyAndroidWidget } from './buddy-android-widget';

/** app.json 의 react-native-android-widget `widgets[].name` 과 같아야 한다 */
export const ANDROID_WIDGET = 'Buddy';

async function readEntries(): Promise<WidgetEntry[]> {
  try {
    const raw = await readSetting(WIDGET_DATA_KEY);
    return raw ? (JSON.parse(raw) as WidgetEntry[]) : [];
  } catch {
    return [];
  }
}

async function readPending(): Promise<string[]> {
  try {
    const raw = await readSetting(WIDGET_PENDING_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function draw(entries: WidgetEntry[], info: WidgetInfo): WidgetRepresentation {
  const props = pickEntry(entries, new Date()) ?? emptyWidgetProps('yugabuddy:///', '');
  return {
    light: <BuddyAndroidWidget props={props} width={info.width} height={info.height} dark={false} />,
    dark: <BuddyAndroidWidget props={props} width={info.width} height={info.height} dark />,
  };
}

export async function widgetTaskHandler(p: WidgetTaskHandlerProps): Promise<void> {
  switch (p.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      p.renderWidget(draw(await readEntries(), p.widgetInfo));
      break;
    case 'WIDGET_CLICK': {
      const id = p.clickActionData?.id;
      if (p.clickAction !== 'routine' || typeof id !== 'string') break;
      const entries = await readEntries();
      const now = Date.now();
      // 지금 보이는 벌만 토글한다 — 다음 날들의 벌은 앱이 다시 넣는다
      let index = 0;
      entries.forEach((e, i) => {
        if (e.date <= now) index = i;
      });
      const current = entries[index];
      if (!current) break;
      const next = toggleInWidget(current.props, id);
      entries[index] = { ...current, props: next };
      const pending = await readPending();
      const merged = pending.includes(id) ? pending.filter((x) => x !== id) : [...pending, id];
      await writeSetting(WIDGET_DATA_KEY, JSON.stringify(entries));
      await writeSetting(WIDGET_PENDING_KEY, JSON.stringify(merged));
      p.renderWidget(draw(entries, p.widgetInfo));
      break;
    }
    default:
      break;
  }
}

/** 뿌리 index.ts 에서 한 번 — 앱 없이도 돌아가는 작업으로 등록한다 */
export function registerAndroidWidgets(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
}

/** 앱이 계산한 일주일 치를 저장하고, 홈 화면에 있는 위젯을 모두 다시 그린다 */
export async function pushAndroidWidgets(entries: WidgetEntry[]): Promise<void> {
  await writeSetting(WIDGET_DATA_KEY, JSON.stringify(entries));
  await requestWidgetUpdate({ widgetName: ANDROID_WIDGET, renderWidget: (info) => draw(entries, info) });
}

/** 위젯에서 누른 루틴 id 를 가져오고 비운다 */
export async function takeAndroidPending(): Promise<string[]> {
  const pending = await readPending();
  if (pending.length > 0) await writeSetting(WIDGET_PENDING_KEY, '[]');
  return pending;
}
