/**
 * 위젯 모듈을 쓸 수 있는 곳에서만 불러오기 (SPEC-MAIN-09, task today/008).
 *
 * `expo-widgets`(아이폰)와 `react-native-android-widget`(안드로이드)은 불러오는 순간 네이티브 모듈을 찾는다 —
 * Expo Go · 웹 · 다른 플랫폼에는 없어서 앱이 죽는다. 그래서 여기서 플랫폼을 보고 그때 `require` 한다.
 */

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

export const widgetsAvailable = (Platform.OS === 'ios' || Platform.OS === 'android') && !isRunningInExpoGo();

type Ios = typeof import('@/widgets/ios-widgets');
type Android = typeof import('@/widgets/android-widgets');

let ios: Ios | null | undefined;
let android: Android | null | undefined;

export function iosWidgets(): Ios | null {
  if (ios === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ios = Platform.OS === 'ios' && widgetsAvailable ? (require('@/widgets/ios-widgets') as Ios) : null;
    } catch {
      ios = null;
    }
  }
  return ios;
}

export function androidWidgets(): Android | null {
  if (android === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      android = Platform.OS === 'android' && widgetsAvailable ? (require('@/widgets/android-widgets') as Android) : null;
    } catch {
      android = null;
    }
  }
  return android;
}
