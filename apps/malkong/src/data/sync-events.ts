/**
 * 「바뀌었다」는 작은 신호 두 가지.
 * - 내 폰에서 바뀜: 저장소 쪽(records · baby · events · todos · routines)이 울리고, 가족 공유(family-context)가 듣고 서버와 맞춘다(task my/007 · 009).
 *   가족이 없으면 듣는 쪽이 없어 아무 일도 없다.
 * - 가족 폰에서 바뀜: 맞추기가 할 일 · 루틴을 적용하면 울리고, todos-context · routines-context 가 듣고 다시 읽는다.
 *   화면 묶음 순서(가족 → 할 일 → 루틴) 때문에 서로 직접 부르지 않고 이 신호로 잇는다.
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

export type RemoteKind = 'todos' | 'routines';
type RemoteListener = (kinds: RemoteKind[]) => void;

const remoteListeners = new Set<RemoteListener>();

/** 가족 폰에서 온 할 일 · 루틴을 폰에 적용했다 */
export function emitRemoteChange(kinds: RemoteKind[]): void {
  if (kinds.length === 0) return;
  for (const listener of remoteListeners) listener(kinds);
}

export function onRemoteChange(listener: RemoteListener): () => void {
  remoteListeners.add(listener);
  return () => {
    remoteListeners.delete(listener);
  };
}
