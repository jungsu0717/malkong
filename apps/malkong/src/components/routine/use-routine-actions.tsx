/**
 * 루틴을 누를 때의 흐름 — 홈 「오늘 할 루틴」과 루틴 화면이 같이 쓴다 (SPEC-MAIN-02 · 05 · 06 · 08, task today/007).
 *
 * 단계가 있으면 단계 시트, 재고 확인은 재고 확인 시트, 그 밖의 체크는 바로 완료 ↔ 되돌림. 편집은 routine-form 화면.
 * 보이는 화면에서 그날 루틴(둘 이상)을 마지막 하나까지 완료한 순간이 「좋은 순간」이다 — 쌓이면 스토어 별점 창(SPEC-MY-09).
 * `sheets` 는 화면에 한 번 둔다.
 */

import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { RoutineStepsSheet } from '@/components/routine/routine-steps-sheet';
import { StockSheet } from '@/components/routine/stock-sheet';
import { happyMoment } from '@/data/review';
import { hasSteps, todayPlan, type Routine } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';

export function useRoutineActions(now: Date) {
  const focused = useIsFocused();
  const { routines, logs, loading, updateRoutine, check, toggleStep, completeAll, skipToday, completeStock } = useRoutines();
  /** 단계 시트 · 재고 확인 시트로 연 루틴 id */
  const [stepsId, setStepsId] = useState<string | null>(null);
  const [stockId, setStockId] = useState<string | null>(null);

  const leftBefore = useRef<number | null>(null);
  useEffect(() => {
    if (loading) return;
    const p = todayPlan(routines, logs, now);
    const left = p.total - p.done;
    if (focused && leftBefore.current !== null && leftBefore.current > 0 && left === 0 && p.total >= 2) void happyMoment();
    leftBefore.current = left;
  }, [routines, logs, now, loading, focused]);

  const edit = (r: Routine) => router.push({ pathname: '/routine-form', params: { id: r.id } });
  const onCheck = (id: string) => {
    const r = routines.find((x) => x.id === id);
    if (r && hasSteps(r)) setStepsId(id);
    else if (r?.kind === 'stock') setStockId(id);
    else void check(id);
  };

  const stepsRoutine = routines.find((r) => r.id === stepsId) ?? null;
  const stockRoutine = routines.find((r) => r.id === stockId) ?? null;
  const sheets = (
    <>
      <RoutineStepsSheet
        routine={stepsRoutine}
        logs={logs}
        now={now}
        onToggleStep={(i) => stepsRoutine && void toggleStep(stepsRoutine.id, i)}
        onCompleteAll={() => stepsRoutine && void completeAll(stepsRoutine.id)}
        onEdit={() => {
          setStepsId(null);
          if (stepsRoutine) edit(stepsRoutine);
        }}
        onSkip={() => {
          if (stepsRoutine) void skipToday(stepsRoutine.id);
          setStepsId(null);
        }}
        onClose={() => setStepsId(null)}
      />
      <StockSheet
        key={stockId ?? 'stock-closed'}
        routine={stockRoutine}
        onDone={(short) => {
          const id = stockId;
          setStockId(null);
          if (id) void completeStock(id, short);
        }}
        onAddItem={(name) => stockRoutine && void updateRoutine(stockRoutine.id, { items: [...(stockRoutine.items ?? []), name] })}
        onSkip={() => {
          if (stockRoutine) void skipToday(stockRoutine.id);
          setStockId(null);
        }}
        onClose={() => setStockId(null)}
      />
    </>
  );

  return { onCheck, edit, sheets };
}
