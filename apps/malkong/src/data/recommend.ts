/**
 * 시기별 · 있는 곳별 추천 (SPEC-MAIN-07 · SPEC-TOPIC-13, task today/003 · 005, decisions/029).
 *
 * 우리가 고른 고정 목록이다 — 모은 숫자나 「많이 하는」 같은 말을 쓰지 않는다. 영양제 · 약 · 권장 시간 · 신청 · 서류는 넣지 않는다(헌장 5, decisions/026).
 * 「지금 아기와 있는 곳」은 병원 · 산후조리원 · 집(처음은 집, 설정값 `baby_place`).
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/recommend.test.ts`).
 */

import { ROUTINE_TEMPLATES, titleKey, type RoutineTemplate } from './routine.ts';

export type Place = 'hospital' | 'carecenter' | 'home';
export const PLACES: Place[] = ['hospital', 'carecenter', 'home'];
export const PLACE_LABELS: Record<Place, string> = { hospital: '병원', carecenter: '산후조리원', home: '집' };
export const PLACE_KEY = 'baby_place';

export function placeFrom(value: string | null): Place {
  return value === 'hospital' || value === 'carecenter' ? value : 'home';
}

/** 시기마다 바뀌는 단계 — 같은 이름의 루틴이라도 시기에 맞는 단계로 추천한다 */
const tpl = (title: string, change: Partial<RoutineTemplate> = {}): RoutineTemplate => {
  const base = ROUTINE_TEMPLATES.find((x) => x.title === title);
  if (!base) throw new Error(`추천 목록에 없는 루틴: ${title}`);
  return { ...base, ...change };
};
const T = (...titles: string[]) => titles.map((t) => tpl(t));

/** 밤잠 준비 — 뒤집기를 시작할 즈음부터는 속싸개 대신 수면 조끼, 돌 무렵부터는 잠옷 · 책 */
const SLEEP_VEST = tpl('밤잠 준비', { items: ['수면 조끼 입히기', '수유', '트림', '자장가 부르며 재우기'] });
const SLEEP_TODDLER = tpl('밤잠 준비', { items: ['잠옷 갈아입히기', '책 읽어 주기', '자장가 부르며 재우기'] });
/**
 * 집안일 — 침구 · 분유포트 · 가습기. 분유포트는 돌 무렵까지.
 * 기저귀 휴지통 · 빨래 · 가제수건 · 젖병 소독처럼 쌓이면 눈에 띄어서 하게 되는 일은 넣지 않는다(task today/006)
 */
const CHORES = T('재고 확인', '아기 침구 빨래', '분유포트 세척', '가습기 청소');
const CHORES_TODDLER = T('재고 확인', '아기 침구 빨래', '가습기 청소', '장난감 소독');
/** 2개월부터 더해지는 것 — 장난감 소독 · 쪽쪽이 바꾸기 */
const LATER_CHORES = T('장난감 소독', '쪽쪽이 바꾸기');

/**
 * 집에서의 시기 — 시기마다 추천 전체를 따로 둔다(앞 시기에 더하지 않는다). 며칠마다 해서 까먹기 쉬운 일이 중심이고,
 * 놀이(아기체육관 · 뒤집기 연습 · 책 · 걸음마)는 성장 탭 「오늘의 놀이」에 맡긴다(task today/006).
 * 순서대로 루틴 화면의 추천 버튼이 된다
 */
const HOME_STAGES: { from: number; label: string; templates: RoutineTemplate[] }[] = [
  {
    from: 0,
    label: '생후 0~2개월',
    templates: [...T('목욕', '밤잠 준비', '손발톱 깎기', '터미타임'), ...CHORES],
  },
  {
    from: 2,
    label: '2개월부터',
    templates: [tpl('목욕'), SLEEP_VEST, ...T('손발톱 깎기', '터미타임', '산책'), ...CHORES, ...LATER_CHORES],
  },
  {
    from: 6,
    label: '6개월부터',
    templates: [tpl('목욕'), SLEEP_VEST, tpl('이유식'), ...T('손발톱 깎기', '산책'), ...CHORES, ...LATER_CHORES],
  },
  {
    from: 9,
    label: '9개월부터',
    templates: [tpl('목욕'), SLEEP_VEST, tpl('이유식', { time: null, items: ['아침', '점심', '저녁'] }), ...T('손발톱 깎기', '산책'), ...CHORES, ...LATER_CHORES],
  },
  {
    from: 12,
    label: '12개월부터',
    templates: [tpl('목욕'), SLEEP_TODDLER, ...T('양치', '유아식', '간식', '손발톱 깎기', '산책'), ...CHORES_TODDLER],
  },
];

