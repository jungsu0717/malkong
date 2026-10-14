/**
 * 지식 지도 — 버디가 아는 우리 아기를 돌려 보는 3D 그래프 (SPEC-BABY-02, task baby/001).
 *
 * 가운데 아기, 둘레에 영역 행성 여섯, 행성 둘레에 「알아야 할 것」 점들. 아는 것은 밝게 채우고 모르는 것은 빈 고리.
 * 3D 엔진 없이, 점마다 회전 · 원근 투영을 직접 계산(`project`)해 앱의 기본 화면 요소(View)를 Reanimated 로
 * UI 스레드에서 움직인다. 처음에는 Skia 그림판으로 그렸는데 아이폰(Expo Go)에서 그림판이 붙는 순간 앱이 꺼지는
 * 일이 되풀이돼 바꿨다(task baby/001). 이 방식은 웹에서도 같은 코드로 그려진다.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { BuddyMark } from '@/components/brand';
import { GalaxyBoundary } from '@/components/galaxy-boundary';
import { FontFamily } from '@/constants/theme';
import type { Domain, DomainId } from '@/data/knowledge-profile';

export type GalaxyProps = {
  domains: Domain[];
  /** 바뀔 때마다 등장 모션을 다시 */
  replay: number;
  /** 탭이 보일 때만 움직인다 — 안 보이는 동안 매 프레임 계산하지 않게 */
  active: boolean;
  selected: DomainId | null;
  onSelect: (id: DomainId | null) => void;
  height: number;
  /** 가운데 아기 색 */
  coreColor: string;
};

type V3 = [number, number, number];

/** 그리는 데 필요한 공유 값 — 모든 점이 같은 카메라를 본다 */
type Cam = {
  width: number;
  height: number;
  time: SharedValue<number>;
  intro: SharedValue<number>;
  yaw: SharedValue<number>;
  dragYaw: SharedValue<number>;
  pitch: SharedValue<number>;
};

/** 카메라 거리 — 작을수록 원근이 세다 */
const CAMERA = 3.4;
const STAR_COUNT = 36;
const RING_DOTS = 40;
const ORBIT = 1.05;

/** 결정적인 난수 — 그릴 때마다 별이 흔들리지 않게 */
function seeded(n: number) {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount)),
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 회전(가로 yaw · 세로 pitch) 뒤 원근 투영 — 화면 좌표, 크기 배율, 깊이(클수록 멀다) */
function project(p: V3, yaw: number, pitch: number, width: number, height: number) {
  'worklet';
  const cx = width / 2;
  const cy = height / 2 + 6;
  const focal = Math.min(width, height) * 1.05;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = p[0] * cosY + p[2] * sinY;
  const z1 = -p[0] * sinY + p[2] * cosY;
  const cosX = Math.cos(pitch);
  const sinX = Math.sin(pitch);
  const y2 = p[1] * cosX - z1 * sinX;
  const z2 = p[1] * sinX + z1 * cosX;
  const depth = z2 + CAMERA;
  const scale = focal / depth;
  return { x: cx + x1 * scale, y: cy - y2 * scale, scale, depth };
}

/** 가까울수록 1, 멀수록 0.35 */
function nearness(depth: number) {
  'worklet';
  return Math.max(0.35, Math.min(1, (CAMERA + 1.3 - depth) / 2.2));
}

function planetRadius(scale: number, score: number, k: number) {
  'worklet';
  return scale * (0.07 + 0.075 * score) * (0.3 + 0.7 * k);
}

/** 사실 점의 3D 자리 — 행성 둘레를 돈다 */
function factPos(planet: V3, dir: V3, index: number, j: number, t: number, k: number): V3 {
  'worklet';
  const spin = t * 0.5 + index;
  const cosS = Math.cos(spin);
  const sinS = Math.sin(spin);
  const orbit = 0.2 + 0.05 * (j % 2);
  const dx = dir[0] * cosS + dir[2] * sinS;
  const dz = -dir[0] * sinS + dir[2] * cosS;
  return [(planet[0] + dx * orbit) * k, (planet[1] + dir[1] * orbit) * k, (planet[2] + dz * orbit) * k];
}

