/** 지식 지도 — 앱(iOS·Android)은 Skia 가 이미 있으니 바로 그린다. 웹은 knowledge-galaxy.web.tsx */
import KnowledgeGalaxyCanvas, { type GalaxyProps } from '@/components/knowledge-galaxy-canvas';

export function KnowledgeGalaxy(props: GalaxyProps) {
  return <KnowledgeGalaxyCanvas {...props} />;
}
