/**
 * 앱 입구 — Expo Router 가 화면을 맡고, 안드로이드 네이티브 빌드에서는 홈 화면 위젯의 작업 처리기를 함께 등록한다(task today/008).
 * 위젯은 앱이 꺼져 있어도 이 파일부터 돌려 그린다. Expo Go 에는 위젯 네이티브 모듈이 없어 등록하지 않는다.
 */

import 'expo-router/entry';

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

if (Platform.OS === 'android' && !isRunningInExpoGo()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('./src/widgets/android-widgets') as typeof import('./src/widgets/android-widgets')).registerAndroidWidgets();
}
