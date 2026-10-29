// 스토어 그림을 전부 찍는다 — node render.mjs [이름 …] (없으면 전부). 맥 · 리눅스 모두(크롬은 chrome.mjs 가 찾는다)
//   out/01-home · 02-year · 03-routine · 04-todo · 05-shop · 06-growth · 07-family — 각각 -ios.png(1290×2796) · -play.png(1080×1920)
//   out/feature.png — 구글 플레이 그래픽 이미지(1024×500)
// 앱 화면(shots/*.png)은 웹 빌드를 띄우고 `node capture.mjs` 로 먼저 찍는다
import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HEADLESS, findChrome } from './chrome.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const chrome = findChrome();

/** [이름, 페이지, 창 너비, 창 높이, 배율] — 플레이는 1290×2293 을 0.8372 배로 찍어 1080×1920 */
const PLAY = 1080 / 1290;
const pages = [
  ...[['01', 'home'], ['02', 'year'], ['03', 'routine'], ['04', 'todo'], ['05', 'shop'], ['06', 'growth'], ['07', 'family']].flatMap(([n, p]) => [
    [`${n}-${p}-ios`, `store.html?p=${p}&v=ios`, 1290, 2796, 1],
    [`${n}-${p}-play`, `store.html?p=${p}&v=play`, 1290, 2293, PLAY],
  ]),
  ['feature', 'feature.html', 1024, 500, 1],
];

/** PNG 머리에서 크기를 읽는다(sips 없이) */
function size(file) {
  const buf = Buffer.alloc(24);
  const fd = openSync(file, 'r');
  readSync(fd, buf, 0, 24, 0);
  return `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`;
}

const only = process.argv.slice(2);
for (const [name, page, w, h, scale] of pages) {
  if (only.length && !only.some((o) => name.includes(o))) continue;
  const out = join(here, 'out', `${name}.png`);
  const r = spawnSync(chrome, [
    ...HEADLESS, `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--virtual-time-budget=8000',
    '--allow-file-access-from-files', `--screenshot=${out}`, `file://${here}${page}`,
  ], { stdio: 'ignore' });
  console.log(r.status === 0 ? `out/${name}.png ${size(out)}` : `${name}: 실패(${r.status})`);
}
