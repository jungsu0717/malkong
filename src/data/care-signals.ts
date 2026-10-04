/**
 * 데일리 브리핑의 안부 (SPEC-HOME-06 ①② · ④, decisions/018, task home/008) — 어제 일에 이어 묻기.
 *
 * 어제 0시부터 지금까지 내가 버디에게 한 말과 기록 문구에서 신호(열 · 게움 · 접종 · 덜 먹음 · 변 · 기침 · 보챔 · 밤잠)를 찾는다.
 * 신호마다 가장 최근 말에 「내렸어요 · 괜찮아요 · 나아졌어요」가 있으면 끝난 일로 본다 — 안부에 좋아졌다고 답한 기록도 같은 길로
 * 센다. 그래서 같은 일을 끝난 뒤에 다시 묻지 않는다(constitution 3). 모두 기기 안에서, 모델 없이.
 *
 * 문구는 묻기만 한다 — 안심 단정 · 진단 · 처방을 쓰지 않는다(constitution 2). 걱정되는 답은 입력창에 담아 대화로 잇고,
 * 거기서 위험 신호 규칙을 거친다(SPEC-ASK-02). 관련 위험 신호 L1 이 있으면 출처와 함께 한 줄 붙인다.
 */

import type { ChatMessage } from './chat';
import { itemById } from './l1';
import type { BabyRecord } from './records';
import { groupLabel, type L1Item } from './timeline';

export type SignalKey = 'fever' | 'vomit' | 'vaccine' | 'appetite' | 'stool' | 'cold' | 'fussy' | 'night';

type SignalDef = {
  key: SignalKey;
  /** 안부 칩으로 답하면 남는 기록의 머리 — 아래 match 가 이 말도 잡아야 끝났는지 셀 수 있다 */
  name: string;
  match: RegExp;
  /** 가장 최근 말에 이게 있으면 끝난 일 */
  resolved: RegExp | null;
};

const SIGNALS: SignalDef[] = [
  {
    key: 'fever',
    name: '발열',
    match: /(^|[^가-힣])열\s*(이|은|도|나|났|있|올|내|감)|발열|미열|고열|해열제|3[7-9](\.\d)?\s*(도|℃|°)/,
    resolved: /내렸|내림|떨어졌|정상|괜찮|나아|좋아졌|없어졌/,
  },
  {
    key: 'vomit',
    name: '게움',
    match: /토(했|하|해|함)|게워|게움|게웠|구토|역류|분수\s*토/,
    resolved: /잘\s*먹었|안\s*게|안\s*토|괜찮|나아|멈췄|그쳤/,
  },
  {
    key: 'appetite',
    name: '먹는 양',
    match: /안\s*먹|덜\s*먹|못\s*먹|먹지\s*않|먹기\s*싫|거부|입맛|먹는\s*양/,
    resolved: /잘\s*먹|다시\s*먹|괜찮/,
  },
  {
    key: 'stool',
    name: '변 상태',
    match: /변비|설사|묽은\s*변|물\s*같은\s*변|변\s*상태|(응가|대변).{0,6}(안|못|딱딱|묽)/,
    resolved: /괜찮|나아|정상|좋아졌/,
  },
  {
    key: 'cold',
    name: '기침·콧물',
    match: /기침|콧물|코\s*막|코감기|감기|가래|쌕쌕/,
    resolved: /나아|괜찮|좋아졌|멈췄|그쳤/,
  },
  { key: 'fussy', name: '보챔', match: /보채|보챘|보챈|칭얼|짜증|울어|울었|울음|울고|달래/, resolved: null },
  {
    key: 'night',
    name: '밤잠',
    // 낮잠 이야기(「낮잠을 못 자요」)는 부모의 밤과 다르다 — 밤 · 새벽 · 통잠 · 자주 깸만
    match: /밤에?.{0,8}(깨|못\s*자|안\s*자|못\s*잤)|밤잠|새벽.{0,6}깨|통잠.{0,4}(안|못)|자주\s*깨/,
    resolved: null,
  },
];

/** 접종 다음 날의 안부 — 말이 아니라 「어제 완료를 알린 접종」으로 안다 */
const VACCINE_ANSWER = '접종 후';

type Said = { at: string; text: string };

/** 어제 0시부터 지금까지 — 내가 한 말과 남은 기록 문구 */
function recentSayings(messages: ChatMessage[], records: BabyRecord[], now: Date): Said[] {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const said: Said[] = [
    ...messages.filter((m) => m.role === 'user' && m.createdAt >= from).map((m) => ({ at: m.createdAt, text: m.content })),
    ...records.filter((r) => r.createdAt >= from).map((r) => ({ at: r.createdAt, text: r.label })),
  ];
  return said.sort((a, b) => a.at.localeCompare(b.at));
}

