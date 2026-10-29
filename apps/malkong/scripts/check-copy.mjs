#!/usr/bin/env node
/**
 * 화면 문구 점검 — src/ 의 한국어 문자열에서 AI 가 쓴 티(느낌표 · 이모지 · 광고 말 · 번역투 · 상투 결산)를 찾아 파일과 줄 번호로 보여 준다.
 * 점검표는 저장소 공통 docs/governance/korean-copy-check.md (task common/027).
 * 기계가 먼저 찾고 사람이 판단한다 — 찾았다고 모두 고치지는 않는다. `npm run copy-check`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/** 찾을 것 — 이름 · 정규식. 점검표의 번호를 적어 둔다 */
const RULES = [
  // 글 끝이나 낱말 뒤의 느낌표만 — 코드의 `x!` 는 아니다
  { id: 1, name: '느낌표', re: /[가-힣a-zA-Z0-9][!！](?=\s|$|[」'"`])/ },
  { id: 1, name: '이모지', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}]/u },
  { id: 2, name: '광고 말', re: /스마트(?!스토어)|간편|손쉽|효율|최적|완벽|솔루션|혁신|놀라운|특별한|소중한|프리미엄|강력한/ },
  { id: 3, name: '영어 추상어 직역', re: /경험을|다양한|활용|여정|인사이트|관리하세요|제공해|제공합|지원합니다|기능을 통해/ },
  { id: 4, name: '이중 피동 · 번역투', re: /되어지|보여지|에 의해|을 통해|를 통해|에 있어서|함으로써|바탕으로|에 대한|에 대해/ },
  { id: 5, name: '형식 명사 결말', re: /것이 중요|필요한 것은|라는 점|것이 좋습니다/ },
  { id: 6, name: '상투 결산 · 열거 도입', re: /결론적으로|이를 통해|다음과 같은|크게 .* 가지/ },
  { id: 7, name: '기계 같은 말', re: /도착했어요|함께 쌓아|성공적으로|정상적으로|처리되었|완료되었습니다|업데이트되었/ },
  { id: 10, name: '합니다체', re: /합니다[.」'"]|입니다[.」'"]|습니다[.」'"]/ },
];

const HANGUL = /[가-힣]/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'legal' || name === 'l1') continue; // 약관 · 공공 자료 원문은 따로 본다
      yield* files(full);
    } else if (/\.(tsx?|json)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/^legal(-html)?\.ts$/.test(name)) yield full; // 약관은 긴 글이라 따로(humanize-korean)
  }
}

/** 한 줄에서 사람에게 보이는 글만 — 따옴표 안의 글과 JSX 글. 주석은 뺀다 */
function visibleText(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return [];
  const found = [];
  for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) if (HANGUL.test(m[2])) found.push(m[2]);
  // JSX 글 — 태그 사이의 글
  for (const m of line.matchAll(/>([^<>{}]*[가-힣][^<>{}]*)</g)) found.push(m[1].trim());
  // 태그 없이 한 줄 통째로 글인 경우(여러 줄 JSX 안)
  if (found.length === 0 && HANGUL.test(trimmed) && !/[=:;(){}]/.test(trimmed)) found.push(trimmed);
  return found;
}

let count = 0;
for (const file of files(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const text of visibleText(line)) {
      for (const rule of RULES) {
        if (rule.re.test(text)) {
          count++;
          console.log(`${relative(ROOT, file)}:${i + 1}  [${rule.id} ${rule.name}]  ${text}`);
        }
      }
    }
  });
}
console.log(count === 0 ? '찾은 것이 없어요' : `\n${count}곳 — 하나씩 보고 고치거나 남긴 이유를 적는다`);
