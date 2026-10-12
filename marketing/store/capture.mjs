// 스토어 스크린샷에 넣을 진짜 앱 화면을 찍는다 (docs/task/common/021).
//   1) npx expo export --platform web        → ../../dist
//   2) node capture.mjs [이름 …]             → shots/<이름>.png (1170×2532, 아이폰 390×844 @3x)
// 정적 파일 서버를 스스로 띄우고(8099) 크롬을 원격 조종해 앱을 연다. 서버로 가는 요청은 미리 정한 답으로
// 바꿔 넣는다 — 모델(Gemini)을 부르지 않는다. 답 본문은 L1 승인 항목의 문장, 위험 신호 답은 서버의 고정 문장 그대로다.
// 크롬은 CHROME=경로 → 맥 크롬 → Playwright 크로미움(~/.cache/ms-playwright) 순서로 찾는다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HEADLESS, findChrome } from './chrome.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(here, '../../dist');
const PORT = Number(process.env.PORT ?? 8099);
const APP = `http://127.0.0.1:${PORT}`;
mkdirSync(join(here, 'shots'), { recursive: true });

/* ───────── 찍을 장면 ───────── */

const DAY = 864e5;
const bornDaysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const at = (daysAgo, hour = 10) => {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const KDCA = { name: '질병관리청 예방접종도우미', url: 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=115' };
const CDC_UTI = { name: '미국 CDC 요로감염 안내', url: 'https://www.cdc.gov/uti/about/index.html' };

/** 기록 한 줄 — src/data/records.ts 의 BabyRecord */
const rec = (id, covers, label, daysAgo, kind = '기록', whenLabel = null) => ({
  id, kind, label, covers, whenLabel, sourceMessageId: null, stale: false, createdAt: at(daysAgo), updatedAt: at(daysAgo),
});

/** 4개월 아기 — 0 · 1 · 2개월 접종과 검진은 다 했고, 4개월 접종이 이번 달 차례 */
const RECORDS_4M = [
  rec('r-01', ['k-vacc-0001', 'k-vacc-0002'], 'BCG · B형간염 1차 맞았어요', 126),
  rec('r-02', ['k-chk-0001'], '영유아 건강검진 1차 다녀왔어요', 105),
  rec('r-03', ['k-vacc-0101'], 'B형간염 2차 맞았어요', 98),
  rec('r-04', ['k-vacc-0201', 'k-vacc-0202', 'k-vacc-0203', 'k-vacc-0204', 'k-vacc-0205'], '2개월 접종 다 맞았어요 (DTaP · 폴리오 · Hib · 폐렴구균 · 로타)', 66),
  rec('r-05', [], '분유를 하루 6번, 한 번에 160ml 먹어요', 20, '요약'),
  rec('r-06', [], '밤에 6시간쯤 통잠을 자요', 12, '요약'),
  rec('r-07', [], '몸무게 7.1kg', 9, '요약'),
  rec('r-08', [], '뒤집기를 시작했어요', 5, '요약'),
  rec('r-09', ['k-dev-0201'], '얼굴 보고 웃고, 엎드리면 고개를 들어요', 40, '요약'),
];

/** 그동안 물어본 것들 — 우리 아기 탭의 「나눈 질문 N번」. 답은 싣지 않는다(그 장면에서 대화는 안 보인다) */
const QUESTIONS_4M = [
  'BCG 언제 맞아요?', '신생아 배꼽 소독 어떻게 해요?', '분유 양은 얼마나 줘야 해요?', '딸꾹질 자주 하는데 괜찮아요?',
  '2개월 접종 뭐 맞아요?', '접종하고 열이 나면 어떡해요?', '밤에 자주 깨는데 왜 그래요?', '터미타임은 언제부터 해요?',
  '이유식은 언제 시작해요?', '뒤집기는 보통 언제 해요?', '낮잠은 몇 번 재워요?', '4개월 접종은 뭐 맞아요?',
].map((content, i) => ({ id: `q-${i}`, role: 'user', content, meta: {}, createdAt: at(120 - i * 9, 14) }));

const usage = { remaining: 9 };
const ANSWER_BCG = {
  type: 'answer', level: '사실', eco: false, usage, records: [],
  answer: 'BCG는 결핵을 막는 예방접종으로, 생후 4주 안에 한 번 맞으면 끝나요.\n\n말콩이는 지금 생후 3주라 이번 주 안에 맞히면 돼요.',
  sources: [{ id: 'k-vacc-0001', ...KDCA }],
};
const ANSWER_4M = {
  type: 'answer', level: '사실', eco: false, usage, records: [],
  answer:
    '4개월에 맞는 접종은 DTaP 2차, 폴리오 2차, Hib 2차, 폐렴구균 2차, 로타바이러스 2차예요. ' +
    'DTaP · Hib · 폐렴구균 3차는 6개월이고, 폴리오 3차는 6~18개월 사이에 맞아요.\n\n' +
    '말콩이는 2개월 접종을 다 맞았으니, 이번 달에 2차를 맞을 차례예요.',
  sources: [{ id: 'k-vacc-0401', ...KDCA }],
};
// 서버 app/domain/ask/service.py 의 REDFLAG_HEAD · 항목 title + body · REDFLAG_TAIL 그대로
const REDFLAG = {
  type: 'redflag',
  answer:
    '말씀하신 내용에 바로 진료가 필요할 수 있는 신호가 있어요.\n\n' +
    '3개월 미만 아기의 열 — 38°C 이상이면 바로 의료진에게 연락\n' +
    '생후 3개월이 안 된 아기가 38°C(100.4°F) 이상 열이 나면 바로 의료진에게 연락해요.\n\n' +
    '증상이 심하거나 아기가 반응이 없으면 바로 119 에 전화하세요. 그렇지 않더라도 지금 소아청소년과나 응급실에서 진료를 받으세요.',
  sources: [{ id: 'k-warn-0001', ...CDC_UTI }],
};
const ENTITLEMENTS = { ads: false, dailyLimit: 10, rewardPerAd: 3, rewardMaxPerDay: 2, remaining: 9 };

const SHOTS = {
  /** 첫 장 — 생후 3주, BCG 질문과 출처 */
  answer: { born: 21, route: '/', ask: { q: 'BCG 언제 맞아요?', res: ANSWER_BCG, wait: '결핵을 막는' } },
  /** 2장 — 4개월, 접종 질문과 출처 */
  vaccine4: { born: 130, records: RECORDS_4M, route: '/', ask: { q: '4개월 접종은 뭐 맞아요?', res: ANSWER_4M, wait: '폐렴구균 2차' } },
  /** 3장 — 생후 2개월, 열 → 위험 신호 안내 */
  redflag: { born: 60, route: '/', ask: { q: '열이 38.5도예요. 해열제 먹여도 돼요?', res: REDFLAG, wait: '바로 진료가 필요할' } },
  /** 4장 — 일정 탭. 오늘이 딱 4개월 되는 날이라 달력의 오늘에 접종 · 검진 무렵 점이 찍히고 그날 할 것이 보인다 */
  schedule: { born: 4, bornUnit: 'month', records: RECORDS_4M, route: '/schedule', wait: '개월별 챙길 것' },
  /** 5장 — 우리 아기 탭 */
  baby: { born: 130, records: RECORDS_4M, chat: QUESTIONS_4M, route: '/baby', wait: '알게 된 내용' },
  /** 1-2장 — 어제 저녁 열 기록 → 오늘 아침 안부. 아침 8시로 맞추고 대화 맨 위(안부)로 올린다 */
  briefing: {
    born: 150,
    records: [...RECORDS_4M, { ...rec('r-10', [], '체온 38.2℃ — 저녁에 좀 보챘어요', 1), createdAt: at(1, 19), updatedAt: at(1, 19) }],
    route: '/', wait: '열', settle: 2500, clock: 8, scrollTop: true,
  },
};

/* ───────── 정적 파일 서버 — 라우트(/schedule)는 dist/schedule.html 로 ───────── */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html 이 없어요 — 먼저 npx expo export --platform web');
  process.exit(1);
}
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, APP).pathname);
  let file = join(DIST, path);
  if (path === '/' || (existsSync(file) && statSync(file).isDirectory())) file = join(file, 'index.html');
  if (!existsSync(file)) file = existsSync(`${file}.html`) ? `${file}.html` : join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ───────── 크롬 ───────── */

