/**
 * 성장 탭 상세 시트 (SPEC-STAGE-02, task growth/004) — 발달 단계나 「이맘때」 한 줄을 누르면 열린다.
 * 내용은 승인된 공공 지식(L1) 본문 그대로다. 「사회·정서: …」처럼 앞에 분류가 있는 줄은 분류를 굵게.
 * 출처는 화면에 쓰지 않고 「의학 정보 출처와 한계 고지」에 모은다(Julian, 2026-10-22). 개발 빌드의 승인 전 항목에는 「승인 전」 표시.
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
            {item && item.status !== 'approved' && <DraftTag />}
          </ScrollView>
          {action && <Button size="lg" label={action.label} onPress={action.onPress} />}
          <Button size="lg" variant={action ? 'secondary' : 'primary'} label="닫기" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** 개발 빌드에서만 보이는 승인 전 표시 */
export function DraftTag() {
  const c = useTheme();
  return (
    <View style={[styles.draft, { borderColor: c.border }]}>
      <ThemedText type="caption" style={{ color: c.textSecondary, fontWeight: 700, fontSize: 11 }}>
        승인 전
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  draft: { alignSelf: 'flex-start', height: 20, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: Spacing.three, maxHeight: '86%' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  head: { gap: 2 },
  body: { gap: 10, paddingBottom: Spacing.one },
  line: { lineHeight: 24 },
});
