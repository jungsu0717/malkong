/**
 * 버디가 묻는 짧은 질문 하나 — 고르거나 직접 적으면 기기 안의 기록(L2) 한 줄이 된다. 모델을 부르지 않는다.
 * 우리 아기 탭의 하루 기록(`daily-log.ts`)과 「알려 주기」(`knowledge-profile.ts`)가 같은 모양을 쓴다 —
 * 그리는 것은 `ask-sheet.tsx`.
 */

export type QuickAsk = {
  /** 시트 머리 — 묻는 말 */
  title: string;
  /** 머리 아래 한 줄 — 왜 묻는지, 어떻게 적으면 되는지 */
  hint: string;
  /** 숫자로 받을 때의 단위 — 없으면 고르거나 글로 적는다 */
  unit: 'ml' | '시간' | 'kg' | 'cm' | '도' | null;
  placeholder: string;
  /** 눌러서 고르는 답 — 숫자면 값만(「3」), 글이면 그대로 기록에 들어갈 말 */
  options: string[];
  /** 저장할 기록 문구 */
  label: (value: string, today: Date) => string;
};

export const monthDay = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
