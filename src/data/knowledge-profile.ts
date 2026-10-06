/**
 * 버디가 아는 우리 아기 (SPEC-BABY-01·03·04, task baby/001).
 *
 * 영역 여섯마다 「알아야 할 것」(사실)이 있고, 사실은 기록(L2) 문구를 찾는 규칙이나 표준(L1) 완료 비율로 0~1 점수를 낸다.
 * **기록에 없는 것은 아는 것으로 세지 않는다**(SPEC-BABY-01 근거) — 숫자를 꾸미지 않는다.
 * 모두 기기 안에서 계산한다.
 */

import { ageFrom, type Baby } from './baby';
import { allItems, type KnowledgeKind } from './l1';
import { monthDay, type QuickAsk } from './quick-ask';
import type { BabyRecord } from './records';

export type DomainId = 'feeding' | 'sleep' | 'growth' | 'health' | 'development' | 'daily';

export type Fact = {
  id: string;
  label: string;
  /** 0~1 — 사실 하나를 얼마나 아는지. 기록 문구 규칙은 0 또는 1, 표준 완료 비율은 그 사이 */
  score: number;
  /** 아는 값 — 맞은 기록 가운데 가장 최근 것의 문구, 또는 「3 / 10」 같은 비율 */
  value: string | null;
  /** 알려 주면 좋아지는 것 — SPEC-BABY-04 */
  benefit: string;
  /** 그 자리에서 묻는 질문(task baby/002). 표준 완료 비율 사실은 없다(완료는 일정 탭에서) */
  ask: QuickAsk | null;
  /** 아는 값의 기록 — 고칠 때 그 기록을 바꾼다 */
  record: BabyRecord | null;
};

export type Domain = {
  id: DomainId;
  name: string;
  /** 지식 지도의 행성 색 — 밝은 바탕 · 어두운 바탕 모두에서 보이는 중간 밝기 */
  color: string;
  score: number;
  facts: Fact[];
};

export type KnowledgeProfile = {
  domains: Domain[];
  /** 0~100 */
  percent: number;
  level: { step: number; name: string };
  knownCount: number;
  totalCount: number;
};

type RuleFact = {
  kind: 'rule';
  id: string;
  label: string;
  match: RegExp;
  benefit: string;
  ask: FactAsk;
  /** 이 월령부터 알아야 할 것 — 그 전에는 세지 않는다 */
  fromMonth?: number;
};

type CoverFact = {
  kind: 'cover';
  id: string;
  label: string;
  kinds: KnowledgeKind[];
  benefit: string;
  fromMonth?: number;
};

type FactDef = RuleFact | CoverFact;

/** 사실의 질문 — 머리 아래 한 줄은 그 사실의 benefit 을 쓴다 */
type FactAsk = Omit<QuickAsk, 'hint'>;

/** 골라서 답하는 질문 — 기록은 「사실 이름: 답」. 사실의 match 가 이 이름을 잡아야 한다 */
const choose = (title: string, name: string, options: string[]): FactAsk => ({
  title,
  unit: null,
  placeholder: '직접 입력',
  options,
  label: (v) => `${name}: ${v}`,
});

/** 숫자로 답하는 질문 — 잰 값은 잰 날을 붙인다(몸무게 · 키 · 머리둘레) */
const measure = (
  title: string,
  name: string,
  unit: NonNullable<QuickAsk['unit']>,
  placeholder: string,
  { options = [], dated = true }: { options?: string[]; dated?: boolean } = {},
): FactAsk => ({
  title,
  unit,
  placeholder,
  options,
  label: (v, today) => `${name} ${v}${unit}${dated ? ` (${monthDay(today)})` : ''}`,
});

