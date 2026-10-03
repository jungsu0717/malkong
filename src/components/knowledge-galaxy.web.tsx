/**
 * 지식 지도 — 웹 미리보기. Skia 의 웹 엔진(CanvasKit)을 먼저 불러온 뒤 같은 그림 파일을 연다.
 * CanvasKit 은 저장소에 싣지 않고(약 7MB) CDN 에서 받는다 — 웹은 검토용이라 출시 앱과 상관없다.
 */
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { View } from 'react-native';

import type { GalaxyProps } from '@/components/knowledge-galaxy-canvas';
import { GalaxyBoundary } from '@/components/galaxy-boundary';

const CANVASKIT = 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/';

export function KnowledgeGalaxy(props: GalaxyProps) {
  return (
    <GalaxyBoundary height={props.height}>
    <WithSkiaWeb
      getComponent={() => import('@/components/knowledge-galaxy-canvas')}
      fallback={<View style={{ height: props.height, backgroundColor: '#0B0B10' }} />}
      opts={{ locateFile: (file: string) => `${CANVASKIT}${file}` }}
      componentProps={props}
    />
    </GalaxyBoundary>
  );
}
