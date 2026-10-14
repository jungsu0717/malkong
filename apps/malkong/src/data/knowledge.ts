/**
 * 지식 유닛 — L1·L2 가 공유하는 겉모양.
 *
 * 저장은 지금처럼 나눠 둔다(L1 은 번들 JSON, L2 는 기기 DB). 공통으로 두는 것은 **계약과 인터페이스**
 * 뿐이다 — 하나의 큰 저장소로 합치면 갱신 주기와 승인 규율이 서로 다른 것들이 엉킨다.
 *
 * 답변·화면이 두 층을 섞어 쓸 때는 이 모양으로 본다. 그래서 나중에 앱 사용법 지식 같은 것이
 * 늘어나도 소비하는 쪽을 고치지 않아도 된다.
 */

import type { KnowledgeItem } from './l1';
import type { BabyRecord } from './records';

/** 업종 일반의 참고(L1)인가, 우리 아기의 사실(L2)인가 — 규율이 이 축으로 갈린다 */
export type KnowledgeLayer = 'L1' | 'L2';

/** L1 은 지식의 성격, L2 는 사실인지 해석인지 */
export type UnitConfidence = '표준' | '권고' | '참고' | '기록' | '요약';

/** 이 유닛이 어디서 왔는가 — 근거를 댈 수 없는 유닛은 만들지 않는다 */
export type UnitOrigin =
  | { kind: '출처'; name: string; url: string; checked: string }
  | { kind: '대화'; messageId: string | null };

export type KnowledgeUnit = {
  id: string;
  layer: KnowledgeLayer;
  /** 접종·검진·발달… (L1) 또는 기록·요약 (L2) */
  kind: string;
  title: string;
  body?: string;
  origin: UnitOrigin;
  /** 언제의 것인가. L1 표준은 시점이 없다 */
  when: string | null;
  confidence: UnitConfidence;
  /** 낡았을 수 있는가 — L2 요약에만 뜻이 있다 */
  stale: boolean;
};

export function unitFromL1(item: KnowledgeItem): KnowledgeUnit {
  return {
    id: item.id,
    layer: 'L1',
    kind: item.kind,
    title: item.title,
    body: item.body,
    origin: {
      kind: '출처',
      name: item.source.name,
      url: item.source.url,
      checked: item.source.checked,
    },
    when: null,
    confidence: item.confidence,
    stale: false,
  };
}

export function unitFromRecord(record: BabyRecord): KnowledgeUnit {
  return {
    id: record.id,
    layer: 'L2',
    kind: record.kind,
    title: record.label,
    origin: { kind: '대화', messageId: record.sourceMessageId },
    when: record.whenLabel,
    confidence: record.kind,
    stale: record.stale,
  };
}
