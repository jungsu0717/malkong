/**
 * 시각 · 날짜 고르기 (task today/004 · topic/009 · log/005) — 폰의 기본 선택기를 쓴다.
 * iOS 는 화면 안에 펼치고(`TimeWheel` · `DateWheel` · `DateTimeWheel`), 안드로이드는 창을 띄운다(`pickTime` · `pickDate` · `pickDateTime`). 웹은 time-picker.web.tsx.
 * 기록의 때(`DateTimeWheel`)는 지나간 때만 — 60일 전부터 지금까지, 1분 단위.
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

/** iOS 의 달력 — 오늘부터 고른다 */
export function DateWheel({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const scheme = useColorScheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <DateTimePicker
      mode="date"
      display="inline"
      locale="ko-KR"
      minimumDate={new Date()}
      themeVariant={scheme === 'dark' ? 'dark' : 'light'}
      value={value}
      onValueChange={(_, d) => onChange(d)}
    />
  );
}

/** 안드로이드의 달력 창 */
export function pickDate(value: Date, onChange: (date: Date) => void) {
  if (Platform.OS !== 'android') return;
  DateTimePickerAndroid.open({ mode: 'date', value, minimumDate: new Date(), onValueChange: (_, d) => onChange(d) });
}

/** 기록의 때를 고르는 바퀴 — 날짜 · 오전/오후 · 시 · 분(iOS). 60일 전부터 지금까지 */
export function DateTimeWheel({ value, onChange }: { value: Date; onChange: (at: Date) => void }) {
  const scheme = useColorScheme();
  if (Platform.OS !== 'ios') return null;
  const now = new Date();
  return (
    <DateTimePicker
      mode="datetime"
      display="spinner"
      locale="ko-KR"
      maximumDate={now}
      minimumDate={new Date(now.getTime() - RECORD_BACK_DAYS * 24 * 60 * 60 * 1000)}
      themeVariant={scheme === 'dark' ? 'dark' : 'light'}
      value={value}
      onValueChange={(_, d) => onChange(d)}
      style={styles.wheel}
    />
  );
}

/** 기록의 때를 얼마나 앞까지 고를 수 있나 */
export const RECORD_BACK_DAYS = 60;

/** 안드로이드 — 날짜 창을 띄우고, 고르면 이어서 시각 창. 앞으로의 때는 지금으로 */
export function pickDateTime(value: Date, onChange: (at: Date) => void) {
  if (Platform.OS !== 'android') return;
  const now = new Date();
  DateTimePickerAndroid.open({
    mode: 'date',
    value,
    maximumDate: now,
    minimumDate: new Date(now.getTime() - RECORD_BACK_DAYS * 24 * 60 * 60 * 1000),
    onValueChange: (_, day) => {
      DateTimePickerAndroid.open({
        mode: 'time',
        is24Hour: false,
        value,
        onValueChange: (__, time) => {
          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
          onChange(at.getTime() > Date.now() ? new Date() : at);
        },
      });
    },
  });
}

const styles = StyleSheet.create({
  wheel: { height: 180 },
});
