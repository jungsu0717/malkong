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

/** 팔 · 다리 — 굵은 검은 선 위에 조금 가는 흰 선을 겹쳐 테두리 있는 관처럼 */
function limb(d, w = 54, fill = '#fff') {
  return `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 10}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
}

/** 주먹 · 손 — 동그란 장갑 모양과 손가락 금 */
function hand(x, y, r = 30, fill = '#fff', rot = 0) {
  return G(x, y, 1, C(0, 0, r, 5, fill) + P(`M ${-r * 0.1},${-r * 0.75} Q ${r * 0.6},${-r * 0.55} ${r * 0.35},${-r * 0.05}`, 4), rot);
}

/* ───────── 아빠(Julian 캐리커처): 덥수룩한 머리 · 둥근 안경 ───────── */

const LX = -42, RX = 42, EY = -28, ER = 34;

const eyes = {
  dots: (r = 7, dx = 0, dy = 0) => DOT(LX + dx, EY + dy, r) + DOT(RX + dx, EY + dy, r),
  happy: () => P(`M ${LX - 16},${EY + 6} Q ${LX},${EY - 12} ${LX + 16},${EY + 6}`, 5) + P(`M ${RX - 16},${EY + 6} Q ${RX},${EY - 12} ${RX + 16},${EY + 6}`, 5),
  closed: () => P(`M ${LX - 16},${EY - 4} Q ${LX},${EY + 10} ${LX + 16},${EY - 4}`, 5) + P(`M ${RX - 16},${EY - 4} Q ${RX},${EY + 10} ${RX + 16},${EY - 4}`, 5),
  side: () =>
    P(`M ${LX - 31},${EY - 6} L ${LX + 31},${EY - 6}`, 5) + P(`M ${RX - 31},${EY - 6} L ${RX + 31},${EY - 6}`, 5) +
    DOT(LX + 16, EY + 8, 8) + DOT(RX + 16, EY + 8, 8),
  sparkle: () =>
    [LX, RX].map((x) => DOT(x, EY + 2, 17) + DOT(x + 6, EY - 5, 6.5, '#fff') + DOT(x - 6, EY + 9, 3, '#fff')).join(''),
  lid: () =>
    P(`M ${LX - 30},${EY - 2} L ${LX + 30},${EY - 2}`, 5) + P(`M ${RX - 30},${EY - 2} L ${RX + 30},${EY - 2}`, 5) +
    DOT(LX, EY + 10, 6) + DOT(RX, EY + 10, 6),
  spiral: () =>
    [LX, RX].map((x) => P(`M ${x},${EY} m -3,0 a 3,3 0 1 1 6,0 a 7,7 0 1 1 -14,0 a 11,11 0 1 1 22,0 a 15,15 0 1 1 -30,0`, 3)).join(''),
  none: () => '',
};

const brows = {
  calm: P('M -72,-74 Q -46,-82 -20,-75', 7) + P('M 20,-75 Q 46,-82 72,-74', 7),
  high: P('M -72,-82 Q -46,-96 -20,-84', 7) + P('M 20,-84 Q 46,-96 72,-82', 7),
  worry: P('M -72,-68 L -20,-86', 7) + P('M 20,-86 L 72,-68', 7),
  angry: P('M -74,-86 L -18,-64', 9) + P('M 18,-64 L 74,-86', 9),
  sus: P('M -72,-68 L -20,-66', 7) + P('M 20,-80 Q 46,-100 72,-80', 7),
  flat: P('M -70,-72 L -22,-72', 7) + P('M 22,-72 L 70,-72', 7),
  firm: P('M -72,-80 L -20,-70', 8) + P('M 20,-70 L 72,-80', 8),
  droop: P('M -72,-64 Q -46,-72 -22,-80', 6) + P('M 22,-80 Q 46,-72 72,-64', 6),
};

const mouths = {
  line: P('M -22,76 Q 0,82 22,76', 5),
  smirk: P('M -34,72 Q 6,92 42,62', 5),
  grin: P('M -38,62 Q 0,66 38,62 Q 32,104 0,106 Q -32,104 -38,62 Z', 5, K) + P('M -22,92 Q 0,82 22,92 Q 12,103 0,104 Q -12,103 -22,92 Z', 0, '#fff'),
  scream: P('M -34,60 C -32,40 32,40 34,60 C 36,100 -36,100 -34,60 Z', 5, K) + P('M -16,86 Q 0,74 16,86 Q 0,95 -16,86 Z', 0, '#fff'),
  teeth:
    P('M -44,54 L 44,54 L 36,100 L -36,100 Z', 5, '#fff') + P('M -42,77 L 40,77', 4) +
    [-24, -8, 8, 24].map((x) => P(`M ${x},55 L ${x},99`, 3)).join(''),
  wobble: P('M -30,74 Q -20,62 -10,74 Q 0,86 10,74 Q 20,62 30,74', 5),
  flat: P('M -18,76 L 18,76', 5),
  skew: P('M -26,78 L 30,70', 5),
  o: C(0, 76, 11, 5, '#fff'),
  slack: P('M -20,66 Q 0,62 20,66 Q 18,96 0,98 Q -18,96 -20,66 Z', 5, K),
  smile: P('M -24,70 Q 0,90 24,70', 5),
  sleepy: P('M -12,76 Q 0,84 12,76', 5),
};

const extras = {
  sweat: (x, y, s = 1) =>
    G(x, y, s, P('M 0,0 C -11,18 -13,30 0,32 C 13,30 11,18 0,0 Z', 3.5, '#cfe8ff')),
  tears: () =>
    P('M -58,6 C -62,40 -56,84 -68,132 L -44,132 C -38,84 -42,40 -36,6 Z', 3.5, '#a9dcff') +
    P('M 36,6 C 42,40 38,84 44,132 L 68,132 C 56,84 62,40 58,6 Z', 3.5, '#a9dcff'),
  vein: (x = 78, y = -150) =>
    G(x, y, 1.4, P('M -14,-4 Q -4,-4 -4,-14 M 4,-14 Q 4,-4 14,-4 M 14,4 Q 4,4 4,14 M -4,14 Q -4,4 -14,4', 5, 'none', '#d93a2b')),
  circles: (heavy = false) =>
    [LX, RX].map((x) =>
      P(`M ${x - 24},${EY + 34} Q ${x},${EY + 46} ${x + 24},${EY + 34}`, 3) +
      (heavy ? P(`M ${x - 20},${EY + 44} Q ${x},${EY + 56} ${x + 20},${EY + 44}`, 3) : ''),
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
    [LX, RX].map((x) => C(x, EY, ER - 3, 0, '#d8efff') + P(`M ${x - 18},${EY + 6} L ${x + 2},${EY - 18} M ${x - 6},${EY + 14} L ${x + 14},${EY - 8}`, 4, 'none', '#fff')).join(''),
};

const FACES = {
  normal: { eyes: eyes.dots(), brows: 'calm', mouth: 'line' },
  smug: { eyes: eyes.happy(), brows: 'high', mouth: 'smirk', extra: () => extras.glint() },
  proud: { eyes: eyes.happy(), brows: 'high', mouth: 'grin', extra: () => extras.blush() },
  panic: { eyes: eyes.dots(4), brows: 'worry', mouth: 'scream', extra: () => extras.sweat(112, -96) + extras.sweat(-122, -60, 0.8) + extras.sweat(118, 10, 0.7) },
  suspicious: { eyes: eyes.side(), brows: 'sus', mouth: 'skew' },
  rage: { eyes: eyes.dots(5), brows: 'angry', mouth: 'teeth', extra: () => extras.vein() + extras.shake() },
  touched: { eyes: eyes.sparkle(), brows: 'worry', mouth: 'wobble', extra: () => extras.tears() + extras.blush() },
  sparkle: { eyes: eyes.sparkle(), brows: 'high', mouth: 'wobble', extra: () => extras.blush() },
  deadpan: { eyes: eyes.lid(), brows: 'flat', mouth: 'flat', extra: () => extras.circles() },
  pale: { eyes: eyes.dots(3.5), brows: 'worry', mouth: 'o', face: '#e3e8f0', extra: () => extras.hatch() + extras.sweat(112, -90) + extras.shake(140) },
  zombie: { eyes: eyes.spiral(), brows: 'droop', mouth: 'slack', face: '#e6e6e6', extra: () => extras.circles(true) + extras.drool() },
  focused: { eyes: '', brows: 'firm', mouth: 'flat', lens: true },
  sleep: { eyes: eyes.closed(), brows: 'calm', mouth: 'sleepy', extra: () => extras.drool() },
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
  s += C(LX, EY, ER, 5) + C(RX, EY, ER, 5);
  s += P('M -8,-32 Q 0,-40 8,-32', 5) + P('M -76,-34 L -97,-40', 5) + P('M 76,-34 L 97,-40', 5);
  s += brows[f.brows];
  s += P('M -2,6 C -10,28 -12,38 0,42 C 8,44 14,40 14,34', 4);
  s += mouths[f.mouth];
  if (f.extra) s += f.extra();
  return s;
}

/** 아빠 상반신 몸통 — 머리 아래(0,108)부터 */
function torso(fill = '#fff') {
  return (
    P('M -34,100 L -38,152 M 34,100 L 38,152', 5) +
    P('M -38,150 C -110,156 -178,182 -198,300 L -214,940 L 214,940 L 198,300 C 178,182 110,156 38,150 Q 0,192 -38,150 Z', 5, fill) +
    P('M -38,150 Q 0,192 38,150', 5)
  );
}

/** 팔 자세 */
const arms = {
  none: () => '',
  crossed: (fill) =>
    limb('M -180,290 C -110,320 20,350 120,360', 60, fill) + hand(126, 360, 26) +
    limb('M 180,290 C 110,320 -20,350 -120,360', 60, fill) + hand(-126, 360, 26),
  /** 오른손(보는 쪽 기준 오른쪽)으로 가슴 앞에 폰 */
  phone: (fill, screen = '#fff') =>
    limb('M 170,470 C 170,420 150,380 110,340', 60, fill) +
    G(96, 250, 1, `<rect x="-58" y="-98" width="116" height="196" rx="18" ${S(5, '#2a2a2a')}/><rect x="-48" y="-84" width="96" height="168" rx="8" fill="${screen}"/>`, -6) +
    hand(104, 330, 34, '#fff', -20),
  /** 두 손으로 폰 — 치는 중 */
  typing: (fill, screen = '#fff') =>
    limb('M -170,470 C -160,420 -110,380 -60,350', 56, fill) + limb('M 170,470 C 160,420 110,380 60,350', 56, fill) +
    G(0, 280, 1, `<rect x="-70" y="-110" width="140" height="210" rx="18" ${S(5, '#2a2a2a')}/><rect x="-58" y="-96" width="116" height="180" rx="8" fill="${screen}"/>`) +
    hand(-56, 352, 32) + hand(56, 352, 32),
};

/** 아빠 — x,y 는 얼굴 가운데 */
function dad(x, y, s, { expr = 'normal', arm = 'none', shirt = '#fff', messy = false, headRot = 0, screen } = {}) {
  const head = headRot ? `<g transform="rotate(${headRot} 0 100)">${dadHead(expr, { messy })}</g>` : dadHead(expr, { messy });
  return G(x, y, s, torso(shirt) + head + arms[arm](shirt, screen));
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

window.T = { K, P, C, DOT, G, limb, hand, dad, dadHead, baby, babyHead, label, box, book, star, bubble, cloud, magnifier, burst, extras };
})();