const DOMAINS: { id: DomainId; name: string; color: string; facts: FactDef[] }[] = [
  {
    id: 'feeding',
    name: '먹기',
    color: '#E8825F',
    facts: [
      { kind: 'rule', id: 'feed-type', label: '수유 방식', match: /수유\s*방식|모유|분유|혼합\s*수유/, benefit: '수유량·간격 답이 모유·분유에 맞춰져요', ask: choose('수유는 어떻게 하고 있나요?', '수유 방식', ['모유', '분유', '혼합 수유']) },
      { kind: 'rule', id: 'feed-interval', label: '수유 간격', match: /수유\s*(텀|간격)|시간\s*(마다|간격|텀)|밤중\s*수유/, benefit: '배고픔·밤중 수유 질문에 우리 아기 패턴으로 답해요', ask: measure('요즘 수유 간격은요?', '수유 간격', '시간', '3', { options: ['2', '2.5', '3', '3.5', '4'], dated: false }) },
      { kind: 'rule', id: 'feed-amount', label: '한 번 먹는 양', match: /\d+\s*(ml|mL|ML|cc)|수유량|먹는\s*양/, benefit: '먹는 양이 괜찮은지 물을 때 기준이 생겨요', ask: measure('한 번에 먹는 양은요?', '한 번 먹는 양', 'ml', '120', { options: ['60', '90', '120', '150', '180'], dated: false }) },
      { kind: 'rule', id: 'solids', label: '이유식', match: /이유식|미음|퓨레/, benefit: '이유식 단계와 재료 답이 정확해져요', ask: choose('이유식은 어디까지 왔나요?', '이유식', ['아직 시작 안 했어요', '초기(미음)', '중기', '후기', '완료기']), fromMonth: 4 },
    ],
  },
  {
    id: 'sleep',
    name: '잠',
    color: '#7D8FE0',
    facts: [
      { kind: 'rule', id: 'night', label: '밤잠', match: /밤잠|통잠|밤에\s*\S*\s*(자|깨)|밤중에?\s*깨/, benefit: '밤에 자주 깨는 이유를 우리 아기 기준으로 짚어요', ask: choose('밤잠은 어떤가요?', '밤잠', ['통잠 자요', '1~2번 깨요', '3번 이상 깨요']) },
      { kind: 'rule', id: 'nap', label: '낮잠', match: /낮잠/, benefit: '낮잠 횟수·길이 질문에 바로 비교해 드려요', ask: choose('낮잠은 하루 몇 번 자나요?', '낮잠', ['하루 1번', '하루 2번', '하루 3번', '하루 4번 이상']) },
      { kind: 'rule', id: 'settle', label: '재우는 방식', match: /재우|재움|수면\s*교육|안아서\s*자|눕혀서|자장가|백색\s*소음/, benefit: '수면 교육·잠투정 답이 지금 방식에서 시작해요', ask: choose('보통 어떻게 재우나요?', '재우는 방식', ['안아서 재워요', '눕히면 스스로 자요', '먹이면서 재워요', '흔들거나 업어서 재워요']) },
    ],
  },
  {
    id: 'growth',
    name: '성장',
    color: '#4FB39A',
    facts: [
      { kind: 'rule', id: 'weight', label: '몸무게', match: /몸무게|체중|\d+(\.\d+)?\s*(kg|킬로)/i, benefit: '먹는 양·성장 질문에 최근 몸무게를 짚어 답해요', ask: measure('최근 몸무게는요?', '몸무게', 'kg', '6.4') },
      { kind: 'rule', id: 'height', label: '키', match: /(^|\s)키\s*(는|가|\d)|신장|\d+(\.\d+)?\s*cm/i, benefit: '성장 속도를 물을 때 비교할 수 있어요', ask: measure('최근에 잰 키는요?', '키', 'cm', '62') },
      { kind: 'rule', id: 'head', label: '머리둘레', match: /머리\s*둘레/, benefit: '검진 결과를 물을 때 같이 볼 수 있어요', ask: measure('머리둘레는요?', '머리둘레', 'cm', '40') },
    ],
  },
  {
    id: 'health',
    name: '건강',
    color: '#E0607A',
    facts: [
      { kind: 'cover', id: 'vaccines', label: '예방접종', kinds: ['접종'], benefit: '다음 접종과 놓친 접종을 정확히 챙겨요' },
      { kind: 'cover', id: 'checkups', label: '영유아 검진', kinds: ['검진'], benefit: '다음 검진 시기를 정확히 챙겨요' },
      { kind: 'rule', id: 'skin', label: '알레르기 · 피부', match: /알레르기|아토피|태열|습진|두드러기/, benefit: '이유식 재료·피부 질문에서 조심할 것을 먼저 짚어요', ask: choose('알레르기나 피부 고민이 있나요?', '알레르기 · 피부', ['없어요', '태열 · 아토피', '습진', '음식 알레르기가 의심돼요']) },
      { kind: 'rule', id: 'sick', label: '아팠던 일', match: /아팠던\s*일|열이?\s*(났|나|있)|감기|입원|병원|중이염|장염|약을?\s*먹/, benefit: '비슷한 증상을 물을 때 지난 일을 함께 봐요', ask: choose('최근에 아팠던 적이 있나요?', '최근 아팠던 일', ['없어요', '감기', '열이 났어요', '장염', '중이염']) },
    ],
  },
  {
    id: 'development',
    name: '발달',
    color: '#E9B03C',
    facts: [
      { kind: 'rule', id: 'motor', label: '몸 움직임', match: /몸\s*움직임|목\s*가누|뒤집|배밀이|기어|기기|앉|서기|걸음|걷/, benefit: '이정표 질문에 지금 할 수 있는 것부터 답해요', ask: choose('요즘 몸으로 하는 건 뭐예요?', '몸 움직임', ['목을 가눠요', '뒤집어요', '배밀이해요', '기어요', '혼자 앉아요', '잡고 서요', '걸어요']) },
      { kind: 'rule', id: 'social', label: '소리 · 표정', match: /소리\s*·\s*표정|옹알|웃|눈\s*맞|소리\s*내|낯가림|엄마|아빠/, benefit: '말·사회성 발달 질문이 우리 아기 기준이 돼요', ask: choose('요즘 내는 소리나 표정은요?', '소리 · 표정', ['눈을 맞춰요', '소리 내 웃어요', '옹알이해요', '낯을 가려요', '엄마 · 아빠를 말해요']) },
      { kind: 'rule', id: 'teeth', label: '이', match: /이가?\s*(났|나)|치아|잇몸/, benefit: '이앓이·양치 질문에 바로 맞춰 답해요', ask: choose('이는 났나요?', '치아', ['아직 안 났어요', '1~2개', '3~6개', '7개 이상']), fromMonth: 4 },
    ],
  },
  {
    id: 'daily',
    name: '생활',
    color: '#B08BDB',
    facts: [
      { kind: 'rule', id: 'temper', label: '기질', match: /예민|순한|순해|기질|잘\s*울|잘\s*웃|겁이/, benefit: '달래기·잠투정 답을 우리 아기 성향에 맞춰요', ask: choose('우리 아기 성향은 어떤가요?', '기질', ['순한 편', '예민한 편', '활발한 편', '겁이 많은 편']) },
      { kind: 'rule', id: 'likes', label: '좋아하는 것', match: /좋아(해|하|함)|싫어(해|하|함)/, benefit: '놀이·달래기 방법을 좋아하는 것에서 시작해요', ask: choose('좋아하는 건 뭐예요?', '좋아하는 것', ['노래 · 자장가', '산책', '목욕', '안아 주기', '장난감']) },
      { kind: 'rule', id: 'play', label: '놀이 · 목욕', match: /터미타임|놀이|산책|목욕|외출/, benefit: '하루 일과 질문에 지금 생활을 반영해요', ask: choose('요즘 하루 일과는 어떤가요?', '놀이 · 목욕', ['터미타임을 해요', '매일 목욕해요', '산책을 자주 해요', '주로 집에서 놀아요']) },
      { kind: 'cover', id: 'life', label: '알아 둔 생활 팁', kinds: ['생활', '안전', '수면', '수유'], benefit: '챙길 것의 생활 팁을 확인하면 늘어나요' },
    ],
  },
];

