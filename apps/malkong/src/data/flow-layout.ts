/**
 * 하루 흐름의 자리와 선 (SPEC-MAIN-08, task today/014) — 화면 너비를 받아 노드 좌표와 선 모양을 계산한다.
 *
 * 한 줄에 잠 네모 하나와 그 뒤 넓은 노드 하나가 놓이고, 넓은 노드 아래로 그 사이 기록이 점선으로 갈라진다(n8n 의 에이전트처럼).
 * 줄 끝에서 선이 오른쪽으로 돌아 다음 줄 왼쪽으로 넘어간다. 앞으로 올 것은 맨 아래에 흐린 네모로 줄지어 놓는다.
 * 측정하지 않고 정해진 크기로 그린다 — 글자 길이가 달라도 자리가 흔들리지 않게. 화면 코드를 가져오지 않는 순수 함수(`node --test`).
 */

export const SQ = 56;
const LEFT = 28;
const RIGHT = 44;
/** 잠 네모와 넓은 노드 사이 */
const GAP = 40;
/** 갈라진 기록 동그라미의 지름과 간격 */
export const SUB = 40;
const SUB_STEP = 60;
/** 노드 아래 이름 두 줄의 높이 */
const LABEL = 38;
/** 앞으로 올 것 네모 사이 */
const FUTURE_STEP = 108;

export type Rect = { x: number; y: number; w: number; h: number };

export type LayoutRow = {
  /** 잠 — past 는 네모, now 는 지금 자는 중이라 넓게 */
  sleep: 'past' | 'now' | null;
  /** 잠과 잠 사이 — now 는 지금 노드 */
  wake: 'past' | 'now' | null;
  /** 지금 노드에 단추 줄이 붙는가(모유를 재는 중) */
  tall?: boolean;
  /** 갈라진 기록 수를 묶음마다(수유 · 기저귀와 그 밖 · 루틴과 할 일) — 묶음마다 포트 하나 */
  groups: number[];
};

export type RowGeo = {
  sleep: Rect | null;
  wake: Rect | null;
  /** 묶음마다 포트(넓은 노드 바닥) */
  ports: { x: number; y: number }[];
  /** 갈라진 기록 — 묶음 순서대로 */
  subs: { cx: number; cy: number; group: number }[];
};

export type FlowGeo = {
  chip: Rect | null;
  rows: RowGeo[];
  future: Rect[];
  /** 지난 선(흐르는 점) · 지금으로 들어오는 선(코랄) · 갈라지는 점선 · 앞으로 올 것의 점선 — SVG path */
  edges: { past: string; now: string; fans: string; future: string };
  height: number;
};

export type LayoutInput = { width: number; chip: boolean; rows: LayoutRow[]; future: number };

const r = (n: number) => Math.round(n * 10) / 10;

/** 줄 끝에서 오른쪽으로 돌아 아래 줄 왼쪽으로 — mid 는 가로로 지나가는 높이 */
export function wrapPath(x1: number, y1: number, x2: number, y2: number, mid: number): string {
  return `M${r(x1)} ${r(y1)}C${r(x1 + 30)} ${r(y1)} ${r(x1 + 32)} ${r(mid)} ${r(x1 - 6)} ${r(mid)}L${r(x2 + 18)} ${r(mid)}C${r(x2 - 22)} ${r(mid)} ${r(x2 - 22)} ${r(y2)} ${r(x2)} ${r(y2)}`;
}

