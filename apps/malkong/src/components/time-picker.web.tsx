/**
 * 시각 · 날짜 고르기 — 웹 미리보기 (task today/004 · topic/009). 웹에는 폰의 선택기가 없어 브라우저의 시각 · 날짜 칸으로 대신한다.
 */

import { FontFamily } from '@/constants/theme';
import { isTime } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

export const INLINE_WHEEL = true;

export function TimeWheel({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const c = useTheme();
  return (
    <input
      type="time"
      aria-label="알림 시각"
      value={value}
      step={300}
      onChange={(e) => {
        if (isTime(e.target.value)) onChange(e.target.value);
      }}
      style={{
        margin: '4px 0 12px',
        padding: '12px 14px',
        border: 0,
        borderRadius: 12,
        background: c.surface,
        color: c.text,
        fontFamily: FontFamily.semibold,
        fontSize: 20,
        textAlign: 'center',
      }}
    />
  );
}

export function pickTime(_value: string, _onChange: (time: string) => void) {}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function DateWheel({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const c = useTheme();
  return (
    <input
      type="date"
      aria-label="날짜"
      value={ymd(value)}
      min={ymd(new Date())}
      onChange={(e) => {
        const [y, m, d] = e.target.value.split('-').map(Number);
        if (y && m && d) onChange(new Date(y, m - 1, d));
      }}
      style={{
        margin: '4px 0 12px',
        padding: '12px 14px',
        border: 0,
        borderRadius: 12,
        background: c.surface,
        color: c.text,
        fontFamily: FontFamily.semibold,
        fontSize: 18,
      }}
    />
  );
}

export function pickDate(_value: Date, _onChange: (date: Date) => void) {}
