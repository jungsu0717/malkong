/**
 * 하루 흐름의 자리와 선 (SPEC-MAIN-08, task today/017) — 화면 너비를 받아 묶음 틀 · 노드 · 선의 좌표를 계산한다.
 *
 * 묶음 틀 안에는 기록 노드가 시간순으로 한 줄에 놓이고, 넘치면 틀 안에서 다음 줄로 넘어간다.
 * 묶음과 묶음 사이 선은 오른쪽 끝으로 나가 내려온 뒤 왼쪽 끝으로 돌아 다음 틀의 첫 노드로 들어간다.
 * 그 가운데 가로선 위에 기록이 없던 시간 알약이나 잠 노드가 놓인다. 하루 첫머리의 잠이나 잇달은 잠은 틀 없는 한 줄이다.
 * 측정하지 않고 정해진 크기로 그린다 — 글자 길이가 달라도 자리가 흔들리지 않게. 화면 코드를 가져오지 않는 순수 함수(`node --test`).
 */

/** 묶음 안 노드의 크기 */
export const ITEM = 44;
/** 지금 점의 크기 */
export const DOT = 32;
/** 묶음 틀의 왼쪽 */
export const FX = 16;
/** 틀 위 글줄의 높이 */
export const HEAD = 44;
/** 모유를 재는 중일 때 틀 아래 단추 줄 */
export const BUTTONS = 52;
/** 자는 중인 지금 노드의 높이 */
export const SLEEP_NOW_H = 64;
/** 노드 아래 이름 두 줄(띄움 8 포함) */
const LABEL = 40;
/** 틀 안 줄과 줄 사이(줄 바꿈 선이 지나간다) */
const LINE_GAP = 14;
const PAD = 14;
const FIRST = 52;
/** 틀 없는 잠 줄의 첫 노드 — 이름이 넓어서 화면 끝에 닿지 않게 */
const SLEEP_FIRST = 76;
const COL = 70;
const SLEEP_COL = 120;
const FUT_COL = 96;
/** 틀 밖 선과 화면 끝 사이 */
const RAIL = 7;
const R = 14;
/** 틀 안 줄 바꿈 선 — 틀 테두리 안쪽 */
const IN = 8;
const IR = 6;
const LINK_H = { plain: 34, pill: 56, sleep: 120 } as const;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { cx: number; cy: number };
/** 노드 모양 — 네모(수유 · 루틴 · 할 일 · 체온 같은 것), 동그라미(기저귀), 지금 점 */
export type Shape = 'square' | 'circle' | 'dot';

export type PartSpec =
  /** 묶음 — now 면 코랄 틀, buttons 면 아래에 단추 줄 */
  | { type: 'box'; shapes: Shape[]; now?: boolean; buttons?: boolean }
  /** 틀 없이 잠 노드만 한 줄 */
  | { type: 'sleeps'; count: number }
  /** 지금 자는 중 — 먹색 넓은 노드 */
  | { type: 'sleepNow' };
/** 토막과 토막 사이 — 그냥 선, 기록이 없던 시간 알약, 잠 노드 하나 */
export type LinkSpec = keyof typeof LINK_H;

export type PartGeo = { frame: Rect; nodes: Point[] };
export type LinkGeo = { kind: LinkSpec; cx: number; cy: number };
export type FlowGeo = {
  chip: Rect | null;
  parts: PartGeo[];
  /** 토막 i 와 i+1 사이 */
  links: LinkGeo[];
  future: Point[];
  /** 지난 선(흐르는 점) · 지금 묶음 안의 코랄 선 · 앞으로 올 것의 점선 — SVG path */
  edges: { past: string; now: string; future: string };
  height: number;
};

export type LayoutInput = { width: number; chip: boolean; parts: PartSpec[]; links: LinkSpec[]; future: number };

const r = (n: number) => Math.round(n * 10) / 10;
const half = (s: Shape) => (s === 'dot' ? DOT / 2 : s === 'circle' ? 21 : ITEM / 2);