const LEVELS = [
  { from: 0, name: '처음 만났어요' },
  { from: 15, name: '알아 가는 중' },
  { from: 35, name: '꽤 잘 알아요' },
  { from: 55, name: '단짝이에요' },
  { from: 75, name: '박사' },
];

export function buildProfile(baby: Baby, records: BabyRecord[], now = new Date()): KnowledgeProfile {
  const { month } = ageFrom(baby.birthDate, now);
  const covered = new Set(records.flatMap((r) => r.covers));
  const newestFirst = [...records].reverse();

  const domains: Domain[] = DOMAINS.map((d) => {
    const facts: Fact[] = d.facts
      .filter((f) => (f.fromMonth ?? 0) <= month)
      .map((f) => {
        if (f.kind === 'cover') {
          // 지금까지 시작한 표준 항목 가운데 완료(확인)를 알린 것의 비율
          const due = allItems().filter((i) => f.kinds.includes(i.kind) && i.months[0] <= month);
          const done = due.filter((i) => covered.has(i.id)).length;
          return {
            id: f.id,
            label: f.label,
            score: due.length ? done / due.length : 0,
            value: due.length ? `${done} / ${due.length}` : null,
            benefit: f.benefit,
            ask: null,
            record: null,
          };
        }
        const hit = newestFirst.find((r) => f.match.test(r.label));
        return {
          id: f.id,
          label: f.label,
          score: hit ? 1 : 0,
          value: hit?.label ?? null,
          benefit: f.benefit,
          ask: { ...f.ask, hint: f.benefit },
          record: hit ?? null,
        };
      });
    const score = facts.length ? facts.reduce((s, f) => s + f.score, 0) / facts.length : 0;
    return { id: d.id, name: d.name, color: d.color, score, facts };
  });

  const percent = Math.round((domains.reduce((s, d) => s + d.score, 0) / domains.length) * 100);
  const step = LEVELS.filter((l) => percent >= l.from).length;
  const all = domains.flatMap((d) => d.facts);
  return {
    domains,
    percent,
    level: { step, name: LEVELS[step - 1].name },
    knownCount: all.filter((f) => f.score >= 0.5).length,
    totalCount: all.length,
  };
}

