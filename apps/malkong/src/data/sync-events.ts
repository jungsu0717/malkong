/**
 * 「아기 · 기록이 바뀌었다」는 작은 신호 — 저장소 쪽(records-context · baby-context)이 울리고,
 * 가족 공유(family-context)가 듣고 서버와 맞춘다(task my/007). 가족이 없으면 듣는 쪽이 없어 아무 일도 없다.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function requestSync(): void {
  for (const listener of listeners) listener();
}

export function onSyncRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
