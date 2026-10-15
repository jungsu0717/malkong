/**
 * 행성 그림 — 주제별 할 일을 한눈에 (SPEC-TOPIC-10, task topic/002).
 *
 * 가운데 아기, 둘레에 주제 행성, 행성 둘레에 이번 달 할 일 점(완료는 채운 점, 남은 것은 빈 고리), 반복 할 일은 행성을 도는 작은 위성.
 * 이번 달 할 일이 많은 주제일수록 행성이 크다. 행성을 누르면 그 주제로, 옆으로 끌면 돈다(위아래로 끌면 화면이 스크롤된다).
 *
 * 예전 우리 아기 탭의 지식 지도(git 9c8b1be~1 `knowledge-galaxy.tsx`)를 가져왔다. 3D 엔진 없이 점마다 회전 · 원근 투영을
 * 직접 계산(`project`)해 기본 화면 요소(View)를 Reanimated 로 UI 스레드에서 움직인다. Skia 그림판은 아이폰(Expo Go)에서
 * 앱이 꺼지는 일이 되풀이돼 쓰지 않는다(task baby/001). 웹에서도 같은 코드로 그려진다.
 */

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { FontFamily } from '@/constants/theme';

export type GalaxyPlanet = {
  id: string;
  name: string;
  color: string;
  /** 0~1 — 이번 달 할 일이 많을수록 크다 */
  size: number;
  /** 이번 달 할 일 — 완료는 채운 점, 남은 것은 빈 고리 */
  dots: { key: string; done: boolean }[];
  /** 반복 할 일 수 — 행성을 도는 위성 */
  moons: number;
};

export type GalaxyProps = {
  planets: GalaxyPlanet[];
  /** 바뀔 때마다 등장 모션을 다시 */
  replay: number;
  /** 탭이 보일 때만 움직인다 — 안 보이는 동안 매 프레임 계산하지 않게 */
  active: boolean;
  onSelect: (id: string) => void;
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
};

/** 카메라 거리 — 작을수록 원근이 세다 */
const CAMERA = 3.4;
/** 위에서 내려다보는 각 — 납작한 카드에 맞게 예전(-0.42)보다 얕게 */
const PITCH = -0.34;
const STAR_COUNT = 36;
const RING_DOTS = 40;
const ORBIT = 1.05;
/** 위성이 도는 거리 — 할 일 점보다 바깥 */
const MOON_ORBIT = 0.33;
/** 행성 하나에 그리는 위성 수 */
export const MAX_MOONS = 3;

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

