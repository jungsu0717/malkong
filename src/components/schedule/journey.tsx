import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { BabyFaceIcon } from '@/components/baby-icons';
import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Card, tap } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { todoOf } from '@/data/briefing';
import type { BabyRecord } from '@/data/records';
import {
  buildJourney,
  coveredIds,
  groupsToMark,
  journeyRings,
  KIND_COLORS,
  type JourneyRing,
  type Station,
} from '@/data/schedule';
import { groupLabel, type GapGroup } from '@/data/timeline';
import { useProgress } from '@/hooks/use-progress';
import { useTheme } from '@/hooks/use-theme';

/** 정류장 사이 · 양 끝 여백 · 길 그림 높이 */
const STEP = 96;
const PAD = 44;
const TAIL = 56;
const ROAD_H = 150;
/** 길의 가운데 줄과 출렁임 — 정류장은 위아래로 번갈아 놓인다 */
const MID = 78;
const AMP = 16;
const NODE = 30;
const NOW_NODE = 44;
const LABEL_TOP = MID + AMP + NOW_NODE / 2 + 6;

const xOf = (i: number) => PAD + i * STEP;
const yOf = (x: number) => MID + AMP * Math.cos(((x - PAD) / STEP) * Math.PI);

/** 0 부터 `to` 까지의 길 — 점을 촘촘히 이은 선과 그 길이 */
function roadPath(from: number, to: number): { d: string; length: number } {
  let d = `M ${from} ${yOf(from)}`;
  let length = 0;
  let prev = { x: from, y: yOf(from) };
  for (let x = from + 4; x <= to; x += 4) {
    const y = yOf(x);
    d += ` L ${x} ${y.toFixed(1)}`;
    length += Math.hypot(x - prev.x, y - prev.y);
    prev = { x, y };
  }
  return { d, length };
}

const RING = 62;
const RING_STROKE = 6;

function Ring({ ring, replay, delay }: { ring: JourneyRing; replay: number; delay: number }) {
  const c = useTheme();
  const p = useProgress(replay, 1100, delay);
  const r = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = ring.total > 0 ? ring.done / ring.total : 0;
  const color = KIND_COLORS[ring.kind];
  return (
    <View style={styles.ring} accessible accessibilityLabel={`${ring.kind} ${ring.total}개 중 ${ring.done}개`}>
      <View>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={c.onSpace} strokeOpacity={0.14} strokeWidth={RING_STROKE} fill="none" />
          {ratio > 0 && (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - ratio * p)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          )}
        </Svg>
        <View style={styles.ringCenter}>
          <ThemedText type="label" style={{ color: c.onSpace, fontWeight: 700 }}>
            {ring.total > 0 ? `${Math.round(ring.done * p)}/${ring.total}` : '—'}
          </ThemedText>
        </View>
      </View>
      <View style={styles.ringLabel}>
        <View style={[styles.pip, { backgroundColor: color }]} />
        <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
          {ring.kind}
        </ThemedText>
      </View>
    </View>
  );
}

/** 지나온 길 — 차오르는 모션. 빛 번짐(굵고 옅은 선) 위에 또렷한 선 */
function TraveledRoad({ to, replay }: { to: number; replay: number }) {
  const c = useTheme();
  const p = useProgress(replay, 1300, 150);
  const { d, length } = useMemo(() => roadPath(0, to), [to]);
  const offset = length * (1 - p);
  const dash = `${length} ${length}`;
  return (
    <>
      <Path d={d} stroke="url(#road)" strokeWidth={14} strokeOpacity={0.22} strokeLinecap="round" fill="none" strokeDasharray={dash} strokeDashoffset={offset} />
      <Path d={d} stroke="url(#road)" strokeWidth={5} strokeLinecap="round" fill="none" strokeDasharray={dash} strokeDashoffset={offset} />
      <Defs>
        <LinearGradient id="road" x1="0" y1="0" x2={String(Math.max(1, to))} y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={KIND_COLORS.발달} />
          <Stop offset="1" stopColor={c.accent} />
        </LinearGradient>
      </Defs>
    </>
  );
}

/** 지금 자리 — 아기 얼굴과 퍼지는 고리 */
function NowNode({ selected }: { selected: boolean }) {
  const c = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.8 }],
  }));
  return (
    <View style={styles.nowWrap}>
      <Animated.View style={[styles.nowPulse, { backgroundColor: c.accent }, ring]} />
      <View style={[styles.nowNode, { backgroundColor: c.accent, borderColor: selected ? c.onSpace : c.accent }]}>
        <BabyFaceIcon size={26} color={c.onSpace} />
      </View>
    </View>
  );
}