/** 지금 이어서 물을 만한 신호 — 끝난 것은 뺀다. 어제 완료를 알린 접종이 있으면 그 이름(「DTaP·폴리오 1차」) */
export function activeSignals(
  messages: ChatMessage[],
  records: BabyRecord[],
  now: Date,
): { keys: Set<SignalKey>; vaccine: string | null } {
  const said = recentSayings(messages, records, now);
  const keys = new Set<SignalKey>();
  for (const def of SIGNALS) {
    const last = said.filter((s) => def.match.test(s.text)).at(-1);
    if (!last) continue;
    if (def.resolved && def.resolved.test(last.text)) continue;
    keys.add(def.key);
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const shots = records
    .filter((r) => r.createdAt >= yesterday && r.createdAt < today)
    .flatMap((r) => r.covers)
    .map((id) => itemById(id))
    .filter((i): i is L1Item => i?.kind === '접종');
  const answered = records.some((r) => r.createdAt >= today && r.label.includes(VACCINE_ANSWER));
  const vaccine = shots.length > 0 && !answered ? groupLabel(shots) : null;
  if (vaccine) keys.add('vaccine');
  return { keys, vaccine };
}

/** 안부 칩 하나 — good 은 기록만, bad 는 기록하고 입력창에 담아 대화로 잇는다, neutral 은 아무것도 남기지 않는다 */
export type CareOption = {
  label: string;
  tone: 'good' | 'bad' | 'neutral';
  /** 남길 기록의 본문(앞에 날짜가 붙는다) */
  record: string | null;
  /** 대화로 이을 때 입력창에 담을 말 */
  prefill: string | null;
};

export type CareCheck = {
  signal: SignalKey;
  question: string;
  options: CareOption[];
  /** 함께 보일 위험 신호 L1 — 출처와 함께 */
  warnId: string | null;
  /** 고른 칩 */
  answer: string | null;
};

/** 기록하면 좋을 것(SPEC-HOME-06 ④) — 신호와 이어지는 것 하나 */
export type SuggestKey = 'temperature' | 'feed-total' | 'note';

const opt = (label: string, tone: CareOption['tone'], record: string | null, prefill: string | null = null): CareOption => ({
  label,
  tone,
  record,
  prefill,
});

/** 아기 안부 — 우선순위 열 > 게움 > 접종 > 덜 먹음 > 변 > 기침. 하루에 하나 */
export function babyCheck(
  keys: Set<SignalKey>,
  { name, month, vaccine }: { name: string; month: number; vaccine: string | null },
): { care: CareCheck | null; suggest: SuggestKey | null } {
  const ga = /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0 ? '이' : '가';
  const who = `${name}${ga}`;
  const check = (signal: SignalKey, question: string, options: CareOption[], warnId: string | null = null): CareCheck => ({
    signal,
    question,
    options,
    warnId: warnId && itemById(warnId) ? warnId : null,
    answer: null,
  });

  if (keys.has('fever')) {
    return {
      care: check(
        'fever',
        `어제 ${who} 열이 났다고 하셨죠. 오늘은 좀 어때요?`,
        [
          opt('열이 내렸어요', 'good', '발열: 내렸어요'),
          opt('아직 열이 있어요', 'bad', '발열: 아직 있어요', '어제부터 열이 아직 있어요. 지금 체온은 '),
          opt('아직 안 재 봤어요', 'neutral', null),
        ],
        month < 3 ? 'k-warn-0001' : 'k-warn-0002',
      ),
      suggest: 'temperature',
    };
  }
  if (keys.has('vomit')) {
    return {
      care: check(
        'vomit',
        `어제 ${who} 자꾸 게워 냈다고 하셨는데, 오늘은 잘 먹었어요?`,
        [
          opt('잘 먹었어요', 'good', '게움: 오늘은 잘 먹었어요'),
          opt('또 게웠어요', 'bad', '게움: 또 게웠어요', '어제에 이어 오늘도 게워 냈어요. '),
          opt('덜 먹었어요', 'bad', '게움: 오늘은 덜 먹었어요', '게워 낸 뒤로 평소보다 덜 먹어요. '),
        ],
        'k-warn-0006',
      ),
      suggest: 'feed-total',
    };
  }
  if (keys.has('vaccine') && vaccine) {
    return {
      care: check('vaccine', `어제 ${vaccine} 맞았죠. 열이나 접종한 자리는 괜찮아요?`, [
        opt('괜찮아요', 'good', `${VACCINE_ANSWER}: 괜찮아요`),
        opt('열이 나요', 'bad', `${VACCINE_ANSWER}: 열이 나요`, '어제 접종하고 열이 나요. 지금 체온은 '),
        opt('접종 부위가 부었어요', 'bad', `${VACCINE_ANSWER}: 부위가 부었어요`, '어제 접종한 자리가 부었어요. '),
      ]),
      suggest: 'temperature',
    };
  }
  if (keys.has('appetite')) {
    return {
      care: check('appetite', `어제 ${who} 평소보다 덜 먹었다고 하셨죠. 오늘은 잘 먹고 있어요?`, [
        opt('잘 먹어요', 'good', '먹는 양: 다시 잘 먹어요'),
        opt('아직 덜 먹어요', 'bad', '먹는 양: 아직 덜 먹어요', '요즘 평소보다 덜 먹어요. '),
      ]),
      suggest: 'feed-total',
    };
  }
  if (keys.has('stool')) {
    return {
      care: check(
        'stool',
        `어제 ${name} 변 이야기를 하셨는데, 오늘은 어때요?`,
        [opt('괜찮아졌어요', 'good', '변 상태: 괜찮아졌어요'), opt('아직 그래요', 'bad', '변 상태: 아직 그래요', '변 상태가 아직 안 좋아요. ')],
        'k-warn-0008',
      ),
      suggest: 'note',
    };
  }
  if (keys.has('cold')) {
    return {
      care: check('cold', `어제 기침 · 콧물 이야기를 하셨죠. 오늘은 좀 나아졌어요?`, [
        opt('나아졌어요', 'good', '기침·콧물: 나아졌어요'),
        opt('비슷해요', 'neutral', '기침·콧물: 비슷해요'),
        opt('더 심해졌어요', 'bad', '기침·콧물: 더 심해졌어요', '기침 · 콧물이 어제보다 심해졌어요. '),
      ]),
      suggest: 'temperature',
    };
  }
  return { care: null, suggest: null };
}

/** 부모 안부 칩 하나 — 고르면 버디가 한 마디 답한다. 기록하지 않는다(아기 기록이 아니다) */
export type ParentOption = { label: string; reply: string };

export type ParentCheck = {
  reason: 'fussy' | 'night' | 'routine';
  question: string;
  options: ParentOption[];
  answer: string | null;
};

/** 신호가 없는 날의 부모 안부 — 일주일에 두 번(태어난 날부터 센 날로 돌린다) */
const ROUTINE_DAYS = [1, 4];

/**
 * 부모 안부 — 친정엄마의 마음으로. 보챔 · 밤잠 신호가 있으면 잠을, 없으면 일주일에 두 번 끼니 · 컨디션을 묻는다.
 * 아기 안부가 있는 날에는 신호가 있을 때만 — 하루 브리핑이 질문으로 가득하지 않게.
 */
export function parentCheck(
  keys: Set<SignalKey>,
  { name, days, hasBabyCheck }: { name: string; days: number; hasBabyCheck: boolean },
): ParentCheck | null {
  const ga = /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0 ? '이' : '가';
  const who = `${name}${ga}`;
  const sleepOptions: ParentOption[] = [
    { label: '거의 못 잤어요', reply: `오늘은 ${who} 잘 때 같이 눈 붙여요. 집안일은 좀 미뤄도 괜찮아요.` },
    { label: '조금 잤어요', reply: `조금이라도 다행이에요. 낮에 ${who} 잘 때 잠깐이라도 같이 누워요.` },
    { label: '괜찮아요', reply: '다행이에요. 오늘도 같이 챙길게요.' },
  ];
  if (keys.has('fussy')) {
    return {
      reason: 'fussy',
      question: `어제 ${who} 많이 보챘다니 고생 많으셨어요. 잠은 좀 주무셨어요?`,
      options: sleepOptions,
      answer: null,
    };
  }
  if (keys.has('night')) {
    return {
      reason: 'night',
      question: `어젯밤 ${who} 자주 깼다고 하셨죠. 밤새 애쓰셨어요. 잠은 좀 주무셨어요?`,
      options: sleepOptions,
      answer: null,
    };
  }
  if (hasBabyCheck || !ROUTINE_DAYS.includes(days % 7)) return null;
  if (Math.floor(days / 7) % 2 === 0) {
    return {
      reason: 'routine',
      question: `요즘 끼니는 잘 챙겨 드세요? ${name} 챙기다 보면 거르기 쉬워요.`,
      options: [
        { label: '잘 먹고 있어요', reply: '다행이에요. 잘 드셔야 오래 버텨요.' },
        { label: '자주 걸러요', reply: '한 손으로 먹을 수 있는 걸 곁에 두면 조금 나아요. 부모님 몸도 아기만큼 소중해요.' },
      ],
      answer: null,
    };
  }
  return {
    reason: 'routine',
    question: '요즘 컨디션은 어때요? 잠은 좀 주무세요?',
    options: [
      { label: '괜찮아요', reply: '다행이에요. 오늘도 같이 챙길게요.' },
      {
        label: '좀 지쳤어요',
        reply: `많이 애쓰고 계세요. 오늘 하나쯤은 미뤄도 괜찮아요. ${who} 잘 때 같이 쉬고, 혼자 다 하려 하지 말고 주변에 손을 빌려요.`,
      },
    ],
    answer: null,
  };
}

/** 안부의 짧은 이름 — 알림함 요약에 */
export const SIGNAL_NAMES: Record<SignalKey, string> = {
  fever: '열',
  vomit: '게움',
  vaccine: '접종 뒤',
  appetite: '먹는 양',
  stool: '변',
  cold: '기침·콧물',
  fussy: '보챔',
  night: '밤잠',
};
