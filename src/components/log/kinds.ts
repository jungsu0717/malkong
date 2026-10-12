import type { IconName } from '@/components/ui';
import type { EventKind } from '@/data/events';

/** 기록 종류의 이름과 아이콘 — 기록 탭 단추 · 오늘 기록 줄 · 그래프가 같이 쓴다(SPEC-LOG-01) */
export const KIND_UI: Record<EventKind, { label: string; icon: IconName }> = {
  breast: { label: '모유', icon: 'heart-outline' },
  formula: { label: '분유', icon: 'beaker-outline' },
  diaper: { label: '기저귀', icon: 'water-outline' },
  sleep: { label: '잠', icon: 'moon-outline' },
  temp: { label: '체온', icon: 'thermometer-outline' },
  weight: { label: '몸무게', icon: 'scale-outline' },
  height: { label: '키', icon: 'resize-outline' },
};
