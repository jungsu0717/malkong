/*
 * 12컷 — 콘티는 docs/product/store-toon.md. 1·2막은 흑백, 버디가 나오는 3막부터 색이 들어온다.
 */

(() => {
const { K, P, C, G, limb, dad, baby, label, box, book, star, bubble, cloud, magnifier, burst } = window.T;

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
const yellowShot = (x, y, w, h, inner, rot = 0) =>
  card(x, y, w, h, `<div style="background:#fff;border:4px solid #1b1b1b;border-radius:12px;height:100%;box-sizing:border-box;padding:28px 32px;display:flex;flex-direction:column;gap:16px">${inner}</div>`, { bg: YELLOW, rot, pad: 24, radius: 6, border: 5 });

const ad = (x, y, w, h, title, rot) =>
  card(x, y, w, h,
    `<div style="position:absolute;right:10px;top:4px;font-size:20px;color:#999">×</div>
     <div style="font-size:20px;color:#888;font-weight:700">광고</div>
     <div style="font-size:30px;font-weight:900;line-height:1.25;margin-top:4px">${title}</div>
     <div style="display:inline-block;margin-top:10px;background:#1b1b1b;color:#fff;font-size:24px;font-weight:700;padding:6px 18px;border-radius:30px">지금 클릭 ▶</div>`,
    { rot, pad: 18, radius: 14, extra: 'box-shadow:6px 8px 0 rgba(0,0,0,0.18);filter:grayscale(1)' });

const userMsg = (text, size = 28) =>
  `<div style="align-self:flex-end;max-width:82%;background:#2b2b2b;color:#fff;border-radius:24px 24px 6px 24px;padding:16px 22px;font-size:${size}px;line-height:1.4">${text}</div>`;
const botMsg = (text, size = 28) =>
  `<div style="align-self:flex-start;max-width:82%;background:#eee;border-radius:24px 24px 24px 6px;padding:16px 22px;font-size:${size}px;line-height:1.4">${text}</div>`;

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
      { svg: dad(710, 690, 1.3, { expr: 'smug', arm: 'crossed' }) + bubble(660, 290, 300, 96, 620, 440) +
          book(760, 1250, 250, 64, '육아 백과', -3) + book(780, 1186, 220, 60, '첫 1년의 기적', 2) + book(750, 1126, 240, 58, '수면 교육', -1) },
      { html: txt(660, 290, '후… 이 정도면\n완벽하지', { size: 54 }) + txt(930, 560, '번쩍', { size: 40, rot: 12 }) },
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
          dad(580, 700, 1.15, { expr: 'panic', messy: true }) +
          limb('M 430,900 C 360,960 316,1020 300,1090', 58) +
          baby(440, 965, 0.9, { expr: 'cry' }) +
          limb('M 300,1090 C 310,1190 450,1200 560,1140', 58) + T.hand(562, 1138, 32) +
          limb('M 800,1040 C 850,960 880,900 880,860', 58) +
          G(905, 780, 1,
            `<rect x="-78" y="-130" width="156" height="260" rx="22" fill="#2a2a2a" stroke="${K}" stroke-width="5"/>` +
            `<rect x="-64" y="-114" width="128" height="228" rx="10" fill="#f2f2f2"/>` +
            [0, 1, 2].flatMap((c) => [0, 1, 2, 3].map((r) => `<rect x="${-52 + c * 38}" y="${-100 + r * 50}" width="28" height="28" rx="7" fill="#bbb" stroke="${K}" stroke-width="2.5"/>`)).join(''),
            12) +
          T.hand(880, 880, 36) },
      { html:
          txt(540, 330, '마지막 수유가… 이 앱이었나?\n저 앱? 아니 수첩이었나??', { size: 44 }) +
          big(200, 790, '응애애애!!', { size: 84, rot: -14, color: '#444' }) +
          big(840, 1235, '멘붕', { size: 190, rot: -8 }) },
    ],
  }),

  4: () => ({
    title: '결국 내가 찾은 건…',
    layers: [
      { svg: dad(540, 1010, 0.95, { expr: 'deadpan', arm: 'phone', screen: '#e8f4ff' }) },
      { html:
          card(70, 270, 680, 160,
            `<div style="font-size:30px;font-weight:900;margin-bottom:12px">블로그 검색</div>${searchBar('신생아 태열 크림')}`, { rot: -2, pad: 22 }) +
          card(330, 460, 680, 160,
            `<div style="font-size:30px;font-weight:900;margin-bottom:12px">해외 검색</div>${searchBar('baby crying reasons')}`, { rot: 2, pad: 22 }) +
          card(110, 650, 680, 160,
            `<div style="font-size:30px;font-weight:900;margin-bottom:12px">AI 챗봇</div>${searchBar('무엇이든 물어보세요').replace('🔍', '⬆️')}`, { rot: -1, pad: 22 }) +
          cap(50, 1220, '새벽 3시 12분', { bg: YELLOW, size: 36 }) },
    ],
  }),

  5: () => ({
    title: '첫 번째, 블로그 검색',
    layers: [
      { html: yellowShot(60, 240, 730, 790,
          `<div style="display:flex;align-items:center;gap:14px;font-size:26px;color:#555">
             <div style="width:54px;height:54px;border-radius:50%;background:#ddd;border:3px solid #1b1b1b"></div>쑥쑥맘의 육아일기 ✿ · 3일 전</div>
           <div style="font-size:42px;font-weight:900;line-height:1.25">신생아 태열 크림 정착템 💕<br>찐 솔직 후기</div>
           <div style="height:200px;background:#eee;border:3px solid #1b1b1b;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:120px;filter:grayscale(1)">🧴</div>
           <div style="font-size:30px;line-height:1.5">제가 직접 써 보고 정착한 크림이에요~ 진짜 순하고, 우리 아기 볼이 하루 만에 보들보들해졌어요 ♡</div>
           <div style="font-size:24px;color:#888">♡ 공감 1,284 · 댓글 312</div>`, -2) },
      { svg: dad(860, 1130, 0.95, { expr: 'sparkle' }) + star(720, 960, 22) + star(1010, 950, 18) + star(1020, 1080, 14) +
          bubble(330, 1180, 250, 92, 720, 1190) },
      { html: txt(330, 1180, '역시… 선배 부모님…!', { size: 50 }) },
    ],
  }),

  6: () => ({
    title: '끝까지 내렸더니…',
    layers: [
      { html: yellowShot(60, 230, 960, 600,
          `<div style="font-size:34px;line-height:1.5">…그래서 진짜 강추드려요!<br>고민 말고 바로 쟁이세요 ♡</div>
           <div style="align-self:center;background:#eee;border:3px solid #1b1b1b;border-radius:40px;padding:12px 34px;font-size:30px;font-weight:700">👇 최저가 구매 링크 👇</div>
           <div style="flex:1"></div>
           <div style="font-size:22px;color:#888">※ 본 포스팅은 업체로부터 제품을 무상으로 제공받아 작성되었습니다.</div>`, 1.5) +
          `<div style="position:absolute;left:400px;top:600px;width:300px;height:300px;border-radius:50%;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center;font-size:44px;font-weight:900;line-height:1.3">
             <span>업체로부터<br><span style="background:${YELLOW}">제품을 무상으로</span><br>제공받아…</span></div>` },
      { svg: magnifier(550, 750, 150) + dad(250, 1100, 1.0, { expr: 'rage' }) },
      { html: big(770, 1150, '속았다…!', { size: 170, rot: -5 }) + txt(110, 880, '부들부들', { size: 42, rot: -14 }) },
    ],
  }),

  7: () => ({
    title: '두 번째, 해외 검색',
    layers: [
      { html: yellowShot(60, 230, 960, 640,
          `<div style="font-size:24px;color:#777">🌐 자동 번역됨 · 원문 보기</div>
           <div style="font-size:44px;font-weight:900">아기가 우는 이유 7가지</div>
           <div style="font-size:34px;line-height:1.5"><b>1.</b> 당신의 아기가 울 때, 그것은 <span style="background:${YELLOW}">당신의 아기가 울고 있다는 것</span>을 의미합니다.</div>
           <div style="font-size:34px;line-height:1.5"><b>2.</b> 아기는 배고픔을 느낄 때 배가 고픕니다.</div>
           <div style="font-size:34px;line-height:1.5;color:#999"><b>3.</b> …</div>`, -1.5) +
          ad(600, 650, 420, 210, '아기 10초 만에 재우는<br>기적의 이불 🔥', 4) +
          ad(110, 760, 380, 190, '오늘만 90% 할인!!<br>육아템 대방출', -5) },
      { svg: dad(820, 1120, 0.95, { expr: 'deadpan' }) + bubble(420, 1050, 200, 84, 720, 1130) },
      { html: txt(420, 1050, '…그래서요?', { size: 54 }) + cap(40, 1200, '광고 닫으려다\n광고 눌렀다 (세 번째)', { bg: YELLOW, size: 32 }) },
    ],
  }),

  8: () => ({
    title: '그리고 검색은 늘<br>최악부터 보여준다',
    layers: [
      { html: card(60, 290, 650, 480,
          `${searchBar('아기 딸꾹질', { size: 32 })}
           ${[['딸꾹질, 알고 보니 무서운 병의 신호?!', 'health-info.example'], ['의사들이 경고하는 증상 TOP 5 (충격)', 'mom-news.example'], ['이걸 놓치면 큰일 납니다…', 'baby-tip.example']]
             .map(([h, u]) => `<div style="margin-top:30px"><div style="font-size:22px;color:#999">${u}</div><div style="font-size:33px;font-weight:900;line-height:1.3;text-decoration:underline">${h}</div></div>`).join('')}`,
          { rot: -1.5, pad: 28 }) },
      { svg: dad(880, 700, 0.8, { expr: 'pale' }) + bubble(450, 900, 230, 88, 790, 770) + baby(230, 1160, 1.1, { expr: 'happy' }) },
      { html: txt(450, 900, '우, 우리 애…\n괜찮은 거지…?', { size: 46 }) + txt(400, 1070, '딸꾹!', { size: 64, rot: 12 }) +
          txt(500, 1300, '(정작 본인은 해맑음)', { size: 40, color: '#777' }) },
    ],
  }),

  9: () => ({
    title: '세 번째, AI 챗봇',
    layers: [
      { html: card(370, 230, 670, 440,
          `<div style="display:flex;flex-direction:column;gap:20px">
             <div style="font-size:24px;color:#888;text-align:center">AI 챗봇 · 새 대화</div>
             ${userMsg('우리 애 3개월이고요, 분유 먹고, 지난주에 접종했고, 요즘 밤에 자주 깨고, 몸무게는 6.4kg이고…')}
             ${botMsg('좋은 질문이에요! 일반적으로 이 시기 아기들은 … 하는 경우가 많아요.')}
           </div>`, { pad: 26, radius: 26 }) },
      { svg: dad(190, 610, 0.72, { expr: 'suspicious' }) + bubble(185, 330, 168, 100, 190, 455) + tier(830) },
      { html: txt(185, 330, '…맞는 말\n같은데,\n근거는?', { size: 38 }) + txt(330, 520, '슬쩍', { size: 36, rot: -10 }) },
      { svg: dad(290, 1130, 0.75, { expr: 'zombie', arm: 'typing' }) },
      { html: cap(40, 860, '새 대화를 열 때마다…', { size: 34 }) +
          card(570, 890, 470, 250,
            `<div style="display:flex;flex-direction:column;gap:12px">${userMsg('우리 애 3개월이고요, 분유 먹고, 지난주에 접종했고…', 26)}
             <div style="align-self:flex-end;font-size:22px;color:#888">(일곱 번째 자기소개)</div></div>`, { pad: 20, radius: 22 }) +
          big(800, 1250, '또 처음부터…', { size: 92, rot: -4 }) },
    ],
  }),

  10: () => ({
    title: '그래서 개발자 아빠는<br>결심했다',
    titleColor: '#fff',
    bg: '#232838',
    layers: [
      { rough: false, svg:
          `<defs><radialGradient id="glow"><stop offset="0" stop-color="#bfe4ff" stop-opacity="0.5"/><stop offset="1" stop-color="#bfe4ff" stop-opacity="0"/></radialGradient></defs>` +
          `<ellipse cx="540" cy="900" rx="560" ry="480" fill="url(#glow)"/>` },
      { svg:
          dad(540, 720, 1.05, { expr: 'focused' }) +
          G(540, 720, 1.05, limb('M -122,168 L -96,320', 34, '#c8ced8') + limb('M 122,168 L 96,320', 34, '#c8ced8')) +
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

  11: () => ({
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
          P('M 640,1250 C 540,1240 500,1120 500,990', 6, 'none', ACCENT) + P('M 480,1012 L 500,986 L 520,1012', 6, 'none', ACCENT) },
      { html: txt(850, 470, '너… 기억하고\n있었구나…', { size: 46 }) + txt(740, 1290, '출처까지…?!', { size: 58, color: ACCENT, rot: -4 }) },
    ],
  }),

  12: () => ({
    title: '앱 11개 뒤지던 걸,<br>이제 버디에게 물으면 끝',
    bg: '#FFF6E2',
    mark: false,
    layers: [
      { svg:
          `<rect x="70" y="700" width="680" height="330" rx="60" fill="#E6D6BE" stroke="${K}" stroke-width="5"/>` +
          `<rect x="40" y="960" width="740" height="230" rx="50" fill="#EBDDC7" stroke="${K}" stroke-width="5"/>` +
          dad(410, 760, 0.9, { expr: 'sleep', shirt: YELLOW, headRot: -14 }) +
          baby(410, 1000, 0.72, { expr: 'sleep', blush: '#f7c6bd' }) +
          limb('M 250,1000 C 270,1080 320,1110 380,1110', 50, YELLOW) + T.hand(384, 1108, 22) +
          limb('M 570,1000 C 550,1080 500,1110 440,1112', 50, YELLOW) + T.hand(436, 1110, 22) +
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

  /* 그림 확인용 — 표정 모음 */
  sheet: () => {
    const exprs = ['normal', 'smug', 'proud', 'panic', 'suspicious', 'rage', 'touched', 'deadpan', 'pale', 'zombie', 'focused', 'sleep'];
    let svg = '';
    let html = '';
    exprs.forEach((e, i) => {
      const x = 180 + (i % 4) * 240, y = 230 + Math.floor(i / 4) * 380;
      svg += dad(x, y, 0.62, { expr: e });
      html += txt(x, y + 150, e, { size: 30 });
    });
    svg += baby(180, 1240, 0.6, { expr: 'cry', body: false }) + baby(420, 1240, 0.6, { expr: 'sleep', body: false }) + baby(660, 1240, 0.6, { expr: 'happy', body: false });
    return { layers: [{ svg }, { html }], mark: false };
  },
};
})();
