import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { adsModule, adUnit, useAdsReady } from '@/data/ads';
import { useEntitlements } from '@/data/entitlements-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * 배너 광고 (SPEC-HOME-05 · SPEC-GROW-04, task common/006).
 *
 * - 광고 제거를 샀거나 운영자(가족) 기기면 자리까지 사라진다(SPEC-MY-06)
 * - 광고 모듈이 없는 곳(웹 미리보기 · Expo Go)은 자리 표시만 한다
 * - 광고가 실제로 들어오기 전에는 「광고」 표시도 그리지 않는다 — 빈 상자가 남지 않게
 * - 콘텐츠 카드(채운 회색)와 다르게 테두리만 두른다 — 광고가 우리 콘텐츠처럼 보이면 안 된다
 *
 * 전면 광고는 main-design 「다음」이라 첫 출시에 넣지 않는다.
 */
export function AdBanner({ anchored = false }: { anchored?: boolean }) {
  const colors = useTheme();
  const { ads } = useEntitlements();
  const ready = useAdsReady(ads);
  const [loaded, setLoaded] = useState(false);

  if (!ads) return null;

  const module = adsModule();
  if (!module) {
    return (
      <View style={[styles.banner, { borderColor: colors.border }]}>
        <ThemedText type="caption" style={{ color: colors.textSecondary, fontWeight: 600 }}>
          광고
        </ThemedText>
        <ThemedText type="caption" style={{ color: colors.textSecondary }}>
          배너 광고 자리 · 앱 빌드에서 나와요
        </ThemedText>
      </View>
    );
  }

  const unitId = adUnit('banner');
  if (!unitId || !ready) return null;
  const { BannerAd, BannerAdSize } = module;

  return (
    <View
      style={
        loaded ? [styles.banner, { borderColor: colors.border }] : styles.collapsed
      }>
      {loaded && (
        <ThemedText type="caption" style={{ color: colors.textSecondary, fontWeight: 600 }}>
          광고
        </ThemedText>
      )}
      <BannerAd
        unitId={unitId}
        size={
          anchored ? BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER : BannerAdSize.INLINE_ADAPTIVE_BANNER
        }
        // 홈은 스크롤 안의 배너라 높이를 묶는다 — 묶지 않으면 화면 높이만큼 커질 수 있다
        maxHeight={anchored ? undefined : 120}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 64,
    overflow: 'hidden',
  },
  // 들어오기 전에는 자리를 차지하지 않는다(광고 모듈은 불러오는 동안에도 붙어 있어야 해서 숨기기만 한다)
  collapsed: { height: 0, overflow: 'hidden' },
});