export function flowLayout({ width, chip, rows, future }: LayoutInput): FlowGeo {
  const past: string[] = [];
  const nowEdges: string[] = [];
  const fans: string[] = [];
  const dashed: string[] = [];
  const perLine = Math.max(3, Math.floor((width - 52 - RIGHT + SUB_STEP) / SUB_STEP));

  const chipRect: Rect | null = chip ? { x: LEFT, y: 12, w: 132, h: 32 } : null;
  let y = chip ? 64 : 12;
  /** 앞 줄의 끝 — 다음 줄로 넘어갈 선의 출발점 */
  let tail: { x: number; y: number; mid: number } | null = null;
  const geos: RowGeo[] = [];

  rows.forEach((row) => {
    const wakeH = row.wake === 'now' ? (row.tall ? 112 : 64) : SQ;
    const tallTop = row.wake === 'now' || row.sleep === 'now';
    // 잠 네모는 넓은 노드의 윗부분에 맞춘다 — 선이 곧게 이어지게
    const sleepRect: Rect | null =
      row.sleep === 'past' ? { x: LEFT, y: y + (tallTop ? 4 : 0), w: SQ, h: SQ } : row.sleep === 'now' ? { x: LEFT, y, w: width - LEFT - RIGHT, h: 64 } : null;
    const portY = sleepRect ? sleepRect.y + Math.min(sleepRect.h, 64) / 2 : y + Math.min(wakeH, 64) / 2;
    const wakeX = row.sleep === 'past' ? LEFT + SQ + GAP : LEFT;
    const wakeRect: Rect | null = row.wake ? { x: wakeX, y: row.wake === 'now' && row.sleep === 'past' ? sleepRect!.y - 4 : y, w: width - wakeX - RIGHT, h: wakeH } : null;
    const into = row.sleep === 'now' || (row.wake === 'now' && !row.sleep) ? nowEdges : past;

    // 앞 줄에서 넘어오는 선, 또는 접힌 이전 기록에서
    if (tail) into.push(wrapPath(tail.x, tail.y, LEFT, portY, tail.mid));
    else if (chipRect) past.push(`M${LEFT} ${chipRect.y + 16}C${LEFT - 22} ${chipRect.y + 16} ${LEFT - 22} ${r(portY)} ${LEFT} ${r(portY)}`);
    // 잠 → 잠과 잠 사이
    if (sleepRect && wakeRect) (row.wake === 'now' ? nowEdges : past).push(`M${LEFT + SQ} ${r(portY)}H${wakeRect.x}`);

    // 갈라진 기록
    const subs: RowGeo['subs'] = [];
    const ports: RowGeo['ports'] = [];
    const nodeBottom = wakeRect ? wakeRect.y + wakeRect.h : sleepRect ? sleepRect.y + sleepRect.h : y;
    let i = 0;
    row.groups.forEach((n, g) => {
      const mine: { cx: number; cy: number; group: number }[] = [];
      for (let k = 0; k < n; k++, i++) {
        const line = Math.floor(i / perLine);
        mine.push({ cx: 52 + (i % perLine) * SUB_STEP, cy: nodeBottom + 96 + line * 76, group: g });
      }
      subs.push(...mine);
      if (wakeRect && mine.length > 0) {
        const avg = mine.reduce((s, m) => s + m.cx, 0) / mine.length;
        const px = Math.min(Math.max(avg, wakeRect.x + 22), wakeRect.x + wakeRect.w - 22);
        ports.push({ x: r(px), y: nodeBottom });
        for (const m of mine) {
          fans.push(`M${r(px)} ${nodeBottom}V${nodeBottom + 40}C${r(px)} ${nodeBottom + 66} ${m.cx} ${m.cy - 52} ${m.cx} ${m.cy - 20}`);
        }
      }
    });

    const labelBottom = sleepRect && row.sleep === 'past' ? sleepRect.y + SQ + LABEL : 0;
    const subBottom = subs.length ? subs[subs.length - 1].cy + 56 : 0;
    const bottom = Math.max(nodeBottom, labelBottom, subBottom);
    const last = wakeRect ?? sleepRect!;
    tail = { x: last.x + last.w, y: portY, mid: bottom + 16 };
    geos.push({ sleep: sleepRect, wake: wakeRect, ports, subs });
    y = bottom + 32;
  });

  // 앞으로 올 것 — 흐린 네모, 한 줄에 셋쯤
  const perRow = Math.max(2, Math.floor((width - LEFT - 16 + 52) / FUTURE_STEP));
  const fut: Rect[] = [];
  for (let k = 0; k < future; k++) {
    const col = k % perRow;
    if (col === 0 && k > 0) y += SQ + LABEL + 32;
    fut.push({ x: LEFT + col * FUTURE_STEP, y, w: SQ, h: SQ });
  }
  fut.forEach((f, k) => {
    const cy = f.y + SQ / 2;
    if (k === 0) {
      if (tail) dashed.push(wrapPath(tail.x, tail.y, LEFT, cy, tail.mid));
    } else if (k % perRow === 0) {
      const prev = fut[k - 1];
      dashed.push(wrapPath(prev.x + SQ, prev.y + SQ / 2, LEFT, cy, prev.y + SQ + LABEL + 16));
    } else {
      dashed.push(`M${fut[k - 1].x + SQ} ${cy}H${f.x}`);
    }
  });
  const height = fut.length ? fut[fut.length - 1].y + SQ + LABEL + 24 : y;

  return { chip: chipRect, rows: geos, future: fut, edges: { past: past.join(''), now: nowEdges.join(''), fans: fans.join(''), future: dashed.join('') }, height };
}
