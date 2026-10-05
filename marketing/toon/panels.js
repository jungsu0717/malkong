/*
 * 9컷 — 콘티는 docs/product/store-toon.md. 1·2막은 흑백, 버디가 나오는 3막부터 색이 들어온다.
 */

(() => {
const { K, P, C, G, dad, armAt, layer, SH_L, SH_R, baby, box, book, star, bubble, cloud, magnifier } = window.T;

const YELLOW = '#FDD686';
const ACCENT = '#C64536';

/* HTML 조각 */
const txt = (x, y, text, { size = 44, w, font, weight, color, rot = 0, lh } = {}) =>
  `<div class="t" style="left:${x}px;top:${y}px;font-size:${size}px;${w ? `width:${w}px;` : ''}${font ? `font-family:'${font}';` : ''}${weight ? `font-weight:${weight};` : ''}${color ? `color:${color};` : ''}${lh ? `line-height:${lh};` : ''}transform:translate(-50%,-50%) rotate(${rot}deg)">${text}</div>`;
const big = (x, y, text, { size = 150, rot = -6, color = K } = {}) =>
  `<div class="big" style="left:${x}px;top:${y}px;font-size:${size}px;color:${color};transform:translate(-50%,-50%) rotate(${rot}deg)">${text}</div>`;
const cap = (x, y, text, { bg = '#fff', size = 38, rot = 0 } = {}) =>
  `<div class="cap" style="left:${x}px;top:${y}px;background:${bg};font-size:${size}px;transform:rotate(${rot}deg)">${text}</div>`;
const phone = (x, y, w, h, inner, { rot = 0, bg = '#fff', gray = false } = {}) =>
  `<div class="phone${gray ? ' gray' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${bg};transform:rotate(${rot}deg)">${inner}</div>`;
const card = (x, y, w, h, inner, { rot = 0, bg = '#fff', border = 4, radius = 18, pad = 0, extra = '' } = {}) =>
  `<div class="card" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${bg};border-width:${border}px;border-radius:${radius}px;padding:${pad}px;transform:rotate(${rot}deg);${extra}">${inner}</div>`;

/** 앱 아이콘 하나 — 흑백 막에서는 회색 */
const appIcon = (emoji, name, size = 112, font = 24) =>
  `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:${size + 20}px">
     <div style="width:${size}px;height:${size}px;border-radius:${size * 0.24}px;background:#ececec;border:3px solid #1b1b1b;display:flex;align-items:center;justify-content:center;font-size:${size * 0.52}px;filter:grayscale(1)">${emoji}</div>
     <div style="font-size:${font}px;font-weight:500;color:#333;white-space:nowrap">${name}</div>
   </div>`;

const APPS = [
  ['🍼', '수유 기록'], ['🧷', '기저귀'], ['💉', '접종 알림'], ['📏', '성장 그래프'], ['⏱️', '수유 타이머'], ['😴', '수면 기록'],
  ['🥣', '이유식'], ['💬', '맘카페'], ['📔', '육아 일기'], ['🔊', '백색소음'], ['🌡️', '체온 기록'],
];

/** 검색창 한 줄 */
const searchBar = (q, { size = 30 } = {}) =>
  `<div style="display:flex;align-items:center;gap:12px;border:4px solid #1b1b1b;border-radius:40px;padding:10px 22px;font-size:${size}px;font-weight:500">
     <span style="flex:1">${q}</span><span style="font-size:${size}px">🔍</span></div>`;

/** 패널 사이 칸 나누기 — y 아래를 흰 칸으로 덮고 선을 긋는다 */
const tier = (y) => `<rect x="0" y="${y}" width="1080" height="${1350 - y}" fill="#fff"/>` + P(`M 0,${y} L 1080,${y}`, 6);

/** 블로그 · 기사 캡처를 담는 노란 상자 (육아툰 문법) */
const yellowShot = (x, y, w, h, inner, rot = 0, { pad = 24, inPad = '28px 32px', gap = 16 } = {}) =>
  card(x, y, w, h, `<div style="background:#fff;border:4px solid #1b1b1b;border-radius:12px;height:100%;box-sizing:border-box;padding:${inPad};display:flex;flex-direction:column;gap:${gap}px">${inner}</div>`, { bg: YELLOW, rot, pad, radius: 6, border: 5 });

const ad = (x, y, w, h, title, rot, { button = true } = {}) =>
  card(x, y, w, h,
    `<div style="position:absolute;right:10px;top:4px;font-size:20px;color:#999">×</div>
     <div style="font-size:18px;color:#888;font-weight:700">광고</div>
     <div style="font-size:25px;font-weight:900;line-height:1.25;margin-top:2px">${title}</div>
     ${button ? '<div style="display:inline-block;margin-top:6px;background:#1b1b1b;color:#fff;font-size:19px;font-weight:700;padding:4px 14px;border-radius:30px">지금 클릭 ▶</div>' : ''}`,
    { rot, pad: 14, radius: 14, extra: 'box-shadow:6px 8px 0 rgba(0,0,0,0.18);filter:grayscale(1)' });

const userMsg = (text, size = 28) =>
  `<div style="align-self:flex-end;max-width:82%;background:#2b2b2b;color:#fff;border-radius:24px 24px 6px 24px;padding:16px 22px;font-size:${size}px;line-height:1.4">${text}</div>`;
const botMsg = (text, size = 28) =>
  `<div style="align-self:flex-start;max-width:82%;background:#eee;border-radius:24px 24px 24px 6px;padding:16px 22px;font-size:${size}px;line-height:1.4">${text}</div>`;

/* 아기 안은 팔 — 아빠 몸 좌표. 아기는 dad 의 front 로 먼저 그리고 팔을 그 위에 얹는다 */

/** 왼팔로 아기 엉덩이를 받친다 — 손끝이 아기 옆구리를 감싼다 */
const holdUnder = (el = [-215, 500], wr = [40, 505]) => armAt(SH_L, el, wr, { hand: 'open', thumb: -1, handDeg: -58, hs: 0.9 });

/** 아이콘이 깔린 폰 (흑백 막) — 몸 좌표 (x,y) 가 가운데 */
const appPhone = (x, y, rot) =>
  G(x, y, 1,
    `<rect x="-60" y="-105" width="120" height="210" rx="18" fill="#2a2a2a" stroke="${K}" stroke-width="5"/>` +
    `<rect x="-50" y="-92" width="100" height="184" rx="8" fill="#f2f2f2"/>` +
    [0, 1, 2].flatMap((c) => [0, 1, 2, 3].map((r) => `<rect x="${-40 + c * 30}" y="${-80 + r * 40}" width="22" height="22" rx="6" fill="#bbb" stroke="${K}" stroke-width="2.5"/>`)).join(''),
    rot);

window.PANELS = {
  1: () => ({
    title: '준비는 완벽했다 <span style="font-size:34px;color:#999;font-weight:700">(실화)</span>',
    layers: [
      { svg: box(70, 1020, 330, 270, '기저귀', -2, 56) + box(100, 820, 260, 190, '분유', 3, 50) },
      { html: card(60, 300, 300, 400,
          `<div style="font-family:Gaegu;font-weight:700;font-size:40px;line-height:1.45">
             <div style="font-size:44px;border-bottom:3px solid #1b1b1b;margin-bottom:8px">출산 준비물</div>
             ✔ 기저귀<br>✔ 분유 · 젖병<br>✔ 아기띠<br>✔ 육아책 3권<br>✔ 육아 앱 11개</div>`,
          { rot: -5, pad: 26, radius: 4, extra: 'width:330px' }) },
      { svg: dad(710, 640, 1.15, { expr: 'smug', arm: 'crossed' }) + bubble(660, 260, 300, 92, 640, 400) +
          book(770, 1290, 250, 58, '육아 백과', -3) + book(790, 1234, 220, 54, '첫 1년의 기적', 2) },
      { html: txt(660, 260, '후… 이 정도면\n완벽하지', { size: 54 }) + txt(930, 500, '번쩍', { size: 40, rot: 12 }) },
    ],
  }),

  2: () => ({
    title: '육아 앱도 11개나 깔았다',
    layers: [
      { html: phone(240, 220, 600, 1010,
          `<div style="position:absolute;inset:0;background:#d6d6d6"></div>
           <div style="position:absolute;left:30px;right:30px;top:70px;bottom:46px;background:rgba(255,255,255,0.92);border-radius:44px;padding:34px 18px;box-sizing:border-box">
             <div style="font-size:40px;font-weight:900;text-align:center;margin-bottom:26px">육아</div>
             <div style="display:grid;grid-template-columns:repeat(3,1fr);row-gap:22px;justify-items:center">
               ${APPS.map(([e, n]) => appIcon(e, n, 104)).join('')}
             </div>
           </div>`) },
      { svg: dad(935, 1150, 0.56, { expr: 'proud' }) + bubble(950, 920, 100, 60, 940, 1030) },
      { html: txt(950, 920, '뿌듯', { size: 46 }) },
    ],
  }),

  3: () => ({
    title: '그리고, 새벽 3시',
    layers: [
      { svg:
          cloud(540, 330, 420, 100, 700, 470) +
          dad(580, 700, 1.15, { expr: 'panic', messy: true, front: baby(-20, 300, 0.85, { expr: 'cry' }),
            arm: () => [holdUnder(), layer(appPhone(312, 60, 10)), armAt(SH_R, [314, 440], [304, 210], { hand: 'fist', thumb: 1 })] }) },
      { html:
          txt(540, 330, '마지막 수유가… 이 앱이었나?\n저 앱? 아니 수첩이었나??', { size: 44 }) +
          big(200, 790, '응애애애!!', { size: 84, rot: -14, color: '#444' }) +
          big(885, 1250, '멘붕', { size: 180, rot: -8 }) },
    ],
  }),

  4: () => ({
    title: '결국 내가 찾은 건…',
    layers: [
      { svg: dad(540, 960, 0.9, { expr: 'deadpan', arm: 'phone', screen: '#e8f4ff' }) },
      { html:
          card(70, 240, 680, 160,
            `<div style="font-size:30px;font-weight:900;margin-bottom:12px">블로그 검색</div>${searchBar('신생아 태열 크림')}`, { rot: -2, pad: 22 }) +
          card(330, 420, 680, 160,
            `<div style="font-size:30px;font-weight:900;margin-bottom:12px">해외 검색</div>${searchBar('baby crying reasons')}`, { rot: 2, pad: 22 }) +
          card(110, 600, 680, 160,
            `<div style="font-size:30px;font-weight:900;margin-bottom:12px">AI 챗봇</div>${searchBar('무엇이든 물어보세요').replace('🔍', '⬆️')}`, { rot: -1, pad: 22 }) +
          cap(50, 1220, '새벽 3시 12분', { bg: YELLOW, size: 36 }) },
    ],
  }),

  /* 블로그 · 해외 글 · 증상 검색 — 세 칸에 한 번에 */
  5: () => ({
    title: '찾으면 찾을수록…',
    layers: [
      /* 1칸: 블로그 후기 → 맨 끝 협찬 문구 */
      { html:
          yellowShot(40, 190, 600, 340,
            `<div style="font-size:22px;color:#555">쑥쑥맘의 육아일기 ✿ · 3일 전</div>
             <div style="font-size:34px;font-weight:900;line-height:1.25">신생아 태열 크림 정착템 💕<br>찐 솔직 후기</div>
             <div style="font-size:26px;line-height:1.4">…고민 말고 바로 쟁이세요 ♡</div>
             <div style="flex:1"></div>
             <div style="font-size:17px;color:#888">※ 본 포스팅은 업체로부터 제품을 무상으로 제공받아…</div>`, -1.5, { pad: 20, inPad: '22px 26px', gap: 10 }) +
          `<div style="position:absolute;left:436px;top:350px;width:184px;height:184px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font-size:25px;font-weight:900;line-height:1.3">
             <span>업체로부터<br><span style="background:${YELLOW}">무상으로</span><br>받아…</span></div>` },
      { svg: magnifier(528, 442, 94) + dad(850, 430, 0.5, { expr: 'rage' }) },
      { html: big(820, 236, '속았다…!', { size: 84, rot: -5 }) + txt(1000, 360, '부들\n부들', { size: 32, rot: 12 }) },

      /* 2칸: 자동 번역 글과 광고 */
      { svg: tier(560) + dad(180, 800, 0.5, { expr: 'meh' }) + bubble(190, 640, 140, 54, 200, 712) },
      { html:
          yellowShot(380, 585, 660, 330,
            `<div style="font-size:20px;color:#777">🌐 자동 번역됨 · 원문 보기</div>
             <div style="font-size:32px;font-weight:900">아기가 우는 이유 7가지</div>
             <div style="font-size:28px;line-height:1.45"><b>1.</b> 당신의 아기가 울 때, 그것은 <span style="background:${YELLOW}">당신의 아기가 울고 있다는 것</span>을 의미합니다.</div>`, 1.5, { pad: 20, inPad: '22px 28px', gap: 10 }) +
          ad(670, 820, 320, 110, '아기 10초 만에 재우는<br>기적의 이불 🔥', -3, { button: false }) +
          txt(190, 640, '…그래서요?', { size: 40 }) },

      /* 3칸: 증상 검색은 무서운 것부터 */
      { svg: tier(950) +
          dad(820, 1070, 0.5, { expr: 'pale', front: baby(-20, 300, 0.85, { expr: 'happy' }), arm: () => [holdUnder()] }) +
          bubble(300, 1296, 270, 44, 740, 1150) },
      { html:
          card(40, 974, 610, 262,
            `${searchBar('아기 딸꾹질', { size: 28 })}
             ${[['딸꾹질, 알고 보니 무서운 병의 신호?!', 'health-info.example'], ['의사들이 경고하는 증상 TOP 5 (충격)', 'mom-news.example']]
               .map(([h, u]) => `<div style="margin-top:14px"><div style="font-size:18px;color:#999">${u}</div><div style="font-size:27px;font-weight:900;line-height:1.3;text-decoration:underline">${h}</div></div>`).join('')}`,
            { rot: -1.5, pad: 22 }) +
          txt(300, 1296, '우, 우리 애… 괜찮은 거지…?', { size: 36 }) +
          txt(1012, 1150, '딸꾹!', { size: 44, rot: 12 }) +
          txt(1016, 1250, '(본인은\n해맑음)', { size: 24, color: '#777' }) },
    ],
  }),

  6: () => ({
    title: '그럼 AI 챗봇은?',
    layers: [
      { html: card(370, 230, 670, 440,
          `<div style="display:flex;flex-direction:column;gap:20px">
             <div style="font-size:24px;color:#888;text-align:center">AI 챗봇 · 새 대화</div>
             ${userMsg('우리 애 3개월이고요, 분유 먹고, 지난주에 접종했고, 요즘 밤에 자주 깨고, 몸무게는 6.4kg이고…')}
             ${botMsg('좋은 질문이에요! 일반적으로 이 시기 아기들은 … 하는 경우가 많아요.')}
           </div>`, { pad: 26, radius: 26 }) },
      { svg: dad(190, 610, 0.72, { expr: 'suspicious', arm: 'chin' }) + bubble(185, 330, 168, 100, 190, 455) + tier(830) },
      { html: txt(185, 330, '…맞는 말\n같은데,\n근거는?', { size: 38 }) + txt(330, 520, '슬쩍', { size: 36, rot: -10 }) },
      { svg: dad(240, 1010, 0.6, { expr: 'zombie', arm: 'typing' }) },
      { html: cap(560, 856, '새 대화를 열 때마다…', { size: 34 }) +
          card(570, 950, 470, 210,
            `<div style="display:flex;flex-direction:column;gap:12px">${userMsg('우리 애 3개월이고요, 분유 먹고, 지난주에 접종했고…', 26)}
             <div style="align-self:flex-end;font-size:22px;color:#888">(일곱 번째 자기소개)</div></div>`, { pad: 20, radius: 22 }) +
          big(790, 1262, '또 처음부터…', { size: 88, rot: -4 }) },
    ],
  }),

  7: () => ({
    title: '그래서 개발자 아빠는<br>결심했다',
    titleColor: '#fff',
    bg: '#232838',
    layers: [
      { rough: false, svg:
          `<defs><radialGradient id="glow"><stop offset="0" stop-color="#bfe4ff" stop-opacity="0.5"/><stop offset="1" stop-color="#bfe4ff" stop-opacity="0"/></radialGradient></defs>` +
          `<ellipse cx="540" cy="900" rx="560" ry="480" fill="url(#glow)"/>` },
      { svg:
          dad(540, 720, 1.05, { expr: 'focused' }) +
          G(540, 720, 1.05, T.limb('M -122,168 L -96,320', 34, '#c8ced8') + T.limb('M 122,168 L 96,320', 34, '#c8ced8')) +
          baby(540, 1000, 0.85, { expr: 'sleep', body: false }) +
          P('M 430,1030 Q 540,1050 650,1030 L 640,1120 L 440,1120 Z', 5, '#c8ced8') +
          `<rect x="150" y="1085" width="780" height="320" rx="18" fill="#3a4155" stroke="${K}" stroke-width="6"/>` +
          P('M 170,1090 L 910,1090', 6, 'none', '#bfe4ff') +
          bubble(270, 380, 235, 118, 440, 560) },
      { html:
          txt(270, 380, '우리 애를 기억하고,\n근거를 대는 비서…\n내가 만든다.', { size: 40 }) +
          card(600, 300, 440, 230,
            `<div style="font-family:Menlo,monospace;font-size:25px;line-height:1.6;color:#d4d4d4;white-space:pre"><span style="color:#c586c0">if</span> (어제.<span style="color:#9cdcfe">열</span>) {
  안부(<span style="color:#ce9178">"오늘은 좀 어때요?"</span>)
}
답.출처 = <span style="color:#ce9178">"공공기관"</span></div>`, { bg: '#1e1e1e', pad: 24, radius: 16, border: 4 }) +
          txt(900, 1030, '타닥 타닥', { size: 46, color: '#bfe4ff', rot: -8 }) +
          txt(540, 935, 'z z', { size: 34, color: '#ddd' }) },
    ],
    mark: true,
  }),

  8: () => ({
    title: '그리고 다음 날 아침',
    bg: '#FFF6E2',
    layers: [
      { html: phone(60, 220, 580, 900,
          `<div style="position:absolute;inset:0;background:#FBF8F3;padding:70px 30px 30px;box-sizing:border-box;display:flex;flex-direction:column;gap:22px">
             <div style="display:flex;align-items:center;gap:14px">
               <img src="../../assets/images/mascot/face.png" style="width:70px;height:70px"/>
               <div style="font-size:32px;font-weight:900">버디</div><div style="font-size:24px;color:#999">오전 8:00</div></div>
             <div style="background:#fff;border:2px solid #E8DFD0;border-radius:26px;padding:26px;display:flex;flex-direction:column;gap:16px">
               <div style="font-size:26px;color:#8a8a8a">좋은 아침이에요 ☀️</div>
               <div style="font-size:33px;font-weight:900;line-height:1.4">어제 말콩이 열이 났다고<br>하셨죠. 오늘은 좀 어때요?</div>
               <div style="display:flex;gap:10px;flex-wrap:wrap">
                 <div style="border:2px solid #1b1b1b;border-radius:30px;padding:8px 18px;font-size:25px;font-weight:700">열이 내렸어요</div>
                 <div style="border:2px solid #1b1b1b;border-radius:30px;padding:8px 18px;font-size:25px;font-weight:700">아직 열이 있어요</div></div>
             </div>
             <div style="background:#fff;border:2px solid #E8DFD0;border-radius:26px;padding:26px;display:flex;flex-direction:column;gap:14px">
               <div style="font-size:24px;color:#8a8a8a">BCG 언제 맞아요?</div>
               <div style="font-size:30px;line-height:1.45">생후 4주 안에 한 번 맞는 결핵 예방접종이에요. 이 한 번으로 끝나요.</div>
               <div style="align-self:flex-start;background:${'#FCEBE8'};color:#8F2E23;border-radius:14px;padding:8px 16px;font-size:24px;font-weight:700">출처 · 질병관리청 예방접종도우미</div>
             </div>
           </div>`) },
      { svg: dad(870, 850, 0.85, { expr: 'touched', shirt: YELLOW }) + bubble(850, 470, 200, 100, 860, 660) +
          P('M 470,1236 C 515,1200 502,1100 500,990', 6, 'none', ACCENT) + P('M 480,1012 L 500,986 L 520,1012', 6, 'none', ACCENT) },
      { html: txt(850, 470, '너… 기억하고\n있었구나…', { size: 46 }) + txt(290, 1268, '출처까지…?!', { size: 58, color: ACCENT, rot: -4 }) },
    ],
  }),

  9: () => ({
    title: '앱 11개 뒤지던 걸,<br>이제 버디에게 물으면 끝',
    bg: '#FFF6E2',
    mark: false,
    layers: [
      { svg:
          `<rect x="70" y="700" width="680" height="330" rx="60" fill="#E6D6BE" stroke="${K}" stroke-width="5"/>` +
          `<rect x="40" y="960" width="740" height="230" rx="50" fill="#EBDDC7" stroke="${K}" stroke-width="5"/>` +
          dad(410, 760, 0.9, { expr: 'sleep', shirt: YELLOW, headRot: -14, front: baby(0, 230, 0.75, { expr: 'sleep', blush: '#f7c6bd' }),
            arm: () => [holdUnder([-215, 430], [-10, 420]), armAt(SH_R, [222, 440], [96, 380], { hand: 'open', thumb: 1, handDeg: 6, hs: 0.9 })] }) +
          bubble(890, 430, 170, 78, 880, 540, { stroke: ACCENT }) },
      { html:
          `<img src="../../assets/images/mascot/standing.png" style="position:absolute;left:760px;top:540px;width:270px"/>` +
          txt(890, 430, '제가 챙길게요!', { size: 44, color: ACCENT }) +
          txt(600, 600, 'Z z z', { size: 60, color: '#999', rot: -10 }) +
          `<div style="position:absolute;left:0;right:0;top:1170px;bottom:0;background:${YELLOW};border-top:5px solid #1b1b1b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center">
             <div style="font-size:42px;font-weight:900;line-height:1.3">육아의 모든 질문, 우리 아기 기준으로<br>버디가 다 챙겨요</div>
             <div style="font-size:28px;font-weight:700;color:#5a4a2a">육아버디 · 아빠가 만든 육아 비서</div></div>` },
    ],
  }),

  /* 그림 확인용 — 팔 자세 모음 */
  poses: () => {
    const list = [
      ['down', {}], ['crossed', { arm: 'crossed', expr: 'smug' }], ['phone', { arm: 'phone', expr: 'deadpan', screen: '#e8f4ff' }],
      ['typing', { arm: 'typing', expr: 'zombie' }], ['chin', { arm: 'chin', expr: 'suspicious' }],
      ['holdUnder', { expr: 'panic', front: baby(-20, 300, 0.85, { expr: 'cry' }), arm: () => [holdUnder(), layer(appPhone(312, 60, 10)), armAt(SH_R, [314, 440], [304, 210], { hand: 'fist' })] }],
    ];
    let svg = '', html = '';
    list.forEach(([name, o], i) => {
      const x = 190 + (i % 3) * 350, y = 230 + Math.floor(i / 3) * 640;
      svg += dad(x, y, 0.5, o);
      html += txt(x, y - 190, name, { size: 30, color: '#c00' });
    });
    return { layers: [{ svg }, { html }], mark: false };
  },

  /* 그림 확인용 — 표정 모음 */
  sheet: () => {
    const exprs = ['normal', 'smug', 'proud', 'panic', 'suspicious', 'rage', 'meh', 'deadpan', 'pale', 'zombie', 'focused', 'touched', 'sleep'];
    let svg = '', html = '';
    exprs.forEach((e, i) => {
      const x = 150 + (i % 4) * 260, y = 170 + Math.floor(i / 4) * 320;
      svg += dad(x, y, 0.62, { expr: e, arm: 'none' });
      html += txt(x, y + 104, e, { size: 28, color: '#c00' });
    });
    return { layers: [{ svg }, { html }], mark: false };
  },
};
})();
