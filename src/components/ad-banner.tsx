import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { areAdsEnabled } from '@/data/entitlements';
import { useEntitlements } from '@/data/entitlements-context';

/**
 * 광고 자리 컴포넌트 (placeholder).
 *
 * 실제 광고는 Google AdMob(react-native-google-mobile-ads)로 붙인다.
 * 네이티브 모듈이라 Expo Go에서는 돌지 않으므로 개발 빌드(EAS) 단계에서:
 *   1. npx expo install react-native-google-mobile-ads
 *   2. app.json plugins에 androidAppId / iosAppId 등록 (AdMob 콘솔에서 발급)
 *   3. 이 컴포넌트 내부를 <BannerAd unitId={TestIds.BANNER} ...> 로 교체
 *   4. iOS는 expo-tracking-transparency로 ATT 동의를 먼저 받는다
 *
 * 전면 광고(저장·완료 시점)는 lib 없이 자리만 잡는다 — showInterstitial() 참조.
 */
export function AdBanner() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { ads } = useEntitlements();

  // 광고 제거를 구매했거나 운영자(가족) 기기면 자리까지 사라진다 (SPEC-MY-06)
  if (!ads) return null;

  // 콘텐츠 카드(채운 회색)와 다르게 테두리만 두른다 — 광고가 우리 콘텐츠처럼 보이면 안 된다
  return (
    <View style={[styles.banner, { borderColor: colors.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: colors.textSecondary }}>
        광고
      </ThemedText>
      <ThemedText type="small" style={{ color: colors.textSecondary }}>
        배너 광고 영역 · AdMob 연결 예정
      </ThemedText>
    </View>
  );
}

/**
 * 전면 광고 자리. 저장·기록 완료 같은 "한 호흡 쉬는" 시점에 부른다.
 * AdMob 연결 전까지는 아무것도 하지 않는다.
 */
export async function showInterstitial(): Promise<void> {
  // 광고 제거를 샀으면 전면 광고도 뜨지 않는다 (SPEC-MY-06)
  if (!areAdsEnabled()) return;
  // TODO(AdMob): InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL) 로 교체
  return;
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 64,
  },
});