function Galaxy({ domains, replay, active, selected, onSelect, height, coreColor }: GalaxyProps) {
  const [width, setWidth] = useState(0);
  const time = useSharedValue(0);
  const intro = useSharedValue(0);
  const dragYaw = useSharedValue(0);
  const pitch = useSharedValue(-0.42);
  /** 끄는 동안은 저절로 도는 것을 멈춘다 */
  const dragging = useSharedValue(0);
  const autoYaw = useSharedValue(0);

  const ticker = useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    time.value += dt;
    if (!dragging.value) autoYaw.value += dt * 0.16;
  }, false);

  useEffect(() => {
    ticker.setActive(active);
  }, [ticker, active]);

  useEffect(() => {
    intro.set(0);
    intro.set(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }));
  }, [intro, replay]);

  // 뼈대 — 영역 행성 자리, 행성마다 사실 점의 방향, 별. 데이터가 바뀔 때만 다시 만든다
  const scene = useMemo(() => {
    const planets = domains.map((d, i) => {
      const a = (i / domains.length) * Math.PI * 2;
      const pos: V3 = [Math.cos(a) * ORBIT, i % 2 ? 0.26 : -0.2, Math.sin(a) * ORBIT];
      const facts = d.facts.map((f, j) => {
        // 행성 둘레 작은 구 위에 고르게(황금각)
        const kk = (j + 0.5) / d.facts.length;
        const phi = Math.acos(1 - 2 * kk);
        const theta = Math.PI * (1 + Math.sqrt(5)) * j + i;
        return {
          key: f.id,
          dir: [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)] as V3,
          known: f.score >= 0.5,
          partial: f.score > 0 && f.score < 0.5,
        };
      });
      return {
        id: d.id,
        index: i,
        name: d.name,
        percent: Math.round(d.score * 100),
        score: d.score,
        pos,
        color: d.color,
        light: shade(d.color, 0.55),
        dark: shade(d.color, -0.45),
        facts,
      };
    });
    const rand = seeded(7);
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = 3 + rand() * 1.5;
      const s = Math.sqrt(1 - u * u);
      return { key: i, p: [s * Math.cos(t) * r, u * r, s * Math.sin(t) * r] as V3, tw: rand() * 6 };
    });
    return { planets, stars };
  }, [domains]);

  const cam: Cam = { width, height, time, intro, yaw: autoYaw, dragYaw, pitch };

  // 끌어서 돌리기 · 눌러서 고르기. 고르기는 지금 화면에 그려진 행성 자리로 가장 가까운 것을 찾는다
  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      dragging.set(1);
    })
    .onChange((e) => {
      dragYaw.set(dragYaw.get() + e.changeX * 0.008);
      pitch.set(Math.max(-1.2, Math.min(0.35, pitch.get() + e.changeY * 0.006)));
    })
    .onFinalize(() => {
      dragging.set(0);
    });

  const pick = (x: number, y: number) => {
    if (!width) return;
    const yaw = autoYaw.get() + dragYaw.get();
    let best: { id: DomainId; d: number } | null = null;
    for (const pl of scene.planets) {
      const q = project(pl.pos, yaw, pitch.get(), width, height);
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < planetRadius(q.scale, pl.score, 1) + 18 && (!best || d < best.d)) best = { id: pl.id, d };
    }
    onSelect(best ? (best.id === selected ? null : best.id) : null);
  };

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => pick(e.x, e.y));


  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tapGesture)}>
      <View style={[styles.wrap, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            {/* 가운데가 은은하게 밝은 우주 — 크기가 다른 옅은 원을 겹쳐 퍼지는 빛처럼 */}
            {[300, 220, 150].map((size, i) => (
              <View
                key={size}
                pointerEvents="none"
                style={[
                  styles.nebula,
                  { width: size, height: size, borderRadius: size / 2, left: width / 2 - size / 2, top: height / 2 + 6 - size / 2, opacity: 0.1 + i * 0.05 },
                ]}
              />
            ))}
            {scene.stars.map((s) => (
              <Star key={s.key} p={s.p} tw={s.tw} cam={cam} />
            ))}
            {Array.from({ length: RING_DOTS }, (_, i) => (
              <RingDot key={i} angle={(i / RING_DOTS) * Math.PI * 2} cam={cam} />
            ))}
            {scene.planets.map((pl) => (
              <Spoke key={pl.id} pos={pl.pos} score={pl.score} color={pl.color} cam={cam} />
            ))}
            {scene.planets.map((pl) =>
              pl.facts.map((f, j) => (
                <FactDot
                  key={`${pl.id}-${f.key}`}
                  planet={pl.pos}
                  dir={f.dir}
                  index={pl.index}
                  j={j}
                  known={f.known}
                  partial={f.partial}
                  light={pl.light}
                  cam={cam}
                />
              )),
            )}
            <Core color={coreColor} cam={cam} />
            {scene.planets.map((pl) => (
              <Planet
                key={pl.id}
                pos={pl.pos}
                score={pl.score}
                color={pl.color}
                light={pl.light}
                dark={pl.dark}
                selected={pl.id === selected}
                cam={cam}
              />
            ))}
            {scene.planets.map((pl) => (
              <PlanetLabel key={pl.id} name={pl.name} percent={pl.percent} pos={pl.pos} score={pl.score} cam={cam} />
            ))}
          </>
        )}
      </View>
    </GestureDetector>
  );
}

