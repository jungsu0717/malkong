/**
 * 마이의 「광고 없이 쓰기」 카드 — 구매와 복원 (SPEC-MY-06, task my/004).
 * 광고만 없앤다 — 질문 한도와 답변 품질은 그대로다(SPEC-MY-06 금지).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { useEntitlements } from '@/data/entitlements-context';
import {
  buyNoAds,
  noAdsOffer,
  purchasesAvailable,
  restoreNoAds,
  type NoAdsOffer,
} from '@/data/purchases';
import { useTheme } from '@/hooks/use-theme';

export function NoAdsCard() {
  const c = useTheme();
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
      <Card tone="filled" style={styles.card}>
        <ThemedText type="heading" style={{ fontSize: 15 }}>
          광고 없이 쓰는 중이에요
        </ThemedText>
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          함께해 주셔서 고마워요
        </ThemedText>
      </Card>
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
    <Card style={styles.card}>
      <ThemedText type="heading" style={{ fontSize: 15 }}>
        광고 없이 쓰기
      </ThemedText>
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        한 번 결제하면 광고가 모두 사라져요. 질문 횟수와 답변은 그대로예요
      </ThemedText>
      {!available ? (
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          준비 중이에요
        </ThemedText>
      ) : (
        <View style={styles.actions}>
          <Button
            label={offer ? `${offer.price} 결제하기` : '가격을 불러오는 중…'}
            size="sm"
            disabled={!offer}
            busy={busy}
            onPress={buy}
          />
          <Pressable disabled={busy} onPress={restore} hitSlop={10} accessibilityRole="button">
            <ThemedText type="label" style={{ color: c.textSecondary, textDecorationLine: 'underline' }}>
              구매 복원
            </ThemedText>
          </Pressable>
        </View>
      )}
      {note && (
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {note}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
});
