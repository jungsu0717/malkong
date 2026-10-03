/**
 * 지식 지도 — 버디가 아는 우리 아기를 돌려 보는 3D 그래프 (SPEC-BABY-02, task baby/001).
 *
 * 가운데 아기, 둘레에 영역 행성 여섯, 행성 둘레에 「알아야 할 것」 점들. 아는 것은 밝게 채우고 모르는 것은 빈 고리.
 * 3D 엔진 없이 Skia 로 그린다 — 점마다 회전 · 원근 투영을 직접 계산하고(`project`), 깊이 순으로 그린다.
 * 그리기는 Reanimated 의 `useDerivedValue` 안에서 매 프레임 UI 스레드에서 한다(JS 스레드를 쓰지 않는다).
 *
 * 웹은 `knowledge-galaxy.web.tsx` 가 CanvasKit 을 불러온 뒤 이 파일을 연다.
 */

import {
  Canvas,
  createPicture,
  PaintStyle,
  Picture,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FontFamily } from '@/constants/theme';
import type { Domain, DomainId } from '@/data/knowledge-profile';

export type GalaxyProps = {
  domains: Domain[];
  /** 바뀔 때마다 등장 모션을 다시 — 그림판을 새로 만들지 않는다(그리는 도중에 지우면 앱이 꺼질 수 있다) */
  replay: number;
  /** 탭이 보일 때만 움직인다 — 안 보이는 동안 매 프레임 그리지 않게 */
  active: boolean;
  selected: DomainId | null;
  onSelect: (id: DomainId | null) => void;
  height: number;
  /** 가운데 아기 색 */
  coreColor: string;
};

type V3 = [number, number, number];

