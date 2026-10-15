/**
 * 앱이 채워 주는 할 일 (SPEC-TOPIC-11, decisions/025) — 신청 · 서류, 기념일, 사이즈 바꾸기.
 *
 * 아기 생일로 기한을 계산하고, 기한 며칠 전(lead)이 되면 그 주제의 할 일로 만든다. 만든 할 일은 보통 할 일과 같다(체크 · 편집 · 삭제).
 * 같은 할 일을 두 번 만들지 않게 `ref` 로 알아본다. 사용자가 지운 것은 다시 만들지 않는다(설정값에 ref 를 남긴다).
 * 처음 볼 때 기한이 grace 일보다 더 지났으면 만들지 않는다 — 이미 했을 가능성이 크다(예: 4개월에 설치하면 출생신고는 안 보인다).
 *
 * 신청 · 서류는 법이나 제도로 기한이 정해진 것만 두고 금액은 적지 않는다(헌장 8). 확인한 곳(2026-10-15):
 * 출생신고 1개월 — 가족관계등록법 제44조, 부모급여 · 아동수당 60일 소급 — 정부24 · 복지부 안내,
 * 첫만남이용권 사용 기한 2년(2024년 이후 출생) — 복지부 안내. 해마다 한 번 다시 확인한다.
 *
 * 화면 코드를 가져오지 않는 순수 함수만 둔다(`node --test src/data/auto-todos.test.ts`).
 */

export type AutoKind = 'paperwork' | 'milestone' | 'size';

export type AutoLink = { label: string; url: string };

