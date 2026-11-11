/**
 * 기록과 루틴 아이콘 (13판, task today/030, decisions/047) — 종류마다 모양이 다르다. 시안 캔버스의 Icons13 과 같은 선이다.
 *
 * 24x24, 선 1.8, 끝 둥글게(baby-icons 와 같은 규격). 호(arc) 명령은 쓰지 않고 동그라미는 Circle 로 그린다.
 * 색은 kindTone 이 정한다 — 수유는 코랄, 유축은 옅은 코랄, 먹는 것(이유식, 간식)과 마시는 것(우유, 물)은 각자 한 색, 루틴은 모두 파란색.
 */

import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { BarKind } from '@/data/record-bar';
import type { useTheme } from '@/hooks/use-theme';

type Part = string | { c: [number, number, number] } | { dot: [number, number, number] };

const GLYPHS = {
  breast: ['M12 20c-5-3.4-8-6.6-8-10.2C4 7.3 5.9 5.5 8.2 5.5c1.6 0 2.9.8 3.8 2.1.9-1.3 2.2-2.1 3.8-2.1 2.3 0 4.2 1.8 4.2 4.3 0 3.6-3 6.8-8 10.2Z'],
  formula: ['M10.4 6V4.7q0-2 1.6-2t1.6 2V6', 'M8.4 6h7.2v2.6H8.4Z', 'M9 8.6h6q1.4 0 1.4 1.4v9.4q0 1.8-1.8 1.8H9.4q-1.8 0-1.8-1.8V10q0-1.4 1.4-1.4Z', 'M13.2 12.2h1.6M13.2 15.2h1.6'],
  pumped: ['M10.4 6V4.7q0-2 1.6-2t1.6 2V6', 'M8.4 6h7.2v2.6H8.4Z', 'M9 8.6h6q1.4 0 1.4 1.4v9.4q0 1.8-1.8 1.8H9.4q-1.8 0-1.8-1.8V10q0-1.4 1.4-1.4Z', 'M12 18.2c-1.7-1.1-2.6-2.1-2.6-3.2 0-.8.6-1.4 1.3-1.4.6 0 1 .3 1.3.8.3-.5.7-.8 1.3-.8.7 0 1.3.6 1.3 1.4 0 1.1-.9 2.1-2.6 3.2Z'],
  pump: ['M3.5 3.5h11l-3.9 6h-3.2Z', 'M6.8 10.5h4.4q1.4 0 1.4 1.4v6.8q0 1.8-1.8 1.8H7.2q-1.8 0-1.8-1.8v-6.8q0-1.4 1.4-1.4Z', 'M15.5 3.5q4.5 0 4.5 4.5v6.5', 'M18 14.5h4'],
  solid: ['M3.5 11.5h17c0 4.4-3.8 8-8.5 8s-8.5-3.6-8.5-8Z', 'M9.5 8.5q-1.1-1.4 0-2.8t0-2.8', 'M14.5 8.5q-1.1-1.4 0-2.8t0-2.8'],
  snack: ['M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8 8-3.58 8-8c-1.8.3-3.5-1.3-3.4-3.1C14.4 9 12.2 6.8 12 4Z', { dot: [8.8, 10.5, 1.1] }, { dot: [12.3, 15, 1.1] }, { dot: [8.4, 15.6, 1.1] }, { dot: [14.8, 11.6, 1.1] }],
  milk: ['M7 9.5 9 5.5h6l2 4V19q0 1.5-1.5 1.5h-7Q7 20.5 7 19Z', 'M9 5.5V3.5h6v2', 'M7 9.5h10', 'M12 12.6q-1.7 2.1-1.7 3.2c0 .95.76 1.7 1.7 1.7s1.7-.75 1.7-1.7q0-1.1-1.7-3.2Z'],
  water: ['M5.5 4h13l-1.5 15.2q-.1 1.3-1.4 1.3H8.4q-1.3 0-1.4-1.3Z', 'M6.4 10.2q1.4-1 2.8 0t2.8 0 2.8 0 2.8 0'],
  diaper: ['M3 6.5h18v2.8q-3 .4-4.4 3.4-1.2 2.6-1.4 5.8H8.8q-.2-3.2-1.4-5.8Q6 9.7 3 9.3Z', 'M5.6 8.6h1.6M16.8 8.6h1.6'],
  sleep: ['M4.5 11.5h6.5l-6.5 8h6.5', 'M13.5 4.5h5.5l-5.5 6.5h5.5'],
  temp: ['M10 13.6V5.5q0-2 2-2t2 2v8.1C16.4 15 16.6 18.6 14.4 20.2 13 21.2 11 21.2 9.6 20.2 7.4 18.6 7.6 15 10 13.6Z', 'M12 9.5v7.2'],
  bath: ['M3.5 12h17v1.8q0 5.2-5.2 5.2H8.7q-5.2 0-5.2-5.2Z', 'M6 12V6.6q0-2.1 2.1-2.1 1.2 0 1.8 1', 'M7 19l-1 2M17 19l1 2', { c: [13.2, 8.4, 1.4] }, { c: [17.4, 5.6, 1] }],
  tummy: [{ c: [6.6, 10.6, 2.6] }, 'M9.4 11.6c3.4-.6 7.6.3 9.6 2.6q1 1.2 1 2.6', 'M7.6 13.4l.8 5', 'M3 18.6h18'],
  play: [{ c: [12, 7.6, 4.4] }, 'M12 12.2V17', { c: [12, 18.8, 1.7] }, 'M4.6 4.2l1.3 1.3M19.4 4.2l-1.3 1.3'],
  hospital: ['M5 7h14q1.5 0 1.5 1.5v10q0 1.5-1.5 1.5H5q-1.5 0-1.5-1.5v-10Q3.5 7 5 7Z', 'M9 7V5.2q0-.7.7-.7h4.6q.7 0 .7.7V7', 'M12 10.5v6M9 13.5h6'],
  medicine: ['M13.8 4.9l1.4-1.4q1.6-1.6 3.2 0l2 2q1.6 1.6 0 3.2l-1.4 1.4Z', 'M14 7.6l-7.2 7.2-1 3.2 3.2-1 7.2-7.2', 'M5.3 18.6q-.9 1-.9 1.9c0 .5.4.9.9.9s.9-.4.9-.9q0-.9-.9-1.9Z'],
  etc: [{ dot: [6.5, 12, 1.5] }, { dot: [12, 12, 1.5] }, { dot: [17.5, 12, 1.5] }],
  nail: [{ c: [6, 6, 2.5] }, { c: [6, 18, 2.5] }, 'M8.2 7.4 20 16.5M8.2 16.6 20 7.5'],
  vitamin: ['M9.5 19.3 19.3 9.5C20.63 8.17 20.63 6.03 19.3 4.7 17.97 3.37 15.83 3.37 14.5 4.7L4.7 14.5C3.37 15.83 3.37 17.97 4.7 19.3 6.03 20.63 8.17 20.63 9.5 19.3Z', 'M9.6 9.6l4.8 4.8'],
} satisfies Record<string, Part[]>;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, size = 24, color }: { name: GlyphName; size?: number; color: ColorValue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(GLYPHS[name] as Part[]).map((p, i) =>
        typeof p === 'string' ? (
          <Path key={i} d={p} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        ) : 'c' in p ? (
          <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} stroke={color} strokeWidth={1.8} />
        ) : (
          <Circle key={i} cx={p.dot[0]} cy={p.dot[1]} r={p.dot[2]} fill={color} />
        ),
      )}
    </Svg>
  );
}

export type Tone = { bg: string; fg: string; line: string | null };

/** 기록 종류의 색 — 바탕, 아이콘, 테두리. 루틴은 routineTone */
export function kindTone(kind: BarKind, c: ReturnType<typeof useTheme>): Tone {
  if (kind === 'breast' || kind === 'formula') return { bg: c.accent, fg: '#FFFFFF', line: null };
  if (kind === 'pumped' || kind === 'pump') return { bg: c.accentSoft, fg: c.accent, line: c.accentLine };
  if (kind === 'solid' || kind === 'snack') return { bg: c.mealBg, fg: c.mealFg, line: c.mealLine };
  if (kind === 'milk' || kind === 'water') return { bg: c.drinkBg, fg: c.drinkFg, line: c.drinkLine };
  if (kind === 'diaper') return { bg: c.peeBg, fg: c.peeFg, line: c.peeLine };
  if (kind === 'temp') return { bg: c.tempBg, fg: c.tempFg, line: c.tempLine };
  return { bg: c.ink, fg: c.onInk, line: null };
}

export const routineTone = (c: ReturnType<typeof useTheme>): Tone => ({ bg: c.doneBg, fg: c.doneFg, line: c.doneLine });
