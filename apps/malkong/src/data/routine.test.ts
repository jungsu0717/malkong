/// <reference types="node" />
/**
 * 루틴 시험 — `node --test src/data/routine.test.ts`. 기준 시각은 2026-10-16(금) 14:00.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  countsDone,
  dateLabel,
  everyLabel,
  isDueOn,
  nextDayLabel,
  routineReminders,
  slotOf,
  statusLine,
  stockToBuy,
  timeLabel,
  todayPlan,
  todayState,
  type Routine,
  type RoutineLog,
} from './routine.ts';

const NOW = new Date(2026, 9, 16, 14, 0);
const iso = (mo: number, d: number, h = 9, mi = 0) => new Date(2026, mo - 1, d, h, mi).toISOString();
const routine = (o: Partial<Routine> = {}): Routine => ({
  id: 'r1',
  title: '목욕',
  kind: 'check',
  everyDays: 1,
  time: '19:00',
  goalMinutes: null,
  items: null,
  hidden: false,
  sort: 0,
  runningSince: null,
  createdAt: iso(10, 1),
  updatedAt: iso(10, 1),
  ...o,
});
let n = 0;
const log = (at: string, minutes: number | null = null, routineId = 'r1', by: string | null = null): RoutineLog => ({
  id: `l${(n += 1)}`,
  routineId,
  at,
  minutes,
  by,
  step: null,
  createdAt: at,
});

test('체크 루틴 — 오늘 했나, 몇 시에', () => {
  const r = routine();
  assert.equal(todayState(r, [], NOW).done, false);
  const s = todayState(r, [log(iso(10, 16, 8, 10))], NOW);
  assert.equal(s.done, true);
  assert.equal(s.firstAt, iso(10, 16, 8, 10));
});

test('시간 재기 — 오늘 누적, 목표가 있으면 채웠나', () => {
  const r = routine({ kind: 'minutes', title: '터미타임', time: null });
  const logs = [log(iso(10, 16, 9), 5), log(iso(10, 16, 11), 10), log(iso(10, 15, 9), 20)];
  assert.equal(todayState(r, logs, NOW).minutes, 15);
  assert.equal(todayState(r, logs, NOW).done, false);
  assert.equal(todayState({ ...r, goalMinutes: 15 }, logs, NOW).done, true);
});

test('N일마다 — 차례인 날, 지난번부터 며칠', () => {
  const r = routine({ title: '손톱 깎기', everyDays: 7, time: null });
  const logs = [log(iso(10, 10))];
  assert.equal(isDueOn(r, logs, NOW), false);
  assert.equal(todayState(r, logs, NOW).nextInDays, 1);
  assert.equal(todayState(r, logs, NOW).sinceDays, 6);
  assert.equal(isDueOn(r, logs, new Date(2026, 9, 17)), true);
  // 한 적이 없으면 차례
  assert.equal(isDueOn(r, [], NOW), true);
});

test('시간대와 이름', () => {
  assert.equal(slotOf('08:00'), 'morning');
  assert.equal(slotOf('13:00'), 'day');
  assert.equal(slotOf('19:00'), 'evening');
  assert.equal(slotOf(null), 'any');
  assert.equal(timeLabel('19:05'), '오후 7:05');
  assert.equal(timeLabel('00:30'), '오전 12:30');
  assert.equal(everyLabel(1), '매일');
  assert.equal(everyLabel(2), '2일마다');
  assert.equal(everyLabel(7), '매주');
  assert.equal(everyLabel(14), '14일마다');
});

test('루틴 알림 — 오늘 안 했으면 오늘부터, 했으면 내일부터', () => {
  const r = routine();
  const notDone = routineReminders([r], [], NOW, 3);
  assert.equal(notDone.length, 3);
  assert.equal(notDone[0].at.getDate(), 16);
  assert.equal(notDone[0].title, '목욕 시간이에요');
  assert.equal(notDone[0].body, '저녁에 챙길 루틴이에요');
  const done = routineReminders([r], [log(iso(10, 16, 8))], NOW, 3);
  assert.deepEqual(
    done.map((x) => x.at.getDate()),
    [17, 18],
  );
  // 시각이 지났으면 오늘은 뺀다
  assert.equal(routineReminders([routine({ time: '09:00' })], [], NOW, 1).length, 0);
  // 시각이 없으면 알리지 않는다
  assert.equal(routineReminders([routine({ time: null })], [], NOW, 3).length, 0);
});

test('루틴 알림 — N일마다는 차례인 날만, 지난번 날짜를 글에', () => {
  const r = routine({ title: '손톱 깎기', everyDays: 7, time: '20:00' });
  const reminders = routineReminders([r], [log(iso(10, 10))], NOW, 3);
  assert.deepEqual(
    reminders.map((x) => x.at.getDate()),
    [17, 18],
  );
  assert.equal(reminders[0].body, '마지막으로 한 지 7일 지났어요');
});

test('버튼 상태 한 줄 — 완료 시각, 누가, 다음 날, 타이머 누적, 마지막', () => {
  const line = (r: Routine, logs: RoutineLog[]) => statusLine(r, todayState(r, logs, NOW)).text;
  assert.equal(line(routine(), []), '오후 7:00');
  assert.equal(line(routine(), [log(iso(10, 16, 8, 10))]), '08:10 완료');
  assert.equal(line(routine(), [log(iso(10, 16, 8, 10), null, 'r1', '엄마')]), '엄마 · 08:10');
  assert.equal(line(routine({ time: null }), []), '매일');
  const nails = routine({ title: '손톱 깎기', everyDays: 7, time: null });
  assert.equal(line(nails, [log(iso(10, 10))]), '내일');
  assert.equal(line(nails, [log(iso(10, 8))]), '마지막 8일 전');
  const tummy = routine({ kind: 'minutes', title: '터미타임', time: null });
  assert.equal(line(tummy, []), '오늘 0분');
  assert.equal(line(tummy, [log(iso(10, 16, 9), 15)]), '오늘 15분');
  assert.equal(line({ ...tummy, goalMinutes: 30 }, [log(iso(10, 16, 9), 15)]), '15분 / 30분');
  assert.equal(statusLine(nails, todayState(nails, [log(iso(10, 16, 9))], NOW)).done, true);
});

test('루틴 탭 — 오늘 할 것과 다른 날, 완료 수, 다음 루틴', () => {
  const vitamin = routine({ id: 'v', title: '비타민D', time: '08:00', sort: 0 });
  const bath = routine({ id: 'b', title: '목욕', everyDays: 2, time: '20:00', sort: 1 });
  const tummy = routine({ id: 't', title: '터미타임', kind: 'minutes', time: null, sort: 2 });
  const stock = routine({ id: 's', title: '재고 확인', everyDays: 7, time: null, sort: 3 });
  const logs = [log(iso(10, 16, 8, 10), null, 'v'), log(iso(10, 14, 20), null, 'b'), log(iso(10, 13, 10), null, 's')];
  const plan = todayPlan([tummy, stock, bath, vitamin], logs, NOW);
  assert.deepEqual(
    plan.today.map((x) => x.r.id),
    ['v', 'b', 't'],
  );
  assert.deepEqual(
    plan.later.map((x) => x.r.id),
    ['s'],
  );
  assert.equal(plan.done, 1);
  assert.equal(plan.total, 3);
  assert.equal(plan.next?.r.id, 'b');
  // 타이머는 목표가 없으면 조금이라도 하면 완료로 센다
  assert.equal(countsDone(tummy, todayState(tummy, [log(iso(10, 16, 9), 2, 't')], NOW)), true);
  assert.equal(countsDone({ ...tummy, goalMinutes: 15 }, todayState({ ...tummy, goalMinutes: 15 }, [log(iso(10, 16, 9), 2, 't')], NOW)), false);
});

test('다른 날 이름과 날짜', () => {
  assert.equal(nextDayLabel(1, NOW), '내일');
  assert.equal(nextDayLabel(2, NOW), '일요일');
  assert.equal(nextDayLabel(9, NOW), '9일 뒤');
  assert.equal(dateLabel(NOW), '10월 16일 금요일');
});

test('단계가 있는 루틴 — 단계 줄은 완료로 세지 않고, 전체 한 줄이 있어야 완료', () => {
  const sleep = routine({ title: '밤잠 준비', time: '20:30', items: ['스와들 입히기', '수유', '트림', '자장가 부르며 재우기'] });
  const step = (at: string, i: number): RoutineLog => ({ ...log(at), step: i });
  const half = [step(iso(10, 16, 13, 1), 0), step(iso(10, 16, 13, 4), 1)];
  const s1 = todayState(sleep, half, NOW);
  assert.equal(s1.done, false);
  assert.deepEqual(s1.stepsDone, [0, 1]);
  assert.equal(statusLine(sleep, s1).text, '2 / 4단계');
  assert.equal(statusLine(sleep, todayState(sleep, [], NOW)).text, '오후 8:30 · 4단계');
  const all = [...half, step(iso(10, 16, 13, 6), 2), step(iso(10, 16, 13, 9), 3), log(iso(10, 16, 13, 9))];
  assert.equal(todayState(sleep, all, NOW).done, true);
  assert.equal(statusLine(sleep, todayState(sleep, all, NOW)).text, '13:09 완료');
  // 지난번부터 며칠은 전체 줄로만 — 어제 단계만 한 날은 한 날로 치지 않는다
  const bath = routine({ title: '목욕', everyDays: 2, items: ['목욕', '보습'] });
  assert.equal(isDueOn(bath, [step(iso(10, 15, 20), 0)], NOW), true);
  assert.equal(isDueOn(bath, [log(iso(10, 15, 20))], NOW), false);
});

test('재고 확인 — 부족한 것 중 살 것에 없는 것만, 살 곳은 지난번 산 곳', () => {
  const out = stockToBuy(
    ['기저귀', '보습 로션', '물티슈'],
    ['물 티슈'],
    [
      { title: '기저귀', store: '마트', doneAt: iso(10, 1) },
      { title: '기저귀', store: '온라인', doneAt: iso(10, 9) },
    ],
  );
  assert.deepEqual(out, [
    { title: '기저귀', store: '온라인' },
    { title: '보습 로션', store: null },
  ]);
  const stock = routine({ title: '재고 확인', kind: 'stock', everyDays: 7, time: null, items: ['분유'] });
  assert.equal(todayState(stock, [log(iso(10, 16, 9))], NOW).done, true);
});
