/**
 * 물어보기에서 보고 있는 날의 기록을 함께 읽을지 (decisions/040, task today/022) — 처음 한 번 묻고, 마이에서 바꾼다.
 *
 * 'yes' 면 그날 기록을 문장과 함께 서버의 모델로 보내고, 'no' 면 문장만 보낸다. 아직 정하지 않았으면 null.
 * 이 폰에만 적는다. 바뀌면 물어보기 창과 하루 흐름, 마이가 바로 따라오게 듣는 쪽에 알린다.
 */

import { useEffect, useState } from 'react';

import { readSetting, writeSetting } from './db';

const KEY = 'ask.records';

export type AskConsent = 'yes' | 'no' | null;

const listeners = new Set<(v: AskConsent) => void>();

const parse = (v: string | null): AskConsent => (v === 'yes' || v === 'no' ? v : null);

export async function readAskConsent(): Promise<AskConsent> {
  return parse(await readSetting(KEY));
}

export async function saveAskConsent(v: 'yes' | 'no'): Promise<void> {
  await writeSetting(KEY, v);
  for (const l of listeners) l(v);
}

/** 지금 정한 것 — 읽기 전에는 undefined(창이 동의 화면을 잠깐 보이지 않게) */
export function useAskConsent(): AskConsent | undefined {
  const [v, setV] = useState<AskConsent | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void readAskConsent().then((x) => alive && setV(x));
    listeners.add(setV);
    return () => {
      alive = false;
      listeners.delete(setV);
    };
  }, []);
  return v;
}