/** 병원 · 산후조리원에서는 대부분 챙겨 준다 — 그곳에서 쓸 만한 것만 */
const AWAY: Record<Exclude<Place, 'home'>, string[]> = {
  hospital: [],
  carecenter: ['모자동실', '손발톱 깎기'],
};

const stageIndex = (month: number) => Math.max(0, HOME_STAGES.map((r) => r.from <= month).lastIndexOf(true));

/** 집에서 지금 개월의 추천 전체 — 루틴 추가 시트와 루틴 화면의 추천 버튼(SPEC-MAIN-03) */
export function homeTemplates(month: number): RoutineTemplate[] {
  return HOME_STAGES[stageIndex(month)].templates;
}

/** `j` 시기에 있고 `i` 시기에는 없던 이름 */
function newSince(i: number, j: number): RoutineTemplate[] {
  const before = new Set((HOME_STAGES[i]?.templates ?? []).map((t) => titleKey(t.title)));
  return HOME_STAGES[j].templates.filter((t) => !before.has(titleKey(t.title)));
}

export type RoutineRecommend = {
  /** 「생후 0~2개월 추천」 · 「산후조리원에서」 */
  label: string;
  templates: RoutineTemplate[];
  /** 병원 · 산후조리원일 때의 안내 */
  note: string | null;
  /** 다음 시기 미리 보기 — 집에서만, 새로 들어오는 것이 있는 가장 가까운 시기. `fromMonth` 개월이 되는 날부터 */
  next: { label: string; fromMonth: number; templates: RoutineTemplate[] } | null;
};

/** 루틴 추천 화면(SPEC-MAIN-07) */
export function routineRecommend(month: number, place: Place): RoutineRecommend {
  if (place !== 'home') {
    return {
      label: `${PLACE_LABELS[place]}에서`,
      templates: AWAY[place].map((t) => tpl(t)),
      note: `${PLACE_LABELS[place]}에서는 대부분 챙겨 줘요. 집에 오면 추천이 바뀌어요`,
      next: null,
    };
  }
  const i = stageIndex(month);
  // 이름이 같고 단계만 바뀌는 시기(9개월 이유식)는 건너뛴다
  const j = HOME_STAGES.findIndex((stage, k) => k > i && newSince(i, k).length > 0);
  return {
    label: `${HOME_STAGES[i].label} 추천`,
    templates: HOME_STAGES[i].templates,
    note: null,
    next: j > 0 ? { label: HOME_STAGES[j].label, fromMonth: HOME_STAGES[j].from, templates: newSince(i, j) } : null,
  };
}

/**
 * 루틴 화면 버튼 뒤에 점선으로 보일 추천(SPEC-MAIN-03) — 지금 시기 추천 중 아직 안 넣고 숨기지 않은 것 전부.
 * 루틴 수로 개수를 바꾸지 않는다 — 하나 넣으면 그 버튼만 빠지고, 루틴을 지우면 그 버튼만 돌아온다(task today/006).
 * 6개월이 되면 이유식처럼 새 시기 것도 저절로 보인다. 길게 눌러 숨긴 이름은 `hidden`.
 */
export function gridSuggestions(month: number, routineTitles: string[], hidden: string[] = []): RoutineTemplate[] {
  const skip = new Set([...routineTitles, ...hidden].map(titleKey));
  return homeTemplates(month).filter((t) => !skip.has(titleKey(t.title)));
}

/**
 * 루틴 추천과 지금 루틴의 단계가 다른가 — 같은 이름인데 시기에 맞는 단계가 바뀐 것(신생아 때 넣은 「밤잠 준비」의 속싸개).
 * 추천 화면에서 「단계 바꾸기」를 보인다
 */
export function stepsDiffer(template: RoutineTemplate, items: string[] | null): boolean {
  if (!template.items?.length || !items?.length) return false;
  return template.items.join('|') !== items.join('|');
}

/** 할 일 추천(SPEC-TOPIC-13) — 묶음 하나 */
export type TodoGroup = { title: string; items: string[] };

