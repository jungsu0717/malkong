/**
 * 알림 시각 고르기 (task today/004) — 폰의 시각 바퀴를 쓴다.
 * iOS 는 시각 줄 바로 아래에 바퀴를 펼치고(`TimeWheel`), 안드로이드는 시계 창을 띄운다(`pickTime`). 웹은 time-picker.web.tsx.
 */

import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

/** 줄 아래에 바퀴를 펼치는가 — 아니면 `pickTime` 으로 창을 띄운다 */
export const INLINE_WHEEL = Platform.OS === 'ios';

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** iOS 의 시각 바퀴(오전/오후 · 시 · 분, 5분 단위) */
export function TimeWheel({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const scheme = useColorScheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <DateTimePicker
      mode="time"
      display="spinner"
      locale="ko-KR"
      minuteInterval={5}
      themeVariant={scheme === 'dark' ? 'dark' : 'light'}
      value={toDate(value)}
      onValueChange={(_, d) => onChange(toTime(d))}
      style={styles.wheel}
    />
  );
}

/** 안드로이드의 시계 창 — 고르면 `onChange`, 취소하면 그대로 */
export function pickTime(value: string, onChange: (time: string) => void) {
  if (Platform.OS !== 'android') return;
  DateTimePickerAndroid.open({ mode: 'time', is24Hour: false, value: toDate(value), onValueChange: (_, d) => onChange(toTime(d)) });
}

const styles = StyleSheet.create({
  wheel: { height: 180 },
});
