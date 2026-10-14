/**
 * L1 지식 항목의 모양.
 *
 * 스키마 정본은 docs/architecture/l1-knowledge-base.md 다. 여기 타입은 그 문서를 따라가며,
 * 서버가 내려주는 갱신 묶음도 같은 모양이다(docs/architecture/api-contract.md).
 * 필드 이름을 문서와 맞추려고 `red_flag` 만 snake_case 를 그대로 쓴다.
 */

/** 분류 — 항목 id 의 가운데 토막과 짝을 이룬다 */
export type KnowledgeKind =
  | '접종'
  | '검진'
  | '발달'
  | '수유'
  | '수면'
  | '생활'
  | '안전'
  | '대응'
  /** 부모 돌봄 — 부모의 잠 · 끼니 · 마음(데일리 브리핑 부모 안부, task common/013) */
  | '부모';

/** 표준(일정·기준) · 권고(가이드라인) · 참고(일반 정보) */
export type Confidence = '표준' | '권고' | '참고';

/**
 * 의료 게이트. 사람(Julian)이 검토하기 전에는 draft 이고, 로더가 걸러내 화면에 나가지 않는다.
 * 절차를 사람의 기억이 아니라 코드가 지키게 하려고 둔 필드다.
 */
export type ReviewStatus = 'draft' | 'approved';

export type SourceRef = {
  /** 출처 이름 — 화이트리스트 안이어야 한다 */
  name: string;
  url: string;
  /** 원문을 마지막으로 확인한 날 (YYYY-MM-DD) */
  checked: string;
};

export type KnowledgeItem = {
  /** `k-<분류>-<월령 2자리><순번>` 예: k-vacc-0401 */
  id: string;
  /** 해당 월령. 여러 달에 걸치면 모두 적는다 */
  months: number[];
  kind: KnowledgeKind;
  title: string;
  /** 원문을 복제하지 않은 재서술. 수치·기준은 출처 그대로 */
  body: string;
  source: SourceRef;
  confidence: Confidence;
  /** 위험 신호 항목이면 true — 검수를 한 번 더 받는다 */
  red_flag: boolean;
  status: ReviewStatus;
};