function Star({ p, tw, cam }: { p: V3; tw: number; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const q = project(p, (cam.yaw.value + cam.dragYaw.value) * 0.35, cam.pitch.value * 0.5, cam.width, cam.height);
    const twinkle = 0.3 + 0.35 * Math.sin(cam.time.value * 1.6 + tw);
    return {
      opacity: q.depth <= 0.2 ? 0 : Math.max(0, twinkle * cam.intro.value),
      transform: [{ translateX: q.x - 1 }, { translateY: q.y - 1 }, { scale: Math.max(0.6, q.scale * 0.012) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.star, style]} />;
}

function RingDot({ angle, cam }: { angle: number; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project(
      [Math.cos(angle) * ORBIT * k, 0.03, Math.sin(angle) * ORBIT * k],
      cam.yaw.value + cam.dragYaw.value,
      cam.pitch.value,
      cam.width,
      cam.height,
    );
    return {
      opacity: 0.22 * nearness(q.depth) * k,
      transform: [{ translateX: q.x - 1 }, { translateY: q.y - 1 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.ringDot, style]} />;
}

/** 아기와 행성을 잇는 선 — 가는 막대를 두 점 사이에 돌려 놓는다 */
function Spoke({ pos, score, color, cam }: { pos: V3; score: number; color: string; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const yaw = cam.yaw.value + cam.dragYaw.value;
    const a = project([0, 0, 0], yaw, cam.pitch.value, cam.width, cam.height);
    const b = project([pos[0] * k, pos[1] * k, pos[2] * k], yaw, cam.pitch.value, cam.width, cam.height);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
    const bright = (0.35 + 0.65 * score) * nearness(b.depth) * k;
    return {
      opacity: 0.32 * bright,
      transform: [
        { translateX: (a.x + b.x) / 2 - 50 },
        { translateY: (a.y + b.y) / 2 - 0.5 },
        { rotate: `${Math.atan2(dy, dx)}rad` },
        { scaleX: len / 100 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.spoke, { backgroundColor: color }, style]} />;
}

/** 알아야 할 것 하나 — 아는 것은 빛나는 점, 모르는 것은 빈 고리 */
function FactDot({
  planet,
  dir,
  index,
  j,
  known,
  partial,
  light,
  cam,
}: {
  planet: V3;
  dir: V3;
  index: number;
  j: number;
  known: boolean;
  partial: boolean;
  light: string;
  cam: Cam;
}) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project(
      factPos(planet, dir, index, j, cam.time.value, k),
      cam.yaw.value + cam.dragYaw.value,
      cam.pitch.value,
      cam.width,
      cam.height,
    );
    const r = Math.max(1.6, q.scale * 0.022);
    return {
      opacity: (known ? 1 : partial ? 0.75 : 0.55) * k * (0.5 + 0.5 * nearness(q.depth)),
      transform: [{ translateX: q.x - 6 }, { translateY: q.y - 6 }, { scale: r / 6 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.fact, style]}>
      {known || partial ? (
        <>
          <View style={[styles.factHalo, { backgroundColor: light }]} />
          <View style={[styles.factCore, { opacity: known ? 1 : 0.6 }]} />
        </>
      ) : (
        <View style={styles.factRing} />
      )}
    </Animated.View>
  );
}

/** 가운데 아기 — 숨 쉬는 빛과 버디 얼굴 */
function Core({ color, cam }: { color: string; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project([0, 0, 0], cam.yaw.value + cam.dragYaw.value, cam.pitch.value, cam.width, cam.height);
    const pulse = 1 + 0.06 * Math.sin(cam.time.value * 2.2);
    const r = q.scale * 0.15 * pulse * (0.4 + 0.6 * k);
    return { transform: [{ translateX: q.x - 30 }, { translateY: q.y - 30 }, { scale: r / 30 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.body, style]}>
      <View style={[styles.halo, styles.haloOuter, { backgroundColor: color }]} />
      <View style={[styles.halo, styles.haloInner, { backgroundColor: color }]} />
      <View style={styles.face}>
        <BuddyMark size={64} />
      </View>
    </Animated.View>
  );
}

/** 구처럼 보이게 — 어두운 바탕 위에 조금 비켜 놓은 본색, 왼쪽 위 반사광 */
function Sphere({ color, light, dark }: { color: string; light: string; dark: string }) {
  return (
    <View style={[styles.sphere, { backgroundColor: dark }]}>
      <View style={[styles.sphereMain, { backgroundColor: color }]} />
      <View style={[styles.sphereShine, { backgroundColor: light }]} />
      <View style={styles.sphereSpec} />
    </View>
  );
}

function Planet({
  pos,
  score,
  color,
  light,
  dark,
  selected,
  cam,
}: {
  pos: V3;
  score: number;
  color: string;
  light: string;
  dark: string;
  selected: boolean;
  cam: Cam;
}) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project([pos[0] * k, pos[1] * k, pos[2] * k], cam.yaw.value + cam.dragYaw.value, cam.pitch.value, cam.width, cam.height);
    const r = planetRadius(q.scale, score, k);
    const bright = (0.35 + 0.65 * score) * nearness(q.depth) * k;
    return {
      opacity: Math.min(1, 0.45 + bright),
      transform: [{ translateX: q.x - 30 }, { translateY: q.y - 30 }, { scale: r / 30 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.body, style]}>
      <View style={[styles.halo, styles.haloOuter, { backgroundColor: color, opacity: 0.06 + 0.08 * score }]} />
      <View style={[styles.halo, styles.haloInner, { backgroundColor: color, opacity: 0.12 + 0.12 * score }]} />
      <Sphere color={color} light={light} dark={dark} />
      {selected && <View style={styles.selectedRing} />}
    </Animated.View>
  );
}

/** 행성 이름과 아는 정도 — 같은 투영 계산으로 행성 옆을 따라다닌다 */
function PlanetLabel({ name, percent, pos, score, cam }: { name: string; percent: number; pos: V3; score: number; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project([pos[0] * k, pos[1] * k, pos[2] * k], cam.yaw.value + cam.dragYaw.value, cam.pitch.value, cam.width, cam.height);
    const r = planetRadius(q.scale, score, k);
    return {
      opacity: Math.min(1, 0.3 + nearness(q.depth)) * k,
      transform: [{ translateX: q.x + r + 6 }, { translateY: q.y - 16 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.label, style]}>
      <Text style={styles.labelName}>{name}</Text>
      <Text style={styles.labelPercent}>{percent}%</Text>
    </Animated.View>
  );
}

export function KnowledgeGalaxy(props: GalaxyProps) {
  return (
    <GalaxyBoundary height={props.height}>
      <Galaxy {...props} />
    </GalaxyBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  nebula: { position: 'absolute', backgroundColor: '#3A2433' },
  star: { position: 'absolute', left: 0, top: 0, width: 2, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  ringDot: { position: 'absolute', left: 0, top: 0, width: 2, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  spoke: { position: 'absolute', left: 0, top: 0, width: 100, height: 1 },
  fact: { position: 'absolute', left: 0, top: 0, width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  factHalo: { position: 'absolute', width: 34, height: 34, borderRadius: 17, opacity: 0.32 },
  factCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  factRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.6, borderColor: '#FFFFFF' },
  body: { position: 'absolute', left: 0, top: 0, width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  haloOuter: { width: 112, height: 112, borderRadius: 56, opacity: 0.1 },
  haloInner: { width: 82, height: 82, borderRadius: 41, opacity: 0.2 },
  sphere: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
  sphereMain: { position: 'absolute', left: -4, top: -5, width: 58, height: 58, borderRadius: 29 },
  sphereShine: { position: 'absolute', left: 6, top: 5, width: 30, height: 30, borderRadius: 15, opacity: 0.55 },
  sphereSpec: { position: 'absolute', left: 13, top: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', opacity: 0.7 },
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  selectedRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#FFFFFF' },
  label: { position: 'absolute', left: 0, top: 0 },
  labelName: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontFamily: FontFamily.semibold },
  labelPercent: { color: 'rgba(255,255,255,0.62)', fontSize: 10, lineHeight: 13, fontFamily: FontFamily.medium },
});