export type AutoRule = {
  /** 같은 할 일인지 알아보는 열쇠 — 바꾸지 않는다 */
  ref: string;
  kind: AutoKind;
  title: string;
  /** 기한 — 아기 생일에서 계산(그날 0시) */
  due: (birth: Date) => Date;
  /** 기한 며칠 전부터 할 일로 보일지 */
  lead: number;
  /** 처음 볼 때 기한이 며칠까지 지났어도 만들지 */
  grace: number;
  /** 할 일 아래 작은 글씨 한 줄 */
  note?: string;
  link?: AutoLink;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** n 달 뒤 같은 날 — 그 달에 없는 날이면 말일 */
export function addMonths(d: Date, n: number): Date {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}

/** `YYYY-MM-DD` → 그날 0시(기기 시간대) */
export function birthOf(birthDate: string): Date {
  const [y, m, d] = birthDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const GOV24: AutoLink = { label: '정부24', url: 'https://www.gov.kr' };
const BOKJIRO: AutoLink = { label: '복지로', url: 'https://www.bokjiro.go.kr' };

/** 기념일 — 50일 · 100일은 태어난 날을 1일로 센다 */
const day50 = (b: Date) => addDays(b, 49);
const day100 = (b: Date) => addDays(b, 99);
const firstBirthday = (b: Date) => addMonths(b, 12);

const PAPERWORK: AutoRule[] = [
  {
    ref: 'paper:birth-report',
    kind: 'paperwork',
    title: '출생신고',
    due: (b) => addDays(addMonths(b, 1), -1),
    lead: 31,
    grace: 3,
    note: '출생 후 1개월 안에 해요. 신고할 때 부모급여 · 아동수당 · 첫만남이용권을 함께 신청할 수 있어요',
    link: GOV24,
  },
  {
    ref: 'paper:parent-allowance',
    kind: 'paperwork',
    title: '부모급여 신청',
    due: (b) => addDays(b, 59),
    lead: 60,
    grace: 14,
    note: '태어난 날을 포함해 60일 안에 신청하면 태어난 달부터 받아요',
    link: BOKJIRO,
  },
  {
    ref: 'paper:child-allowance',
    kind: 'paperwork',
    title: '아동수당 신청',
    due: (b) => addDays(b, 59),
    lead: 60,
    grace: 14,
    note: '태어난 날을 포함해 60일 안에 신청하면 태어난 달부터 받아요',
    link: BOKJIRO,
  },
  {
    ref: 'paper:first-voucher',
    kind: 'paperwork',
    title: '첫만남이용권 신청',
    due: (b) => addDays(addMonths(b, 1), -1),
    lead: 31,
    grace: 30,
    note: '출생신고 때 함께 신청할 수 있어요',
    link: BOKJIRO,
  },
  {
    ref: 'paper:first-voucher-use',
    kind: 'paperwork',
    title: '첫만남이용권 남은 금액 쓰기',
    due: (b) => addDays(addMonths(b, 24), -31),
    lead: 30,
    grace: 25,
    note: '태어난 날부터 2년이 지나면 남은 금액이 사라져요',
    link: BOKJIRO,
  },
];

const MILESTONES: AutoRule[] = [
  { ref: 'day:50-photo', kind: 'milestone', title: '50일 촬영 예약', due: (b) => addDays(day50(b), -21), lead: 14, grace: 7 },
  { ref: 'day:100-photo', kind: 'milestone', title: '100일 촬영 예약', due: (b) => addDays(day100(b), -30), lead: 14, grace: 7 },
  { ref: 'day:100-table', kind: 'milestone', title: '백일상 준비', due: (b) => addDays(day100(b), -7), lead: 14, grace: 3 },
  { ref: 'day:y1-party', kind: 'milestone', title: '돌잔치 장소 예약', due: (b) => addDays(firstBirthday(b), -120), lead: 30, grace: 30 },
  { ref: 'day:y1-photo', kind: 'milestone', title: '돌 촬영 예약', due: (b) => addDays(firstBirthday(b), -60), lead: 21, grace: 14 },
  { ref: 'day:y1-table', kind: 'milestone', title: '돌상 · 돌잡이 준비', due: (b) => addDays(firstBirthday(b), -14), lead: 14, grace: 3 },
];

/** 월령마다 확인할 것 — 그 달이 시작하는 날이 기한 */
function monthly(prefix: string, title: string, months: number[], note?: string): AutoRule[] {
  return months.map((m) => ({ ref: `${prefix}-${m}`, kind: 'size', title, due: (b: Date) => addMonths(b, m), lead: 7, grace: 14, note }));
}

const SIZES: AutoRule[] = [
  ...monthly('size:diaper', '기저귀 사이즈 확인', [2, 5, 9, 14, 20], '새거나 허리 · 허벅지가 끼면 다음 사이즈를 살펴봐요'),
  ...monthly('size:clothes', '다음 사이즈 옷 준비', [2, 5, 11, 20]),
  ...monthly('size:nipple', '젖꼭지 단계 확인', [3, 6, 9], '젖병 회사마다 월령 기준이 달라요'),
  ...monthly('size:carseat', '카시트 키 · 몸무게 기준 확인', [9]),
];

export const AUTO_RULES: AutoRule[] = [...PAPERWORK, ...MILESTONES, ...SIZES];

export function ruleOf(ref: string | null | undefined): AutoRule | undefined {
  return ref ? AUTO_RULES.find((r) => r.ref === ref) : undefined;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 지금 할 일로 만들 규칙 — 아직 없고(지운 것 포함), 보일 날이 됐고, 기한이 grace 보다 더 지나지 않은 것 */
export function autoRulesToAdd(birth: Date, now: Date, have: Set<string>): AutoRule[] {
  const today = startOfDay(now).getTime();
  return AUTO_RULES.filter((r) => {
    if (have.has(r.ref)) return false;
    const due = r.due(birth).getTime();
    return today >= due - r.lead * DAY_MS && today <= due + r.grace * DAY_MS;
  });
}

/** 주제 화면의 「다가오는 할 일」 — 아직 할 일로 만들지 않은 것 중 기한이 오늘 뒤인 것, 가까운 순 */
export function upcomingAuto(kind: AutoKind, birth: Date, now: Date, have: Set<string>): { rule: AutoRule; due: Date }[] {
  const today = startOfDay(now).getTime();
  return AUTO_RULES.filter((r) => r.kind === kind && !have.has(r.ref))
    .map((rule) => ({ rule, due: rule.due(birth) }))
    .filter((x) => x.due.getTime() > today)
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

/** 기념일 주제 맨 위에 보이는 날들 — 지난 것도 함께(지난 것은 흐리게) */
export function milestoneDays(birth: Date): { label: string; date: Date }[] {
  return [
    { label: '50일', date: day50(birth) },
    { label: '100일', date: day100(birth) },
    { label: '돌', date: firstBirthday(birth) },
    { label: '두 돌', date: addMonths(birth, 24) },
  ];
}
