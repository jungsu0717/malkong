/// <reference types="node" />
/**
 * 루틴 시험 — `node --test src/data/routine.test.ts`. 기준 시각은 2026-10-16(금) 14:00.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dateLabel,
  everyLabel,
  isDueOn,
  nextDayLabel,
  routineKindOf,
  routineReminders,
  slotOf,
  statusLine,
  scheduleLabel,
  stockToBuy,
  templateDetail,
  templateInput,
  titleKey,
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
  items: null,
  weekdays: null,
  hidden: false,
  sort: 0,
  createdAt: iso(10, 1),
  updatedAt: iso(10, 1),
  ...o,
});
let n = 0;
const log = (at: string, routineId = 'r1', by: string | null = null): RoutineLog => ({
  id: `l${(n += 1)}`,
  routineId,
  at,
  by,
  step: null,
  skip: false,
  createdAt: at,
});

test('체크 루틴 — 오늘 했나, 몇 시에', () => {
  const r = routine();
  assert.equal(todayState(r, [], NOW).done, false);
  const s = todayState(r, [log(iso(10, 16, 8, 10))], NOW);
  assert.equal(s.done, true);
  assert.equal(s.firstAt, iso(10, 16, 8, 10));
});

test('옛 타이머 루틴은 체크로 읽는다(task today/006)', () => {
  assert.equal(routineKindOf('minutes'), 'check');
  assert.equal(routineKindOf('stock'), 'stock');
  assert.equal(routineKindOf(undefined), 'check');
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

test('버튼 상태 한 줄 — 완료 시각, 누가, 다음 날, 마지막', () => {
  const line = (r: Routine, logs: RoutineLog[]) => statusLine(r, todayState(r, logs, NOW)).text;
  assert.equal(line(routine(), []), '오후 7:00');
  assert.equal(line(routine(), [log(iso(10, 16, 8, 10))]), '08:10 완료');
  assert.equal(line(routine(), [log(iso(10, 16, 8, 10), 'r1', '엄마')]), '엄마 · 08:10');
  assert.equal(line(routine({ time: null }), []), '매일');
  const nails = routine({ title: '손톱 깎기', everyDays: 7, time: null });
  assert.equal(line(nails, [log(iso(10, 10))]), '내일');
  assert.equal(line(nails, [log(iso(10, 8))]), '마지막 8일 전');
  assert.equal(line(routine({ title: '터미타임', time: null }), [log(iso(10, 16, 9))]), '09:00 완료');
  assert.equal(statusLine(nails, todayState(nails, [log(iso(10, 16, 9))], NOW)).done, true);
});

test('루틴 탭 — 오늘 할 것과 다른 날, 완료 수, 다음 루틴', () => {
  const vitamin = routine({ id: 'v', title: '비타민D', time: '08:00', sort: 0 });
  const bath = routine({ id: 'b', title: '목욕', everyDays: 2, time: '20:00', sort: 1 });
  const tummy = routine({ id: 't', title: '터미타임', time: null, sort: 2 });
  const stock = routine({ id: 's', title: '재고 확인', everyDays: 7, time: null, sort: 3 });
  const logs = [log(iso(10, 16, 8, 10), 'v'), log(iso(10, 14, 20), 'b'), log(iso(10, 13, 10), 's')];
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
  // 오후 2시 — 밤 8시 목욕보다 시각 없는 터미타임이 먼저, 저녁 7시 반이면 목욕이 먼저
  assert.equal(plan.next?.r.id, 't');
  assert.equal(todayPlan([tummy, stock, bath, vitamin], logs, new Date(2026, 9, 16, 19, 30)).next?.r.id, 'b');
  // 오전 8시 비타민D를 아직 안 했으면 지난 것이 먼저
  assert.equal(todayPlan([tummy, stock, bath, vitamin], logs.slice(1), NOW).next?.r.id, 'v');
  // 터미타임도 한 번 누르면 완료
  assert.equal(todayPlan([tummy, stock, bath, vitamin], [...logs, log(iso(10, 16, 9), 't')], NOW).done, 2);
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

test('추천 줄의 설명', () => {
  assert.equal(templateDetail({ title: '목욕', kind: 'check', everyDays: 2, time: '20:00', items: ['목욕', '보습'] }), '2일마다 · 목욕 → 보습');
  assert.equal(templateDetail({ title: '터미타임', kind: 'check', everyDays: 1, time: null }), '매일');
  assert.equal(templateDetail({ title: '재고 확인', kind: 'stock', everyDays: 7, time: null, items: ['분유', '기저귀', '물티슈', '로션'] }), '매주 · 분유 · 기저귀 · 물티슈');
  assert.equal(templateDetail({ title: '책', kind: 'check', everyDays: 1, time: '20:00' }), '매일 · 오후 8:00');
});

test('요일 반복 — 그 요일만 할 날, 다음 할 날, 이름', () => {
  const stock = routine({ title: '재고 확인', kind: 'stock', time: null, everyDays: 7, weekdays: [0] });
  // NOW 는 10월 16일 금요일
  assert.equal(isDueOn(stock, [], NOW), false);
  assert.equal(isDueOn(stock, [], new Date(2026, 9, 18)), true);
  assert.equal(todayState(stock, [], NOW).nextInDays, 2);
  assert.equal(nextDayLabel(todayState(stock, [], NOW).nextInDays, NOW), '일요일');
  assert.equal(scheduleLabel(stock), '매주 일요일');
  assert.equal(scheduleLabel({ everyDays: 7, weekdays: [5, 1, 3] }), '매주 월 · 수 · 금');
  assert.equal(scheduleLabel({ everyDays: 2, weekdays: null }), '2일마다');
  // 알림도 그 요일에만
  const r = routine({ time: '20:00', weekdays: [6] });
  assert.deepEqual(
    routineReminders([r], [], NOW, 3).map((x) => x.at.getDate()),
    [17],
  );
});

test('오늘은 건너뛰기 — 진행 · 알림에서 빠지고, 지난번으로 세지 않는다', () => {
  const bath = routine({ id: 'b', title: '목욕', everyDays: 2, time: '20:00' });
  const skip: RoutineLog = { ...log(iso(10, 16, 9), 'b'), skip: true };
  const s = todayState(bath, [skip], NOW);
  assert.equal(s.skipped, true);
  assert.equal(s.done, false);
  assert.equal(statusLine(bath, s).text, '오늘은 건너뜀');
  const plan = todayPlan([bath], [skip], NOW);
  assert.equal(plan.total, 0);
  assert.equal(plan.next, null);
  assert.equal(routineReminders([bath], [skip], NOW, 1).length, 0);
  // 건너뛴 다음 날은 다시 할 날(건너뛴 것은 한 것이 아니다)
  assert.equal(isDueOn(bath, [skip], new Date(2026, 9, 17)), true);
});

test('같은 루틴인지는 띄어쓰기를 빼고 본다 · 추천은 그대로 추가 값이 된다(task today/004)', () => {
  assert.equal(titleKey('밤잠 준비'), titleKey('밤잠준비'));
  assert.notEqual(titleKey('목욕'), titleKey('목욕 준비'));
  const input = templateInput({ title: '재고 확인', kind: 'stock', everyDays: 7, weekdays: [0], time: null, items: ['분유'] });
  assert.deepEqual(input, { title: '재고 확인', kind: 'stock', everyDays: 7, weekdays: [0], time: null, items: ['분유'] });
  assert.equal(templateInput({ title: '목욕', kind: 'check', everyDays: 2, time: '20:00' }).weekdays, null);
});
