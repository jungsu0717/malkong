// 스토어 스크린샷에 넣을 진짜 앱 화면을 찍는다 (docs/product/store-toon.md 「스토어 스크린샷」).
//   1) npx expo export --platform web        → ../../dist
//   2) node capture.mjs [이름 …]             → shots/<이름>.png (1170×2532, 아이폰 390×844 @3x)
// 정적 파일 서버를 스스로 띄우고(8099) 크롬을 원격 조종해 앱을 연다. 서버로 가는 요청은 미리 정한 답으로 바꿔 넣는다 —
// 자격은 광고 없음(배너 자리가 찍히지 않게), 나머지는 빈 204. 기기 저장소(localStorage)에 아기 · 루틴 · 할 일 · 메모를 미리 넣는다.
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

// 오늘 오전 10시를 기준으로 데이터를 만든다 — 앱 시계도 그 시각으로 맞춘다(seedScript)
const CLOCK = 10;
const DAY = 864e5;
const BASE = new Date();
BASE.setHours(CLOCK, 0, 0, 0);
/** 오늘부터 며칠 전(음수면 뒤) 몇 시 몇 분 */
const at = (daysAgo, hour = CLOCK, minute = 0) => {
  const d = new Date(BASE.getTime() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** 그날 0시 — 시각 없는 기한 */
const dayOf = (daysAgo) => {
  const d = new Date(BASE.getTime() - daysAgo * DAY);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
/** 지난 일요일까지 며칠 */
const sinceSunday = BASE.getDay() === 0 ? 7 : BASE.getDay();
/** 다음 월요일까지 며칠(음수 — 뒤) */
const toMonday = -(((8 - BASE.getDay()) % 7) || 7);

/** 태어난 지 24일 — 성장은 「2개월까지」, 아기 일정은 1차 검진 · 50일 촬영 예약 · B형간염 2차(지난 일정이 없게) */
const BORN = ymd(new Date(BASE.getTime() - 24 * DAY));

const routine = (id, sort, o) => ({
  id, title: '', kind: 'check', everyDays: 1, weekdays: null, time: null, goalMinutes: null, items: null,
  hidden: false, sort, runningSince: null, createdAt: at(20), updatedAt: at(20), ...o,
});
const ROUTINES = [
  routine('rt-bath', 0, { title: '목욕', everyDays: 2, time: '20:00', items: ['목욕', '보습'] }),
  routine('rt-night', 1, { title: '밤잠 준비', time: '20:30', items: ['스와들 입히기', '수유', '트림', '자장가 부르며 재우기'] }),
  routine('rt-tummy', 2, { title: '터미타임', kind: 'minutes', goalMinutes: 15 }),
  routine('rt-bottle', 3, { title: '젖병 소독' }),
  routine('rt-nails', 4, { title: '손발톱 확인', everyDays: 3 }),
  routine('rt-stock', 5, { title: '재고 확인', kind: 'stock', everyDays: 7, weekdays: [0], items: ['분유', '기저귀', '물티슈', '아기 바디워시', '보습 로션'] }),
];
let logN = 0;
const log = (routineId, iso, o = {}) => ({ id: `rl-${(logN += 1)}`, routineId, at: iso, minutes: null, by: null, step: null, skip: false, createdAt: iso, ...o });
/** 오늘 한 것 — `by` 를 주면 가족 이름(「엄마 · 08:10」) */
const routineLogs = (mom = null, dad = null) => [
  log('rt-bath', at(2, 20, 10)),
  log('rt-nails', at(3, 21, 0)),
  log('rt-stock', at(sinceSunday, 11, 0)),
  log('rt-bottle', at(0, 8, 10), { by: mom }),
  log('rt-nails', at(0, 9, 20), { by: dad }),
  log('rt-tummy', at(0, 9, 30), { minutes: 8, by: mom }),
];

const T = { checkup: 'tp-checkup', milestone: 'tp-milestone', size: 'tp-size', general: 'tp-general', shopping: 'tp-shopping' };
const TOPICS = [
  ['checkup', '접종 · 검진'], ['milestone', '기념일'], ['size', '사이즈 바꾸기'], ['general', '내 할 일'], ['shopping', '장보기'],
].map(([kind, title], sort) => ({ id: T[kind], kind, title, hidden: false, sort, icon: null, createdAt: at(33), updatedAt: at(33) }));

let todoN = 0;
const todo = (topic, title, o = {}) => ({
  id: `td-store-${(todoN += 1)}`, topicId: T[topic], title, note: null, dueAt: null, hasTime: false, buy: false, source: 'manual',
  doneAt: null, repeat: null, ref: null, orderedAt: null, arriveAt: null, store: null, doneBy: null,
  createdAt: at(4), updatedAt: at(4), ...o,
});
const TODOS = [
  // 내 할 일 — 오늘 · 예정 · 날짜 없음
  todo('general', '분유 샘플 신청', { dueAt: dayOf(0) }),
  todo('general', '산후조리원 퇴소 서류 정리', { doneAt: at(0, 9, 0), dueAt: dayOf(0) }),
  todo('general', '카시트 커버 빨래', { dueAt: dayOf(toMonday) }),
  todo('general', '아기 사진 정리'),
  // 장보기 — 재고 확인에서 들어온 둘(지난 일요일), 다이소, 배송 중, 지난번 산 것
  todo('shopping', '분유 800g', { store: '마트', source: 'stock', createdAt: at(sinceSunday, 11, 1), updatedAt: at(sinceSunday, 11, 1) }),
  todo('shopping', '물티슈 캡형', { store: '마트', source: 'stock', createdAt: at(sinceSunday, 11, 1), updatedAt: at(sinceSunday, 11, 1) }),
  todo('shopping', '기저귀 정리함', { store: '다이소' }),
  todo('shopping', '기저귀 2단계', { orderedAt: at(1, 21, 0), arriveAt: dayOf(-1) }),
  todo('shopping', '손톱 가위', { store: '다이소', doneAt: at(6, 15, 0) }),
  todo('shopping', '아기 바디워시', { store: '마트', doneAt: at(5, 18, 0) }),
];

const memo = (id, text, daysAgo, ref = null) => ({ id, at: at(daysAgo, 11), text, ref, createdAt: at(daysAgo, 11), updatedAt: at(daysAgo, 11) });
const MEMOS = [
  memo('mm-k-dev-0219', '엎드려서 고개를 들어요', 6, 'k-dev-0219'),
  memo('mm-k-dev-0214', '말 걸거나 웃어 주면 따라 웃어요', 3, 'k-dev-0214'),
  memo('mm-store-1', '처음으로 소리 내서 웃었어요', 1),
];

/** 접종 · 검진 완료 기록 — 태어난 날 맞은 BCG · B형간염 1차(아기 일정에서 완료로 빠진다) */
const RECORDS = [
  {
    id: 'r-store-1', kind: '기록', label: 'BCG · B형간염 1차 맞았어요', covers: ['k-vacc-0001', 'k-vacc-0002'], whenLabel: null,
    sourceMessageId: null, stale: false, createdAt: at(23, 11), updatedAt: at(23, 11),
  },
];

const ENTITLEMENTS = { ads: false, operator: false };

const BASE_DATA = { routines: ROUTINES, logs: routineLogs(), topics: TOPICS, todos: TODOS, memos: MEMOS, records: RECORDS };

const SHOTS = {
  /** 1장 — 루틴 탭: 먹색 머리, 진행 고리, 버튼 보기 */
  routine: { ...BASE_DATA, route: '/', wait: '오늘 할 루틴' },
  /** 2장 — 내 할 일: 「금요일 오전 10시 …」 를 적는 중, 날짜를 읽어 「내일 오전 10:00에 알려 드려요」 */
  todo: { ...BASE_DATA, route: '/todo?cat=mine', wait: '아기 사진 정리', type: '금요일 오전 10시 산후 검진 예약', typeWait: '알려 드려요' },
  /** 3장 — 장보기: 재고 확인 한 줄, 살 곳별, 배송 중 */
  shop: { ...BASE_DATA, route: '/todo?cat=shop', wait: '기저귀 정리함' },
  /** 4장 — 아기 일정: 생일로 앱이 채운 접종 · 검진 · 기념일 */
  baby: { ...BASE_DATA, route: '/todo?cat=baby', wait: '이번 달' },
  /** 5장 — 성장 탭: 버디 · 막대 · 발달 체크 2 / 11 · 메모 */
  growth: { ...BASE_DATA, route: '/growth', wait: '발달 체크', settle: 2500 },
  /** 6장 — 가족: 시간순 보기에 「엄마 · 08:10 완료」 「아빠 · 09:20 완료」 */
  family: { ...BASE_DATA, logs: routineLogs('엄마', '아빠'), view: 'timeline', route: '/', wait: '오늘 할 루틴' },
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

// 서버로 가는 요청 — 자격은 광고 없음, 나머지는 빈 204(CORS 머리도 붙인다)
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
  const body = request.method !== 'OPTIONS' && path.startsWith('/v1/entitlements') ? ENTITLEMENTS : null;
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

/** 온보딩을 마친 기기처럼 — 아기 · 루틴 · 할 일 · 메모 · 기기 키 · 알림 끔, 시계는 오늘 오전 10시 */
function seedScript(shot) {
  const baby = { id: 'store', name: '말콩이', birthDate: BORN, createdAt: `${BORN}T00:00:00.000Z`, updatedAt: `${BORN}T00:00:00.000Z` };
  const settings = {
    intro_seen: 'yes',
    device_key: 'store-capture',
    briefing_time: 'off',
    todo_reminder_asked: 'yes',
    routine_view: shot.view ?? 'grid',
  };
  const lists = {
    'malkong.baby': baby,
    'malkong.routines': shot.routines,
    'malkong.routineLogs': shot.logs,
    'malkong.topics': shot.topics,
    'malkong.todos': shot.todos,
    'malkong.memos': shot.memos,
    'malkong.records': shot.records,
  };
  return `try {
    localStorage.clear();
    ${Object.entries(lists).map(([k, v]) => `localStorage.setItem('${k}', ${JSON.stringify(JSON.stringify(v))});`).join('\n    ')}
    ${Object.entries(settings).map(([k, v]) => `localStorage.setItem('malkong.setting.${k}', '${v}');`).join('\n    ')}
  } catch {}
  {
    const offset = ${BASE.getTime()} - Date.now();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
      static now() { return RealDate.now() + offset; }
    }
    window.Date = FakeDate;
  }
  // 한국어 줄바꿈을 낱말 단위로 — 웹은 글자 단위로 끊어 「추가했어/요」처럼 보인다(폰 앱은 낱말 단위)
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '* { word-break: keep-all; overflow-wrap: anywhere; }';
    document.head.appendChild(style);
  });`;
}

let seedId = null;
async function capture(name, shot) {
  if (seedId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedId });
  seedId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript(shot) })).identifier;
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await send('Page.navigate', { url: `${APP}${shot.route}` });
  const ready = await until(async () => (await text())?.includes(shot.wait));
  if (!ready) console.log(`${name}: 화면이 안 떴어요 — ${(await text())?.slice(0, 200)}`);
  await sleep(shot.settle ?? 1500);
  if (shot.type) {
    // 웹의 TextInput 은 input 이나 textarea — 값을 바꾸고 input 이벤트를 낸다
    const typed = await run(`(() => {
      const box = [...document.querySelectorAll('input, textarea')].find((el) => el.offsetParent !== null);
      if (!box) return '입력 칸 없음';
      const proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(box, ${JSON.stringify(shot.type)});
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok';
    })()`);
    const shown = await until(async () => (await text())?.includes(shot.typeWait), 5000);
    console.log(`${name}: 입력 ${typed} · 미리 보기 ${shown ? '보임' : '안 보임'}`);
    await run('document.activeElement && document.activeElement.blur()');
    await sleep(800);
  }
  const shotData = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(here, 'shots', `${name}.png`), Buffer.from(shotData.data, 'base64'));
  console.log(`${name}: shots/${name}.png — ${JSON.stringify((await text())?.replace(/\n+/g, ' / ').slice(0, 260))}`);
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