/** 한 줄에 놓을 수 있는 노드 수 */
export function perLine(width: number, col = COL, labelHalf = 0): number {
  return Math.max(1, Math.floor((width - FIRST - Math.max(FIRST, labelHalf + 8)) / col) + 1);
}

/** 화면 끝 선 — 오른쪽으로 나가 mid 높이에서 왼쪽 끝으로 돌아 (x2, y2) 로 들어간다 */
export function railPath(width: number, x1: number, y1: number, x2: number, y2: number, mid: number): string {
  const RR = width - RAIL;
  const RL = RAIL;
  return (
    `M${r(x1)} ${r(y1)}H${RR - R}Q${RR} ${r(y1)} ${RR} ${r(y1 + R)}V${r(mid - R)}Q${RR} ${r(mid)} ${RR - R} ${r(mid)}` +
    `H${RL + R}Q${RL} ${r(mid)} ${RL} ${r(mid + R)}V${r(y2 - R)}Q${RL} ${r(y2)} ${RL + R} ${r(y2)}H${r(x2)}`
  );
}

/** 틀 안 줄 바꿈 — 틀 테두리 안쪽으로 돈다 */
function innerWrap(width: number, x1: number, y1: number, x2: number, y2: number, mid: number): string {
  const A = width - FX - IN;
  const B = FX + IN;
  return (
    `M${r(x1)} ${r(y1)}H${A - IR}Q${A} ${r(y1)} ${A} ${r(y1 + IR)}V${r(mid - IR)}Q${A} ${r(mid)} ${A - IR} ${r(mid)}` +
    `H${B + IR}Q${B} ${r(mid)} ${B} ${r(mid + IR)}V${r(y2 - IR)}Q${B} ${r(y2)} ${B + IR} ${r(y2)}H${r(x2)}`
  );
}

/** 노드를 줄지어 놓고 그 사이 선을 잇는다 — 묶음 틀 안, 틀 없는 잠 줄, 앞으로 올 것이 같이 쓴다 */
function rowNodes(
  width: number,
  top: number,
  shapes: Shape[],
  col: number,
  per: number,
  wrap: 'inner' | 'outer',
  first = FIRST,
): { nodes: Point[]; path: string; lines: number } {
  const step = ITEM + LABEL + LINE_GAP;
  const nodes = shapes.map((_, k) => ({ cx: first + (k % per) * col, cy: top + ITEM / 2 + Math.floor(k / per) * step }));
  let path = '';
  for (let k = 1; k < nodes.length; k++) {
    const a = nodes[k - 1];
    const b = nodes[k];
    const x1 = a.cx + half(shapes[k - 1]);
    const x2 = b.cx - half(shapes[k]);
    if (a.cy === b.cy) path += `M${r(x1)} ${r(a.cy)}H${r(x2)}`;
    else {
      const mid = a.cy + ITEM / 2 + LABEL + LINE_GAP / 2;
      path += wrap === 'inner' ? innerWrap(width, x1, a.cy, x2, b.cy, mid) : railPath(width, x1, a.cy, x2, b.cy, mid);
    }
  }
  return { nodes, path, lines: Math.max(1, Math.ceil(shapes.length / per)) };
}

