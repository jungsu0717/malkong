import type { IconName } from '@/components/ui';
import type { TopicKind } from '@/data/todos';

/** 주제 아이콘 — 먹색 한 가지로, 색은 늘리지 않는다 */
export const TOPIC_ICONS: Record<TopicKind, IconName> = {
  feeding: 'cafe-outline',
  diaper: 'layers-outline',
  checkup: 'medkit-outline',
  outing: 'bag-handle-outline',
  sick: 'thermometer-outline',
  solids: 'restaurant-outline',
  shopping: 'cart-outline',
  general: 'list-outline',
  custom: 'folder-open-outline',
};

/**
 * 행성 그림의 행성 색(SPEC-TOPIC-10) — 어두운 우주 카드 안에서만 쓴다. 밝은 화면의 아이콘 · 글자에는 쓰지 않는다.
 * 예전 지식 지도의 여섯 색을 그대로 쓰고, 기타는 회색. 직접 만든 주제는 차례대로 돌려 쓴다
 */
export const TOPIC_COLORS: Record<Exclude<TopicKind, 'custom'>, string> = {
  feeding: '#E9B03C',
  diaper: '#7D8FE0',
  checkup: '#4FB39A',
  outing: '#E8825F',
  sick: '#E0607A',
  solids: '#B08BDB',
  shopping: '#5FA8D3',
  general: '#9A9AA6',
};
const CUSTOM_COLORS = ['#E8825F', '#7D8FE0', '#4FB39A', '#E9B03C', '#B08BDB', '#E0607A'];

export function topicColor(kind: TopicKind, index: number): string {
  return kind === 'custom' ? CUSTOM_COLORS[index % CUSTOM_COLORS.length] : TOPIC_COLORS[kind];
}
