import { useEffect, useState } from 'react';

import { readSetting, writeSetting } from '@/data/db';
import { PLACE_KEY, placeFrom, type Place } from '@/data/recommend';

/** 「지금 아기와 있는 곳」(SPEC-MAIN-07) — 루틴 추천과 할 일 추천이 같은 설정값을 본다. 처음은 집 */
export function usePlace(): [Place, (p: Place) => void] {
  const [place, setPlace] = useState<Place>('home');
  useEffect(() => {
    void readSetting(PLACE_KEY)
      .then((v) => setPlace(placeFrom(v)))
      .catch(() => undefined);
  }, []);
  const change = (p: Place) => {
    setPlace(p);
    void writeSetting(PLACE_KEY, p).catch(() => undefined);
  };
  return [place, change];
}
