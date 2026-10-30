/**
 * 오늘 아기 소식 카드 (SPEC-LOG-06, task log/004) — 기록 화면 · 홈 기록 칸의 「소식 보내기」에서 연다.
 *
 * 먹색 카드(가로:세로 4:5)에 날짜 · 「우리 아기 오늘」 · 함께한 지 며칠, 수유 · 잠 · 기저귀 칸(그날 있었던 것만), 그날 메모 한 줄,
 * 매트 위 버디(지금 자세), 오른쪽 아래 「육아버디 ★」. 시트에서 카드를 먼저 보여 주고 「공유하기」로 1080×1350 그림을 공유한다(share-image.ts).
 * 가족 단톡방에 보내는 그림이라 아기 이름 · 체온 · 변 색은 넣지 않는다(day-news.ts). 카드 색은 기념 카드와 같아서 다크 모드에서도 같다.
 */

import { Image } from 'expo-image';
import { useRef, useState, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroMobile, POSES } from '@/components/growth/growth-hero';
import { shareImage } from '@/components/share-image';
import { ThemedText } from '@/components/themed-text';
import { Button, tap } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { DayNews } from '@/data/day-news';
import type { BuddyPose } from '@/data/stage';
import { useTheme } from '@/hooks/use-theme';

/** 카드를 그린 기준 크기 — 화면 너비에 맞춰 이 비율로 키우고 줄인다(기념 카드와 같다) */
const BASE_W = 360;
const BASE_H = 450;
const OUT_W = 1080;
const OUT_H = 1350;

function NewsCard({ news, pose, width, cardRef }: { news: DayNews; pose: BuddyPose; width: number; cardRef: RefObject<View | null> }) {
  const c = useTheme();
  const k = width / BASE_W;
  const art = POSES[pose];
  // 칸이 없으면(메모만) 메모를 칸 자리로 올린다
  const noteTop = news.stats.length > 0 ? 262 : 150;
  return (
    <View ref={cardRef} collapsable={false} style={{ width, height: BASE_H * k, backgroundColor: c.hero, overflow: 'hidden' }}>
      <View style={[styles.mobile, { right: 10 * k }]}>
        <HeroMobile scale={0.62 * k} />
      </View>

      <View style={[styles.abs, { left: 24 * k, top: 30 * k, gap: 2 * k }]}>
        <ThemedText style={{ fontSize: 13 * k, lineHeight: 18 * k, color: c.onHeroDim }}>{news.dateText}</ThemedText>
        <ThemedText style={{ fontSize: 30 * k, lineHeight: 38 * k, fontWeight: 700, letterSpacing: -0.8 * k, color: c.onHero }}>
          우리 아기 오늘
        </ThemedText>
        <ThemedText style={{ fontSize: 14 * k, lineHeight: 20 * k, fontWeight: 600, color: c.heroAccent }}>{news.daysText}</ThemedText>
      </View>

      {news.stats.length > 0 && (
        <View style={[styles.abs, styles.stats, { left: 20 * k, right: 20 * k, top: 150 * k, gap: 8 * k }]}>
          {news.stats.map((s) => (
            <View
              key={s.label}
              style={{ flex: 1, minHeight: 96 * k, borderRadius: 16 * k, backgroundColor: c.heroCard, paddingHorizontal: 12 * k, paddingVertical: 12 * k, gap: 2 * k }}>
              <ThemedText style={{ fontSize: 12 * k, lineHeight: 16 * k, color: c.onHeroDim }}>{s.label}</ThemedText>
              {/* 「7시간 30분」은 칸이 좁아 띄어쓰기에서 두 줄로 — 줄이지 않는다 */}
              <ThemedText style={{ fontSize: 22 * k, lineHeight: 27 * k, fontWeight: 700, color: c.onHero }} numberOfLines={2}>
                {s.value}
              </ThemedText>
              {s.sub && <ThemedText style={{ fontSize: 11 * k, lineHeight: 15 * k, color: c.onHeroDim }}>{s.sub}</ThemedText>}
            </View>
          ))}
        </View>
      )}

      {news.note && (
        <View style={[styles.abs, { left: 24 * k, right: 24 * k, top: noteTop * k }]}>
          <ThemedText style={{ fontSize: 17 * k, lineHeight: 25 * k, fontWeight: 600, color: c.onHero }} numberOfLines={2}>
            “{news.note}”
          </ThemedText>
        </View>
      )}

      <View style={{ position: 'absolute', left: 20 * k, width: 190 * k, bottom: 18 * k, height: 34 * k, borderRadius: 17 * k, backgroundColor: c.heroMat }} />
      <View style={{ position: 'absolute', left: 20 * k, width: 190 * k, bottom: 28 * k, alignItems: 'center' }}>
        <Image source={art.src} style={{ width: art.width * 0.62 * k, height: art.height * 0.62 * k }} contentFit="contain" accessibilityIgnoresInvertColors />
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

export function DayNewsSheet({
  news,
  title,
  pose,
  onClose,
}: {
  /** 보낼 소식 — null 이면 시트를 닫아 둔다 */
  news: DayNews | null;
  /** 시트 제목 — 「오늘 소식」 · 「어제 소식」 */
  title: string;
  pose: BuddyPose;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const width = Math.min(window.width - Spacing.four * 2, BASE_W);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    await shareImage(card, OUT_W, OUT_H);
    setBusy(false);
  };

  return (
    <Modal visible={news !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ThemedText type="title">{title}</ThemedText>
          {news && (
            <View style={styles.card}>
              <NewsCard news={news} pose={pose} width={width} cardRef={card} />
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
  stats: { flexDirection: 'row' },
  mobile: { position: 'absolute', top: 0 },
  logo: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
});
