/**
 * 루틴 아이콘 — 루틴에 아이콘 칸을 따로 두지 않고 이름으로 고른다(task today/002).
 * 젖병 · 쪽쪽이 · 딸랑이는 탭과 같은 베이비 세트, 나머지는 Ionicons. 모르는 이름은 별, 타이머 루틴은 시계.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import { BottleIcon, PacifierIcon, RattleIcon } from '@/components/baby-icons';
import type { IconName } from '@/components/ui';
import type { RoutineKind } from '@/data/routine';

type IconChoice = { baby: 'bottle' | 'pacifier' | 'rattle' } | { ion: IconName };

const RULES: [RegExp, IconChoice][] = [
  [/젖병|분유|수유|모유/, { baby: 'bottle' }],
  [/쪽쪽이|공갈/, { baby: 'pacifier' }],
  [/장난감|놀이|딸랑이/, { baby: 'rattle' }],
  [/목욕|샤워|씻/, { ion: 'water-outline' }],
  [/터미/, { ion: 'body-outline' }],
  [/산책|외출|바깥/, { ion: 'walk-outline' }],
  [/손톱|발톱|머리\s*깎|이발/, { ion: 'cut-outline' }],
  [/침구|이불|빨래|세탁/, { ion: 'bed-outline' }],
  [/가습기/, { ion: 'cloud-outline' }],
  [/유산균|비타민|영양제|이유식|간식|밥/, { ion: 'nutrition-outline' }],
  [/낮잠|수면|재우|잠/, { ion: 'moon-outline' }],
  [/책|독서/, { ion: 'book-outline' }],
  [/청소|소독/, { ion: 'sparkles-outline' }],
  [/재고|남은 양/, { ion: 'cube-outline' }],
];

function pick(title: string, kind: RoutineKind): IconChoice {
  for (const [re, p] of RULES) if (re.test(title)) return p;
  return { ion: kind === 'minutes' ? 'timer-outline' : 'star-outline' };
}

export function RoutineIcon({ title, kind, size = 24, color }: { title: string; kind: RoutineKind; size?: number; color: ColorValue }) {
  const p = pick(title, kind);
  if ('ion' in p) return <Ionicons name={p.ion} size={size} color={color as string} />;
  if (p.baby === 'bottle') return <BottleIcon size={size} color={color} />;
  if (p.baby === 'pacifier') return <PacifierIcon size={size} color={color} />;
  return <RattleIcon size={size} color={color} />;
}
