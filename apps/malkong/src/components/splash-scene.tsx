import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AssistantIcon, BottleIcon } from '@/components/baby-icons';
import { BrandLogo, BrandSlogan } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type At = (dx: number, dy: number) => { left: number; top: number };

/**
 * 시작 화면 둘레의 카드 셋과 로고 · 슬로건 — 지금 앱의 하루 흐름을 보여 준다(11판 시안, task today/028).
 * 기록 한 줄(누가 남겼는지까지), 물어보기 한 번, 하루 24시간 고리. 카드 내용은 앱을 보여 주는 그림이고 그 집의 실제 기록이 아니다.
 */
export function SplashCards({ at, s }: { at: At; s: number }) {
  const c = useTheme();
  return (
    <>
      <Card style={at(-177, -222)} rotate={-6} scale={s}>
        <View style={styles.row}>
          <View style={[styles.tile, { backgroundColor: c.accent }]}>
            <BottleIcon size={16} color="#FFFFFF" />
          </View>
          <View>
            <ThemedText style={[styles.title, { color: c.onHero }]}>분유 160ml</ThemedText>
            <ThemedText style={[styles.sub, { color: c.onHeroDim }]}>12:30 · 할머니</ThemedText>
          </View>
        </View>
      </Card>

      <Card style={at(27, -196)} rotate={5} scale={s}>
        <View style={[styles.me, { backgroundColor: c.onHero }]}>
          <ThemedText style={[styles.sub, { color: c.hero, fontWeight: 600 }]}>마지막 수유 언제였지?</ThemedText>
        </View>
        <View style={styles.row}>
          <AssistantIcon size={18} color={c.onHeroDim} spark={c.heroAccent} />
          <ThemedText style={[styles.reply, { color: c.onHero }]}>2시간 전, 160ml</ThemedText>
        </View>
      </Card>

      <Card style={at(35, 70)} rotate={-3} scale={s}>
        <View style={styles.row}>
          <MiniRing />
          <View style={styles.legend}>
            <Dot color={c.onHero} label="잠 12시간" />
            <Dot color={c.heroAccent} label="수유 6번" />
            <Dot color={c.diaperDot} label="기저귀 5번" />
          </View>
        </View>
      </Card>

      <View style={[styles.words, { top: at(0, 206).top, transform: [{ scale: s }] }]}>
        <BrandLogo size={36} color={c.onHero} />
        <BrandSlogan onDark />
      </View>
    </>
  );
}

/** 하루 24시간 고리를 작게 — 위가 0시, 잠은 흰 구간, 수유는 코랄 점, 기저귀는 바깥 노란 점(오늘 소식 카드와 같은 약속) */
function MiniRing() {
  const c = useTheme();
  const SIZE = 56;
  const C = SIZE / 2;
  const R = 19;
  const pt = (h: number, r: number) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  };
  const arc = (from: number, to: number) => {
    const a = pt(from, R);
    const b = pt(to, R);
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}A${R} ${R} 0 ${to - from > 12 ? 1 : 0} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };
  const sleeps: [number, number][] = [
    [0, 6.5],
    [9.5, 11],
    [13.2, 14.8],
    [21, 24],
  ];
  const feeds = [3, 7.4, 12.2, 16.2, 18.8, 20.4];
  const diapers = [7.6, 12.6, 16.8, 19.6, 22.4];
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={C} cy={C} r={R} stroke={c.heroTrack} strokeWidth={5} fill="none" />
      {sleeps.map(([a, b], i) => (
        <Path key={i} d={arc(a, b)} stroke={c.onHero} strokeWidth={5} strokeLinecap="round" fill="none" />
      ))}
      {diapers.map((h, i) => {
        const p = pt(h, R + 8.5);
        return <Circle key={`d${i}`} cx={p.x} cy={p.y} r={2} fill={c.diaperDot} />;
      })}
      {feeds.map((h, i) => {
        const p = pt(h, R);
        return <Circle key={`f${i}`} cx={p.x} cy={p.y} r={3.2} fill={c.heroAccent} stroke={c.heroCard} strokeWidth={1.2} />;
      })}
    </Svg>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  const c = useTheme();
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText style={[styles.sub, { color: c.onHero }]}>{label}</ThemedText>
    </View>
  );
}

/** 먹색 위의 작은 카드 */
function Card({ style, rotate, scale, children }: { style: { left: number; top: number }; rotate: number; scale: number; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.card, style, { backgroundColor: c.heroCard, borderColor: c.heroCardLine, transform: [{ rotate: `${rotate}deg` }, { scale }] }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 150,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: 700, letterSpacing: -0.3 },
  sub: { fontSize: 11, lineHeight: 15 },
  reply: { fontSize: 13, lineHeight: 18, fontWeight: 700, letterSpacing: -0.2 },
  me: { alignSelf: 'flex-end', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, borderBottomRightRadius: 4 },
  legend: { gap: 2 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  words: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 16 },
});