/** 회전(가로 yaw · 세로 PITCH) 뒤 원근 투영 — 화면 좌표, 크기 배율, 깊이(클수록 멀다) */
function project(p: V3, yaw: number, width: number, height: number) {
  'worklet';
  const cx = width / 2;
  const cy = height * 0.57;
  // 납작하고 넓은 카드 — 가로를 넉넉히 쓰되 위아래로 넘치지 않게
  const focal = Math.min(width * 1.12, height * 1.7);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = p[0] * cosY + p[2] * sinY;
  const z1 = -p[0] * sinY + p[2] * cosY;
  const cosX = Math.cos(PITCH);
  const sinX = Math.sin(PITCH);
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

function planetRadius(scale: number, size: number, k: number) {
  'worklet';
  return scale * (0.055 + 0.07 * size) * (0.3 + 0.7 * k);
}

/** 할 일 점의 3D 자리 — 행성 둘레를 돈다 */
function dotPos(planet: V3, dir: V3, index: number, j: number, t: number, k: number): V3 {
  'worklet';
  const spin = t * 0.5 + index;
  const cosS = Math.cos(spin);
  const sinS = Math.sin(spin);
  const orbit = 0.2 + 0.04 * (j % 2);
  const dx = dir[0] * cosS + dir[2] * sinS;
  const dz = -dir[0] * sinS + dir[2] * cosS;
  return [(planet[0] + dx * orbit) * k, (planet[1] + dir[1] * orbit) * k, (planet[2] + dz * orbit) * k];
}

/** 위성의 3D 자리 — 행성을 기울어진 고리로 돈다 */
function moonPos(planet: V3, index: number, j: number, count: number, t: number, k: number): V3 {
  'worklet';
  const a = t * 0.9 + index * 1.7 + (j / count) * Math.PI * 2;
  return [
    (planet[0] + Math.cos(a) * MOON_ORBIT) * k,
    (planet[1] + Math.sin(a) * MOON_ORBIT * 0.35) * k,
    (planet[2] + Math.sin(a) * MOON_ORBIT) * k,
  ];
}

function Galaxy({ planets, replay, active, onSelect, height, coreColor }: GalaxyProps) {
  const [width, setWidth] = useState(0);
  const time = useSharedValue(0);
  const intro = useSharedValue(0);
  const dragYaw = useSharedValue(0);
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
    intro.set(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [intro, replay]);

  // 뼈대 — 행성 자리, 행성마다 할 일 점의 방향, 별. 데이터가 바뀔 때만 다시 만든다
  const scene = useMemo(() => {
    const placed = planets.map((p, i) => {
      const a = (i / planets.length) * Math.PI * 2;
      const pos: V3 = [Math.cos(a) * ORBIT, i % 2 ? 0.2 : -0.16, Math.sin(a) * ORBIT];
      const dots = p.dots.map((d, j) => {
        // 행성 둘레 작은 구 위에 고르게(황금각)
        const kk = (j + 0.5) / p.dots.length;
        const phi = Math.acos(1 - 2 * kk);
        const theta = Math.PI * (1 + Math.sqrt(5)) * j + i;
        return {
          key: d.key,
          dir: [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)] as V3,
          done: d.done,
        };
      });
      return {
        id: p.id,
        index: i,
        name: p.name,
        size: p.size,
        pos,
        color: p.color,
        light: shade(p.color, 0.55),
        dark: shade(p.color, -0.45),
        dots,
        moons: Math.min(MAX_MOONS, p.moons),
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
    return { planets: placed, stars };
  }, [planets]);

  const cam: Cam = { width, height, time, intro, yaw: autoYaw, dragYaw };

  // 옆으로 끌어 돌리기 — 위아래로 끌면 실패시켜 화면 스크롤에 넘긴다
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      dragging.set(1);
    })
    .onChange((e) => {
      dragYaw.set(dragYaw.get() + e.changeX * 0.008);
    })
    .onFinalize(() => {
      dragging.set(0);
    });

  // 눌러서 고르기 — 지금 화면에 그려진 행성 자리에서 가장 가까운 것
  const pick = (x: number, y: number) => {
    if (!width) return;
    const yaw = autoYaw.get() + dragYaw.get();
    let best: { id: string; d: number } | null = null;
    for (const pl of scene.planets) {
      const q = project(pl.pos, yaw, width, height);
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < planetRadius(q.scale, pl.size, 1) + 22 && (!best || d < best.d)) best = { id: pl.id, d };
    }
    if (best) onSelect(best.id);
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
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    left: width / 2 - size / 2,
                    top: height * 0.57 - size / 2,
                    opacity: 0.1 + i * 0.05,
                  },
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
              <Spoke key={pl.id} pos={pl.pos} size={pl.size} color={pl.color} cam={cam} />
            ))}
            {scene.planets.map((pl) =>
              pl.dots.map((d, j) => (
                <TodoDot
                  key={`${pl.id}-${d.key}`}
                  planet={pl.pos}
                  dir={d.dir}
                  index={pl.index}
                  j={j}
                  done={d.done}
                  light={pl.light}
                  cam={cam}
                />
              )),
            )}
            <Core color={coreColor} cam={cam} />
            {scene.planets.map((pl) => (
              <Planet key={pl.id} pos={pl.pos} size={pl.size} color={pl.color} light={pl.light} dark={pl.dark} cam={cam} />
            ))}
            {scene.planets.map((pl) =>
              Array.from({ length: pl.moons }, (_, j) => (
                <Moon key={`${pl.id}-moon-${j}`} planet={pl.pos} index={pl.index} j={j} count={pl.moons} light={pl.light} cam={cam} />
              )),
            )}
            {scene.planets.map((pl) => (
              <PlanetLabel key={pl.id} name={pl.name} pos={pl.pos} size={pl.size} cam={cam} />
            ))}
          </>
        )}
      </View>
    </GestureDetector>
  );
}

