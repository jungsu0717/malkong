/**
 * 지식층 모형 (목업 데이터).
 *
 * 겉으로 보이는 층은 둘 — L1(공공 지식) · L2(우리 아기 지식).
 * L2는 안쪽에서 다시 둘로 나눈다:
 *   - 기록: 관찰된 사실 (정정 가능, 답변의 근거로 안전)
 *   - 요약: 질의에서 추출한 해석 (낡을 수 있어 시점이 붙는다)
 * 사실과 해석을 한 칸에 섞으면 반드시 한쪽이 낡는다.
 */

export type L1Kind = '접종' | '검진' | '발달' | '생활';
export type L1Item = { kind: L1Kind; label: string };

export type L2Kind = '기록' | '요약';
export type L2Item = {
  kind: L2Kind;
  label: string;
  when?: string;
  /** 이 기록이 완료 처리하는 L1 항목 라벨 (표준 대비 빠진 것 계산에 쓴다) */
  covers?: string;
};

export type MonthData = {
  month: number;
  headline: string;
  l1: L1Item[];
  l2: L2Item[];
};

/** 해당 월의 표준 데이터 — 목업 범위(0~6개월)를 벗어나면 없다 */
export function monthData(month: number): MonthData | undefined {
  return TIMELINE.find((m) => m.month === month);
}

/** 표준(L1) 대비 우리 아기 기록(L2)의 차집합 — 홈의 추천이 여기서 나온다 */
export function getGaps(currentMonth: number) {
  const missed: { month: number; item: L1Item }[] = [];
  const upcoming: { month: number; item: L1Item }[] = [];

  for (const m of TIMELINE) {
    if (m.month > currentMonth + 1) continue;
    for (const item of m.l1) {
      if (item.kind !== '접종' && item.kind !== '검진') continue;
      const covered = m.l2.some((r) => r.covers === item.label);
      if (covered) continue;
      if (m.month < currentMonth) missed.push({ month: m.month, item });
      else upcoming.push({ month: m.month, item });
    }
  }
  return { missed, upcoming };
}

export const TIMELINE: MonthData[] = [
  {
    month: 0,
    headline: '세상에 온 첫 달',
    l1: [
      { kind: '접종', label: 'BCG · B형간염 1차' },
      { kind: '검진', label: '선천성 대사이상 검사' },
      { kind: '생활', label: '2~3시간 간격 수유' },
    ],
    l2: [
      { kind: '기록', label: '3.2kg 출생 · 자연분만', when: 'D+0' },
      { kind: '기록', label: 'BCG · B형간염 1차 접종 완료', when: 'D+1', covers: 'BCG · B형간염 1차' },
    ],
  },
  {
    month: 1,
    headline: '낮밤이 없는 시기',
    l1: [
      { kind: '접종', label: 'B형간염 2차' },
      { kind: '검진', label: '영유아 건강검진 1차 (14~35일)' },
      { kind: '발달', label: '소리에 반응 · 엎드려 고개 잠깐 들기' },
    ],
    l2: [
      {
        kind: '기록',
        label: '건강검진 1차 완료 — 이상 없음',
        when: 'D+21',
        covers: '영유아 건강검진 1차 (14~35일)',
      },
      { kind: '요약', label: '밤중 수유 3회, 등센서 있는 편', when: 'D+28 질문에서' },
    ],
  },
  {
    month: 2,
    headline: '첫 사회적 미소',
    l1: [
      { kind: '접종', label: 'DTaP·폴리오·폐렴구균·로타 1차' },
      { kind: '발달', label: '사람 얼굴 보고 웃기 · 옹알이 시작' },
      { kind: '생활', label: '낮밤 구분 루틴 시작' },
    ],
    l2: [
      {
        kind: '기록',
        label: '1차 접종 완료 · 접종 후 미열 하루',
        when: 'D+61',
        covers: 'DTaP·폴리오·폐렴구균·로타 1차',
      },
      { kind: '요약', label: '분유량 갑자기 줄어 걱정 → 급성장기로 판단', when: 'D+70 질문에서' },
    ],
  },
  {
    month: 3,
    headline: '목을 가누기 시작',
    l1: [
      { kind: '발달', label: '엎드려 고개 45~90도 · 손 뻗기' },
      { kind: '생활', label: '터미타임 하루 3번' },
      { kind: '접종', label: '다음 달 2차 접종 준비' },
    ],
    l2: [
      { kind: '기록', label: '몸무게 6.4kg (50~75 백분위)', when: 'D+85' },
      { kind: '요약', label: '밤중 수유 2회로 줄음 — 수면 흐름 좋아지는 중', when: 'D+86 질문에서' },
    ],
  },
  {
    month: 4,
    headline: '뒤집기 연습의 달',
    l1: [
      { kind: '접종', label: 'DTaP·폴리오·폐렴구균·로타 2차' },
      { kind: '검진', label: '영유아 건강검진 2차 (4~6개월)' },
      { kind: '발달', label: '뒤집기 시도 · 소리내어 웃기' },
    ],
    l2: [],
  },
  {
    month: 5,
    headline: '이유식 준비',
    l1: [
      { kind: '생활', label: '이유식 준비 — 알레르기 가족력 확인' },
      { kind: '발달', label: '장난감 손으로 옮겨 잡기' },
    ],
    l2: [],
  },
  {
    month: 6,
    headline: '앉기와 이유식 시작',
    l1: [
      { kind: '접종', label: 'DTaP·폴리오 3차 · B형간염 3차' },
      { kind: '생활', label: '이유식 시작 (쌀미음부터)' },
      { kind: '발달', label: '받쳐 주면 앉기 · 낯가림 시작' },
    ],
    l2: [],
  },
];