/** 카메라 거리 — 작을수록 원근이 세다 */
const CAMERA = 3.4;
const STAR_COUNT = 90;

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
function project(p: V3, yaw: number, pitch: number, cx: number, cy: number, focal: number) {
  'worklet';
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

export default function KnowledgeGalaxyCanvas({
  domains,
  replay,
  active,
  selected,
  onSelect,
  height,
  coreColor,
}: GalaxyProps) {
  const [width, setWidth] = useState(0);

  /** 그리다 오류가 났는지 — 한 번만 알린다 */
  const failed = useSharedValue(0);
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

  // 그림의 뼈대 — 영역 행성 자리, 행성마다 사실 점의 방향, 별. 데이터가 바뀔 때만 다시 만든다
  const scene = useMemo(() => {
    const planets = domains.map((d, i) => {
      const a = (i / domains.length) * Math.PI * 2;
      const pos: V3 = [Math.cos(a) * 1.05, i % 2 ? 0.26 : -0.2, Math.sin(a) * 1.05];
      const facts = d.facts.map((f, j) => {
        // 행성 둘레 작은 구 위에 고르게(황금각)
        const k = (j + 0.5) / d.facts.length;
        const phi = Math.acos(1 - 2 * k);
        const theta = Math.PI * (1 + Math.sqrt(5)) * j + i;
        return {
          dir: [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)] as V3,
          known: f.score >= 0.5,
          partial: f.score > 0 && f.score < 0.5,
        };
      });
      return {
        id: d.id,
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
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = 3 + rand() * 1.5;
      const s = Math.sqrt(1 - u * u);
      return { p: [s * Math.cos(t) * r, u * r, s * Math.sin(t) * r] as V3, tw: rand() * 6 };
    });
    return { planets, stars };
  }, [domains]);

  const selectedIndex = scene.planets.findIndex((p) => p.id === selected);
  const core = useMemo(
    () => ({ color: coreColor, light: shade(coreColor, 0.5), dark: shade(coreColor, -0.4) }),
    [coreColor],
  );

  const picture = useDerivedValue(() => {
    const w = width;
    const h = height;
    try {
    const pic = createPicture(
      (canvas) => {
        if (!w) return;
        const cx = w / 2;
        const cy = h / 2 + 6;
        const focal = Math.min(w, h) * 1.05;
        const t = time.value;
        const k = intro.value;
        const yaw = autoYaw.value + dragYaw.value;
        const pt = pitch.value;

        const fill = Skia.Paint();
        fill.setAntiAlias(true);
        /** 구처럼 보이는 그라디언트 전용 — 그라디언트를 걷어 낼 일이 없게 따로 둔다 */
        const sphere = Skia.Paint();
        sphere.setAntiAlias(true);
        const glow = Skia.Paint();
        glow.setAntiAlias(true);
        /** 빛 번짐 — 흐림 필터 대신 가장자리로 갈수록 투명해지는 원(가볍고 모든 기기에서 같다) */
        const halo = (x: number, y: number, r: number, color: string, alpha: number) => {
          const c = Skia.Color(color);
          glow.setShader(
            Skia.Shader.MakeRadialGradient(
              { x, y },
              r,
              [Float32Array.of(c[0], c[1], c[2], alpha), Float32Array.of(c[0], c[1], c[2], 0)],
              null,
              TileMode.Clamp,
            ),
          );
          canvas.drawCircle(x, y, r, glow);
        };
        const stroke = Skia.Paint();
        stroke.setAntiAlias(true);
        stroke.setStyle(PaintStyle.Stroke);

        // 우주 바탕
        const bg = Skia.Paint();
        bg.setShader(
          Skia.Shader.MakeRadialGradient(
            { x: cx, y: cy },
            Math.max(w, h) * 0.75,
            [Skia.Color('#221A26'), Skia.Color('#0B0B10')],
            null,
            TileMode.Clamp,
          ),
        );
        canvas.drawRect(Skia.XYWHRect(0, 0, w, h), bg);

        // 별 — 깊이와 반짝임
        for (let i = 0; i < scene.stars.length; i++) {
          const s = scene.stars[i];
          const q = project(s.p, yaw * 0.35, pt * 0.5, cx, cy, focal);
          if (q.depth <= 0.2) continue;
          const tw = 0.35 + 0.35 * Math.sin(t * 1.6 + s.tw);
          fill.setColor(Skia.Color('#FFFFFF'));
          fill.setAlphaf(Math.max(0, Math.min(1, tw * k)));
          canvas.drawCircle(q.x, q.y, Math.max(0.5, q.scale * 0.012), fill);
        }

        // 궤도 고리
        const ring = Skia.PathBuilder.Make();
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          const q = project([Math.cos(a) * 1.05 * k, 0.03, Math.sin(a) * 1.05 * k], yaw, pt, cx, cy, focal);
          if (i === 0) ring.moveTo(q.x, q.y);
          else ring.lineTo(q.x, q.y);
        }
        stroke.setColor(Skia.Color('#FFFFFF'));
        stroke.setAlphaf(0.09);
        stroke.setStrokeWidth(1);
        canvas.drawPath(ring.detach(), stroke);

        // 그릴 것들을 깊이 순으로 — 먼 것부터
        type Item = { depth: number; kind: number; i: number; j: number };
        const items: Item[] = [{ depth: CAMERA, kind: 0, i: 0, j: 0 }];
        const placed: { x: number; y: number; scale: number; depth: number }[] = [];
        for (let i = 0; i < scene.planets.length; i++) {
          const pl = scene.planets[i];
          const pos: V3 = [pl.pos[0] * k, pl.pos[1] * k, pl.pos[2] * k];
          const q = project(pos, yaw, pt, cx, cy, focal);
          placed.push(q);
          items.push({ depth: q.depth, kind: 1, i, j: 0 });
        }
        items.sort((a, b) => b.depth - a.depth);

        const coreQ = project([0, 0, 0], yaw, pt, cx, cy, focal);

        for (let n = 0; n < items.length; n++) {
          const it = items[n];
          if (it.kind === 0) {
            // 가운데 아기 — 숨 쉬는 빛
            const pulse = 1 + 0.06 * Math.sin(t * 2.2);
            const r = coreQ.scale * 0.15 * pulse * (0.4 + 0.6 * k);
            halo(coreQ.x, coreQ.y, r * 2.4, core.color, 0.55);
            sphere.setAlphaf(1);
            sphere.setShader(
              Skia.Shader.MakeRadialGradient(
                { x: coreQ.x - r * 0.35, y: coreQ.y - r * 0.4 },
                r * 1.4,
                [Skia.Color(core.light), Skia.Color(core.color), Skia.Color(core.dark)],
                [0, 0.55, 1],
                TileMode.Clamp,
              ),
            );
            canvas.drawCircle(coreQ.x, coreQ.y, r, sphere);
            // 쪽쪽이 문 얼굴
            fill.setColor(Skia.Color('#FFFFFF'));
            fill.setAlphaf(0.95 * k);
            canvas.drawCircle(coreQ.x - r * 0.32, coreQ.y - r * 0.12, r * 0.09, fill);
            canvas.drawCircle(coreQ.x + r * 0.32, coreQ.y - r * 0.12, r * 0.09, fill);
            stroke.setColor(Skia.Color('#FFFFFF'));
            stroke.setAlphaf(0.95 * k);
            stroke.setStrokeWidth(Math.max(1, r * 0.08));
            canvas.drawCircle(coreQ.x, coreQ.y + r * 0.32, r * 0.2, stroke);
            continue;
          }

          const pl = scene.planets[it.i];
          const q = placed[it.i];
          const near = Math.max(0.35, Math.min(1, (CAMERA + 1.3 - q.depth) / 2.2));
          const bright = (0.35 + 0.65 * pl.score) * near * k;
          const r = q.scale * (0.07 + 0.075 * pl.score) * (0.3 + 0.7 * k);

          // 아기와 잇는 선
          stroke.setColor(Skia.Color(pl.color));
          stroke.setAlphaf(0.28 * bright);
          stroke.setStrokeWidth(1);
          canvas.drawLine(coreQ.x, coreQ.y, q.x, q.y, stroke);

          // 사실 점 — 행성 둘레를 돈다. 아는 것은 채우고 모르는 것은 빈 고리
          const spin = t * 0.5 + it.i;
          const cosS = Math.cos(spin);
          const sinS = Math.sin(spin);
          for (let j = 0; j < pl.facts.length; j++) {
            const f = pl.facts[j];
            const orbit = 0.2 + 0.05 * (j % 2);
            const dx = f.dir[0] * cosS + f.dir[2] * sinS;
            const dz = -f.dir[0] * sinS + f.dir[2] * cosS;
            const fp: V3 = [
              (pl.pos[0] + dx * orbit) * k,
              (pl.pos[1] + f.dir[1] * orbit) * k,
              (pl.pos[2] + dz * orbit) * k,
            ];
            const fq = project(fp, yaw, pt, cx, cy, focal);
            const fr = Math.max(1.5, fq.scale * 0.022);
            stroke.setColor(Skia.Color(pl.light));
            stroke.setAlphaf(0.18 * k);
            stroke.setStrokeWidth(0.8);
            canvas.drawLine(q.x, q.y, fq.x, fq.y, stroke);
            if (f.known || f.partial) {
              halo(fq.x, fq.y, fr * 3, pl.light, 0.7 * k);
              fill.setColor(Skia.Color('#FFFFFF'));
              fill.setAlphaf((f.known ? 1 : 0.6) * k);
              canvas.drawCircle(fq.x, fq.y, fr, fill);
            } else {
              stroke.setColor(Skia.Color('#FFFFFF'));
              stroke.setAlphaf(0.45 * k);
              stroke.setStrokeWidth(1);
              canvas.drawCircle(fq.x, fq.y, fr, stroke);
            }
          }

          // 행성 — 빛 번짐 + 구처럼 보이는 그라디언트
          halo(q.x, q.y, r * 2.3, pl.color, 0.6 * bright);
          sphere.setAlphaf(Math.min(1, 0.45 + bright));
          sphere.setShader(
            Skia.Shader.MakeRadialGradient(
              { x: q.x - r * 0.35, y: q.y - r * 0.4 },
              r * 1.4,
              [Skia.Color(pl.light), Skia.Color(pl.color), Skia.Color(pl.dark)],
              [0, 0.5, 1],
              TileMode.Clamp,
            ),
          );
          canvas.drawCircle(q.x, q.y, r, sphere);

          if (it.i === selectedIndex) {
            stroke.setColor(Skia.Color('#FFFFFF'));
            stroke.setAlphaf(0.9);
            stroke.setStrokeWidth(1.5);
            canvas.drawCircle(q.x, q.y, r + 6 + Math.sin(t * 4) * 1.5, stroke);
          }
        }
      },
      { width: w, height: h },
    );
    return pic;
    } catch (e) {
      // 그리다 오류가 나도 앱을 끄지 않고 빈 그림을 낸다 — 개발 중에는 한 번 알린다
      if (__DEV__ && !failed.value) {
        console.warn('[지식 지도] 그리지 못함', String(e));
        failed.value = 1;
      }
      return createPicture(() => {}, { width: 1, height: 1 });
    }
  }, [width, height, scene, selectedIndex, core]);

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
    const cx = width / 2;
    const cy = height / 2 + 6;
    const focal = Math.min(width, height) * 1.05;
    const yaw = autoYaw.get() + dragYaw.get();
    let best: { id: DomainId; d: number } | null = null;
    for (const pl of scene.planets) {
      const q = project(pl.pos, yaw, pitch.get(), cx, cy, focal);
      const d = Math.hypot(q.x - x, q.y - y);
      const r = q.scale * (0.07 + 0.075 * pl.score) + 18;
      if (d < r && (!best || d < best.d)) best = { id: pl.id, d };
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
          <Canvas style={{ width, height }}>
            <Picture picture={picture} />
          </Canvas>
        )}
        {width > 0 &&
          scene.planets.map((pl) => (
            <PlanetLabel
              key={pl.id}
              name={pl.name}
              percent={pl.percent}
              pos={pl.pos}
              score={pl.score}
              width={width}
              height={height}
              intro={intro}
              yaw={autoYaw}
              dragYaw={dragYaw}
              pitch={pitch}
            />
          ))}
      </View>
    </GestureDetector>
  );
}

