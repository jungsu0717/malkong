// 스토어 스크린샷에 넣을 진짜 앱 화면을 찍는다 — 웹 개발 서버(npx expo start --web --port 8099)를 띄운 뒤
// `node capture.mjs` → shots/answer.png (1170×2532, 아이폰 390×844 @3x).
// 크롬을 원격 조종해 앱을 열고, 서버로 가는 요청만 미리 정한 답으로 바꿔 넣는다 — 모델(Gemini)을 부르지 않는다.
// 답은 L1 k-vacc-0001(질병관리청 예방접종도우미 · BCG)의 내용에 아기 나이를 더한 것이다.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8099/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const here = new URL('.', import.meta.url).pathname;
mkdirSync(join(here, 'shots'), { recursive: true });

/** 생후 3주 아기 — 오늘에서 21일 전에 태어났다 */
const born = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
const QUESTION = 'BCG 언제 맞아요?';
const ANSWER = {
  type: 'answer',
  answer: 'BCG는 결핵을 막는 예방접종으로, 생후 4주 안에 한 번 맞으면 끝나요.\n\n말콩이는 지금 생후 3주라 이번 주 안에 맞히면 돼요.',
  level: '사실',
  sources: [{ id: 'k-vacc-0001', name: '질병관리청 예방접종도우미', url: 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=115' }],
  records: [],
  usage: { remaining: 9 },
  eco: false,
};
const ENTITLEMENTS = { ads: false, dailyLimit: 10, rewardMaxPerDay: 3, remaining: 9 };

const profile = join(tmpdir(), 'malkong-store-capture');
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9334', `--user-data-dir=${profile}`, '--window-size=500,1000', 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const page = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const waiting = new Map();
const handlers = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m.result);
    waiting.delete(m.id);
  } else if (m.method) handlers.forEach((h) => h(m));
});
const send = (method, params = {}) => new Promise((r) => { seq++; waiting.set(seq, r); ws.send(JSON.stringify({ id: seq, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

// 서버로 가는 요청 — 미리 정한 답으로 바꿔 넣는다(CORS 머리도 붙인다)
const cors = [
  { name: 'Access-Control-Allow-Origin', value: '*' },
  { name: 'Access-Control-Allow-Headers', value: '*' },
  { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  { name: 'Content-Type', value: 'application/json' },
];
handlers.push(async (m) => {
  if (m.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = m.params;
  const path = new URL(request.url).pathname;
  const body = request.method === 'OPTIONS' ? null
    : path === '/v1/ask' ? ANSWER
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
await send('Fetch.enable', { patterns: [{ urlPattern: '*run.app/*' }, { urlPattern: 'http://localhost:8000/*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
// 온보딩을 마친 기기처럼 — 아기 생일 · 만화 본 표시 · 기기 키
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try {
    localStorage.setItem('malkong.baby', JSON.stringify({ id: 'store', name: '말콩이', birthDate: '${born}', createdAt: '${born}T00:00:00.000Z' }));
    localStorage.setItem('malkong.setting.intro_seen', 'yes');
    localStorage.setItem('malkong.setting.device_key', 'store-capture');
    localStorage.setItem('malkong.setting.briefing_time', 'off');
  } catch {}`,
});
await send('Page.navigate', { url: APP });
await sleep(7000);

// 질문을 치고 보낸다 — 웹의 TextInput 은 textarea 라 값을 바꾸고 input 이벤트를 낸다
console.log('입력:', await run(`(() => {
  const box = document.querySelector('textarea');
  if (!box) return 'textarea 없음';
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, ${JSON.stringify(QUESTION)});
  box.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`));
await sleep(500);
console.log('보내기:', await run(`(() => { const b = document.querySelector('[aria-label="보내기"]'); if (!b) return '단추 없음'; b.click(); return 'ok'; })()`));
await sleep(5000);
// 키보드 · 입력 칸 포커스를 치운다
await run('document.activeElement && document.activeElement.blur()');
await sleep(800);

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(here, 'shots/answer.png'), Buffer.from(shot.data, 'base64'));
console.log('화면 글:', JSON.stringify((await run('document.body.innerText')).slice(0, 400)));
chrome.kill();
process.exit(0);
