/**
 * 화면의 카드를 그림으로 만들어 폰의 공유 창을 연다 — 기념 카드(SPEC-STAGE-07)와 오늘 아기 소식(SPEC-LOG-06)이 같이 쓴다.
 *
 * 그림은 `react-native-view-shot` 의 `captureRef`(PNG, 임시 파일), 공유는 `expo-sharing` 의 `shareAsync`.
 * 사진 저장이나 메신저 보내기는 공유 창에서 고른다. 공유 창이 없는 곳(웹)에서는 그림만 만들고 끝난다.
 */

import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** `width` × `height` 픽셀 그림으로 만들어 공유한다 — 실패하거나 창을 닫아도 오류를 던지지 않는다 */
export async function shareImage(ref: RefObject<View | null>, width: number, height: number): Promise<void> {
  if (!ref.current) return;
  try {
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: width / PixelRatio.get(),
      height: height / PixelRatio.get(),
    });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  } catch {
    // 공유 창을 닫았거나 그림을 못 만들어도 시트는 그대로 둔다
  }
}
