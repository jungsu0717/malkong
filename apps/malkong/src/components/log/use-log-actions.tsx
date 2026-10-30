/**
 * 기록 단추를 누를 때의 흐름 — 홈의 빠른 기록과 기록 화면이 같이 쓴다 (SPEC-LOG-01 · 02, task log/003).
 *
 * 단추를 누르면 입력 시트가 열리고, 모유 · 잠은 시트에서 「시작」으로 재기 시작한다. 잠을 재는 중이면 「잠」 단추가 바로 끝낸다.
 * 모유를 재는 중에 「반대쪽」을 누르면 지금 쪽을 끝내고 반대쪽을 시작한다. `sheets` 는 화면에 한 번 둔다.
 */

import { useState } from 'react';

import { LogSheet, type SheetTarget } from '@/components/log/log-sheet';
import { tap } from '@/components/ui';
import { latestOf } from '@/data/event-summary';
import { runningOf, type CareEvent, type EventInput, type EventKind, type Side } from '@/data/events';
import { useEvents } from '@/data/events-context';

export function useLogActions() {
  const { events, add, update, remove } = useEvents();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  // 열 때마다 시트를 처음부터 — 지난번 입력이 남지 않게
  const [round, setRound] = useState(0);

  const open = (kind: EventKind, editing: CareEvent | null = null) => {
    setRound((r) => r + 1);
    setSheet({ kind, editing });
  };

  const start = async (kind: EventKind, side: Side | null) => {
    setSheet(null);
    const running = runningOf(events, kind);
    if (running) await update(running.id, { endAt: new Date().toISOString() });
    await add({ kind, side, startAt: new Date().toISOString(), endAt: null });
    tap('success');
  };

  const stop = async (e: CareEvent) => {
    tap('success');
    await update(e.id, { endAt: new Date().toISOString() });
  };

  const save = async (input: EventInput, editingId: string | null) => {
    setSheet(null);
    if (editingId) {
      const { kind: _kind, ...patch } = input;
      await update(editingId, patch);
    } else {
      await add(input);
    }
  };

  /** 단추 하나 — 잠을 재는 중이면 바로 끝내고, 그 밖에는 시트를 연다 */
  const press = (kind: EventKind) => {
    tap();
    const sleeping = runningOf(events, 'sleep');
    if (kind === 'sleep' && sleeping) void stop(sleeping);
    else open(kind);
  };

  const sheets = (
    <LogSheet
      key={round}
      target={sheet}
      lastAmount={sheet ? (latestOf(events, sheet.kind)?.amount ?? null) : null}
      onClose={() => setSheet(null)}
      onSave={(input, id) => void save(input, id)}
      onStart={(kind, side) => void start(kind, side)}
      onDelete={(id) => {
        setSheet(null);
        void remove(id);
      }}
    />
  );

  return { open, press, start, stop, sheets };
}
