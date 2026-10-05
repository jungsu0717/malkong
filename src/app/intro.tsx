import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePreferences } from '@/data/preferences-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * 처음 실행 만화 — 온보딩 전에 「아빠가 육아 앱을 만든 이유」 다섯 컷 (SPEC-MY-07, task my/006).
 * 그림은 marketing/toon 에서 그려 `./render.sh app` 으로 옮긴 것이다. label 은 화면 읽기 프로그램이 읽는 줄거리.
 */
const CUTS = [
  {
    image: require('@/assets/images/intro/01.png'),
    label: '어느덧 눈앞에 다가온 출산 예정일. 기저귀와 분유 상자, 필수 육아앱 설치까지 마친 체크리스트 앞에서 아빠가 팔짱을 끼고 「후… 이 정도면 완벽하지」 해요.',
  },
  {
    image: require('@/assets/images/intro/02.png'),
    label: '하지만 새벽 3시 현실은… 우는 아기를 안고 폰을 치켜든 아빠가 「마지막 수유가 이 앱이었나, 저 앱이었나, 아니 수첩이었나」 허둥대요. 검색창과 AI 챗봇 앞에서 멘붕.',
  },
  {
    image: require('@/assets/images/intro/03.png'),
    label: '이런 답변을 원한 게 아닌데… 블로그 후기는 알고 보니 협찬, 번역된 해외 글은 엉뚱한 말, 증상 검색은 무서운 것부터, AI 챗봇은 새 대화마다 아기 소개를 처음부터 다시 해야 해요.',
  },
  {
    image: require('@/assets/images/intro/04.png'),
    label: '그래서 개발자 아빠는 결심했다. 밤에 아기를 안고 코딩하며 「우리 애를 기억하고, 근거를 대는 비서… 내가 만든다」. 옆에는 우리 아기 지식 지도.',
  },
  {
    image: require('@/assets/images/intro/05.png'),
    label: '그래!! 바로 이거지! 다음 날 아침 버디가 어제 열이 났던 걸 기억하고 안부를 묻고, 접종 답에 질병관리청 출처까지 붙여요. 앱 여러 개 뒤지던 걸, 이제 버디에게 물으면 끝.',
  },
];

/** 만화 칸 높이를 재기 전에 쓰는 어림값 — 위 줄 · 점 · 아래 단추가 차지하는 높이 */
const CHROME_HEIGHT = 220;

export default function IntroScreen() {
  const c = useTheme();
  const router = useRouter();
  const { markIntroSeen } = usePreferences();
  const { width, height } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [area, setArea] = useState(0);

  const page = Math.min(width, MaxContentWidth);
  const areaHeight = area || height - CHROME_HEIGHT;
  // 만화는 4:5 — 너비에 맞추되, 키가 모자라면 높이에 맞춘다
  const cutWidth = Math.min(page - Gutter * 2, (areaHeight * 4) / 5);
  const cutHeight = (cutWidth * 5) / 4;
  const last = index === CUTS.length - 1;

  const go = (next: number) => {
    const i = Math.max(0, Math.min(CUTS.length - 1, next));
    setIndex(i);
    scroller.current?.scrollTo({ x: i * page, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / page);
    if (i !== index && i >= 0 && i < CUTS.length) setIndex(i);
  };

  /** 끝까지 봤거나 건너뛰면 다시 띄우지 않는다 */
  const finish = async () => {
    setLeaving(true);
    try {
      await markIntroSeen();
      router.replace('/onboarding');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={[styles.top, { width: page }]}>
          <ThemedText type="label" style={{ color: c.textSecondary }}>
            {index + 1} / {CUTS.length}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="만화 건너뛰기"
            hitSlop={12}
            disabled={leaving}
            onPress={() => void finish()}>
            <ThemedText type="label" style={{ color: c.textSecondary }}>
              건너뛰기
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.area} onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ width: page, height: cutHeight, flexGrow: 0, alignSelf: 'center' }}>
            {CUTS.map((cut, i) => (
              <View key={i} style={[styles.page, { width: page }]}>
                <Image
                  source={cut.image}
                  accessibilityLabel={`만화 ${i + 1}컷. ${cut.label}`}
                  contentFit="contain"
                  style={[styles.cut, { width: cutWidth, height: cutHeight, borderColor: c.border }]}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {CUTS.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === index ? c.ink : c.surfaceStrong }]} />
          ))}
        </View>

        <View style={[styles.footer, { width: page }]}>
          <Button label="이전" variant="secondary" size="lg" disabled={index === 0 || leaving} onPress={() => go(index - 1)} style={styles.flex} />
          <Button
            label={last ? '시작하기' : '다음'}
            size="lg"
            busy={leaving && last}
            disabled={leaving}
            onPress={() => (last ? void finish() : go(index + 1))}
            style={styles.flex}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: Gutter,
    paddingVertical: Spacing.three,
  },
  /** 만화 칸 — 남은 높이 가운데에 만화를 둔다 */
  area: { flex: 1, justifyContent: 'center' },
  page: { alignItems: 'center' },
  cut: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.three },
  dot: { width: 7, height: 7, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'center',
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.three,
  },
});
