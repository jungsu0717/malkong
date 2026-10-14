import { useEffect, useState } from 'react';

/**
 * 0 에서 1 로 차오르는 값 — 짧은 등장 모션(여정 길 · 고리, SPEC-GROW-02 처음). `replay` 가 바뀌면 다시 찬다.
 * 그림 하나하나가 자기 값을 들고 다시 그리므로, 큰 화면 전체가 프레임마다 다시 그려지지 않게 작은 부품 안에서 쓴다.
 */
export function useProgress(replay: unknown, duration = 1100, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = Date.now() + delay;
    const step = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / duration));
      setValue(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [replay, duration, delay]);
  return value;
}