function Star({ p, tw, cam }: { p: V3; tw: number; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const q = project(p, (cam.yaw.value + cam.dragYaw.value) * 0.35, cam.width, cam.height);
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
      [Math.cos(angle) * ORBIT * k, 0.02, Math.sin(angle) * ORBIT * k],
      cam.yaw.value + cam.dragYaw.value,
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
function Spoke({ pos, size, color, cam }: { pos: V3; size: number; color: string; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const yaw = cam.yaw.value + cam.dragYaw.value;
    const a = project([0, 0, 0], yaw, cam.width, cam.height);
    const b = project([pos[0] * k, pos[1] * k, pos[2] * k], yaw, cam.width, cam.height);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
    const bright = (0.35 + 0.65 * size) * nearness(b.depth) * k;
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

/** 이번 달 할 일 하나 — 완료는 빛나는 점, 남은 것은 빈 고리 */
function TodoDot({
  planet,
  dir,
  index,
  j,
  done,
  light,
  cam,
}: {
  planet: V3;
  dir: V3;
  index: number;
  j: number;
  done: boolean;
  light: string;
  cam: Cam;
}) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project(dotPos(planet, dir, index, j, cam.time.value, k), cam.yaw.value + cam.dragYaw.value, cam.width, cam.height);
    const r = Math.max(1.6, q.scale * 0.022);
    return {
      opacity: (done ? 1 : 0.6) * k * (0.5 + 0.5 * nearness(q.depth)),
      transform: [{ translateX: q.x - 6 }, { translateY: q.y - 6 }, { scale: r / 6 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.dot, style]}>
      {done ? (
        <>
          <View style={[styles.dotHalo, { backgroundColor: light }]} />
          <View style={styles.dotCore} />
        </>
      ) : (
        <View style={styles.dotRing} />
      )}
    </Animated.View>
  );
}

/** 반복 할 일 하나 — 행성을 도는 작은 위성 */
function Moon({ planet, index, j, count, light, cam }: { planet: V3; index: number; j: number; count: number; light: string; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project(moonPos(planet, index, j, count, cam.time.value, k), cam.yaw.value + cam.dragYaw.value, cam.width, cam.height);
    const r = Math.max(2.4, q.scale * 0.03);
    return {
      opacity: k * (0.55 + 0.45 * nearness(q.depth)),
      transform: [{ translateX: q.x - 6 }, { translateY: q.y - 6 }, { scale: r / 6 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.dot, style]}>
      <View style={[styles.moon, { backgroundColor: light }]} />
    </Animated.View>
  );
}

/** 가운데 아기 — 숨 쉬는 빛과 버디 얼굴 */
function Core({ color, cam }: { color: string; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project([0, 0, 0], cam.yaw.value + cam.dragYaw.value, cam.width, cam.height);
    const pulse = 1 + 0.06 * Math.sin(cam.time.value * 2.2);
    const r = q.scale * 0.14 * pulse * (0.4 + 0.6 * k);
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

function Planet({ pos, size, color, light, dark, cam }: { pos: V3; size: number; color: string; light: string; dark: string; cam: Cam }) {
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project([pos[0] * k, pos[1] * k, pos[2] * k], cam.yaw.value + cam.dragYaw.value, cam.width, cam.height);
    const r = planetRadius(q.scale, size, k);
    const bright = (0.45 + 0.55 * size) * nearness(q.depth) * k;
    return {
      opacity: Math.min(1, 0.45 + bright),
      transform: [{ translateX: q.x - 30 }, { translateY: q.y - 30 }, { scale: r / 30 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.body, style]}>
      <View style={[styles.halo, styles.haloOuter, { backgroundColor: color, opacity: 0.06 + 0.08 * size }]} />
      <View style={[styles.halo, styles.haloInner, { backgroundColor: color, opacity: 0.12 + 0.12 * size }]} />
      <Sphere color={color} light={light} dark={dark} />
    </Animated.View>
  );
}

/** 이름 글자 너비 어림(11px 글씨) — 오른쪽 끝에서 이름을 행성 왼쪽으로 옮길 때 쓴다. 한글 11, 빈칸 3, 가운뎃점 4, 그 밖 7 */
const labelWidth = (name: string) =>
  [...name].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 11 : ch === ' ' ? 3 : ch === '·' ? 4 : 7), 2);

/** 행성 이름 — 같은 투영 계산으로 행성 옆을 따라다닌다. 카드 오른쪽에 가면 잘리지 않게 행성 왼쪽에 붙는다 */
function PlanetLabel({ name, pos, size, cam }: { name: string; pos: V3; size: number; cam: Cam }) {
  const w = labelWidth(name);
  const style = useAnimatedStyle(() => {
    const k = cam.intro.value;
    const q = project([pos[0] * k, pos[1] * k, pos[2] * k], cam.yaw.value + cam.dragYaw.value, cam.width, cam.height);
    const r = planetRadius(q.scale, size, k);
    const right = q.x + r + 5 + w > cam.width - 6;
    return {
      opacity: Math.min(1, 0.15 + nearness(q.depth)) * k,
      transform: [{ translateX: right ? q.x - r - 5 - w : q.x + r + 5 }, { translateY: q.y - 8 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.label, { width: w }, style]}>
      <Text style={styles.labelName} numberOfLines={1}>
        {name}
      </Text>
    </Animated.View>
  );
}

/** 그림에서 오류가 나도 탭 전체가 깨지지 않게 — 그림 자리에 한 줄만 남긴다 */
class GalaxyBoundary extends Component<{ height: number; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={[styles.fallback, { height: this.props.height }]}>
        <Text style={styles.fallbackText}>그림을 불러오지 못했어요</Text>
      </View>
    );
  }
}

export function TopicGalaxy(props: GalaxyProps) {
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
  dot: { position: 'absolute', left: 0, top: 0, width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 34, height: 34, borderRadius: 17, opacity: 0.32 },
  dotCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  dotRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.6, borderColor: '#FFFFFF' },
  moon: { width: 12, height: 12, borderRadius: 6 },
  body: { position: 'absolute', left: 0, top: 0, width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  haloOuter: { width: 112, height: 112, borderRadius: 56, opacity: 0.1 },
  haloInner: { width: 82, height: 82, borderRadius: 41, opacity: 0.2 },
  sphere: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden' },
  sphereMain: { position: 'absolute', left: -4, top: -5, width: 58, height: 58, borderRadius: 29 },
  sphereShine: { position: 'absolute', left: 6, top: 5, width: 30, height: 30, borderRadius: 15, opacity: 0.55 },
  sphereSpec: { position: 'absolute', left: 13, top: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', opacity: 0.7 },
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', left: 0, top: 0 },
  labelName: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontFamily: FontFamily.semibold },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
