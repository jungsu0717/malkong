import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * 지금 시각 — `fast` 면 1초마다, 아니면 30초마다 바꾼다. 앱이 앞으로 오면 바로(자정을 넘겨 다시 열었을 때 「오늘」이 따라오게).
 * 렌더 안에서 `new Date()` 를 바로 부르면 React Compiler 가 값을 기억해 둬 시계가 멈춘다 — 그래서 상태로 둔다.
 */
export function useNow(fast: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), fast ? 1000 : 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [fast]);
  return now;
}
