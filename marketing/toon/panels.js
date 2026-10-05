/*
 * 5컷 — 콘티는 docs/product/store-toon.md. 1·2막은 흑백, 버디가 나오는 3막부터 색이 들어온다.
 */

(() => {
const { K, P, C, G, dad, dadSide, galaxy, armAt, layer, SH_L, SH_R, baby, box, book, star, bubble, cloud, magnifier } = window.T;

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

const ad = (x, y, w, h, title, rot, { button = true, size = 25 } = {}) =>
  card(x, y, w, h,
    `<div style="position:absolute;right:10px;top:4px;font-size:20px;color:#999">×</div>
     <div style="font-size:18px;color:#888;font-weight:700">광고</div>
     <div style="font-size:${size}px;font-weight:900;line-height:1.25;margin-top:2px">${title}</div>
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
      { html: card(50, 330, 300, 420,
          `<div style="font-family:Gaegu;font-weight:700;font-size:40px;line-height:1.45">
             <div style="font-size:44px;border-bottom:3px solid #1b1b1b;margin-bottom:8px">출산 준비물</div>
             ✔ 기저귀<br>✔ 분유 · 젖병<br>✔ 아기띠<br>✔ 육아책 3권<br>✔ <span style="background:${YELLOW}">필수 육아앱 설치</span></div>`,
          { rot: -5, pad: 26, radius: 4, extra: 'width:380px' }) },
      { svg: dad(710, 640, 1.15, { expr: 'smug', arm: 'crossed' }) + bubble(720, 250, 270, 88, 660, 400) +
          book(770, 1290, 250, 58, '육아 백과', -3) + book(790, 1234, 220, 54, '첫 1년의 기적', 2) },
      { html: txt(720, 250, '후… 이 정도면\n완벽하지', { size: 52 }) + txt(930, 500, '번쩍', { size: 40, rot: 12 }) },
    ],
  }),

  /* 새벽 3시 — 우는 아기를 안고 허둥대는 아빠, 옆에는 오른쪽을 보고 폰으로 검색하는 잔상 */
  2: () => ({
    title: '그리고, 새벽 3시',
    layers: [
      { svg:
          `<g opacity="0.45">${dadSide(800, 790, 0.88)}</g>` +
          P('M 520,690 L 640,690 M 540,750 L 680,750 M 520,810 L 640,810 M 560,870 L 660,870', 4, 'none', '#aaa') +
          cloud(290, 268, 250, 84, 330, 470) +
          dad(320, 800, 1.0, { expr: 'panic', messy: true, front: baby(-20, 300, 0.85, { expr: 'cry' }),
            arm: () => [holdUnder(), armAt(SH_R, [224, 500], [84, 452], { hand: 'open', thumb: 1, handDeg: 4, hs: 0.9 })] }) },
      { html:
          txt(290, 268, '마지막 수유가… 이 앱이었나?\n저 앱? 아니 수첩이었나??', { size: 32 }) +
          card(560, 186, 480, 84, searchBar('신생아 태열 크림', { size: 28 }), { rot: -2, pad: 12 }) +
          card(600, 288, 450, 84, searchBar('baby crying reasons', { size: 28 }), { rot: 2, pad: 12 }) +
          card(570, 392, 470, 196,
            `<div style="display:flex;flex-direction:column;gap:12px">
               ${userMsg('아기가 새벽에 계속 울어요 ㅠㅠ', 24)}
               <div style="display:flex;align-items:center;gap:12px;border:4px solid #1b1b1b;border-radius:40px;padding:8px 20px;font-size:26px;color:#999">
                 <span style="flex:1">무엇이든 물어보세요</span><span>⬆️</span></div></div>`, { rot: -1, pad: 16, radius: 24 }) +
          txt(600, 625, '허둥지둥', { size: 44, rot: -8 }) +
          big(150, 1010, '응애애애!!', { size: 72, rot: -14, color: '#444' }) +
          big(860, 1255, '멘붕', { size: 170, rot: -8 }) },
    ],
  }),

  /* 블로그 · 해외 글 · 증상 검색 · AI 챗봇 — 네 칸에 한 번에 */
  3: () => ({
    title: '찾으면 찾을수록…',
    layers: [
      /* 1칸: 블로그 후기 → 맨 끝 협찬 문구 */
      { html:
          yellowShot(36, 180, 560, 262,
            `<div style="font-size:18px;color:#555">쑥쑥맘의 육아일기 ✿ · 3일 전</div>
             <div style="font-size:28px;font-weight:900;line-height:1.25">신생아 태열 크림 정착템 💕<br>찐 솔직 후기</div>
             <div style="font-size:22px;line-height:1.4">…고민 말고 바로 쟁이세요 ♡</div>
             <div style="flex:1"></div>
             <div style="font-size:14px;color:#888">※ 본 포스팅은 업체로부터 제품을 무상으로 제공받아…</div>`, -1.5, { pad: 16, inPad: '16px 22px', gap: 6 }) +
          `<div style="position:absolute;left:430px;top:312px;width:152px;height:152px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font-size:21px;font-weight:900;line-height:1.3">
             <span>업체로부터<br><span style="background:${YELLOW}">무상으로</span><br>받아…</span></div>` },
      { svg: magnifier(506, 388, 78) + dad(850, 350, 0.4, { expr: 'rage' }) },
      { html: big(815, 214, '속았다…!', { size: 66, rot: -5 }) + txt(1012, 330, '부들\n부들', { size: 26, rot: 12 }) },

      /* 2칸: 자동 번역 글과 광고 */
      { svg: tier(460) + dad(170, 660, 0.42, { expr: 'meh' }) + bubble(180, 530, 128, 44, 190, 590) },
      { html:
          yellowShot(350, 478, 690, 252,
            `<div style="font-size:18px;color:#777">🌐 자동 번역됨 · 원문 보기</div>
             <div style="font-size:28px;font-weight:900">아기가 우는 이유 7가지</div>
             <div style="font-size:25px;line-height:1.45"><b>1.</b> 당신의 아기가 울 때, 그것은 <span style="background:${YELLOW}">당신의 아기가 울고 있다는 것</span>을 의미합니다.</div>`, 1.5, { pad: 16, inPad: '18px 24px', gap: 8 }) +
          ad(800, 666, 240, 82, '기적의 아기 이불 🔥', -3, { button: false, size: 22 }) +
          txt(180, 530, '…그래서요?', { size: 34 }) },

      /* 3칸: 증상 검색은 무서운 것부터 */
      { svg: tier(752) +
          dad(840, 880, 0.42, { expr: 'pale', front: baby(-20, 300, 0.85, { expr: 'happy' }), arm: () => [holdUnder()] }) +
          bubble(300, 1012, 258, 30, 700, 960) },
      { html:
          card(36, 768, 600, 206,
            `${searchBar('아기 딸꾹질', { size: 26 })}
             ${[['딸꾹질, 알고 보니 무서운 병의 신호?!', 'health-info.example'], ['의사들이 경고하는 증상 TOP 5 (충격)', 'mom-news.example']]
               .map(([h, u]) => `<div style="margin-top:6px"><div style="font-size:14px;color:#999">${u}</div><div style="font-size:23px;font-weight:900;line-height:1.3;text-decoration:underline">${h}</div></div>`).join('')}`,
            { rot: -1.5, pad: 18 }) +
          txt(300, 1012, '우, 우리 애… 괜찮은 거지…?', { size: 28 }) +
          txt(992, 905, '딸꾹!', { size: 38, rot: 12 }) +
          txt(1008, 985, '(본인은\n해맑음)', { size: 20, color: '#777' }) },

      /* 4칸: AI 챗봇은 새 대화마다 처음부터 */
      { svg: tier(1046) + dad(170, 1172, 0.4, { expr: 'zombie', arm: 'typing', screen: '#e8f4ff' }) },
      { html:
          card(330, 1062, 710, 200,
            `<div style="display:flex;flex-direction:column;gap:8px">
               <div style="display:flex;justify-content:space-between;font-size:18px;color:#888"><span>AI 챗봇 · 새 대화</span><span>(일곱 번째 자기소개)</span></div>
               ${userMsg('우리 애 3개월이고요, 분유 먹고, 지난주에…', 22)}
               <div style="display:flex;align-items:center;gap:16px">${botMsg('일반적으로 이 시기 아기들은…', 22)}<span style="font-family:Gaegu;font-weight:700;font-size:30px">…근거는?</span></div>
             </div>`, { pad: 16, radius: 22 }) +
          big(780, 1302, '또 처음부터…', { size: 64, rot: -3 }) },
    ],
  }),

  4: () => ({
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
          card(600, 236, 460, 316,
            `<div style="position:absolute;left:18px;top:12px;font-size:19px;font-weight:700;color:rgba(255,255,255,0.85)">우리 아기 지식 지도</div>`,
            { bg: 'radial-gradient(120% 90% at 50% 55%, #3A2433 0%, #1A1D2E 70%)', border: 4, radius: 20 }) +
          txt(900, 1030, '타닥 타닥', { size: 46, color: '#bfe4ff', rot: -8 }) +
          txt(540, 935, 'z z', { size: 34, color: '#ddd' }) },
      { rough: false, svg: G(600, 266, 1, galaxy(460, 282)) },
    ],
    mark: true,
  }),

  /* 다음 날 아침 — 버디의 안부와 출처에 감동한 아빠, 그리고 마무리 */
  5: () => ({
    title: '그리고 다음 날 아침',
    bg: '#FFF6E2',
    mark: false,
    layers: [
      { html: phone(40, 176, 520, 770,
          `<div style="position:absolute;inset:0;background:#FBF8F3;padding:56px 24px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px">
             <div style="display:flex;align-items:center;gap:12px">
               <img src="../../assets/images/mascot/face.png" style="width:60px;height:60px"/>
               <div style="font-size:28px;font-weight:900">버디</div><div style="font-size:22px;color:#999">오전 8:00</div></div>
             <div style="background:#fff;border:2px solid #E8DFD0;border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:12px">
               <div style="font-size:22px;color:#8a8a8a">좋은 아침이에요 ☀️</div>
               <div style="font-size:29px;font-weight:900;line-height:1.4">어제 말콩이 열이 났다고<br>하셨죠. 오늘은 좀 어때요?</div>
               <div style="display:flex;gap:8px;flex-wrap:wrap">
                 <div style="border:2px solid #1b1b1b;border-radius:30px;padding:6px 14px;font-size:22px;font-weight:700">열이 내렸어요</div>
                 <div style="border:2px solid #1b1b1b;border-radius:30px;padding:6px 14px;font-size:22px;font-weight:700">아직 열이 있어요</div></div>
             </div>
             <div style="background:#fff;border:2px solid #E8DFD0;border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:10px">
               <div style="font-size:21px;color:#8a8a8a">BCG 언제 맞아요?</div>
               <div style="font-size:26px;line-height:1.45">생후 4주 안에 한 번 맞는 결핵 예방접종이에요. 이 한 번으로 끝나요.</div>
               <div style="align-self:flex-start;background:#FCEBE8;color:#8F2E23;border-radius:14px;padding:6px 14px;font-size:21px;font-weight:700">출처 · 질병관리청 예방접종도우미</div>
             </div>
           </div>`) },
      { svg: dad(830, 690, 0.78, { expr: 'touched', shirt: YELLOW }) + bubble(825, 350, 190, 88, 840, 520) +
          P('M 420,1000 C 470,980 476,900 430,850', 6, 'none', ACCENT) + P('M 414,868 L 428,846 L 450,860', 6, 'none', ACCENT) +
          bubble(690, 1030, 132, 40, 790, 1050, { stroke: ACCENT }) },
      { html:
          txt(825, 350, '너… 기억하고\n있었구나…', { size: 42 }) +
          txt(260, 1012, '출처까지…?!', { size: 50, color: ACCENT, rot: -4 }) +
          `<div style="position:absolute;left:0;right:0;top:1080px;bottom:0;background:${YELLOW};border-top:5px solid #1b1b1b;display:flex;flex-direction:column;justify-content:center;gap:8px;padding-left:56px">
             <div style="font-size:44px;font-weight:900;line-height:1.25">앱 여러 개 뒤지던 걸,<br>이제 버디에게 물으면 끝</div>
             <div style="font-size:25px;font-weight:700;color:#5a4a2a">육아의 모든 질문, 우리 아기 기준으로</div>
             <div style="font-size:22px;font-weight:700;color:#8a7650">육아버디 · 아빠가 만든 육아 비서</div></div>` +
          `<img src="../../assets/images/mascot/standing.png" style="position:absolute;left:820px;top:1012px;width:220px"/>` +
          txt(690, 1030, '제가 챙길게요!', { size: 34, color: ACCENT }) },
    ],
  }),

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
