import type { IconName } from '@/components/ui';
import type { EventKind, StoolColor } from '@/data/events';

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

/**
 * 변 색 견본 — 앱 테마 색이 아니라 기록하는 대상의 색이라 토큰이 아닌 값으로 둔다(app-design 「색은 토큰으로」의 예외).
 * 흰색 · 회색은 바탕과 구별되게 옅은 회색으로
 */
export const STOOL_SWATCH: Record<StoolColor, string> = {
  yellow: '#E8C24A',
  brown: '#8A5A2B',
  green: '#5E8C3A',
  black: '#2B2522',
  red: '#C0392B',
  white: '#D9D6D0',
};
