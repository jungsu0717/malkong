/**
 * L1 지식베이스 — 번들에 실려 나가는 공공 지식.
 *
 * 분류별 JSON 을 모아 읽고, **사람이 승인한 항목만** 밖으로 내보낸다(의료 게이트).
 * 나중에 서버에서 받은 갱신분을 얹을 자리도 여기다 — 같은 모양이라 병합만 하면 된다
 * (docs/architecture/api-contract.md 의 /v1/knowledge/bundle).
 */

import care from './care.json';
import checkup from './checkup.json';
import development from './development.json';
import type { KnowledgeItem, KnowledgeKind } from './types';
import vaccination from './vaccination.json';

export type { Confidence, KnowledgeItem, KnowledgeKind, ReviewStatus, SourceRef } from './types';

/** 번들 판 번호. 항목을 고치면 올리고, 서버의 최신 판과 비교해 갱신받는다 */
export const L1_VERSION = '2026.10.1';

const BUNDLED = [...vaccination, ...checkup, ...development, ...care] as KnowledgeItem[];

const KINDS: KnowledgeKind[] = ['접종', '검진', '발달', '수유', '수면', '생활', '안전', '대응'];

/**
 * 항목이 규칙을 지키는지 본다. 개발 중에만 돌려서, 출처 없는 항목처럼 들어가면 안 되는 것이
 * 조용히 섞이는 일을 막는다 (SPEC-ASK-01).
 */
function findProblems(items: KnowledgeItem[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const where = item.id || '(id 없음)';
    if (!item.id) problems.push('id 가 없는 항목이 있다');
    if (seen.has(item.id)) problems.push(`${where}: id 가 겹친다`);
    seen.add(item.id);

    if (!item.months?.length) problems.push(`${where}: months 가 비어 있다`);
    if (!KINDS.includes(item.kind)) problems.push(`${where}: 모르는 분류 ${item.kind}`);
    if (!item.title?.trim()) problems.push(`${where}: title 이 비어 있다`);
    if (!item.body?.trim()) problems.push(`${where}: body 가 비어 있다`);
    // 출처 없는 항목은 만들 수 없다 — 이 규칙만은 예외를 두지 않는다
    if (!item.source?.name || !item.source?.url || !item.source?.checked) {
      problems.push(`${where}: source(name·url·checked)가 갖춰지지 않았다`);
    }
  }
  return problems;
}

if (__DEV__) {
  const problems = findProblems(BUNDLED);
  if (problems.length > 0) {
    console.warn(`[L1] 항목에 문제가 있어요\n- ${problems.join('\n- ')}`);
  }
}

/** 승인된 항목만. 화면·답변이 보는 것은 언제나 이 목록이다 */
const APPROVED = BUNDLED.filter((item) => item.status === 'approved');

export function allItems(): KnowledgeItem[] {
  return APPROVED;
}

export function itemsForMonth(month: number): KnowledgeItem[] {
  return APPROVED.filter((item) => item.months.includes(month));
}

export function itemsOfKind(kind: KnowledgeKind, month?: number): KnowledgeItem[] {
  return APPROVED.filter(
    (item) => item.kind === kind && (month === undefined || item.months.includes(month)),
  );
}

/** 답변이 인용할 수 있는 것은 전달된 id 의 항목뿐이다 (menu-spec/ask.md 프롬프트 골격) */
export function itemById(id: string): KnowledgeItem | undefined {
  return APPROVED.find((item) => item.id === id);
}

/** 승인 대기 중인 항목 수 — 구축 진행을 눈으로 보려고 둔다 */
export function pendingReviewCount(): number {
  return BUNDLED.length - APPROVED.length;
}
