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

export const RECORD_BACK_DAYS = 60;
const local = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 기록의 때 — 브라우저 날짜 · 시각 칸. 60일 전부터 지금까지 */
export function DateTimeWheel({ value, onChange }: { value: Date; onChange: (at: Date) => void }) {
  const c = useTheme();
  const now = new Date();
  return (
    <input
      type="datetime-local"
      aria-label="날짜와 시간"
      value={local(value)}
      max={local(now)}
      min={local(new Date(now.getTime() - RECORD_BACK_DAYS * 24 * 60 * 60 * 1000))}
      onChange={(e) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(e.target.value);
        if (!m) return;
        const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
        onChange(at.getTime() > Date.now() ? new Date() : at);
      }}
      style={{
        margin: '4px 0 4px',
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

export function pickDateTime(_value: Date, _onChange: (at: Date) => void) {}