/** 알려 주면 좋아지는 것 — 모르는 것 가운데 앞 영역(먹기·잠·성장)부터 몇 개 (SPEC-BABY-04) */
export function suggestions(profile: KnowledgeProfile, count = 3): (Fact & { domain: Domain })[] {
  return profile.domains
    .flatMap((d) => d.facts.filter((f) => f.score === 0 && f.ask).map((f) => ({ ...f, domain: d })))
    .slice(0, count);
}

/** 사실 id 로 찾는다 */
export function factOf(profile: KnowledgeProfile, id: string): Fact | null {
  for (const d of profile.domains) {
    const f = d.facts.find((x) => x.id === id);
    if (f) return f;
  }
  return null;
}

/** 한눈에 보는 칸의 값 */
export function factValue(profile: KnowledgeProfile, id: string): string | null {
  return factOf(profile, id)?.value ?? null;
}

/** 날짜별로 알게 된 것의 누적 — 기록이 생긴 날마다 한 점 (SPEC-BABY-05) */
export function knowledgeGrowth(records: BabyRecord[], birthDate: string): { day: number; total: number }[] {
  const points: { day: number; total: number }[] = [];
  let total = 0;
  for (const r of records) {
    total += 1;
    const day = ageFrom(birthDate, new Date(r.createdAt)).days;
    const last = points.at(-1);
    if (last && last.day === day) last.total = total;
    else points.push({ day, total });
  }
  return points;
}
