/**
 * 아기 사진과 태어날 때 정보 (SPEC-MY-02, task my/012) — 둘 다 이 폰에만 둔다.
 *
 * 가족 맞추기 서버는 아기 줄의 정해진 칸(이름, 생일)만 받아서 여기에 넣지 않는다. 사진은 앱 문서 폴더에 복사해 두고 그 주소를 설정에 적는다.
 * 사진이 바뀌면 하루 흐름 위 마이 버튼도 바로 바뀌게 듣는 쪽에 알린다.
 */

import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { readSetting, writeSetting } from './db';

const PHOTO_KEY = 'baby.photo';
const BIRTH_KEY = 'baby.birth';

export type Sex = 'girl' | 'boy';
export type Blood = 'A' | 'B' | 'O' | 'AB' | 'unknown';
/** 태어날 때 — 모두 선택. 몸무게(kg) · 키(cm)는 적은 글 그대로 */
export type BirthInfo = { time: string | null; sex: Sex | null; weight: string | null; height: string | null; blood: Blood | null };
export const EMPTY_BIRTH: BirthInfo = { time: null, sex: null, weight: null, height: null, blood: null };

export async function readBirthInfo(): Promise<BirthInfo> {
  const v = await readSetting(BIRTH_KEY);
  if (!v) return EMPTY_BIRTH;
  try {
    return { ...EMPTY_BIRTH, ...(JSON.parse(v) as Partial<BirthInfo>) };
  } catch {
    return EMPTY_BIRTH;
  }
}

export async function saveBirthInfo(info: BirthInfo): Promise<void> {
  await writeSetting(BIRTH_KEY, JSON.stringify(info));
}

const listeners = new Set<(uri: string | null) => void>();

export async function readPhoto(): Promise<string | null> {
  return (await readSetting(PHOTO_KEY)) || null;
}

/** 고른 사진을 앱 폴더에 복사하고 주소를 적는다 — 예전 사진 파일은 지운다. 웹은 고른 주소를 그대로 */
export async function savePhoto(pickedUri: string): Promise<string> {
  const old = await readPhoto();
  let uri = pickedUri;
  if (Platform.OS !== 'web') {
    const source = new File(pickedUri);
    const ext = (source.name.split('.').pop() ?? 'jpg').toLowerCase();
    const dest = new File(Paths.document, `baby-photo-${Date.now()}.${ext}`);
    await source.copy(dest);
    uri = dest.uri;
    if (old) removeFile(old);
  }
  await writeSetting(PHOTO_KEY, uri);
  for (const l of listeners) l(uri);
  return uri;
}

export async function clearPhoto(): Promise<void> {
  const old = await readPhoto();
  if (old && Platform.OS !== 'web') removeFile(old);
  await writeSetting(PHOTO_KEY, '');
  for (const l of listeners) l(null);
}

function removeFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // 이미 없으면 그대로
  }
}

/** 아기 사진 주소 — 없으면 null. 바뀌면 다시 그린다 */
export function useBabyPhoto(): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void readPhoto().then((v) => alive && setUri(v));
    listeners.add(setUri);
    return () => {
      alive = false;
      listeners.delete(setUri);
    };
  }, []);
  return uri;
}