export function flowLayout({ width, chip, parts, links, future }: LayoutInput): FlowGeo {
  const past: string[] = [];
  const nowEdges: string[] = [];
  const dashed: string[] = [];
  const W = width - FX * 2;
  const chipRect: Rect | null = chip ? { x: 30, y: 12, w: 132, h: 32 } : null;
  let y = chip ? 64 : 12;

  type Placed = PartGeo & { enter: { x: number; y: number }; exit: { x: number; y: number } };
  const placed: Placed[] = [];
  const geoLinks: LinkGeo[] = [];

  parts.forEach((part, i) => {
    if (i > 0) {
      const kind = links[i - 1] ?? 'plain';
      const prev = placed[i - 1];
      const bottom = prev.frame.y + prev.frame.h;
      geoLinks.push({ kind, cx: width / 2, cy: bottom + LINK_H[kind] / 2 });
      y = bottom + LINK_H[kind];
    }
    let p: Placed;
    if (part.type === 'box') {
      const per = perLine(width);
      const row = rowNodes(width, y + HEAD, part.shapes, COL, per, 'inner');
      const h = HEAD + row.lines * (ITEM + LABEL) + (row.lines - 1) * LINE_GAP + PAD + (part.buttons ? BUTTONS : 0);
      (part.now ? nowEdges : past).push(row.path);
      const first = row.nodes[0];
      const last = row.nodes[row.nodes.length - 1];
      p = {
        frame: { x: FX, y, w: W, h },
        nodes: row.nodes,
        enter: first ? { x: first.cx - half(part.shapes[0]), y: first.cy } : { x: FX, y: y + HEAD },
        exit: last ? { x: last.cx + half(part.shapes[part.shapes.length - 1]), y: last.cy } : { x: FX + W, y: y + HEAD },
      };
    } else if (part.type === 'sleeps') {
      const shapes: Shape[] = Array.from({ length: part.count }, () => 'square');
      const row = rowNodes(width, y, shapes, SLEEP_COL, perLine(width - (SLEEP_FIRST - FIRST), SLEEP_COL, 58), 'outer', SLEEP_FIRST);
      past.push(row.path);
      const h = row.lines * (ITEM + LABEL) + (row.lines - 1) * LINE_GAP;
      const last = row.nodes[row.nodes.length - 1];
      p = {
        frame: { x: FX, y, w: W, h },
        nodes: row.nodes,
        enter: { x: row.nodes[0].cx - ITEM / 2, y: row.nodes[0].cy },
        exit: { x: last.cx + ITEM / 2, y: last.cy },
      };
    } else {
      const cy = y + SLEEP_NOW_H / 2;
      p = { frame: { x: FX, y, w: W, h: SLEEP_NOW_H }, nodes: [], enter: { x: FX, y: cy }, exit: { x: FX + W, y: cy } };
    }
    if (i > 0) {
      const prev = placed[i - 1];
      past.push(railPath(width, prev.exit.x, prev.exit.y, p.enter.x, p.enter.y, geoLinks[i - 1].cy));
    } else if (chipRect) {
      const cy = chipRect.y + chipRect.h / 2;
      past.push(`M${chipRect.x} ${cy}H${RAIL + R}Q${RAIL} ${cy} ${RAIL} ${cy + R}V${r(p.enter.y - R)}Q${RAIL} ${r(p.enter.y)} ${RAIL + R} ${r(p.enter.y)}H${r(p.enter.x)}`);
    }
    placed.push(p);
  });

  // 앞으로 올 것 — 흐린 네모가 한 줄에 넷쯤
  const lastPart = placed[placed.length - 1];
  let fut: Point[] = [];
  let height = lastPart ? lastPart.frame.y + lastPart.frame.h + 24 : y;
  if (future > 0) {
    const top = lastPart ? lastPart.frame.y + lastPart.frame.h + LINK_H.plain : y;
    const shapes: Shape[] = Array.from({ length: future }, () => 'square');
    const row = rowNodes(width, top, shapes, FUT_COL, perLine(width, FUT_COL, 46), 'outer');
    fut = row.nodes;
    if (lastPart) dashed.push(railPath(width, lastPart.exit.x, lastPart.exit.y, fut[0].cx - ITEM / 2, fut[0].cy, top - LINK_H.plain / 2));
    dashed.push(row.path);
    height = fut[fut.length - 1].cy + ITEM / 2 + LABEL + 24;
  }

  return {
    chip: chipRect,
    parts: placed.map(({ frame, nodes }) => ({ frame, nodes })),
    links: geoLinks,
    future: fut,
    edges: { past: past.join(''), now: nowEdges.join(''), future: dashed.join('') },
    height,
  };
}
