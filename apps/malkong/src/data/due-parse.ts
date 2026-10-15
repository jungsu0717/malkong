/**
 * 할 일 한 줄에서 날짜와 시각을 읽는다 (SPEC-TOPIC-03) — 모델 없이 규칙으로.
 *
 * 날짜: 「오늘」 「내일」 「모레」, 「금요일」(오늘 포함 다가오는 그 요일), 「이번 주 / 다음 주 월요일」(월요일이 한 주의 시작),
 * 「10/20」 「10월 20일」(지났으면 내년), 「20일」(지났으면 다음 달).
 * 시각: 「오전 10시」 「오후 3시 30분」 「저녁 8시」 「1시 반」 「10:30」. 오전 · 오후가 없고 7시 전이면 오후로 본다(「3시」는 보통 15시).
 * 읽은 말은 제목에서 뺀다. 시각이 있으면 알림 시각도 된다. 날짜만 있으면 그날 0시를 기한으로 두고 알림은 없다.
 * 시각만 있으면 오늘, 이미 지났으면 내일이다.
 *
 * 이 파일은 다른 모듈을 가져오지 않는다 — `node --test` 로 바로 시험한다(due-parse.test.ts).
 */

export type ParsedDue = {
  /** 날짜 · 시각 말을 뺀 제목. 다 빼고 남는 게 없으면 처음 글 그대로 */
  title: string;
  /** 기한 — 시각이 없으면 그날 0시 */
  dueAt: Date | null;
  hasTime: boolean;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 읽은 말 뒤에 붙는 조사 — 함께 뺀다 */
const TAIL = '(?:에는|에|까지|쯤)?';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** 월요일이 0 인 요일 번호 */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function parseDue(input: string, now = new Date()): ParsedDue {
  const today = startOfDay(now);
  let text = ` ${input} `;
  let day: Date | null = null;
  let time: { h: number; m: number } | null = null;

  /** 처음 맞는 곳을 읽고 그 말을 글에서 뺀다 */
  const take = (pattern: RegExp, read: (m: RegExpExecArray) => void): boolean => {
    const m = pattern.exec(text);
    if (!m) return false;
    read(m);
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return true;
  };

  // --- 날짜 (먼저 맞은 하나만) ---
  const dated =
    take(new RegExp(`(다음|이번)\\s*주\\s*([월화수목금토일])요일${TAIL}`), (m) => {
      const monday = addDays(today, -mondayIndex(today) + (m[1] === '다음' ? 7 : 0));
      day = addDays(monday, (WEEKDAYS.indexOf(m[2]) + 6) % 7);
    }) ||
    take(new RegExp(`([월화수목금토일])요일${TAIL}`), (m) => {
      day = addDays(today, (WEEKDAYS.indexOf(m[1]) - today.getDay() + 7) % 7);
    }) ||
    take(new RegExp(`(오늘|내일|모레)${TAIL}`), (m) => {
      day = addDays(today, { 오늘: 0, 내일: 1, 모레: 2 }[m[1] as '오늘' | '내일' | '모레']);
    }) ||
    take(new RegExp(`(\\d{1,2})\\s*/\\s*(\\d{1,2})${TAIL}`), (m) => {
      day = monthDay(today, Number(m[1]), Number(m[2]));
    }) ||
    take(new RegExp(`(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${TAIL}`), (m) => {
      day = monthDay(today, Number(m[1]), Number(m[2]));
    }) ||
    take(new RegExp(`\\s(\\d{1,2})일${TAIL}(?=\\s)(?!\\s*(?:치|분량|간|째|마다|동안))`), (m) => {
      const n = Number(m[1]);
      if (n < 1 || n > 31) return;
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), n);
      day = thisMonth < today ? new Date(today.getFullYear(), today.getMonth() + 1, n) : thisMonth;
    });

  // --- 시각 ---
  take(new RegExp(`(오전|오후|아침|저녁|밤|새벽|낮)?\\s*(\\d{1,2})\\s*시(?:\\s*(\\d{1,2})\\s*분|\\s*(반))?${TAIL}`), (m) => {
    let h = Number(m[2]);
    const minutes = m[3] ? Number(m[3]) : m[4] ? 30 : 0;
    const marker = m[1];
    if (h > 24 || minutes > 59) return;
    if (marker === '오후' || marker === '저녁' || marker === '밤') {
      if (h < 12) h += 12;
    } else if (marker === '낮') {
      if (h < 7) h += 12;
    } else if (marker === '오전' || marker === '아침' || marker === '새벽') {
      if (h === 12) h = 0;
    } else if (h < 7) {
      h += 12;
    }
    time = { h: h % 24, m: minutes };
  }) ||
    take(new RegExp(`(\\d{1,2}):(\\d{2})${TAIL}`), (m) => {
      const h = Number(m[1]);
      const minutes = Number(m[2]);
      if (h > 23 || minutes > 59) return;
      time = { h, m: minutes };
    });

  const title = text.replace(/\s+/g, ' ').trim() || input.trim();
  if (!dated && !time) return { title: input.trim(), dueAt: null, hasTime: false };

  const t = time as { h: number; m: number } | null;
  if (t) {
    const base: Date = day ?? today;
    let at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), t.h, t.m);
    if (!day && at <= now) at = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, t.h, t.m);
    return { title, dueAt: at, hasTime: true };
  }
  return { title, dueAt: day, hasTime: false };
}

/** 그해의 그날 — 이미 지났으면 내년 */
function monthDay(today: Date, month: number, date: number): Date | null {
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  const thisYear = new Date(today.getFullYear(), month - 1, date);
  return thisYear < today ? new Date(today.getFullYear() + 1, month - 1, date) : thisYear;
}

/** 할 일 줄에 보이는 기한 — 「오늘」 「내일 10:00」 「10월 20일 (화)」 */
export function dueLabel(dueAt: Date, hasTime: boolean, now = new Date()): string {
  const diff = Math.round((startOfDay(dueAt).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const dayText =
    diff === 0
      ? '오늘'
      : diff === 1
        ? '내일'
        : diff === 2
          ? '모레'
          : diff === -1
            ? '어제'
            : `${dueAt.getMonth() + 1}월 ${dueAt.getDate()}일 (${WEEKDAYS[dueAt.getDay()]})`;
  if (!hasTime) return dayText;
  const hh = String(dueAt.getHours()).padStart(2, '0');
  const mm = String(dueAt.getMinutes()).padStart(2, '0');
  return `${dayText} ${hh}:${mm}`;
}
