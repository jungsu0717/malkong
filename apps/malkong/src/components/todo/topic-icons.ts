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