/**
 * 행성 이름과 아는 정도 — 그림판(Skia)에 글씨를 쓰면 아이폰에서 앱이 꺼져서(글꼴을 UI 스레드로 넘길 때),
 * 앱의 글씨를 행성 옆에 띄우고 같은 투영 계산으로 UI 스레드에서 따라다니게 한다.
 */
function PlanetLabel({
  name,
  percent,
  pos,
  score,
  width,
  height,
  intro,
  yaw,
  dragYaw,
  pitch,
}: {
  name: string;
  percent: number;
  pos: V3;
  score: number;
  width: number;
  height: number;
  intro: SharedValue<number>;
  yaw: SharedValue<number>;
  dragYaw: SharedValue<number>;
  pitch: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const k = intro.value;
    const q = project(
      [pos[0] * k, pos[1] * k, pos[2] * k],
      yaw.value + dragYaw.value,
      pitch.value,
      width / 2,
      height / 2 + 6,
      Math.min(width, height) * 1.05,
    );
    const r = q.scale * (0.07 + 0.075 * score) * (0.3 + 0.7 * k);
    const near = Math.max(0.35, Math.min(1, (CAMERA + 1.3 - q.depth) / 2.2));
    return {
      opacity: Math.min(1, 0.3 + near) * k,
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

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: { position: 'absolute', left: 0, top: 0 },
  labelName: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontFamily: FontFamily.semibold },
  labelPercent: { color: 'rgba(255,255,255,0.62)', fontSize: 10, lineHeight: 13, fontFamily: FontFamily.medium },
});
