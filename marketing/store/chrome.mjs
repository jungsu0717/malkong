// 크롬 찾기 — CHROME=경로 → 맥 크롬 → Playwright 크로미움(~/.cache/ms-playwright). capture.mjs · render.mjs 가 같이 쓴다
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(mac)) return mac;
  const pw = join(homedir(), '.cache/ms-playwright');
  if (existsSync(pw)) {
    const dirs = readdirSync(pw)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      for (const tail of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = join(pw, d, tail);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('크롬을 못 찾았어요 — CHROME=경로 로 알려 주세요');
}

/** 헤드리스 공통 옵션 */
export const HEADLESS = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars'];
