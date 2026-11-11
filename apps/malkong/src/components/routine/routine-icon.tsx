/**
 * 루틴 아이콘 — 루틴에 아이콘 칸을 따로 두지 않고 이름으로 고른다(task today/002).
 * 젖병, 쪽쪽이, 딸랑이는 탭과 같은 베이비 세트, 목욕이나 손톱 깎기처럼 자주 쓰는 것은 기록 아이콘(record-icons.tsx, 13판),
 * 나머지는 Ionicons. 모르는 이름은 별.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import { BottleIcon, PacifierIcon, RattleIcon } from '@/components/baby-icons';
import { Glyph, type GlyphName } from '@/components/record-icons';
import type { IconName } from '@/components/ui';

type IconChoice = { baby: 'bottle' | 'pacifier' | 'rattle' } | { glyph: GlyphName } | { ion: IconName };

const RULES: [RegExp, IconChoice][] = [
  [/젖병|분유|수유|모유/, { baby: 'bottle' }],
  [/쪽쪽이|공갈/, { baby: 'pacifier' }],
  [/장난감|놀이|딸랑이/, { baby: 'rattle' }],
  [/목욕|샤워|씻/, { glyph: 'bath' }],
  [/터미|뒤집기/, { glyph: 'tummy' }],
  [/모자동실/, { ion: 'heart-outline' }],
  [/산책|외출|바깥/, { ion: 'walk-outline' }],
  [/손톱|발톱|머리\s*깎|이발/, { glyph: 'nail' }],
  [/침구|이불/, { ion: 'bed-outline' }],
  [/빨래|세탁|옷/, { ion: 'shirt-outline' }],
  [/기저귀|휴지통|쓰레기/, { ion: 'trash-outline' }],
  [/가습기/, { ion: 'cloud-outline' }],
  [/유산균|비타민|영양제/, { glyph: 'vitamin' }],
  [/이유식|유아식|밥/, { glyph: 'solid' }],
  [/간식/, { glyph: 'snack' }],
  [/양치|이\s*닦/, { ion: 'happy-outline' }],
  [/컵/, { ion: 'cafe-outline' }],
  [/걸음마/, { ion: 'footsteps-outline' }],
  [/낮잠|수면|재우|잠/, { ion: 'moon-outline' }],
  [/책|독서/, { ion: 'book-outline' }],
  [/청소|소독|세척|삶기/, { ion: 'sparkles-outline' }],
  [/재고|남은 양/, { ion: 'cube-outline' }],
  // 「루틴 추가」에 있는 것(task today/029 · 030)
  [/병원|진료|검진/, { glyph: 'hospital' }],
  [/투약|약/, { glyph: 'medicine' }],
  [/^기타$/, { glyph: 'etc' }],
];

function pick(title: string): IconChoice {
  for (const [re, p] of RULES) if (re.test(title)) return p;
  return { ion: 'star-outline' };
}

export function RoutineIcon({ title, size = 24, color }: { title: string; size?: number; color: ColorValue }) {
  const p = pick(title);
  if ('ion' in p) return <Ionicons name={p.ion} size={size} color={color as string} />;
  if ('glyph' in p) return <Glyph name={p.glyph} size={size} color={color} />;
  if (p.baby === 'bottle') return <BottleIcon size={size} color={color} />;
  if (p.baby === 'pacifier') return <PacifierIcon size={size} color={color} />;
  return <RattleIcon size={size} color={color} />;
}
