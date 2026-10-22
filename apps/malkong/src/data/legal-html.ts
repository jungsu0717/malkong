/**
 * 약관 · 개인정보 처리방침 · 자주 묻는 질문을 웹 페이지 한 장으로 — 스토어에 넣을 공개 주소용(task common/024).
 * 서버가 `/privacy` · `/terms` · `/support`(자주 묻는 질문 — App Store 의 지원 URL)로 그대로 내보낸다. 만드는 명령은 `node scripts/export-legal.mjs`,
 * 서버 사본이 본문(legal.ts)과 어긋나면 `legal-html.test.ts` 가 실패한다.
 */

import { DRAFT, legalDoc } from './legal.ts';

export const WEB_DOCS = ['privacy', 'terms', 'faq'] as const;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function legalHtml(id: (typeof WEB_DOCS)[number]): string {
  const doc = legalDoc(id);
  if (!doc) throw new Error(`없는 문서: ${id}`);
  const sections = doc.sections
    .map((s) => `<h2>${escape(s.heading)}</h2>\n${s.body.map((p) => `<p>${escape(p)}</p>`).join('\n')}`)
    .join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(doc.title)} — 육아버디</title>
<style>
:root { --ink: #16161a; --sub: #5e5e69; --line: #dedee4; --accent: #c64536; --bg: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --ink: #f4f4f6; --sub: #a9a9b3; --line: #2c2c33; --bg: #0e0e11; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.7 -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; word-break: keep-all; }
main { max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
.brand { color: var(--accent); font-weight: 700; margin: 0 0 4px; }
h1 { font-size: 26px; margin: 0 0 24px; }
h2 { font-size: 18px; margin: 32px 0 8px; padding-top: 16px; border-top: 1px solid var(--line); }
p { margin: 0 0 8px; color: var(--sub); }
.draft { padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; color: var(--sub); font-size: 14px; }
</style>
</head>
<body>
<main>
<p class="brand">육아버디</p>
<h1>${escape(doc.title)}</h1>
${DRAFT && id !== 'faq' ? '<p class="draft">초안이에요 — 출시 전에 검토해 확정해요</p>\n' : ''}${sections}
</main>
</body>
</html>
`;
}
