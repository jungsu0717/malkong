// 약관 · 개인정보 처리방침을 웹 페이지로 만든다 — 스토어에 넣을 공개 주소용(task common/024).
//   node scripts/export-legal.mjs   → server/app/data/legal/{privacy,terms}.html
// 본문 정본은 src/data/legal.ts 다. 고친 뒤 이 명령을 다시 돌리고 서버를 배포하면 웹 주소의 내용도 바뀐다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WEB_DOCS, legalHtml } from '../src/data/legal-html.ts';

const out = fileURLToPath(new URL('../server/app/data/legal/', import.meta.url));
mkdirSync(out, { recursive: true });
for (const id of WEB_DOCS) {
  writeFileSync(join(out, `${id}.html`), legalHtml(id));
  console.log(`server/app/data/legal/${id}.html`);
}
