/**
 * 알림 시각 고르기 — 웹 미리보기 (task today/004). 웹에는 폰의 시각 바퀴가 없어 브라우저의 시각 칸으로 대신한다.
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
