import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { adsModule, adUnit, useAdsReady } from '@/data/ads';
import { useEntitlements } from '@/data/entitlements-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * 배너 광고 (SPEC-HOME-05 · SPEC-GROW-04, task common/006 · 013). 자리는 app-design 「광고 자리」.
 *
 * - 광고 제거를 샀거나 운영자(가족) 기기면 자리까지 사라진다(SPEC-MY-06)
 * - 광고 모듈이 없는 곳(웹 미리보기 · Expo Go)은 자리 표시만 한다
 * - 광고가 실제로 들어오기 전에는 「광고」 표시도 그리지 않는다 — 빈 상자가 남지 않게
 * - 콘텐츠 카드(채운 회색)와 다르게 테두리만 두른다 — 광고가 우리 콘텐츠처럼 보이면 안 된다
 *
 * - `anchored` — 화면 바닥에 붙는 배너(대화 입력창 아래 · 성장 타임라인 바닥). 여백을 줄이고, 놓인 칸의 너비를 재서
 *   그 너비로 받는다 — 재지 않으면 기기 너비로 와서 좌우 여백 안에서 잘린다
 *
 * 전면 광고는 main-design 「다음」이라 첫 출시에 넣지 않는다.
 */
export function AdBanner({ anchored = false }: { anchored?: boolean }) {
  const colors = useTheme();
  const { ads } = useEntitlements();
  const ready = useAdsReady(ads);
  const [loaded, setLoaded] = useState(false);
  const [width, setWidth] = useState(0);

  if (!ads) return null;

  const module = adsModule();
  if (!module) {
    return (
      <View style={[styles.banner, anchored && styles.bar, { borderColor: colors.border }]}>
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
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={
        loaded ? [styles.banner, anchored && styles.bar, { borderColor: colors.border }] : styles.collapsed
      }>
      {loaded && (
        <ThemedText type="caption" style={{ color: colors.textSecondary, fontWeight: 600 }}>
          광고
        </ThemedText>
      )}
      {width > 0 && (
        <BannerAd
          unitId={unitId}
          size={
            anchored ? BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER : BannerAdSize.INLINE_ADAPTIVE_BANNER
          }
          width={width}
          // 스크롤 안의 배너는 높이를 묶는다 — 묶지 않으면 화면 높이만큼 커질 수 있다
          maxHeight={anchored ? undefined : 120}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={() => setLoaded(false)}
        />
      )}
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
  // 바닥 배너 — 화면 너비 그대로 붙는 띠. 모서리를 둥글리지 않고 위에만 선을 두며, 화면을 덜 차지하게 여백을 줄인다
  bar: { borderRadius: 0, borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 6, gap: 2, minHeight: 56 },
  // 들어오기 전에는 자리를 차지하지 않는다(광고 모듈은 불러오는 동안에도 붙어 있어야 해서 숨기기만 한다).
  // 높이는 0 이어도 너비는 재야 하니 가로로는 늘인다
  collapsed: { height: 0, overflow: 'hidden', alignSelf: 'stretch' },
});
