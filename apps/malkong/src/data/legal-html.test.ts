/// <reference types="node" />
/**
 * 서버가 내보내는 약관 · 개인정보 처리방침 페이지가 본문(legal.ts)과 같은지 — `node --test src/data/legal-html.test.ts`.
 * 어긋나면 `node scripts/export-legal.mjs` 를 돌린다.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { WEB_DOCS, legalHtml } from './legal-html.ts';

test('서버의 약관 · 개인정보 처리방침 페이지가 본문과 같다', () => {
  for (const id of WEB_DOCS) {
    const file = new URL(`../../server/app/data/legal/${id}.html`, import.meta.url);
    assert.equal(readFileSync(file, 'utf8'), legalHtml(id), `${id}.html 이 낡았어요 — node scripts/export-legal.mjs`);
  }
});
