import { RecordsView } from '@/components/baby/records-view';
import { ThemedView } from '@/components/themed-view';

/** 우리 아기 기록 보기·고치기 (SPEC-MY-02 · SPEC-BABY-06) — 우리 아기 탭과 마이에서 들어온다 */
export default function RecordsScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <RecordsView />
    </ThemedView>
  );
}