function StationNode({ station, selected }: { station: Station; selected: boolean }) {
  const c = useTheme();
  if (station.isNow) return <NowNode selected={selected} />;
  const ring = selected ? { borderColor: c.onSpace, borderWidth: 2 } : null;
  const left = station.items.length - station.doneCount;
  switch (station.state) {
    case 'done':
      return (
        <View style={[styles.node, { backgroundColor: c.accent, borderColor: c.accent }, ring]}>
          <Ionicons name="checkmark" size={17} color={c.onSpace} />
        </View>
      );
    case 'missed':
      return (
        <View style={[styles.node, { backgroundColor: c.space, borderColor: c.onSpaceDim }, ring]}>
          <ThemedText type="label" style={{ color: c.onSpace, fontWeight: 700 }}>
            ?
          </ThemedText>
        </View>
      );
    case 'future':
      return <View style={[styles.node, styles.futureNode, { backgroundColor: c.space, borderColor: c.onSpaceDim }, ring]} />;
    default:
      return (
        <View style={[styles.node, { backgroundColor: c.space, borderColor: c.accent }, ring]}>
          <ThemedText type="caption" style={{ color: c.onSpace, fontWeight: 700, fontSize: 11 }}>
            {left}
          </ThemedText>
        </View>
      );
  }
}