/** 병원 · 산후조리원 — 있는 곳마다 한 묶음 */
const AWAY_TODOS: Record<Exclude<Place, 'home'>, TodoGroup> = {
  hospital: { title: '퇴원 전에 챙길 일', items: ['산후조리원에 퇴원일 알리기', '산후조리원에 가져갈 짐 챙기기', '카시트 설치하기'] },
  carecenter: {
    title: '퇴소 전에 챙길 일',
    items: ['카시트 설치하기', '조리원에서 쓰던 기저귀 단계 확인', '집에서 먹일 분유 정하기', '아기 침대 준비하기', '퇴소 뒤 접종 · 검진 날짜 확인'],
  },
};

/**
 * 집에서의 할 일 추천 — 시기마다 묶음(task today/005). 신청 · 서류는 넣지 않고(decisions/026),
 * 아기 일정이 저절로 만드는 기념일(촬영 · 돌잔치 장소 · 돌상) · 사이즈 확인과 겹치지 않게 한다. 보행기는 넣지 않는다
 */
const HOME_TODO_STAGES: { from: number; label: string; groups: TodoGroup[] }[] = [
  {
    from: 0,
    label: '생후 0~3개월',
    groups: [
      {
        title: '집에 온 뒤 챙길 일',
        items: ['아기 침대 · 기저귀 갈이대 자리 정하기', '아기 방에 온습도계 두기', '가까운 소아청소년과 찾아 두기', '외출 가방 챙겨 두기'],
      },
    ],
  },
  {
    from: 4,
    label: '4개월부터',
    groups: [
      { title: '이유식 준비', items: ['턱받이 사기', '이유식 그릇 · 숟가락 사기', '아기 의자 고르기', '이유식 보관 용기 사기'] },
      { title: '집 안 안전', items: ['모서리 보호대 붙이기', '콘센트 덮개 끼우기', '안전문 달기', '전선 · 작은 물건 치우기'] },
    ],
  },
  {
    from: 9,
    label: '9개월부터',
    groups: [
      { title: '걸음마 준비', items: ['미끄럼 방지 양말 사기', '첫 신발 고르기', '밀고 다니는 장난감 고르기', '가구 모서리 다시 확인하기'] },
      { title: '돌 준비', items: ['돌 답례품 고르기', '돌잔치 날짜 가족에게 알리기', '돌 옷 준비하기'] },
    ],
  },
  {
    from: 12,
    label: '12개월부터',
    groups: [
      { title: '유아 식기 · 컵', items: ['빨대컵 사기', '유아 식판 · 수저 사기', '아기 칫솔 · 치약 사기'] },
      { title: '어린이집 준비물', items: ['낮잠 이불 준비하기', '여벌 옷 챙기기', '이름 스티커 붙이기', '물병 준비하기'] },
    ],
  },
];

export type TodoRecommend = {
  /** 지금 시기 이름 — 「생후 0~3개월」 「4개월부터」, 병원 · 산후조리원은 묶음 이름 */
  label: string;
  groups: TodoGroup[];
  /** 다음 시기 미리 보기 — 집에서만 */
  next: { label: string; fromMonth: number; groups: TodoGroup[] } | null;
};

export function todoRecommend(place: Place, month = 0): TodoRecommend {
  if (place !== 'home') return { label: AWAY_TODOS[place].title, groups: [AWAY_TODOS[place]], next: null };
  const i = Math.max(0, HOME_TODO_STAGES.map((r) => r.from <= month).lastIndexOf(true));
  const following = HOME_TODO_STAGES[i + 1];
  return {
    label: HOME_TODO_STAGES[i].label,
    groups: HOME_TODO_STAGES[i].groups,
    next: following ? { label: following.label, fromMonth: following.from, groups: following.groups } : null,
  };
}

/**
 * 성장 탭 「이맘때 챙기면 좋은 일」(SPEC-STAGE-06) — 지금 시기 묶음의 할 일 셋까지. 아직 넣지 않은 것을 먼저,
 * 다 넣었으면 넣은 것을 보인다. `have` 는 내 할 일 제목의 `titleKey`
 */
export function prepPreview(rec: TodoRecommend, have: Set<string>, n = 3): { title: string; added: boolean }[] {
  const all = rec.groups.flatMap((g) => g.items).map((title) => ({ title, added: have.has(titleKey(title)) }));
  return [...all.filter((x) => !x.added), ...all.filter((x) => x.added)].slice(0, n);
}
