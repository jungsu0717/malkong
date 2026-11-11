/// <reference types="node" />
/**
 * 하루 초안 시험 — `node --test src/data/day-draft.test.ts`. 보는 날은 2026-11-09(월), 지난 7일은 11월 2일~8일.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  asksDraft,
  busiestDay,
  dayRecords,
  liveShellSet,
  makeShellSet,
  negatedShells,
  openShells,
  shellHint,
  shellInput,
  shellSetFromText,
  shellTitle,
  stripDraftAsk,
  type ShellSet,
} from './day-draft.ts';
import type { RoutineDone } from './day-flow.ts';
import type { CareEvent } from './events.ts';

const DAY = new Date(2026, 10, 9);
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
let n = 0;
const ev = (o: Partial<CareEvent> & Pick<CareEvent, 'kind' | 'startAt'>): CareEvent => ({
  id: `e${++n}`,
  endAt: o.startAt,
  amount: null,
  side: null,
  diaper: null,
  color: null,
  note: null,
  by: null,
  createdAt: o.startAt,
  updatedAt: o.startAt,
  ...o,
});

/** 11월 2일~8일 — 날마다 분유 다섯 번, 소변 둘, 대변 하나, 낮잠 둘. 날마다 5분씩 어긋난다 */
function week(): CareEvent[] {
  const out: CareEvent[] = [];
  for (let d = 2; d <= 8; d++) {
    const j = ((d % 3) - 1) * 5;
    for (const [h, m, ml] of [
      [7, 40, 120],
      [10, 30, 140],
      [13, 30, 140],
      [16, 50, 140],
      [19, 50, 150],
    ]) out.push(ev({ kind: 'formula', startAt: at(d, h, m + j), amount: ml + (d === 5 ? 10 : 0) }));
    out.push(ev({ kind: 'diaper', diaper: 'pee', startAt: at(d, 7, 35 + j) }));
    out.push(ev({ kind: 'diaper', diaper: 'poo', startAt: at(d, 10, 40 + j) }));
    out.push(ev({ kind: 'diaper', diaper: 'pee', startAt: at(d, 17, 0 + j) }));
    out.push(ev({ kind: 'sleep', startAt: at(d, 12, 0 + j), endAt: at(d, 13, 10 + j) }));
    out.push(ev({ kind: 'sleep', startAt: at(d, 15, 30 + j), endAt: at(d, 16, 20 + j) }));
    out.push(ev({ kind: 'sleep', startAt: at(d, 21, 0 + j), endAt: at(d + 1, 5, 30) }));
  }
  return out.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

test('초안을 부탁하는 말과 그 나머지', () => {
  assert.equal(asksDraft('오늘 하루 기록 초안으로 작성해 줘. 10시 반에 분유 140 먹었어'), true);
  assert.equal(asksDraft('초안 만들어 줘'), true);
  assert.equal(asksDraft('분유 120 먹였어'), false);
  assert.equal(asksDraft('전체 기록 작성해줘'), true);
  assert.equal(asksDraft('오늘 기록 다 채워 줘'), true);
  assert.equal(asksDraft('오늘 기록 보여줘'), false);
  assert.equal(stripDraftAsk('전체 기록 작성해줘'), '');
  assert.equal(stripDraftAsk('오늘 하루 기록 초안으로 작성해 줘. 10시 반에 분유 140 먹었어'), '10시 반에 분유 140 먹었어');
  assert.equal(stripDraftAsk('초안으로 잡아 주고 7시에 소변 갈았어'), '7시에 소변 갈았어');
  assert.equal(stripDraftAsk('오늘 하루 초안 작성해 줘'), '');
});


const NOW = new Date(2026, 10, 9, 11, 5);
const hm = (set: ShellSet, i: number) => shellHint(set, set.items[i]);

test('복사할 날 — 지난 7일 가운데 기록이 가장 많았던 날, 같으면 가장 최근', () => {
  const events = week();
  // 날마다 같으면 어제(8일)
  assert.equal(busiestDay(events, [], DAY, NOW)?.day.getDate(), 8);
  // 6일에 기록이 하나 더 있으면 6일
  const more = [...events, ev({ kind: 'diaper', diaper: 'pee', startAt: at(6, 22, 0) })];
  assert.equal(busiestDay(more, [], DAY, NOW)?.day.getDate(), 6);
  // 어제 기록을 깜빡했으면 그 전의 날
  const noYesterday = events.filter((e) => !e.startAt.startsWith('2026-11-08') && new Date(e.startAt).getDate() !== 8);
  assert.equal(busiestDay(noYesterday, [], DAY, NOW)?.day.getDate(), 7);
  assert.equal(busiestDay([], [], DAY, NOW), null);
});

test('초안 — 그날을 복사한 빈칸, 시각은 비우고 어제 시각만 작게', () => {
  const dones: RoutineDone[] = [{ routineId: 'rt-bath', logId: 'l1', title: '목욕', at: at(8, 19, 30), by: null, endAt: null }];
  const set = makeShellSet(week(), dones, DAY, NOW)!;
  assert.equal(set.day, '2026-11-09');
  assert.equal(set.source, '2026-11-08');
  assert.equal(set.made, '2026-11-09');
  // 분유 다섯, 기저귀 셋, 잠 셋(밤잠 포함), 목욕
  assert.equal(set.items.length, 12);
  assert.equal(set.items[0].title, '소변');
  assert.equal(hm(set, 0), '어제 07:40');
  const formula = set.items.find((s) => s.kind === 'formula')!;
  assert.equal(formula.title, '분유 120ml');
  assert.ok(set.items.some((s) => s.title === '낮잠 1시간 10분'));
  assert.ok(set.items.some((s) => s.title.startsWith('밤잠')));
  assert.ok(set.items.some((s) => s.kind === 'routine' && s.title === '목욕' && s.routineId === 'rt-bath'));
  // 체온은 옮기지 않는다
  const withTemp = [...week(), ev({ kind: 'temp', amount: 37.2, startAt: at(8, 9, 0) })];
  assert.equal(makeShellSet(withTemp, [], DAY, NOW)!.items.filter((s) => s.title.includes('37')).length, 0);
  // 날이 지나면 버린다
  assert.equal(liveShellSet(set, NOW), set);
  assert.equal(liveShellSet(set, new Date(2026, 10, 10, 0, 1)), null);
  // 저장했다가 읽기
  assert.deepEqual(shellSetFromText(JSON.stringify(set)), set);
  assert.equal(shellSetFromText('{깨짐'), null);
});

test('기록하면 같은 종류에서 시각이 가장 가까운 빈칸이 채워진다', () => {
  const set = makeShellSet(week(), [], DAY, NOW)!;
  const feeds = () => openShells(set, dayRecords(today, [], DAY)).filter((s) => s.kind === 'formula').map((s) => shellHint(set, s));
  let today: CareEvent[] = [];
  assert.deepEqual(feeds(), ['어제 07:45', '어제 10:35', '어제 13:35', '어제 16:55', '어제 19:55']);
  // 07:20 분유 — 07:45 칸, 모유도 수유라 10:35 칸
  today = [ev({ kind: 'formula', amount: 120, startAt: at(9, 7, 20) }), ev({ kind: 'breast', side: 'left', startAt: at(9, 10, 0), endAt: at(9, 10, 15) })];
  assert.deepEqual(feeds(), ['어제 13:35', '어제 16:55', '어제 19:55']);
  // 두 시간 넘게 떨어진 수유는 빈칸을 채우지 않는다(평소와 다른 기록)
  today = [ev({ kind: 'formula', amount: 120, startAt: at(9, 4, 0) })];
  assert.equal(feeds().length, 5);
  // 기저귀는 기저귀 칸만
  today = [ev({ kind: 'diaper', diaper: 'poo', startAt: at(9, 7, 30) })];
  assert.equal(feeds().length, 5);
  assert.equal(openShells(set, dayRecords(today, [], DAY)).filter((s) => s.kind === 'diaper').length, 2);
  // 루틴은 같은 이름끼리
  const withBath = makeShellSet(week(), [{ routineId: 'rt-bath', logId: 'l1', title: '목욕', at: at(8, 19, 30), by: null, endAt: null }], DAY, NOW)!;
  const bath = (dones: RoutineDone[]) => openShells(withBath, dayRecords([], dones, DAY)).filter((s) => s.kind === 'routine').length;
  assert.equal(bath([]), 1);
  assert.equal(bath([{ routineId: 'rt-new', logId: 'l2', title: '목 욕', at: at(9, 20, 0), by: null, endAt: null }]), 0);
  assert.equal(bath([{ routineId: 'rt-x', logId: 'l3', title: '산책', at: at(9, 19, 30), by: null, endAt: null }]), 1);
});

test('눌러서 채운 빈칸과 뺀 빈칸 — 채운 기록을 지우면 다시 보인다', () => {
  const set = makeShellSet(week(), [], DAY, NOW)!;
  const f = set.items.filter((s) => s.kind === 'formula');
  // 13:35 칸을 눌러 「지금 11:05」으로 기록했다 — 가까운 10:35 칸이 아니라 누른 칸이 채워진다
  const rec = ev({ kind: 'formula', amount: 140, startAt: at(9, 11, 5) });
  const filled: ShellSet = { ...set, filled: { [f[2].id]: rec.id }, removed: [f[4].id] };
  const left = openShells(filled, dayRecords([rec], [], DAY)).filter((s) => s.kind === 'formula').map((s) => shellHint(set, s));
  assert.deepEqual(left, ['어제 07:45', '어제 10:35', '어제 16:55']);
  // 그 기록을 지우면 13:35 칸이 돌아온다
  assert.equal(openShells(filled, dayRecords([], [], DAY)).filter((s) => s.kind === 'formula').length, 4);
});

test('빈칸을 기록으로 — 시각을 고르고, 지금보다 늦게 끝나는 잠은 재는 중으로', () => {
  const set = makeShellSet(week(), [], DAY, NOW)!;
  const nap = set.items.find((s) => s.title === '낮잠 1시간 10분')!;
  const now = new Date(2026, 10, 9, 12, 30).getTime();
  const from = new Date(2026, 10, 9, 12, 0).getTime();
  assert.deepEqual(shellInput(nap, from, {}, now), { kind: 'sleep', startAt: new Date(from).toISOString(), endAt: null, side: null });
  const early = new Date(2026, 10, 9, 10, 0).getTime();
  assert.equal(shellInput(nap, early, { minutes: 30 }, now)?.endAt, new Date(early + 30 * 60000).toISOString());
  const formula = set.items.find((s) => s.kind === 'formula')!;
  assert.equal(shellInput(formula, early, { amount: 160 }, now)?.amount, 160);
  assert.equal(shellTitle(formula, { amount: 160 }), '분유 160ml');
  assert.equal(shellTitle(nap, { minutes: 50 }), '낮잠 50분');
});

test('「오후 낮잠은 안 잤어」 — 규칙으로 뺄 빈칸을 고른다', () => {
  const set = makeShellSet(week(), [], DAY, NOW)!;
  const items = set.items;
  const afternoon = negatedShells('오후 낮잠은 안 잤어', items);
  assert.equal(afternoon.length, 1);
  assert.equal(shellHint(set, afternoon[0]), '어제 15:35');
  // 낮잠이 둘인데 때가 없으면 정하지 못한다
  assert.equal(negatedShells('낮잠은 안 잤어', items).length, 0);
  assert.equal(negatedShells('낮잠은 다 안 잤어', items).length, 2);
  assert.equal(shellHint(set, negatedShells('오후 5시 분유는 안 먹였어', items)[0]), '어제 16:55');
  assert.equal(shellHint(set, negatedShells('저녁에 소변 안 쌌어', items)[0]), '어제 17:05');
  assert.equal(negatedShells('분유 먹였어', items).length, 0);
});
