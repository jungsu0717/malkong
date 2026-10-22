/**
 * 스토어 리뷰 요청 (SPEC-MY-09, task my/010) — 좋은 순간을 세고, 때가 맞으면 폰의 기본 별점 창(expo-store-review)을 띄운다.
 *
 * 부르는 곳: 루틴 탭(그날 루틴을 모두 완료한 순간) · 할 일 완료(todos-context) · 발달 체크 「했어요」.
 * 우리 앱의 팝업이나 「마음에 드세요?」 같은 질문은 두지 않는다 — App Store 5.6.1 · Google Play 리뷰 지침이 막는다.
 * 개발 빌드 · Expo Go · 웹, 앱이 뒤에 있을 때(알림 단추로 완료)는 띄우지 않는다. 실패해도 조용히 넘어간다.
 */

import { isRunningInExpoGo } from 'expo';
import * as StoreReview from 'expo-store-review';
import { AppState, Platform } from 'react-native';

import { readSetting, writeSetting } from './db';
import { shouldAskReview } from './review-ask';

const FIRST_KEY = 'review.firstSeen';
const HAPPY_KEY = 'review.happy';
const ASKED_KEY = 'review.lastAsked';

/** 아기 생일을 넣은 뒤 처음 연 때를 남긴다 — 며칠 쓴 뒤에만 묻기 위해 */
export async function noteReviewStart(): Promise<void> {
  try {
    if (!(await readSetting(FIRST_KEY))) await writeSetting(FIRST_KEY, new Date().toISOString());
  } catch {
    // 저장소를 못 읽으면 다음에 다시 남긴다
  }
}

let asking = false;

/** 좋은 순간 하나 — 세어 두고, 때가 맞으면 완료 표시가 보인 뒤(1.2초) 별점 창을 띄운다 */
export async function happyMoment(): Promise<void> {
  if (asking) return;
  try {
    const happy = (Number(await readSetting(HAPPY_KEY)) || 0) + 1;
    await writeSetting(HAPPY_KEY, String(happy));
    const state = { firstSeen: await readSetting(FIRST_KEY), happy, lastAsked: (await readSetting(ASKED_KEY)) || null };
    if (!shouldAskReview(state)) return;
    // Expo Go 에서는 Expo Go 앱의 별점 창이 뜬다
    if (__DEV__ || Platform.OS === 'web' || isRunningInExpoGo()) return;
    if (AppState.currentState !== 'active' || !(await StoreReview.isAvailableAsync())) return;
    asking = true;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (AppState.currentState !== 'active') return;
    await writeSetting(ASKED_KEY, new Date().toISOString());
    await writeSetting(HAPPY_KEY, '0');
    await StoreReview.requestReview();
  } catch {
    // 별점 창은 없어도 된다
  } finally {
    asking = false;
  }
}