/** 정류장 아래 — 월령 · 날짜 · 항목마다 점 하나(분류 색, 한 것은 채움) */
function StationLabel({ station, covered }: { station: Station; covered: Set<string> }) {
  const c = useTheme();
  const future = station.state === 'future';
  return (
    <View style={[styles.label, future && styles.dim]}>
      <ThemedText type="label" style={{ color: c.onSpace, fontWeight: 700 }}>
        {station.month}개월
      </ThemedText>
      <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
        {station.isNow ? '지금' : `${station.date.getMonth() + 1}.${station.date.getDate()}`}
      </ThemedText>
      <View style={styles.pips}>
        {station.items.map((item) => {
          const done = covered.has(item.id);
          const color = KIND_COLORS[item.kind];
          return (
            <View
              key={item.id}
              style={[styles.pip, done ? { backgroundColor: color } : { borderWidth: 1.5, borderColor: color }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const STATE_TEXT: Record<Station['state'], string> = {
  done: '다 챙긴 정류장',
  partial: '지나온 정류장',
  open: '지금 챙길 정류장',
  missed: '지나온 정류장',
  future: '앞으로',
  now: '지금 여기',
};

/**
 * 챙길 것 여정 (SPEC-GROW-02 · 03) — 0개월부터 월령을 따라 이어지는 길 위의 정류장.
 * 위는 접종 · 검진 · 발달 세 고리(지금까지 할 것 중 한 것), 가운데는 가로로 넘기는 길(지나온 길은 차오르고 지금 자리에 아기),
 * 아래는 고른 정류장의 항목 — 거기서 완료를 알린다(mark-done). 지식 지도처럼 어두운 판 위에 그린다.
 */
export function Journey({
  birthDate,
  records,
  currentMonth,
  name,
  replay,
  onPick,
}: {
  birthDate: string;
  records: BabyRecord[];
  currentMonth: number;
  name: string;
  /** 바뀌면 등장 모션을 다시 */
  replay: number;
  onPick: (group: GapGroup) => void;
}) {
  const c = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const stations = useMemo(() => buildJourney(birthDate, records, currentMonth), [birthDate, records, currentMonth]);
  const rings = useMemo(() => journeyRings(records, currentMonth), [records, currentMonth]);
  const covered = useMemo(() => coveredIds(records), [records]);
  const nowIndex = Math.max(0, stations.findIndex((s) => s.isNow));
  const [picked, setPicked] = useState<number | null>(null);
  const selectedIndex = picked ?? nowIndex;
  const selected = stations[selectedIndex];
  const width = xOf(stations.length - 1) + TAIL;
  const nowX = xOf(nowIndex);
  const future = useMemo(() => roadPath(nowX, width), [nowX, width]);
  const total = rings.reduce((n, r) => n + r.total, 0);
  const done = rings.reduce((n, r) => n + r.done, 0);

  // 열 때마다 지금 자리가 가운데 오게 — contentOffset 은 iOS 에서만 먹어 다 깔린 뒤 옮긴다
  useEffect(() => {
    if (viewport === 0) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, nowX - viewport / 2), animated: false });
  }, [viewport, nowX, replay]);

  const groups = selected ? groupsToMark(selected.items, covered, currentMonth) : [];
  const doneItems = selected ? selected.items.filter((i) => covered.has(i.id)) : [];
  const doneGroups = [...new Set(doneItems.map((i) => i.kind))].map((kind) => doneItems.filter((i) => i.kind === kind));
  const next = stations.find((s) => s.month > currentMonth && s.items.length > 0);

  return (
    <View style={styles.wrap}>
      <View style={[styles.board, { backgroundColor: c.space }]}>
        <View style={styles.boardHead}>
          <ThemedText type="label" style={{ color: c.onSpaceDim }}>
            {name}의 챙길 것 여정
          </ThemedText>
          <ThemedText type="title" style={{ color: c.onSpace }}>
            {total > 0 ? `지금까지 ${total}개 중 ${done}개` : '여정을 막 시작했어요'}
          </ThemedText>
        </View>
        <View style={styles.rings}>
          {rings.map((ring, i) => (
            <Ring key={ring.kind} ring={ring} replay={replay} delay={i * 120} />
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
          contentContainerStyle={{ width, height: ROAD_H + 46 }}>
          <Svg width={width} height={ROAD_H} style={StyleSheet.absoluteFill}>
            <Path d={future.d} stroke={c.onSpace} strokeOpacity={0.28} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" fill="none" />
            <TraveledRoad to={nowX} replay={replay} />
          </Svg>
          {stations.map((station, i) => {
            const x = xOf(i);
            const size = station.isNow ? NOW_NODE : NODE;
            return (
              <Pressable
                key={station.month}
                accessibilityRole="button"
                accessibilityState={{ selected: i === selectedIndex }}
                accessibilityLabel={`${station.month}개월 정류장, ${STATE_TEXT[station.state]}`}
                onPress={() => {
                  tap();
                  setPicked(i);
                }}
                style={[styles.station, { left: x - STEP / 2, width: STEP }]}>
                {station.isNow && (
                  <View style={[styles.nowTag, { top: yOf(x) - NOW_NODE / 2 - 26, backgroundColor: c.onSpace }]}>
                    <ThemedText type="caption" style={{ color: c.space, fontWeight: 700 }}>
                      지금
                    </ThemedText>
                  </View>
                )}
                <View style={{ position: 'absolute', top: yOf(x) - size / 2, left: STEP / 2 - size / 2 }}>
                  <StationNode station={station} selected={i === selectedIndex} />
                </View>
                <View style={{ position: 'absolute', top: LABEL_TOP, left: 0, right: 0 }}>
                  <StationLabel station={station} covered={covered} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.legend}>
          {(['접종', '검진', '발달'] as const).map((kind) => (
            <View key={kind} style={styles.legendItem}>
              <View style={[styles.pip, { backgroundColor: KIND_COLORS[kind] }]} />
              <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                {kind}
              </ThemedText>
            </View>
          ))}
          <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
            · 색이 찬 점은 한 것 · 정류장을 누르면 자세히 보여요
          </ThemedText>
        </View>
      </View>

      {selected && (
        <Card style={styles.panel}>
          <View style={styles.panelHead}>
            <ThemedText type="heading" style={styles.flex}>
              {selected.month}개월 · {selected.date.getMonth() + 1}월 {selected.date.getDate()}일 무렵
            </ThemedText>
            <ThemedText type="caption" style={{ color: selected.isNow ? c.accentText : c.textSecondary, fontWeight: 600 }}>
              {STATE_TEXT[selected.state]}
            </ThemedText>
          </View>
          {selected.items.length === 0 ? (
            <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
              이번 달에 새로 시작하는 접종 · 검진은 없어요.
              {next ? ` 다음 정류장은 ${next.month}개월(${next.date.getMonth() + 1}월 ${next.date.getDate()}일 무렵)이에요` : ''}
            </ThemedText>
          ) : (
            <>
              {groups.map((g, i) => (
                <TodoRow
                  key={g.key}
                  todo={todoOf(g)}
                  birthDate={birthDate}
                  currentMonth={currentMonth}
                  divider={i > 0}
                  onPick={() => onPick(g)}
                />
              ))}
              {doneGroups.map((items, i) => (
                <TodoRow
                  key={`done-${items[0].kind}`}
                  todo={todoOf({ key: `done-${items[0].kind}`, status: 'open', month: selected.month, label: groupLabel(items), items })}
                  birthDate={birthDate}
                  currentMonth={currentMonth}
                  done
                  divider={groups.length + i > 0}
                  onPick={() => undefined}
                />
              ))}
            </>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  flex: { flex: 1 },
  board: { borderRadius: Radius.xl, paddingTop: Spacing.three, paddingBottom: 14, overflow: 'hidden' },
  boardHead: { paddingHorizontal: Spacing.three, gap: 2 },
  rings: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: Spacing.three, paddingTop: 14, paddingBottom: 4 },
  ring: { alignItems: 'center', gap: 6 },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  station: { position: 'absolute', top: 0, bottom: 0 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  futureNode: { borderStyle: 'dashed', borderWidth: 1.5 },
  nowWrap: { width: NOW_NODE, height: NOW_NODE, alignItems: 'center', justifyContent: 'center' },
  nowPulse: { position: 'absolute', width: NOW_NODE, height: NOW_NODE, borderRadius: NOW_NODE / 2 },
  nowNode: {
    width: NOW_NODE,
    height: NOW_NODE,
    borderRadius: NOW_NODE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowTag: { position: 'absolute', alignSelf: 'center', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  label: { alignItems: 'center', gap: 1 },
  dim: { opacity: 0.6 },
  pips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: 5, paddingHorizontal: 8 },
  pip: { width: 8, height: 8, borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  panel: { paddingVertical: 4 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: 12, paddingBottom: 4 },
  empty: { paddingVertical: 12 },
});
