import { KnowledgeView } from '@/components/baby/knowledge-view';
import { ThemedView } from '@/components/themed-view';

/** 버디가 아는 것 — 영역별 사실과 함께한 시간 (SPEC-BABY-01 · 04 · 05). 우리 아기 탭에서 들어온다 */
export default function KnowledgeScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <KnowledgeView />
    </ThemedView>
  );
}
