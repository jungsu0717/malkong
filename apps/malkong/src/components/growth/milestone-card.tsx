/**
 * 기념일 카드 (SPEC-STAGE-07, task growth/010) — 달마다 · 50일 · 100일 · 돌 당일 성장 탭 머리의 「공유하기」에서 연다.
 *
 * 먹색 카드(가로:세로 4:5)에 깃발 · 모빌, 「우리 아기 / 100일 / 2027년 1월 12일」, 매트 위 버디, 오른쪽 아래 「육아버디 ★」.
 * 시트에서 카드를 먼저 보여 주고, 「공유하기」를 누르면 카드를 1080×1350 그림으로 만들어(react-native-view-shot)
 * 폰의 공유 창(expo-sharing)을 연다 — 사진 저장이나 메신저 보내기는 거기서 고른다.
 * 아기 이름은 넣지 않는다(다른 사람에게 보내는 그림이다). 카드 색은 성장 탭 머리와 같아서 다크 모드에서도 같다.
 */

import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type RefObject } from 'react';
import { Modal, PixelRatio, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bunting, HeroMobile, POSES, Toys } from '@/components/growth/growth-hero';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { BuddyPose, StageStop } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

/** 카드를 그린 기준 크기 — 화면 너비에 맞춰 이 비율로 키우고 줄인다 */
const BASE_W = 360;
const BASE_H = 450;
/** 공유하는 그림 크기(픽셀) */
const OUT_W = 1080;
const OUT_H = 1350;

/** 「2027년 1월 12일」 */
const fullDate = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

/** 카드 — 모서리가 각진 채로 그림이 되게, 둥근 테는 시트 쪽에서 씌운다 */
function MilestoneCard({
  stop,
  pose,
  date,
  width,
  cardRef,
}: {
  stop: StageStop;
  pose: BuddyPose;
  date: Date;
  width: number;
  cardRef: RefObject<View | null>;
}) {
  const c = useTheme();
  const k = width / BASE_W;
  const art = POSES[pose];
  return (
    <View ref={cardRef} collapsable={false} style={{ width, height: BASE_H * k, backgroundColor: c.hero, overflow: 'hidden' }}>
      <View style={styles.abs}>
        <Bunting scale={k} />
      </View>
      <View style={[styles.mobile, { right: 14 * k }]}>
        <HeroMobile scale={0.8 * k} />
      </View>

      <View style={[styles.abs, { left: 24 * k, top: 64 * k, gap: 2 * k }]}>
        <ThemedText style={{ fontSize: 14 * k, lineHeight: 20 * k, color: c.onHeroDim }}>우리 아기</ThemedText>
        <ThemedText style={{ fontSize: 52 * k, lineHeight: 60 * k, fontWeight: 700, letterSpacing: -1.6 * k, color: c.heroAccent }}>
          {stop.label}
        </ThemedText>
        <ThemedText style={{ fontSize: 14 * k, lineHeight: 20 * k, color: c.onHeroDim }}>{fullDate(date)}</ThemedText>
      </View>

      <View style={[styles.abs, { left: 20 * k, right: 20 * k, top: 214 * k, height: 180 * k }]}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 8 * k, height: 40 * k, borderRadius: 20 * k, backgroundColor: c.heroMat }} />
        <View style={{ position: 'absolute', left: 16 * k, bottom: 26 * k }}>
          <Toys scale={k} />
        </View>
        <View style={{ position: 'absolute', left: 60 * k, right: 0, bottom: 20 * k, alignItems: 'center' }}>
          <Image source={art.src} style={{ width: art.width * 0.94 * k, height: art.height * 0.94 * k }} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>
      </View>

      <View style={[styles.logo, { right: 24 * k, bottom: 22 * k, gap: 4 * k }]}>
        <ThemedText style={{ fontSize: 13 * k, lineHeight: 18 * k, fontWeight: 700, color: c.onHeroDim }}>육아버디</ThemedText>
        <Svg width={10 * k} height={10 * k} viewBox="-6 -6 12 12" style={{ marginTop: -8 * k }}>
          <Path d="M0,-6 L1.5,-2.1 L5.7,-1.9 L2.5,0.8 L3.5,4.9 L0,2.6 L-3.5,4.9 L-2.5,0.8 L-5.7,-1.9 L-1.5,-2.1Z" fill={c.heroStar} />
        </Svg>
      </View>
    </View>
  );
}

export function MilestoneSheet({
  stop,
  pose,
  date,
  onClose,
}: {
  /** 오늘이 칸의 날이면 그 칸 — 없으면 시트를 닫아 둔다 */
  stop: StageStop | null;
  pose: BuddyPose;
  date: Date;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const width = Math.min(window.width - Spacing.four * 2, BASE_W);

  const share = async () => {
    if (!card.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(card, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: OUT_W / PixelRatio.get(),
        height: OUT_H / PixelRatio.get(),
      });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // 공유 창을 닫았거나 그림을 못 만들어도 시트는 그대로 둔다
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={stop !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">{stop ? `${stop.label} 기념 카드` : ''}</ThemedText>
          {stop && (
            <View style={styles.card}>
              <MilestoneCard stop={stop} pose={pose} date={date} width={width} cardRef={card} />
            </View>
          )}
          <Button
            size="lg"
            icon="share-outline"
            label="공유하기"
            disabled={busy}
            onPress={() => {
              tap();
              void share();
            }}
          />
          <Button variant="ghost" size="sm" label="닫기" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.two },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  card: { alignSelf: 'center', borderRadius: 16, overflow: 'hidden', marginVertical: Spacing.two },
  abs: { position: 'absolute', left: 0, top: 0 },
  mobile: { position: 'absolute', top: 0 },
  logo: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
});
