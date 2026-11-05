import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * 지금 시각 — `fast` 면 1초마다, 아니면 30초마다 바꾼다. 앱이 앞으로 오면 바로(자정을 넘겨 다시 열었을 때 「오늘」이 따라오게).
 * `changed` 가 바뀌어도 바로 — 방금 적은 기록이 묵은 「지금」보다 뒤라서 다음 갱신 때까지 흐름에서 빠지지 않게.
 * 렌더 안에서 `new Date()` 를 바로 부르면 React Compiler 가 값을 기억해 둬 시계가 멈춘다 — 그래서 상태로 둔다.
 */
export function useNow(fast: boolean, changed?: unknown): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, fast ? 1000 : 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [fast, changed]);
  return now;
}
