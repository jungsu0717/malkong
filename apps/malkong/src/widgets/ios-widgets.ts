/**
 * 아이폰 위젯에 밀어 넣기와 누른 것 받기 (SPEC-MAIN-09, task today/008).
 *
 * 타임라인(일주일 치)은 앱과 위젯이 같이 쓰는 저장소에 들어가고, 위젯 단추가 바꾼 props 도 같은 타임라인에 남는다(expo-widgets AppIntent) —
 * 그래서 `getTimeline` 으로 지금 보이는 벌의 `pending` 을 읽을 수 있다. 버디 얼굴은 위젯이 읽을 수 있는 공유 폴더에 한 번 복사해 둔다.
 * 아이폰 네이티브 빌드에서만 불러온다(widgets-native.ts).
 */

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

import { BUDDY_FACE } from '@/components/brand';
import type { WidgetEntry, WidgetProps } from '@/data/widget-data';

import BuddyWidget from './buddy-widget';

/** 공유 폴더의 버디 얼굴 — 없으면 복사하고, 파일 주소를 돌려준다(없으면 빈 글) */
export async function ensureFace(): Promise<string> {
  if (!widgetsDirectory) return '';
  const dest = new File(widgetsDirectory, 'buddy-face.png');
  if (!dest.exists) {
    const [asset] = await Asset.loadAsync(BUDDY_FACE);
    if (!asset?.localUri) return '';
    new File(asset.localUri).copy(dest);
  }
  return dest.uri;
}

export function pushIosWidgets(entries: WidgetEntry[]): void {
  BuddyWidget.updateTimeline(entries.map((e) => ({ date: new Date(e.date), props: e.props })));
}

/** 지금 보이는 벌에서 위젯이 토글한 루틴 id — 비우는 것은 다음 밀어 넣기가 한다(pending 이 빈 새 벌) */
export async function takeIosPending(): Promise<string[]> {
  const entries = await BuddyWidget.getTimeline();
  const now = Date.now();
  let current: WidgetProps | null = null;
  for (const e of entries) if (e.date.getTime() <= now) current = e.props;
  return current?.pending ?? [];
}
