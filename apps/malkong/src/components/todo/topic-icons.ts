import type { IconName } from '@/components/ui';
import type { Topic, TopicKind } from '@/data/todos';

/** 주제 아이콘 — 먹색 한 가지로, 색은 늘리지 않는다. 예전 기본 주제(decisions/025)는 숨긴 주제 목록에만 보인다 */
export const TOPIC_ICONS: Record<TopicKind, IconName> = {
  checkup: 'medkit-outline',
  milestone: 'gift-outline',
  size: 'shirt-outline',
  routine: 'repeat-outline',
  general: 'checkbox-outline',
  custom: 'folder-open-outline',
  feeding: 'cafe-outline',
  diaper: 'layers-outline',
  outing: 'bag-handle-outline',
  sick: 'thermometer-outline',
  solids: 'restaurant-outline',
  shopping: 'cart-outline',
  paperwork: 'document-text-outline',
};

/** 주제의 아이콘 — 직접 만든 주제는 고른 아이콘 */
export function iconOf(topic: Pick<Topic, 'kind' | 'icon'>): IconName {
  return (topic.icon as IconName | null) ?? TOPIC_ICONS[topic.kind];
}

/**
 * 행성 그림의 행성 색(SPEC-TOPIC-10) — 어두운 우주 카드 안에서만 쓴다. 밝은 화면의 아이콘 · 글자에는 쓰지 않는다.
 * 예전 지식 지도의 여섯 색을 그대로 쓴다. 직접 만든 주제는 차례대로 돌려 쓴다
 */
const COLORS: Partial<Record<TopicKind, string>> = {
  checkup: '#4FB39A',
  milestone: '#E0607A',
  size: '#E9B03C',
  routine: '#B08BDB',
  general: '#E8825F',
  shopping: '#7D8FE0',
};
const CUSTOM_COLORS = ['#E8825F', '#7D8FE0', '#4FB39A', '#E9B03C', '#B08BDB', '#E0607A'];

export function topicColor(kind: TopicKind, index: number): string {
  return COLORS[kind] ?? CUSTOM_COLORS[index % CUSTOM_COLORS.length];
}
