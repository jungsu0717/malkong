/**
 * 성장 탭 상세 시트 (SPEC-STAGE-02, task growth/004) — 발달 단계나 「이맘때」 한 줄을 누르면 열린다.
 * 내용은 승인된 공공 지식(L1) 본문 그대로이고, 맨 아래 출처 이름 한 줄. 「사회·정서: …」처럼 앞에 분류가 있는 줄은 분류를 굵게.
 */

import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { KnowledgeItem } from '@/data/l1';
import { useTheme } from '@/hooks/use-theme';

export function KnowledgeSheet({
  item,
  title,
  sub,
  action,
  onClose,
}: {
  item: KnowledgeItem | null;
  title: string;
  /** 제목 아래 코랄 한 줄 — 「대부분 6개월까지」 */
  sub?: string | null;
  /** 바닥 단추 위의 행동 — 「루틴에 추가」 */
  action?: { label: string; onPress: () => void } | null;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const lines = (item?.body ?? '').split('\n').filter((l) => l.trim());

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <View style={styles.head}>
            <ThemedText type="title">{title}</ThemedText>
            {sub ? (
              <ThemedText type="body" style={{ color: c.accentText, fontWeight: 700 }}>
                {sub}
              </ThemedText>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {lines.map((line, i) => {
              const m = /^([^:：]{1,8})[:：]\s*(.+)$/.exec(line);
              return (
                <ThemedText key={i} type="body" style={styles.line}>
                  {m ? (
                    <>
                      <ThemedText type="body" style={{ fontWeight: 700 }}>
                        {m[1]}
                      </ThemedText>
                      {`  ${m[2]}`}
                    </>
                  ) : (
                    line
                  )}
                </ThemedText>
              );
            })}
            {item && (
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {item.source.name}
              </ThemedText>
            )}
          </ScrollView>
          {action && <Button size="lg" label={action.label} onPress={action.onPress} />}
          <Button size="lg" variant={action ? 'secondary' : 'primary'} label="닫기" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.three, maxHeight: '86%' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { gap: 2 },
  body: { gap: 10, paddingBottom: Spacing.one },
  line: { lineHeight: 24 },
});
