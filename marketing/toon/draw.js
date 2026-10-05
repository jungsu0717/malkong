/*
 * 육아버디 홍보 만화 — 손그림 느낌의 선 그림 도구 (docs/product/store-toon.md).
 * 그림은 모두 SVG 문자열로 만들고, 글자는 HTML 로 얹는다. 캔버스는 1080×1350(인스타 4:5).
 */

(() => {
const K = '#1b1b1b';
const S = (w = 5, fill = 'none', stroke = K) =>
  `fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const P = (d, w = 5, fill = 'none', stroke = K) => `<path d="${d}" ${S(w, fill, stroke)}/>`;
const C = (x, y, r, w = 5, fill = 'none', stroke = K) => `<circle cx="${x}" cy="${y}" r="${r}" ${S(w, fill, stroke)}/>`;
const DOT = (x, y, r, fill = K) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const G = (x, y, s, inner, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${inner}</g>`;
/** 테두리 굵게 먼저 → 칠하기. 여러 모양을 이렇게 겹치면 바깥 테두리만 남아 한 덩어리로 보인다 */
const OUTLINE = `fill="none" stroke="${K}" stroke-width="10" stroke-linejoin="round"`;

/** 굵기가 같은 관 — 굵은 검은 선 위에 조금 가는 선을 겹쳐 테두리 있는 관처럼(돋보기 손잡이 · 아기띠) */
function limb(d, w = 54, fill = '#fff') {
  return `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 10}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
}

/* ───────── 팔 · 손 ─────────
 * 팔은 어깨 → 팔꿈치 → 손목 두 마디다. 손목으로 갈수록 가늘고 팔꿈치는 둥글다.
 * 반팔 소매는 몸통과 한 덩어리로 그린다: 목에서 내려온 어깨 선이 끊김 없이 소매 바깥선이 되고,
 * 소매 안쪽 선은 겨드랑이에서 몸통 옆선과 만난다(dad 의 몸통 모양을 팔 방향에 맞춰 그때그때 만든다).
 */
const SKIN = '#fff';
const xy = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** a → b 마디의 네 귀퉁이 [a 한쪽, b 한쪽, b 반대쪽, a 반대쪽] — a 쪽 굵기 wa, b 쪽 굵기 wb */
function quad([ax, ay], [bx, by], wa, wb) {
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (ay - by) / l, ny = (bx - ax) / l;
  return [
    [ax + (nx * wa) / 2, ay + (ny * wa) / 2], [bx + (nx * wb) / 2, by + (ny * wb) / 2],
    [bx - (nx * wb) / 2, by - (ny * wb) / 2], [ax - (nx * wa) / 2, ay - (ny * wa) / 2],
  ];
}
const along = ([ax, ay], [bx, by], t) => [ax + (bx - ax) * t, ay + (by - ay) * t];

/** 손 모양 — 손목이 (0,0), 손가락은 +x 쪽, 엄지는 -y 쪽. body 는 손목 쪽을 열어 둬서 팔에 이어 붙는다 */
const HANDS = {
  /** 주먹 — 엄지가 손가락 위를 감싼다 */
  fist: {
    body: 'M -2,-23 C 20,-30 50,-31 64,-20 C 78,-8 77,15 63,24 C 48,32 20,30 -2,23',
    thumb: 'M 12,-25 C 16,-44 44,-46 52,-29 C 54,-23 48,-19 38,-19',
    lines: 'M 60,-6 Q 68,-5 72,-1 M 58,9 Q 66,11 70,15',
    thumbOver: true,
  },
  /** 편 손 — 손가락을 붙여 뻗은 장갑 모양 */
  open: {
    body: 'M -2,-22 C 28,-28 68,-28 90,-17 C 104,-9 104,10 90,16 C 68,24 28,26 -2,22',
    thumb: 'M 10,-21 C 18,-48 50,-56 58,-36 C 62,-27 52,-21 42,-21',
    lines: 'M 62,-5 L 96,-5 M 62,7 L 95,7',
    thumbOver: false,
  },
};

/** 손 — (x,y) 손목에서 deg 방향으로 뻗는다. thumb -1 이면 엄지가 반대쪽 */
function hand(x, y, deg = 0, { kind = 'fist', thumb = 1, s = 1 } = {}) {
  const h = HANDS[kind];
  const th = P(h.thumb, 5, SKIN), body = P(h.body, 5, SKIN);
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${s} ${s * thumb})">` +
    (h.thumbOver ? body + th : th + body) + P(h.lines, 4) + '</g>';
}

/** 몸 옆선의 x — 팔은 이 바깥에 붙는다 */
const SIDE_X = 168;

/** 팔 하나의 뼈대와 소매 모양 — 어깨 sh → 팔꿈치 el → 손목 wr */
function armGeom(sh, el, wr, o = {}) {
  const w = o.w ?? 84;
  const l = Math.hypot(el[0] - sh[0], el[1] - sh[1]) || 1;
  const d = [(el[0] - sh[0]) / l, (el[1] - sh[1]) / l];
  const side = Math.sign(sh[0]) || 1;
  let n = [-d[1], d[0]];
  if (n[0] * side < 0) n = [d[1], -d[0]]; // 몸 바깥쪽 법선
  const sw = w + 16, len = l * (o.sleeve ?? 0.5), hw = (sw - 6) / 2;
  const at = (k, m) => [sh[0] + n[0] * k + d[0] * m, sh[1] + n[1] * k + d[1] * m];
  const out = at(sw / 2, 0), inn = at(-sw / 2, 0), hemOut = at(hw, len), hemIn = at(-hw, len);
  // 겨드랑이: 소매 안쪽 선이 몸 옆선과 만나는 곳 — 팔을 내리면 소매 끝 가까이, 들면 어깨 가까이
  const dx = hemIn[0] - inn[0];
  const t = Math.min(0.8, Math.max(0.08, Math.abs(dx) > 0.5 ? (side * SIDE_X - inn[0]) / dx : 1));
  return { sh, el, wr, o: { ...o, w }, d, side, out, inn, hemOut, hemIn, pit: along(inn, hemIn, t) };
}
const sleevePath = (g) => `M ${xy(g.out)} L ${xy(g.hemOut)} L ${xy(g.hemIn)} L ${xy(g.inn)} Z`;

/** 소매 밖으로 나온 맨팔 — 위팔 · 팔꿈치 · 아래팔 · 손 */
function armSkin(g) {
  const { el, wr } = g;
  const sh = along(g.sh, g.el, 0.04); // 소매 윗변에 테두리 끝이 비치지 않게 조금 아래서 시작
  const { hand: kind = 'fist', thumb = 1, handDeg = 0, hs = 1, w } = g.o;
  const we = w * 0.84, ww = w * 0.64;
  const up = quad(sh, el, w, we), fo = quad(el, wr, we * 0.94, ww);
  const closed = (q) => `M ${q.map(xy).join(' L ')} Z`;
  let s =
    `<path d="M ${xy(up[0])} L ${xy(up[1])} M ${xy(up[2])} L ${xy(up[3])}" ${OUTLINE}/>` +
    `<circle cx="${el[0]}" cy="${el[1]}" r="${we / 2}" ${OUTLINE}/>` +
    `<path d="${closed(fo)}" ${OUTLINE}/>` +
    `<path d="${closed(up)}" fill="${SKIN}"/><circle cx="${el[0]}" cy="${el[1]}" r="${we / 2}" fill="${SKIN}"/><path d="${closed(fo)}" fill="${SKIN}"/>`;
  if (kind !== 'none') {
    const deg = (Math.atan2(wr[1] - el[1], wr[0] - el[0]) * 180) / Math.PI + handDeg;
    s += hand(wr[0], wr[1], deg, { kind, thumb, s: (hs * w) / 64 });
  }
  return s;
}

/** 맨팔 위로 소매를 다시 덮는다 — 소매 끝 선만 긋고 칠한다(바깥 테두리는 몸통과 함께 이미 그렸다) */
const sleeveOver = (g, shirt) => `<path d="M ${xy(g.hemOut)} L ${xy(g.hemIn)}" ${OUTLINE}/><path d="${sleevePath(g)}" fill="${shirt}"/>`;

/** 폰 — 가운데가 (0,0) */
const phoneShape = (w, h, screen = '#fff') =>
  `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w * 0.15}" ${S(5, '#2a2a2a')}/>` +
  `<rect x="${-w / 2 + 10}" y="${-h / 2 + 14}" width="${w - 20}" height="${h - 28}" rx="8" fill="${screen}"/>`;

/* ───────── 아빠(Julian 캐리커처): 덥수룩한 머리 · 둥근 안경 ─────────
 * 웃음은 표정에서 나온다: 주름(미간 · 팔자 · 콧등), 깔보는 눈, 꽉 문 이, 흘러내린 안경, 번뜩이는 안경, 흔들림 선,
 * 콧김 · 콧물 · 코풍선 · 빠져나가는 영혼 같은 과장을 표정마다 얹는다.
 */

const LX = -42, RX = 42, EY = -28, ER = 34;
const EYES_AT = [LX, RX];

const eyes = {
  dots: (r = 7, dx = 0, dy = 0) => DOT(LX + dx, EY + dy, r) + DOT(RX + dx, EY + dy, r),
  happy: () => EYES_AT.map((x) => P(`M ${x - 16},${EY + 6} Q ${x},${EY - 12} ${x + 16},${EY + 6}`, 5)).join(''),
  closed: () => EYES_AT.map((x) => P(`M ${x - 18},${EY - 2} Q ${x},${EY + 12} ${x + 18},${EY - 2}`, 5) + P(`M ${x - 12},${EY + 7} l -6,6 M ${x + 12},${EY + 7} l 6,6`, 3)).join(''),
  side: () =>
    P(`M ${LX - 31},${EY - 6} L ${LX + 31},${EY - 6}`, 5) + P(`M ${RX - 31},${EY - 6} L ${RX + 31},${EY - 6}`, 5) +
    DOT(LX + 16, EY + 8, 8) + DOT(RX + 16, EY + 8, 8),
  sparkle: () =>
    EYES_AT.map((x) => DOT(x, EY + 2, 18) + DOT(x + 7, EY - 5, 7, '#fff') + DOT(x - 6, EY + 9, 3.5, '#fff')).join(''),
  lid: () =>
    P(`M ${LX - 30},${EY - 2} L ${LX + 30},${EY - 2}`, 5) + P(`M ${RX - 30},${EY - 2} L ${RX + 30},${EY - 2}`, 5) +
    DOT(LX, EY + 10, 6) + DOT(RX, EY + 10, 6),
  spiral: () =>
    EYES_AT.map((x) => P(`M ${x},${EY} m -3,0 a 3,3 0 1 1 6,0 a 7,7 0 1 1 -14,0 a 11,11 0 1 1 22,0 a 15,15 0 1 1 -30,0`, 3)).join(''),
  /** 휘둥그레 — 흰자 가득, 눈동자는 점 */
  bulge: (r = 3.5) => EYES_AT.map((x, i) => C(x, EY, 22, 4, '#fff') + DOT(x + (i ? -2 : 3), EY + 1, r)).join(''),
  /** 깔보는 눈 — 눈꺼풀을 반쯤 내리고 아래를 내려다본다 */
  halfDown: () =>
    EYES_AT.map((x) =>
      P(`M ${x - 11},${EY - 4} A 11 11 0 0 0 ${x + 11},${EY - 4} Z`, 0, K) +
      P(`M ${x - 27},${EY - 2} Q ${x},${EY - 12} ${x + 27},${EY - 2}`, 6) +
      P(`M ${x - 16},${EY + 15} Q ${x},${EY + 19} ${x + 16},${EY + 15}`, 3)).join(''),
  /** 퀭한 눈 · 정색 — 무거운 눈꺼풀 아래 작은 눈동자 */
  heavy: () =>
    EYES_AT.map((x) =>
      P(`M ${x - 9},${EY + 2} A 9 9 0 0 0 ${x + 9},${EY + 2} Z`, 0, K) +
      P(`M ${x - 28},${EY + 3} Q ${x},${EY - 5} ${x + 28},${EY + 3}`, 6)).join(''),
  /** 슬쩍 곁눈질 — 비스듬한 눈꺼풀, 눈동자는 오른쪽 끝 */
  sideHeavy: () =>
    EYES_AT.map((x) =>
      DOT(x + 17, EY + 3, 8) +
      P(`M ${x - 28},${EY - 1} L ${x + 28},${EY - 9}`, 6) +
      P(`M ${x - 18},${EY + 15} Q ${x + 2},${EY + 19} ${x + 22},${EY + 12}`, 3)).join(''),
};

/** 눈썹 — [모양, 굵기]. 머리카락 위에서도 보이게 흰 테를 두른다 */
const brows = {
  calm: [['M -72,-74 Q -46,-82 -20,-75', 7], ['M 20,-75 Q 46,-82 72,-74', 7]],
  high: [['M -72,-82 Q -46,-96 -20,-84', 7], ['M 20,-84 Q 46,-96 72,-82', 7]],
  worry: [['M -74,-66 L -20,-88', 7], ['M 20,-88 L 74,-66', 7]],
  angry: [['M -74,-86 L -18,-64', 9], ['M 18,-64 L 74,-86', 9]],
  sus: [['M -72,-68 L -20,-66', 7], ['M 20,-82 Q 46,-104 74,-84', 7]],
  flat: [['M -70,-72 L -22,-72', 7], ['M 22,-72 L 70,-72', 7]],
  firm: [['M -74,-84 L -18,-66', 9], ['M 18,-66 L 74,-84', 9]],
  droop: [['M -72,-62 Q -46,-70 -22,-80', 6], ['M 22,-80 Q 46,-70 72,-62', 6]],
  shock: [['M -76,-82 Q -52,-108 -24,-92', 8], ['M 24,-92 Q 52,-108 76,-82', 8]],
  rage: [['M -80,-92 L -14,-60', 13], ['M 14,-60 L 80,-92', 13]],
  smug: [['M -72,-78 Q -46,-86 -20,-78', 7], ['M 20,-86 Q 50,-108 78,-90', 8]],
  meh: [['M -70,-70 L -22,-72', 7], ['M 22,-80 Q 46,-92 72,-84', 7]],
};
const browSvg = (name) =>
  brows[name].map(([d, w]) => P(d, w + 7, 'none', '#fff')).join('') + brows[name].map(([d, w]) => P(d, w)).join('');

const mouths = {
  line: P('M -22,76 Q 0,82 22,76', 5),
  smirk: P('M -34,72 Q 6,92 42,62', 5),
  grin: P('M -42,58 Q 0,64 42,58 Q 36,108 0,110 Q -36,108 -42,58 Z', 5, K) + P('M -36,62 Q 0,68 36,62 L 32,74 Q 0,80 -32,74 Z', 0, '#fff') + P('M -20,96 Q 0,86 20,96 Q 10,106 0,106 Q -10,106 -20,96 Z', 0, '#fff'),
  teeth:
    P('M -44,54 L 44,54 L 36,100 L -36,100 Z', 5, '#fff') + P('M -42,77 L 40,77', 4) +
    [-24, -8, 8, 24].map((x) => P(`M ${x},55 L ${x},99`, 3)).join(''),
  wobble: P('M -30,74 Q -20,62 -10,74 Q 0,86 10,74 Q 20,62 30,74', 5),
  flat: P('M -18,76 L 18,76', 5),
  o: C(0, 76, 11, 5, '#fff'),
  sleepy: P('M -12,76 Q 0,84 12,76', 5),
  /** 턱까지 벌어진 비명 — 윗니와 혀 */
  scream: P('M -24,50 Q 0,34 24,50 L 40,100 Q 42,122 0,124 Q -42,122 -40,100 Z', 5, K) +
    P('M -20,48 Q 0,38 20,48 L 22,56 Q 0,50 -22,56 Z', 0, '#fff') +
    P('M -26,110 Q 0,94 26,110 Q 14,120 0,120 Q -14,120 -26,110 Z', 0, '#d9d9d9'),
  /** 이를 꽉 문 입 — 입꼬리가 으르렁 올라간다 */
  grit:
    P('M -56,56 Q 0,44 56,56 L 50,96 Q 0,110 -50,96 Z', 5, '#fff') + P('M -54,76 Q 0,70 54,76', 4) +
    [-36, -18, 0, 18, 36].map((x) => P(`M ${x},${54} L ${x},${98}`, 3)).join('') +
    P('M -56,56 L -68,46 M 56,56 L 68,46', 5),
  /** 거만한 한쪽 입꼬리 · 보조개 */
  smug: P('M -28,80 Q 6,90 36,66', 5) + P('M 34,56 Q 46,66 38,78', 3.5),
  /** 퀭하게 벌어진 입 */
  ajar: P('M -14,74 Q 0,70 14,74 Q 12,92 0,94 Q -12,92 -14,74 Z', 4.5, K),
  /** 정색 — 한쪽으로 몰린 일자 입 */
  meh: P('M -4,80 L 28,75', 5) + P('M 6,96 Q 14,99 22,96', 3),
  /** 오므린 입 「흠」 */
  purse: P('M 4,80 C 8,70 24,70 28,80 C 24,90 8,90 4,80 Z', 4.5, '#fff') + P('M 9,80 L 23,80', 3),
  /** 질린 입 — 세로로 긴 오 */
  oTall: P('M -12,70 C -12,56 12,56 12,70 L 12,90 C 12,104 -12,104 -12,90 Z', 5, K),
  /** 영혼 없는 벌린 입 */
  slack: P('M -20,62 Q 0,58 20,62 Q 22,112 0,116 Q -22,112 -20,62 Z', 5, K),
  /** 결심 — 꽉 다문 입, 한쪽이 살짝 올라간다 */
  set: P('M -26,80 Q 0,76 28,72', 6),
  /** 감동해 우는 입 — 윗입술이 떨린다 */
  cry: P('M -38,64 Q -26,52 -13,62 Q 0,72 13,62 Q 26,52 38,64 Q 34,108 0,110 Q -34,108 -38,64 Z', 5, K) +
    P('M -18,96 Q 0,86 18,96 Q 0,104 -18,96 Z', 0, '#d9d9d9'),
  /** 코 고는 입 */
  snore: P('M -18,72 C -18,56 18,56 18,72 C 18,98 -18,98 -18,72 Z', 5, K),
};

const extras = {
  sweat: (x, y, s = 1) =>
    G(x, y, s, P('M 0,0 C -11,18 -13,30 0,32 C 13,30 11,18 0,0 Z', 3.5, '#cfe8ff')),
  /** 머리 옆 큰 땀방울 */
  bigSweat: (x = 120, y = -150) => G(x, y, 2.1, P('M 0,0 C -11,18 -13,30 0,32 C 13,30 11,18 0,0 Z', 2.5, '#cfe8ff') + P('M -4,18 Q -5,24 -2,27', 2, 'none', '#fff')),
  tears: () =>
    P('M -58,6 C -62,40 -56,84 -68,132 L -44,132 C -38,84 -42,40 -36,6 Z', 3.5, '#a9dcff') +
    P('M 36,6 C 42,40 38,84 44,132 L 68,132 C 56,84 62,40 58,6 Z', 3.5, '#a9dcff'),
  /** 폭포 눈물 — 턱 아래까지 쏟아지고 튄다 */
  gush: () =>
    P('M -62,4 C -70,50 -60,100 -80,158 L -36,158 C -34,100 -42,50 -30,4 Z', 3.5, '#a9dcff') +
    P('M 30,4 C 42,50 34,100 36,158 L 80,158 C 60,100 70,50 62,4 Z', 3.5, '#a9dcff') +
    [[-92, 150], [-26, 164], [26, 164], [92, 150]].map(([x, y]) => G(x, y, 0.7, P('M 0,0 C -11,18 -13,30 0,32 C 13,30 11,18 0,0 Z', 3, '#a9dcff'), x < 0 ? -40 : 40)).join(''),
  vein: (x = 78, y = -150, s = 1.4) =>
    G(x, y, s, P('M -14,-4 Q -4,-4 -4,-14 M 4,-14 Q 4,-4 14,-4 M 14,4 Q 4,4 4,14 M -4,14 Q -4,4 -14,4', 5, 'none', '#d93a2b')),
  circles: (heavy = false) =>
    EYES_AT.map((x) =>
      P(`M ${x - 24},${EY + 34} Q ${x},${EY + 46} ${x + 24},${EY + 34}`, 3) +
      (heavy ? P(`M ${x - 20},${EY + 44} Q ${x},${EY + 56} ${x + 20},${EY + 44}`, 3) + P(`M ${x - 14},${EY + 53} Q ${x},${EY + 62} ${x + 14},${EY + 53}`, 2.5) : ''),
    ).join(''),
  glint: (x = RX + 34, y = EY - 34, r = 16) =>
    P(`M ${x},${y - r} Q ${x + 3},${y - 3} ${x + r},${y} Q ${x + 3},${y + 3} ${x},${y + r} Q ${x - 3},${y + 3} ${x - r},${y} Q ${x - 3},${y - 3} ${x},${y - r} Z`, 3, '#fff'),
  hatch: () =>
    [-66, -50, -34, -18, -2, 14, 30, 46, 62].map((x) => P(`M ${x},-104 L ${x},${x % 2 ? -40 : -52}`, 2.5, 'none', '#4a4a4a')).join(''),
  blush: () =>
    [[-74, 34], [56, 34]].map(([x, y]) => P(`M ${x},${y + 10} L ${x + 8},${y} M ${x + 9},${y + 10} L ${x + 17},${y}`, 3, 'none', '#d97a6c')).join(''),
  drool: () => P('M 14,84 C 16,104 12,116 18,128', 3) + P('M 18,128 C 12,138 24,142 22,132', 3, '#cfe8ff'),
  shake: (r = 150) =>
    [[-1, -0.3], [-1.05, 0.2], [1, -0.3], [1.05, 0.2]].map(([sx, sy]) =>
      P(`M ${sx * r},${sy * r - 20} l ${sx * 16},0 M ${sx * (r + 6)},${sy * r} l ${sx * 20},0 M ${sx * r},${sy * r + 20} l ${sx * 16},0`, 4),
    ).join(''),
  lens: () =>
    EYES_AT.map((x) => C(x, EY, ER - 3, 0, '#d8efff') + P(`M ${x - 18},${EY + 6} L ${x + 2},${EY - 18} M ${x - 6},${EY + 14} L ${x + 14},${EY - 8}`, 4, 'none', '#fff')).join(''),
  /** 안경이 하얗게 번뜩 — 눈이 안 보인다 */
  glare: () =>
    EYES_AT.map((x) => C(x, EY, ER - 2, 0, '#fff') + P(`M ${x - 20},${EY + 8} L ${x + 4},${EY - 20} M ${x - 6},${EY + 16} L ${x + 16},${EY - 6}`, 4, 'none', '#bbb')).join(''),
  /** 미간 주름 */
  furrow: () => P('M -10,-70 Q -5,-58 -8,-46', 3.5) + P('M 10,-70 Q 5,-58 8,-46', 3.5),
  /** 콧등 주름 */
  noseWrinkle: () => P('M -14,-6 Q 0,-12 14,-6', 3) + P('M -12,3 Q 0,-2 12,3', 3),
  /** 팔자 주름 — side 'l' · 'r' · 둘 다 */
  folds: (side = 'both') =>
    (side !== 'r' ? P('M -34,26 Q -54,56 -44,92', 3.5) : '') + (side !== 'l' ? P('M 34,26 Q 54,56 44,92', 3.5) : ''),
  /** 벌렁이는 콧구멍 */
  nostrils: () => DOT(-7, 37, 4.5) + DOT(11, 37, 4.5),
  /** 콧김 「흥」 */
  puff: () => [-1, 1].map((s) => P(`M ${s * 16},46 q ${s * 18},4 ${s * 24},20 M ${s * 24},44 q ${s * 22},0 ${s * 34},12`, 3.5)).join(''),
  /** 귀에서 김 */
  steam: () => [-1, 1].map((s) => P(`M ${s * 128},-46 q ${s * 12},-14 0,-28 q ${-s * 12},-14 0,-28 M ${s * 150},-30 q ${s * 10},-12 0,-24 q ${-s * 10},-12 0,-24`, 4)).join(''),
  /** 볼 홀쭉 */
  hollow: () => P('M -70,30 Q -62,50 -66,70', 3) + P('M 70,30 Q 62,50 66,70', 3),
  /** 입에서 빠져나가는 영혼 */
  soul: () =>
    P('M 10,98 C 50,118 96,104 122,62 C 140,32 136,-6 168,-20 C 206,-36 246,-10 240,30 C 266,40 262,82 232,88 C 222,114 182,116 172,94 C 152,108 126,108 116,98', 4, 'rgba(255,255,255,0.94)') +
    DOT(186, 20, 5) + DOT(212, 22, 5) + P('M 190,44 Q 199,38 208,44', 3.5) + P('M 154,104 l -10,10 M 232,98 l 8,12', 3),
  /** 콧물 */
  snot: () => P('M 9,40 C 6,58 14,66 9,78 C 5,88 17,90 15,79', 3.5, '#cfe8ff'),
  /** 코풍선 */
  bubble: () => C(26, 58, 22, 3.5, 'rgba(225,242,255,0.9)') + P('M 16,48 q 5,-5 11,-4', 3, 'none', '#fff'),
};

/**
 * 표정 — eyes(눈) · brows(눈썹) · mouth(입) · extra(과장) · face(얼굴색).
 * glasses 는 안경을 흘러내리게(dx · dy · rot), lensFill 은 눈 위로 렌즈를 칠한다(번뜩)
 */
const FACES = {
  normal: { eyes: eyes.dots(), brows: 'calm', mouth: 'line' },
  smug: { eyes: eyes.halfDown(), brows: 'smug', mouth: 'smug', extra: () => extras.nostrils() + extras.folds() + extras.glint(RX + 30, EY - 40, 18) },
  proud: { eyes: eyes.happy(), brows: 'high', mouth: 'grin', extra: () => extras.blush() + extras.nostrils() + extras.glint(RX + 30, EY - 40, 14) },
  panic: {
    eyes: eyes.bulge(), brows: 'shock', mouth: 'scream', glasses: { dx: 4, dy: 18, rot: -9 },
    extra: () => extras.hatch() + extras.sweat(112, -96) + extras.sweat(-124, -60, 0.8) + extras.sweat(118, 10, 0.7) + extras.sweat(-114, 30, 0.6) + extras.bigSweat(),
  },
  suspicious: { eyes: eyes.sideHeavy(), brows: 'sus', mouth: 'purse', extra: () => extras.folds('l') },
  rage: {
    eyes: '', glare: true, brows: 'rage', mouth: 'grit',
    extra: () => extras.furrow() + extras.noseWrinkle() + extras.folds() + extras.vein() + extras.vein(-92, -138, 1.1) + extras.shake() + extras.steam(),
  },
  touched: { eyes: eyes.sparkle(), brows: 'worry', mouth: 'cry', extra: () => extras.gush() + extras.blush() + extras.snot() + extras.shake(150) },
  sparkle: { eyes: eyes.sparkle(), brows: 'high', mouth: 'wobble', extra: () => extras.blush() },
  /** 새벽 3시 — 퀭 */
  deadpan: { eyes: eyes.heavy(), brows: 'droop', mouth: 'ajar', extra: () => extras.circles(true) + extras.hollow() },
  /** 「…그래서요?」 정색 */
  meh: { eyes: eyes.heavy(), brows: 'meh', mouth: 'meh', extra: () => extras.folds() + extras.circles() },
  pale: {
    eyes: eyes.bulge(2.5), brows: 'worry', mouth: 'oTall', face: '#e3e8f0', glasses: { dx: -3, dy: 10, rot: 7 },
    extra: () => extras.hatch() + extras.sweat(112, -90) + extras.sweat(-120, -50, 0.8) + extras.shake(140),
  },
  zombie: { eyes: eyes.spiral(), brows: 'droop', mouth: 'slack', face: '#e6e6e6', extra: () => extras.circles(true) + extras.hollow() + extras.drool() + extras.soul() },
  focused: { eyes: '', brows: 'firm', mouth: 'set', lens: true, extra: () => extras.glint(-64, -56, 15) + extras.glint(80, -6, 10) },
  sleep: { eyes: eyes.closed(), brows: 'calm', mouth: 'snore', extra: () => extras.drool() + extras.bubble() },
};

function hair(messy) {
  let s = P(
    'M -106,-62 C -122,-150 -70,-200 0,-198 C 72,-200 124,-150 106,-62 L 96,-96 L 82,-84 L 74,-118 L 54,-98 L 40,-128 L 18,-104 L 2,-132 L -18,-104 L -36,-130 L -54,-100 L -72,-122 L -82,-88 L -96,-100 Z',
    4, K,
  );
  if (messy) {
    s += P('M -40,-190 L -58,-232 L -22,-196 M 8,-198 L 14,-244 L 32,-196 M 58,-186 L 92,-216 L 76,-172 M -82,-160 L -124,-176 L -96,-140', 4, K);
  }
  return s;
}

/** 아빠 머리 — (0,0)이 얼굴 가운데, 너비 약 230 */
function dadHead(expr = 'normal', { messy = false } = {}) {
  const f = FACES[expr] ?? FACES.normal;
  const face = f.face ?? '#fff';
  let s = '';
  s += P('M -97,-28 C -128,-40 -130,22 -95,20', 5, face);
  s += P('M 97,-28 C 128,-40 130,22 95,20', 5, face);
  s += P('M -100,-60 C -102,-145 -52,-168 0,-168 C 54,-168 104,-145 101,-60 C 100,25 84,104 0,122 C -84,104 -101,25 -100,-60 Z', 5, face);
  s += hair(messy || expr === 'panic' || expr === 'zombie');
  if (f.lens) s += extras.lens();
  s += f.eyes;
  const g = f.glasses;
  const glasses =
    (f.glare ? extras.glare() : '') +
    C(LX, EY, ER, 5) + C(RX, EY, ER, 5) + P('M -8,-32 Q 0,-40 8,-32', 5) + P('M -76,-34 L -97,-40', 5) + P('M 76,-34 L 97,-40', 5);
  s += g ? `<g transform="translate(${g.dx} ${g.dy}) rotate(${g.rot})">${glasses}</g>` : glasses;
  s += browSvg(f.brows);
  s += P('M -2,6 C -10,28 -12,38 0,42 C 8,44 14,40 14,34', 4);
  s += mouths[f.mouth];
  if (f.extra) s += f.extra();
  return s;
}

/* ───────── 몸통 · 팔 자세 ───────── */

/** 팔 없이 그릴 때의 몸통(표정 모음 등) */
const BELL = 'M -38,150 C -110,156 -178,182 -198,300 L -214,940 L 214,940 L 198,300 C 178,182 110,156 38,150 Q 0,192 -38,150 Z';

/** 목 → 어깨 → 소매 바깥 위 귀퉁이 → (소매 속) → 겨드랑이 → 옆구리. 어깨 선은 소매 방향으로 들어가 끊김이 없다 */
function torsoPath(gl, gr) {
  const k = 48;
  const c1 = (g) => [g.side * 92, 152];
  const c2 = (g) => [g.out[0] - g.d[0] * k, g.out[1] - g.d[1] * k];
  const foot = (g) => [g.pit[0] + g.side * 6, 940];
  return `M -38,150 C ${xy(c1(gl))} ${xy(c2(gl))} ${xy(gl.out)} L ${xy(gl.inn)} L ${xy(gl.pit)} L ${xy(foot(gl))} ` +
    `L ${xy(foot(gr))} L ${xy(gr.pit)} L ${xy(gr.inn)} L ${xy(gr.out)} C ${xy(c2(gr))} ${xy(c1(gr))} 38,150 Q 0,192 -38,150 Z`;
}

/** 자세 조각 — 팔 하나 */
const armAt = (sh, el, wr, o) => ({ arm: [sh, el, wr, o] });
/** 자세 조각 — 그 자리에 끼워 그릴 그림(폰 등, 몸 좌표) */
const layer = (svg) => ({ svg });

/** 어깨 관절 — 「왼」「오른」은 보는 쪽 기준 */
const SH_L = [-205, 262], SH_R = [205, 262];
const downL = () => armAt(SH_L, [-218, 500], [-224, 730], { hand: 'open', thumb: 1 });
const downR = () => armAt(SH_R, [218, 500], [224, 730], { hand: 'open', thumb: -1 });

/** 팔 자세 — 조각 목록을 돌려준다. 빠진 쪽 팔은 dad 가 늘어뜨린 팔로 채운다 */
const POSES = {
  none: () => null,
  down: () => [downL(), downR()],
  /** 팔짱 — 왼팔이 아래, 오른팔이 위. 왼손은 오른팔 밑에 숨고 오른손은 왼팔 위팔을 쥔다 */
  crossed: () => [
    armAt(SH_L, [-222, 480], [100, 432], { hand: 'fist', thumb: -1 }),
    armAt(SH_R, [222, 470], [-110, 414], { hand: 'fist', thumb: 1 }),
  ],
  /** 오른손으로 가슴 앞에 폰 */
  phone: (screen = '#fff') => [downL(), layer(G(50, 262, 1, phoneShape(100, 176, screen), -6)),
    armAt(SH_R, [226, 500], [132, 400], { hand: 'fist', thumb: 1, handDeg: -10 })],
  /** 두 손으로 폰 — 치는 중 */
  typing: (screen = '#fff') => [layer(G(0, 300, 1, phoneShape(120, 196, screen))),
    armAt(SH_L, [-224, 490], [-102, 432], { hand: 'fist', thumb: 1, handDeg: -20 }),
    armAt(SH_R, [224, 490], [102, 432], { hand: 'fist', thumb: -1, handDeg: 20 })],
  /** 턱 괴고 슬쩍 — 오른 주먹을 턱 밑에 */
  chin: () => [downL(), armAt(SH_R, [226, 470], [74, 206], { hand: 'fist', thumb: -1, handDeg: 8 })],
};

/**
 * 아빠 — x,y 는 얼굴 가운데. arm 은 POSES 이름이나 () => 조각 목록(직접 그리는 자세),
 * front 는 몸통과 팔 사이에 그릴 것(안은 아기 등, 몸 좌표)
 */
function dad(x, y, s, { expr = 'normal', arm: pose = 'down', shirt = '#fff', messy = false, headRot = 0, screen, front = '' } = {}) {
  const head = headRot ? `<g transform="rotate(${headRot} 0 100)">${dadHead(expr, { messy })}</g>` : dadHead(expr, { messy });
  const neck = P('M -36,96 L -38,170 L 38,170 L 36,96 Z', 0, SKIN) + P('M -34,100 L -38,152 M 34,100 L 38,152', 5);
  const parts = typeof pose === 'function' ? pose() : POSES[pose](screen);
  if (!parts) return G(x, y, s, neck + `<path d="${BELL}" ${S(5, shirt)}/>` + P('M -38,150 Q 0,192 38,150', 5) + head + front);

  const items = parts.map((p) => (p.arm ? { g: armGeom(...p.arm) } : p));
  const arms = items.filter((it) => it.g);
  if (!arms.some((it) => it.g.side < 0)) items.unshift({ g: armGeom(...downL().arm) });
  if (!arms.some((it) => it.g.side > 0)) items.push({ g: armGeom(...downR().arm) });
  const gs = items.filter((it) => it.g).map((it) => it.g);
  const gl = gs.find((g) => g.side < 0), gr = gs.find((g) => g.side > 0);
  const tp = torsoPath(gl, gr);

  // 몸통과 소매를 한 덩어리로: 테두리를 모두 긋고 → 모두 칠한다
  const body =
    `<path d="${tp}" ${OUTLINE}/>` + gs.map((g) => `<path d="${sleevePath(g)}" ${OUTLINE}/>`).join('') +
    `<path d="${tp}" fill="${shirt}"/>` + gs.map((g) => `<path d="${sleevePath(g)}" fill="${shirt}"/>`).join('') +
    gs.map((g) => P(`M ${xy(g.out)} L ${xy(g.inn)} L ${xy(g.pit)}`, 3, 'none', shirt)).join('') + // 맞닿은 칠 사이로 테두리가 비치지 않게
    P('M -38,150 Q 0,192 38,150', 5);
  const rest = items.map((it) => (it.g ? armSkin(it.g) + sleeveOver(it.g, shirt) : it.svg)).join('');
  return G(x, y, s, neck + body + head + front + rest);
}

/* ───────── 아기(말콩이) ───────── */

const babyFaces = {
  cry:
    P('M -38,-12 L -16,-2 L -38,8', 5) + P('M 38,-12 L 16,-2 L 38,8', 5) +
    P('M -26,18 Q 0,8 26,18 Q 22,54 0,56 Q -22,54 -26,18 Z', 5, K) +
    P('M -40,-6 Q -76,-26 -98,2', 7, 'none', '#7cc6ff') + P('M 40,-6 Q 76,-26 98,2', 7, 'none', '#7cc6ff'),
  sleep: P('M -34,-2 Q -24,6 -14,-2', 4) + P('M 14,-2 Q 24,6 34,-2', 4) + C(0, 26, 5, 4, '#fff'),
  happy:
    P('M -34,0 Q -24,-12 -14,0', 5) + P('M 14,0 Q 24,-12 34,0', 5) +
    P('M -18,20 Q 0,20 18,20 Q 14,42 0,42 Q -14,42 -18,20 Z', 4, K),
};

function babyHead(expr = 'sleep', blush = '#e9e9e9') {
  return (
    P('M -60,-8 C -76,-16 -78,14 -60,14', 4, '#fff') + P('M 60,-8 C 76,-16 78,14 60,14', 4, '#fff') +
    C(0, 0, 62, 5, '#fff') +
    P('M -4,-62 C -22,-92 22,-100 18,-76 C 14,-62 -2,-68 4,-78', 4) +
    DOT(-40, 22, 10, blush) + DOT(40, 22, 10, blush) +
    babyFaces[expr]
  );
}

/** 강보에 싸인 아기 */
function baby(x, y, s, { expr = 'sleep', blush, rot = 0, body = true } = {}) {
  const wrap = body
    ? P('M -66,36 C -104,120 -66,210 0,214 C 66,210 104,120 66,36 Q 0,64 -66,36 Z', 5, '#fff') + P('M -58,86 Q 0,120 62,96 M -40,150 Q 10,170 52,150', 4)
    : '';
  return G(x, y, s, wrap + babyHead(expr, blush), rot);
}

/* ───────── 소품 ───────── */

function label(x, y, text, size = 34, rot = 0, color = K, font = 'Gaegu', weight = 700) {
  return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-family="${font}" font-weight="${weight}" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
}

function box(x, y, w, h, text, rot = 0, size = 40) {
  const cx = x + w / 2, cy = y + h / 2;
  return `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${S(5, '#fff')}/>` +
    P(`M ${x},${y} L ${x + w * 0.18},${y - 26} L ${x + w * 0.82},${y - 26} L ${x + w},${y} M ${x + w / 2},${y} L ${x + w / 2},${y + h * 0.25}`, 5, '#fff') +
    label(cx, cy + 10, text, size) + '</g>';
}

function book(x, y, w, h, text, rot = 0) {
  const cx = x + w / 2, cy = y + h / 2;
  return `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${S(5, '#fff')}/>` +
    P(`M ${x + 18},${y} L ${x + 18},${y + h}`, 4) + label(cx + 9, cy + 3, text, Math.min(34, h * 0.55)) + '</g>';
}

function star(x, y, r = 16, fill = '#fff') {
  return P(`M ${x},${y - r} Q ${x + 3},${y - 3} ${x + r},${y} Q ${x + 3},${y + 3} ${x},${y + r} Q ${x - 3},${y + 3} ${x - r},${y} Q ${x - 3},${y - 3} ${x},${y - r} Z`, 3, fill);
}

/** 말풍선 — 꼬리를 (tx,ty)로. 글자는 HTML 로 얹는다 */
function bubble(cx, cy, rx, ry, tx, ty, { fill = '#fff', stroke = K, w = 5, spread = 0.16 } = {}) {
  const a = Math.atan2((ty - cy) / ry, (tx - cx) / rx);
  const pt = (t) => `${(cx + rx * Math.cos(t)).toFixed(1)},${(cy + ry * Math.sin(t)).toFixed(1)}`;
  if (tx === null) return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${S(w, fill, stroke)}/>`;
  return P(`M ${pt(a - spread)} L ${tx},${ty} L ${pt(a + spread)} A ${rx} ${ry} 0 1 1 ${pt(a - spread)} Z`, w, fill, stroke);
}

/** 생각 구름 — 꼬리는 작은 동그라미들 */
function cloud(cx, cy, rx, ry, tx, ty) {
  const n = 14;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
    d += i === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)}` : ` A ${rx * 0.26} ${ry * 0.34} 0 0 1 ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  let s = P(d + ' Z', 5, '#fff');
  for (let i = 1; i <= 3; i++) {
    const k = i / 4;
    s += C(cx + (tx - cx) * (0.55 + k * 0.4), cy + ry + (ty - cy - ry) * (0.2 + k * 0.75), 22 - i * 5, 4, '#fff');
  }
  return s;
}

/** 돋보기 */
function magnifier(x, y, r = 90) {
  return C(x, y, r, 10, 'rgba(255,255,255,0.05)') + limb(`M ${x + r * 0.72},${y + r * 0.72} L ${x + r * 1.45},${y + r * 1.45}`, 22, '#444');
}

/** 집중선 · 떨림선 */
function burst(cx, cy, r1, r2, n = 28, color = K, w = 3) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + (i % 2) * 0.05;
    const a = r1 + (i % 3) * 14;
    s += P(`M ${(cx + a * Math.cos(t)).toFixed(1)},${(cy + a * Math.sin(t)).toFixed(1)} L ${(cx + r2 * Math.cos(t)).toFixed(1)},${(cy + r2 * Math.sin(t)).toFixed(1)}`, w, 'none', color);
  }
  return s;
}

window.T = { K, P, C, DOT, G, limb, hand, armAt, layer, phoneShape, SH_L, SH_R, downL, downR, dad, dadHead, baby, babyHead, label, box, book, star, bubble, cloud, magnifier, burst, extras };
})();
