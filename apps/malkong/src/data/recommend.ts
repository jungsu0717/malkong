/**
 * 시기별 · 있는 곳별 추천 (SPEC-MAIN-07 · SPEC-TOPIC-13, task today/003, decisions/029).
 *
 * 우리가 고른 고정 목록이다 — 모은 숫자나 「많이 하는」 같은 말을 쓰지 않는다. 영양제 · 약 · 권장 시간 · 신청 · 서류는 넣지 않는다(헌장 5, decisions/026).
 * 「지금 아기와 있는 곳」은 병원 · 산후조리원 · 집(처음은 집, 설정값 `baby_place`).
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/recommend.test.ts`).
 */

import { ROUTINE_TEMPLATES, type RoutineTemplate } from './routine.ts';

export type Place = 'hospital' | 'carecenter' | 'home';
export const PLACES: Place[] = ['hospital', 'carecenter', 'home'];
export const PLACE_LABELS: Record<Place, string> = { hospital: '병원', carecenter: '산후조리원', home: '집' };
export const PLACE_KEY = 'baby_place';

export function placeFrom(value: string | null): Place {
  return value === 'hospital' || value === 'carecenter' ? value : 'home';
}

/** 집에서의 개월 범위 — 뒤 범위는 앞 범위에 더한다 */
const HOME_RANGES: { from: number; label: string; add: string[] }[] = [
  {
    from: 0,
    label: '생후 0~2개월',
    add: ['목욕', '밤잠 준비', '터미타임', '손발톱 확인', '젖병 소독', '재고 확인', '가습기 청소', '아기 침구 빨래'],
  },
  { from: 2, label: '2개월부터', add: ['아기체육관 놀이', '책 읽어 주기', '뒤집기 연습', '산책', '장난감 소독'] },
];

/** 병원 · 산후조리원에서는 대부분 챙겨 준다 — 그곳에서 쓸 만한 것만 */
const AWAY: Record<Exclude<Place, 'home'>, string[]> = {
  hospital: [],
  carecenter: ['모자동실', '손발톱 확인'],
};

const byTitle = (titles: string[]): RoutineTemplate[] =>
  titles.map((t) => ROUTINE_TEMPLATES.find((x) => x.title === t)).filter((x): x is RoutineTemplate => !!x);

/** 집에서 지금 개월의 추천 전체 — 루틴 추가 시트와 루틴이 없을 때의 루틴 탭(SPEC-MAIN-03) */
export function homeTemplates(month: number): RoutineTemplate[] {
  return byTitle(HOME_RANGES.filter((r) => r.from <= month).flatMap((r) => r.add));
}

export type RoutineRecommend = {
  /** 「생후 0~2개월 추천」 · 「산후조리원에서」 */
  label: string;
  templates: RoutineTemplate[];
  /** 병원 · 산후조리원일 때의 안내 */
  note: string | null;
  /** 다음 범위 미리 보기 — 집에서만. `fromMonth` 개월이 되는 날부터 */
  next: { label: string; fromMonth: number; templates: RoutineTemplate[] } | null;
};

/** 루틴 추천 화면(SPEC-MAIN-07) */
export function routineRecommend(month: number, place: Place): RoutineRecommend {
  if (place !== 'home') {
    return {
      label: `${PLACE_LABELS[place]}에서`,
      templates: byTitle(AWAY[place]),
      note: `${PLACE_LABELS[place]}에서는 대부분 챙겨 줘요. 집에 오면 추천이 바뀌어요`,
      next: null,
    };
  }
  const i = HOME_RANGES.map((r) => r.from <= month).lastIndexOf(true);
  const current = HOME_RANGES[Math.max(0, i)];
  const following = HOME_RANGES[i + 1];
  return {
    label: `${current.label} 추천`,
    templates: homeTemplates(month),
    note: null,
    next: following ? { label: following.label, fromMonth: following.from, templates: byTitle(following.add) } : null,
  };
}

/** 할 일 추천(SPEC-TOPIC-13) — 있는 곳마다 한 묶음 */
const TODO_GROUPS: Record<Place, { title: string; items: string[] }> = {
  hospital: { title: '퇴원 전에 챙길 일', items: ['산후조리원에 퇴원일 알리기', '산후조리원에 가져갈 짐 챙기기', '카시트 설치하기'] },
  carecenter: {
    title: '퇴소 전에 챙길 일',
    items: ['카시트 설치하기', '조리원에서 쓰던 기저귀 단계 확인', '집에서 먹일 분유 정하기', '아기 침대 준비하기', '퇴소 뒤 접종 · 검진 날짜 확인'],
  },
  home: {
    title: '집에 온 뒤 챙길 일',
    items: ['아기 침대 · 기저귀 갈이대 자리 정하기', '아기 방에 온습도계 두기', '가까운 소아청소년과 찾아 두기', '외출 가방 챙겨 두기'],
  },
};

export function todoRecommend(place: Place): { title: string; items: string[] } {
  return TODO_GROUPS[place];
}