const profile = join(tmpdir(), 'malkong-store-capture');
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(findChrome(), [
  ...HEADLESS, '--remote-debugging-port=9334', `--user-data-dir=${profile}`, '--window-size=500,1000', 'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quit = (code) => {
  chrome.kill();
  server.close();
  process.exit(code);
};

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  await sleep(250);
  try {
    const page = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
}
if (!ws) {
  console.error('크롬 디버그 포트에 못 붙었어요');
  quit(1);
}
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const waiting = new Map();
const handlers = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m.result ?? m.error);
    waiting.delete(m.id);
  } else if (m.method) handlers.forEach((h) => h(m));
});
const send = (method, params = {}) => new Promise((r) => { seq++; waiting.set(seq, r); ws.send(JSON.stringify({ id: seq, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const text = () => run('document.body.innerText');
const until = async (pred, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pred()) return true;
    await sleep(300);
  }
  return false;
};

// 서버로 가는 요청 — 장면마다 정한 답으로 바꿔 넣는다(CORS 머리도 붙인다). 모르는 길은 빈 204
let askResponse = null;
const cors = [
  { name: 'Access-Control-Allow-Origin', value: '*' },
  { name: 'Access-Control-Allow-Headers', value: '*' },
  { name: 'Access-Control-Allow-Methods', value: 'GET, POST, DELETE, OPTIONS' },
  { name: 'Content-Type', value: 'application/json' },
];
handlers.push(async (m) => {
  if (m.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = m.params;
  const path = new URL(request.url).pathname;
  const body = request.method === 'OPTIONS' ? null
    : path === '/v1/ask' ? askResponse
    : path.startsWith('/v1/entitlements') ? ENTITLEMENTS
    : null;
  await send('Fetch.fulfillRequest', {
    requestId,
    responseCode: body ? 200 : 204,
    responseHeaders: cors,
    ...(body ? { body: Buffer.from(JSON.stringify(body)).toString('base64') } : {}),
  });
});

await send('Page.enable');
await send('Runtime.enable');
await send('Fetch.enable', { patterns: [{ urlPattern: '*run.app/*' }, { urlPattern: '*://localhost:8000/*' }, { urlPattern: '*://127.0.0.1:8000/*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

/** 온보딩을 마친 기기처럼 — 아기 · 기록 · 만화 본 표시 · 기기 키 · 알림 끔 */
function seedScript(shot) {
  let born;
  if (shot.bornUnit === 'month') {
    // 오늘이 딱 N개월 되는 날 — 달력의 오늘에 그 달 접종 · 검진이 찍힌다
    const d = new Date();
    d.setMonth(d.getMonth() - shot.born);
    born = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else born = bornDaysAgo(shot.born);
  const baby = { id: 'store', name: '말콩이', birthDate: born, createdAt: `${born}T00:00:00.000Z`, updatedAt: `${born}T00:00:00.000Z` };
  const settings = { intro_seen: 'yes', device_key: 'store-capture', briefing_time: 'off', record_nudge_card: 'off', record_nudge_push: 'off' };
  // 시계를 오늘 몇 시로 맞춘다(인사말 「좋은 아침이에요」) — 날짜는 그대로라 「오늘」 셈은 안 바뀐다
  const clock = shot.clock === undefined ? '' : `
    const target = new Date(); target.setHours(${shot.clock}, 0, 0, 0);
    const offset = target.getTime() - Date.now();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
      static now() { return RealDate.now() + offset; }
    }
    window.Date = FakeDate;`;
  return `try {
    localStorage.clear();
    localStorage.setItem('malkong.baby', ${JSON.stringify(JSON.stringify(baby))});
    localStorage.setItem('malkong.records', ${JSON.stringify(JSON.stringify(shot.records ?? []))});
    localStorage.setItem('malkong.chat', ${JSON.stringify(JSON.stringify(shot.chat ?? []))});
    ${Object.entries(settings).map(([k, v]) => `localStorage.setItem('malkong.setting.${k}', '${v}');`).join('\n    ')}
  } catch {}${clock}`;
}

/** 대화 목록처럼 스크롤되는 칸을 맨 위로 — 브리핑의 안부가 보이게 */
const SCROLL_TOP = `(() => {
  const boxes = [...document.querySelectorAll('div')].filter((el) => {
    const s = getComputedStyle(el);
    return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20;
  });
  boxes.forEach((el) => { el.scrollTop = 0; });
  return boxes.length;
})()`;

let seedId = null;
async function capture(name, shot) {
  askResponse = shot.ask?.res ?? null;
  if (seedId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedId });
  seedId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript(shot) })).identifier;
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await send('Page.navigate', { url: `${APP}${shot.route}` });
  const ready = await until(async () => (await text())?.includes(shot.ask ? '무엇이든' : shot.wait));
  if (!ready) console.log(`${name}: 화면이 안 떴어요 — ${(await text())?.slice(0, 200)}`);
  await sleep(shot.settle ?? 1500);
  if (shot.ask) {
    // 웹의 TextInput 은 textarea 라 값을 바꾸고 input 이벤트를 낸다
    const typed = await run(`(() => {
      const box = document.querySelector('textarea');
      if (!box) return 'textarea 없음';
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, ${JSON.stringify(shot.ask.q)});
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok';
    })()`);
    await sleep(400);
    const sent = await run(`(() => { const b = document.querySelector('[aria-label="보내기"]'); if (!b) return '단추 없음'; b.click(); return 'ok'; })()`);
    const answered = await until(async () => (await text())?.includes(shot.ask.wait));
    console.log(`${name}: 입력 ${typed} · 보내기 ${sent} · 답 ${answered ? '옴' : '안 옴'}`);
    await run('document.activeElement && document.activeElement.blur()');
    await sleep(1200);
  }
  if (shot.scrollTop) {
    console.log(`${name}: 맨 위로 올린 칸 ${await run(SCROLL_TOP)}`);
    await sleep(800);
  }
  const shotData = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(here, 'shots', `${name}.png`), Buffer.from(shotData.data, 'base64'));
  console.log(`${name}: shots/${name}.png — ${JSON.stringify((await text())?.replace(/\n+/g, ' / ').slice(0, 220))}`);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
for (const name of names) {
  if (!SHOTS[name]) {
    console.log(`${name}: 모르는 장면 — ${Object.keys(SHOTS).join(' · ')}`);
    continue;
  }
  await capture(name, SHOTS[name]);
}
quit(0);
