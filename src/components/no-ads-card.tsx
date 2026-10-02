/**
 * 마이의 「광고 없이 쓰기」 카드 — 구매와 복원 (SPEC-MY-06, task my/004).
 * 광고만 없앤다 — 질문 한도와 답변 품질은 그대로다(SPEC-MY-06 금지).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useEntitlements } from '@/data/entitlements-context';
import {
  buyNoAds,
  noAdsOffer,
  purchasesAvailable,
  restoreNoAds,
  type NoAdsOffer,
} from '@/data/purchases';

export function NoAdsCard() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { ads, adsRemoved, applyAdsRemoved } = useEntitlements();
  const [offer, setOffer] = useState<NoAdsOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const available = purchasesAvailable();

  useEffect(() => {
    if (!available || adsRemoved) return;
    let cancelled = false;
    noAdsOffer().then((loaded) => {
      if (!cancelled) setOffer(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [available, adsRemoved]);

  if (adsRemoved) {
    return (
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <ThemedText type="subtitle">광고 없이 쓰는 중이에요</ThemedText>
        <ThemedText type="small" style={{ color: colors.textSecondary }}>
          함께해 주셔서 고마워요
        </ThemedText>
      </View>
    );
  }
  // 운영자(가족) 기기는 이미 광고가 없다 — 살 것이 없다
  if (!ads) return null;

  const buy = async () => {
    if (!offer) return;
    setBusy(true);
    setNote(null);
    const result = await buyNoAds(offer);
    if (result === 'bought') await applyAdsRemoved(true);
    if (result === 'failed') setNote('결제를 마치지 못했어요. 잠시 뒤 다시 시도해 주세요');
    setBusy(false);
  };

  const restore = async () => {
    setBusy(true);
    setNote(null);
    const owned = await restoreNoAds();
    if (owned) await applyAdsRemoved(true);
    else setNote(owned === false ? '되살릴 구매가 없어요' : '지금은 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요');
    setBusy(false);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText type="subtitle">광고 없이 쓰기</ThemedText>
      <ThemedText type="small" style={{ color: colors.textSecondary }}>
        한 번 결제하면 광고가 모두 사라져요. 질문 횟수와 답변은 그대로예요
      </ThemedText>
      {!available ? (
        <ThemedText type="small" style={{ color: colors.textSecondary }}>
          준비 중이에요
        </ThemedText>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.button,
              { backgroundColor: offer && !busy ? colors.accent : colors.backgroundSelected },
            ]}
            disabled={!offer || busy}
            onPress={buy}>
            <ThemedText type="smallBold" style={{ color: offer && !busy ? '#ffffff' : colors.textSecondary }}>
              {offer ? `${offer.price} 결제하기` : '가격을 불러오는 중…'}
            </ThemedText>
          </Pressable>
          <Pressable disabled={busy} onPress={restore} hitSlop={8}>
            <ThemedText type="small" style={{ color: colors.accent }}>
              구매 복원
            </ThemedText>
          </Pressable>
        </View>
      )}
      {note && (
        <ThemedText type="small" style={{ color: colors.textSecondary }}>
          {note}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: Spacing.four, gap: Spacing.two },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  button: { borderRadius: 12, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
