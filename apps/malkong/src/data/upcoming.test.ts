/// <reference types="node" />
/**
 * 다가오는 일 셈 시험 — `node --test src/data/upcoming.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DAY, ddayText, homeRows, thisWeek } from './upcoming.ts';

const today = new Date(2026, 9, 27).getTime();
const at = (days: number) => ({ at: today + days * DAY });

test('D-day 글 — 오늘 · D-n, 지난 날은 없음', () => {
  assert.equal(ddayText(today, today), '오늘');
  assert.equal(ddayText(today + 5 * DAY, today), 'D-5');
  assert.equal(ddayText(today - DAY, today), null);
});

test('이번 주 챙길 일 — 지금 기간 · 지난 것 · 7일 안, 7일째부터는 빠진다', () => {
  // 지금 기간인 접종 · 검진은 어제 날짜로 들어온다(baby-schedule), 기한이 지난 앱 할 일은 더 앞
  const rows = [at(-20), at(-1), at(0), at(2), at(6), at(7), at(35)];
  assert.deepEqual(
    thisWeek(rows, today).map((r) => (r.at - today) / DAY),
    [-20, -1, 0, 2, 6],
  );
  assert.equal(thisWeek([at(7), at(43)], today).length, 0);
});

test('홈 카드 줄 — 이번 주 것은 모두, 적어도 세 줄, 많아도 여섯 줄', () => {
  // 시안: 지금 · 지금 · D-2 · D-5 넷이 이번 주, 그 뒤 D-35 는 안 보인다
  assert.equal(homeRows([at(-1), at(-1), at(2), at(5), at(35), at(43)], today).length, 4);
  // 이번 주가 비어도 다음 것 세 줄
  assert.equal(homeRows([at(12), at(35), at(43), at(60)], today).length, 3);
  assert.equal(homeRows([at(12)], today).length, 1);
  assert.equal(homeRows([], today).length, 0);
  // 이번 주가 여덟이어도 여섯 줄
  assert.equal(homeRows([0, 0, 1, 1, 2, 3, 4, 5].map(at), today).length, 6);
});
