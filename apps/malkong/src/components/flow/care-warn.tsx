/**
 * 기록의 위험 신호 고정 안내 (SPEC-LOG-04, 헌장 5) — 진단이 아니라 L1 위험 신호 항목 그대로다. 하루 흐름의 하루 시계 아래에 먼저 보인다.
 * 예전 기록 화면(log.tsx)에서 옮겼다(task today/012).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { latestOf } from '@/data/event-summary';
import type { CareEvent } from '@/data/events';
import { itemById } from '@/data/l1';
import { useTheme } from '@/hooks/use-theme';

const DAY = 24 * 60 * 60 * 1000;

/**
 * 기록이 위험 신호 기준에 닿았는가 — 기준은 L1 위험 신호 항목 그대로.
 * - 12시간 안의 마지막 체온: 40℃ 이상은 누구나(k-warn-0002), 3개월 미만은 38℃ 이상(k-warn-0001)
 * - 24시간 안에 빨간 변을 적었으면 피 섞인 변(k-warn-0008)
 */
export function careWarnings(events: CareEvent[], month: number | null, now: Date): string[] {
  const ids: string[] = [];
  const temp = latestOf(events, 'temp');
  if (temp && temp.amount !== null && now.getTime() - new Date(temp.startAt).getTime() <= 12 * 60 * 60 * 1000) {
    if (temp.amount >= 40) ids.push('k-warn-0002');
    else if (month !== null && month < 3 && temp.amount >= 38) ids.push('k-warn-0001');
  }
  const red = events.some((e) => e.kind === 'diaper' && e.color === 'red' && now.getTime() - new Date(e.startAt).getTime() <= DAY);
  if (red) ids.push('k-warn-0008');
  return ids;
}

export function WarnCard({ id }: { id: string }) {
  const c = useTheme();
  const item = itemById(id);
  if (!item) return null;
  return (
    <View style={[styles.warn, { backgroundColor: c.dangerSoft }]}>
      <View style={styles.warnHead}>
        <Ionicons name="warning" size={18} color={c.danger} />
        <ThemedText type="heading" style={{ color: c.danger }}>
          바로 진료가 필요할 수 있어요
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ fontWeight: 600 }}>
        {item.title}
      </ThemedText>
      <ThemedText type="small">{item.body}</ThemedText>
      <ExternalLink href={item.source.url as `https://${string}`}>
        <ThemedText type="caption" style={{ color: c.textSecondary, textDecorationLine: 'underline' }}>
          {item.source.name}
        </ThemedText>
      </ExternalLink>
    </View>
  );
}

const styles = StyleSheet.create({
  warn: { borderRadius: Radius.lg, padding: Spacing.three, gap: 6 },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
