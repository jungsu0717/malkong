/**
 * L1 지식베이스 — 번들에 실려 나가는 공공 지식.
 *
 * 분류별 JSON 을 모아 읽고, **사람이 승인한 항목만** 밖으로 내보낸다(의료 게이트).
 * 서버에 더 새 판이 있으면 승인된 항목 전부를 받아 여기에 바꿔 끼운다(knowledge-update.ts,
 * docs/architecture/api-contract.md 의 /v1/knowledge) — 받은 것도 번들과 같은 규칙으로 검사한다.
 */

import care from './care.json';
import checkup from './checkup.json';
import development from './development.json';
import parent from './parent.json';
import type { Confidence, KnowledgeItem, KnowledgeKind } from './types';
import vaccination from './vaccination.json';
import versionFile from './version.json';

export type { Confidence, KnowledgeItem, KnowledgeKind, ReviewStatus, SourceRef } from './types';

/** 번들 판 번호 — version.json 이 정본이다(서버 사본도 같은 파일). 항목을 고치면 올린다 */
export const L1_VERSION: string = versionFile.version;

const BUNDLED = [...vaccination, ...checkup, ...development, ...care, ...parent] as KnowledgeItem[];

const KINDS: KnowledgeKind[] = ['접종', '검진', '발달', '수유', '수면', '생활', '안전', '대응', '부모'];
const CONFIDENCES: Confidence[] = ['표준', '권고', '참고'];

/**
 * 항목이 규칙을 지키는지 본다. 번들은 개발 중에 돌려서 출처 없는 항목처럼 들어가면 안 되는 것이
 * 조용히 섞이는 일을 막고, 서버에서 받은 묶음은 받을 때마다 본다 (SPEC-ASK-01).
 */
export function findProblems(items: KnowledgeItem[]): string[] {
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

const isApproved = (item: KnowledgeItem) => item.status === 'approved';

/** 번들에서 승인된 항목만 */
const APPROVED = BUNDLED.filter(isApproved);

/** 지금 쓰는 지식 — 번들에서 시작하고, 더 새 판을 받으면 통째로 바뀐다. 화면·답변이 보는 것은 언제나 이 목록이다 */
let current: { version: string; items: KnowledgeItem[] } = { version: L1_VERSION, items: APPROVED };

/** 지금 쓰는 지식의 판 번호 — 번들 판이거나, 받아 둔 더 새 판 */
export function l1Version(): string {
  return current.version;
}

export function allItems(): KnowledgeItem[] {
  return current.items;
}

export function itemsForMonth(month: number): KnowledgeItem[] {
  return current.items.filter((item) => item.months.includes(month));
}

export function itemsOfKind(kind: KnowledgeKind, month?: number): KnowledgeItem[] {
  return current.items.filter(
    (item) => item.kind === kind && (month === undefined || item.months.includes(month)),
  );
}

/** 답변이 인용할 수 있는 것은 전달된 id 의 항목뿐이다 (menu-spec/ask.md 프롬프트 골격) */
export function itemById(id: string): KnowledgeItem | undefined {
  return current.items.find((item) => item.id === id);
}

/** 번들에서 승인 대기 중인 항목 수 — 구축 진행을 눈으로 보려고 둔다 */
export function pendingReviewCount(): number {
  return BUNDLED.length - APPROVED.length;
}

/** '2026.10.3' 꼴 — 숫자 토막을 점으로 이은 것 */
export function isValidVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)*$/.test(value);
}

/** 판 번호를 숫자 토막씩 비교한다. a 가 더 새 판이면 양수, 같으면 0 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 서버나 기기 저장소에서 온 것이 항목 모양을 갖췄는지 — 받은 것은 믿지 않고 하나하나 본다 */
export function isKnowledgeItems(value: unknown): value is KnowledgeItem[] {
  if (!Array.isArray(value)) return false;
  return value.every((raw) => {
    if (!raw || typeof raw !== 'object') return false;
    const item = raw as Record<string, unknown>;
    const source = item.source as Record<string, unknown> | undefined;
    return (
      typeof item.id === 'string' &&
      Array.isArray(item.months) &&
      item.months.every((m) => typeof m === 'number') &&
      typeof item.kind === 'string' &&
      typeof item.title === 'string' &&
      typeof item.body === 'string' &&
      !!source &&
      typeof source === 'object' &&
      typeof source.name === 'string' &&
      typeof source.url === 'string' &&
      typeof source.checked === 'string' &&
      CONFIDENCES.includes(item.confidence as Confidence) &&
      typeof item.red_flag === 'boolean' &&
      (item.status === 'approved' || item.status === 'draft')
    );
  });
}

/**
 * 받은 판을 지금 지식으로 삼는다 — 지금 판보다 새 것이고, 승인된 항목이 있고, 규칙에 어긋난 항목이 없을 때만.
 * 승인된 항목만 남긴다(의료 게이트는 앱에서도 지킨다). 돌려주는 값은 받아들였는지.
 */
export function applyBundle(version: string, items: KnowledgeItem[]): boolean {
  if (!isValidVersion(version) || compareVersion(version, current.version) <= 0) return false;
  const approved = items.filter(isApproved);
  if (approved.length === 0 || findProblems(approved).length > 0) return false;
  current = { version, items: approved };
  return true;
}
